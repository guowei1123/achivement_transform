from typing import List, Dict, Any, Optional
import numpy as np
from datetime import datetime

class MatchingRecommendationEngine:
    def __init__(self, data_preprocessor, gnn_aligner, semantic_encoder, 
                 vector_db, score_fusion, rule_filter, online_learning):
        self.data_preprocessor = data_preprocessor
        self.gnn_aligner = gnn_aligner
        self.semantic_encoder = semantic_encoder
        self.vector_db = vector_db
        self.score_fusion = score_fusion
        self.rule_filter = rule_filter
        self.online_learning = online_learning
    
    def generate_recommendations(self, demand: Dict[str, Any], 
                             top_k: int = 10) -> List[Dict[str, Any]]:
        processed_demand = self.data_preprocessor.preprocess_enterprise_demand(demand)
        
        demand_embedding = self.semantic_encoder.encode_text(processed_demand['normalized_text'])
        
        candidate_achievements = self.vector_db.search_similar_achievements(
            demand_embedding, top_k=50
        )
        
        if not candidate_achievements:
            return []
        
        structural_scores = []
        semantic_scores = []
        
        for achievement in candidate_achievements:
            processed_achievement = self.data_preprocessor.preprocess_school_achievement(achievement)
            
            alignment = self.data_preprocessor.align_entities(
                processed_demand, processed_achievement
            )
            
            structural_scores.append(alignment['alignment_score'])
            semantic_scores.append(achievement.get('semantic_similarity', 0))
        
        structural_scores = np.array(structural_scores)
        semantic_scores = np.array(semantic_scores)
        
        fused_results = self.score_fusion.fuse_with_metadata(
            structural_scores, semantic_scores, candidate_achievements
        )
        
        filtered_results = self.rule_filter.apply_all_constraints(
            processed_demand, fused_results
        )
        
        ranked_results = self.rule_filter.rank_by_constraints(
            processed_demand, filtered_results
        )
        
        final_ranked = self.score_fusion.rank_by_fused_score(
            ranked_results, top_k
        )
        
        recommendations = []
        for i, result in enumerate(final_ranked):
            recommendation = self._format_recommendation(
                processed_demand, result, i + 1
            )
            recommendations.append(recommendation)
        
        return recommendations
    
    def _format_recommendation(self, demand: Dict[str, Any], 
                             achievement: Dict[str, Any], 
                             rank: int) -> Dict[str, Any]:
        recommendation = {
            'rank': rank,
            'achievement': {
                'id': achievement.get('id', ''),
                'name': achievement.get('label', ''),
                'type': achievement.get('type', 'Patent'),
                'university': achievement.get('team', ''),
                'patent_number': achievement.get('patent_number', ''),
                'tech_field': achievement.get('tech_field', ''),
                'trl_level': achievement.get('trl_level', 3)
            },
            'matching_scores': {
                'structural_score': achievement.get('structural_score', 0),
                'semantic_score': achievement.get('semantic_score', 0),
                'fused_score': achievement.get('fused_score', 0),
                'constraint_score': achievement.get('constraint_score', 0)
            },
            'matching_path': self._generate_matching_path(demand, achievement),
            'recommendation_reason': self._generate_recommendation_reason(demand, achievement),
            'contact_info': self._get_contact_info(achievement),
            'additional_info': {
                'transferable': achievement.get('transferable', True),
                'cooperation_modes': achievement.get('cooperation_modes', []),
                'keywords': achievement.get('keywords', [])
            }
        }
        
        return recommendation
    
    def _generate_matching_path(self, demand: Dict[str, Any], 
                               achievement: Dict[str, Any]) -> List[str]:
        path = []
        
        path.append(f"需求: {demand.get('label', '')}")
        
        tech_field = achievement.get('tech_field', '')
        if tech_field:
            path.append(f"技术领域: {tech_field}")
        
        keywords = achievement.get('keywords', [])
        if keywords:
            path.append(f"技术关键词: {', '.join(keywords[:3])}")
        
        path.append(f"成果: {achievement.get('label', '')}")
        
        return path
    
    def _generate_recommendation_reason(self, demand: Dict[str, Any], 
                                     achievement: Dict[str, Any]) -> str:
        reasons = []
        
        structural_score = achievement.get('structural_score', 0)
        semantic_score = achievement.get('semantic_score', 0)
        fused_score = achievement.get('fused_score', 0)
        
        if fused_score > 0.8:
            reasons.append("该成果与技术需求高度匹配")
        elif fused_score > 0.6:
            reasons.append("该成果与技术需求匹配度较高")
        else:
            reasons.append("该成果与技术需求基本匹配")
        
        if structural_score > 0.7:
            reasons.append("图谱结构关联性强")
        
        if semantic_score > 0.7:
            reasons.append("文本语义相似度高")
        
        trl_level = achievement.get('trl_level', 3)
        demand_trl = demand.get('trl_level', 5)
        
        if abs(trl_level - demand_trl) <= 1:
            reasons.append(f"TRL成熟度匹配(需求TRL{demand_trl}, 成果TRL{trl_level})")
        
        if achievement.get('patent_number'):
            reasons.append("拥有专利保护")
        
        if achievement.get('transferable'):
            reasons.append("支持技术转让")
        
        cooperation_modes = achievement.get('cooperation_modes', [])
        if cooperation_modes:
            reasons.append(f"支持{', '.join(cooperation_modes)}等合作模式")
        
        return '; '.join(reasons)
    
    def _get_contact_info(self, achievement: Dict[str, Any]) -> Dict[str, str]:
        return {
            'team': achievement.get('team', ''),
            'contact_person': achievement.get('contact_person', ''),
            'email': achievement.get('email', ''),
            'phone': achievement.get('phone', ''),
            'university': achievement.get('university', '')
        }
    
    def batch_generate_recommendations(self, demands: List[Dict[str, Any]], 
                                    top_k: int = 10) -> Dict[str, List[Dict[str, Any]]]:
        results = {}
        
        for demand in demands:
            demand_id = demand.get('id', 'unknown')
            recommendations = self.generate_recommendations(demand, top_k)
            results[demand_id] = recommendations
        
        return results
    
    def generate_summary_report(self, demand: Dict[str, Any], 
                             recommendations: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not recommendations:
            return {
                'demand_id': demand.get('id', ''),
                'demand_label': demand.get('label', ''),
                'total_recommendations': 0,
                'message': '未找到匹配的科技成果'
            }
        
        scores = [rec['matching_scores']['fused_score'] for rec in recommendations]
        
        summary = {
            'demand_id': demand.get('id', ''),
            'demand_label': demand.get('label', ''),
            'total_recommendations': len(recommendations),
            'score_statistics': {
                'max_score': float(np.max(scores)),
                'min_score': float(np.min(scores)),
                'avg_score': float(np.mean(scores)),
                'median_score': float(np.median(scores))
            },
            'top_recommendation': recommendations[0] if recommendations else None,
            'recommendation_distribution': self._analyze_distribution(recommendations),
            'generated_at': datetime.now().isoformat()
        }
        
        return summary
    
    def _analyze_distribution(self, recommendations: List[Dict[str, Any]]) -> Dict[str, Any]:
        tech_fields = {}
        types = {}
        trl_levels = {}
        
        for rec in recommendations:
            tech_field = rec['achievement']['tech_field']
            tech_fields[tech_field] = tech_fields.get(tech_field, 0) + 1
            
            achievement_type = rec['achievement']['type']
            types[achievement_type] = types.get(achievement_type, 0) + 1
            
            trl = rec['achievement']['trl_level']
            trl_levels[trl] = trl_levels.get(trl, 0) + 1
        
        return {
            'tech_fields': tech_fields,
            'achievement_types': types,
            'trl_levels': trl_levels
        }
    
    def export_recommendations(self, recommendations: List[Dict[str, Any]], 
                           format: str = 'json') -> str:
        if format == 'json':
            import json
            return json.dumps(recommendations, ensure_ascii=False, indent=2)
        elif format == 'csv':
            import csv
            import io
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            writer.writerow([
                '排名', '成果名称', '所属高校', '专利号', '技术领域',
                '结构得分', '语义得分', '综合得分', '推荐理由'
            ])
            
            for rec in recommendations:
                writer.writerow([
                    rec['rank'],
                    rec['achievement']['name'],
                    rec['achievement']['university'],
                    rec['achievement']['patent_number'],
                    rec['achievement']['tech_field'],
                    f"{rec['matching_scores']['structural_score']:.3f}",
                    f"{rec['matching_scores']['semantic_score']:.3f}",
                    f"{rec['matching_scores']['fused_score']:.3f}",
                    rec['recommendation_reason']
                ])
            
            return output.getvalue()
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def record_user_feedback(self, demand_id: str, achievement_id: str, 
                          feedback_type: str, scores: Dict[str, float]):
        self.online_learning.record_feedback(
            demand_id, achievement_id, feedback_type, scores
        )
        
        if self.online_learning.should_retrain():
            self.online_learning.train_step()
    
    def get_performance_report(self) -> Dict[str, Any]:
        return self.online_learning.get_performance_report()
    
    def update_model_parameters(self, new_parameters: Dict[str, float]):
        for param_name, value in new_parameters.items():
            self.online_learning.update_parameter(param_name, value)
    
    def save_models(self, base_path: str):
        import os
        os.makedirs(os.path.dirname(base_path), exist_ok=True)
        
        self.gnn_aligner.save_model(f"{base_path}_gnn.pt")
        self.vector_db.save_database(f"{base_path}_vector_db.index")
        self.online_learning.save_model(f"{base_path}_online_learning.pkl")
    
    def load_models(self, base_path: str):
        try:
            self.gnn_aligner.load_model(f"{base_path}_gnn.pt")
            self.vector_db.load_database(f"{base_path}_vector_db.index")
            self.online_learning.load_model(f"{base_path}_online_learning.pkl")
            return True
        except Exception as e:
            print(f"Error loading models: {e}")
            return False
