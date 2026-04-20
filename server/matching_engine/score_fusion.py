import numpy as np
from typing import List, Dict, Any, Tuple, Optional

class ScoreFusion:
    def __init__(self, structural_weight: float = 0.6, semantic_weight: float = 0.4):
        self.structural_weight = structural_weight
        self.semantic_weight = semantic_weight
        self.normalize_weights()
    
    def normalize_weights(self):
        total = self.structural_weight + self.semantic_weight
        self.structural_weight /= total
        self.semantic_weight /= total
    
    def fuse_scores(self, structural_scores: np.ndarray, 
                   semantic_scores: np.ndarray) -> np.ndarray:
        if len(structural_scores) != len(semantic_scores):
            raise ValueError("Structural and semantic scores must have the same length")
        
        fused_scores = (
            self.structural_weight * structural_scores +
            self.semantic_weight * semantic_scores
        )
        
        return fused_scores
    
    def fuse_with_metadata(self, structural_scores: np.ndarray, 
                          semantic_scores: np.ndarray,
                          metadata: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        fused_scores = self.fuse_scores(structural_scores, semantic_scores)
        
        results = []
        for i, meta in enumerate(metadata):
            result = meta.copy()
            result['structural_score'] = float(structural_scores[i])
            result['semantic_score'] = float(semantic_scores[i])
            result['fused_score'] = float(fused_scores[i])
            results.append(result)
        
        return results
    
    def adaptive_fusion(self, structural_scores: np.ndarray, 
                      semantic_scores: np.ndarray,
                      confidence: Optional[np.ndarray] = None) -> np.ndarray:
        if confidence is not None:
            adaptive_weights = confidence
            adaptive_weights = adaptive_weights / adaptive_weights.sum()
            
            fused_scores = (
                adaptive_weights[0] * structural_scores +
                adaptive_weights[1] * semantic_scores
            )
        else:
            fused_scores = self.fuse_scores(structural_scores, semantic_scores)
        
        return fused_scores
    
    def rank_by_fused_score(self, results: List[Dict[str, Any]], 
                           top_k: int = 10) -> List[Dict[str, Any]]:
        sorted_results = sorted(
            results,
            key=lambda x: x.get('fused_score', 0),
            reverse=True
        )
        
        return sorted_results[:top_k]
    
    def compute_confidence(self, structural_scores: np.ndarray, 
                         semantic_scores: np.ndarray) -> np.ndarray:
        std_structural = np.std(structural_scores)
        std_semantic = np.std(semantic_scores)
        
        total_std = std_structural + std_semantic
        if total_std == 0:
            return np.array([0.5, 0.5])
        
        confidence = np.array([
            std_structural / total_std,
            std_semantic / total_std
        ])
        
        return confidence
    
    def ensemble_fusion(self, score_lists: List[np.ndarray], 
                      weights: Optional[List[float]] = None) -> np.ndarray:
        if weights is None:
            weights = [1.0 / len(score_lists)] * len(score_lists)
        
        weights = np.array(weights)
        weights = weights / weights.sum()
        
        fused_scores = np.zeros_like(score_lists[0])
        for scores, weight in zip(score_lists, weights):
            fused_scores += weight * scores
        
        return fused_scores
    
    def weighted_average_fusion(self, scores_dict: Dict[str, np.ndarray],
                             weight_dict: Dict[str, float]) -> np.ndarray:
        total_weight = sum(weight_dict.values())
        normalized_weights = {k: v / total_weight for k, v in weight_dict.items()}
        
        fused_scores = np.zeros_like(list(scores_dict.values())[0])
        for score_type, scores in scores_dict.items():
            weight = normalized_weights.get(score_type, 0)
            fused_scores += weight * scores
        
        return fused_scores
    
    def dynamic_weight_adjustment(self, historical_data: List[Dict[str, Any]]) -> Dict[str, float]:
        if not historical_data:
            return {
                'structural_weight': self.structural_weight,
                'semantic_weight': self.semantic_weight
            }
        
        structural_accuracies = []
        semantic_accuracies = []
        
        for data in historical_data:
            if 'structural_score' in data and 'actual_match' in data:
                structural_accuracies.append(
                    data['structural_score'] if data['actual_match'] else 1 - data['structural_score']
                )
            
            if 'semantic_score' in data and 'actual_match' in data:
                semantic_accuracies.append(
                    data['semantic_score'] if data['actual_match'] else 1 - data['semantic_score']
                )
        
        if structural_accuracies and semantic_accuracies:
            avg_structural = np.mean(structural_accuracies)
            avg_semantic = np.mean(semantic_accuracies)
            
            total = avg_structural + avg_semantic
            new_structural_weight = avg_structural / total
            new_semantic_weight = avg_semantic / total
            
            return {
                'structural_weight': new_structural_weight,
                'semantic_weight': new_semantic_weight
            }
        
        return {
            'structural_weight': self.structural_weight,
            'semantic_weight': self.semantic_weight
        }
    
    def compute_match_probability(self, fused_scores: np.ndarray) -> np.ndarray:
        probabilities = 1 / (1 + np.exp(-5 * (fused_scores - 0.5)))
        return probabilities
    
    def threshold_filtering(self, results: List[Dict[str, Any]], 
                           threshold: float = 0.6) -> List[Dict[str, Any]]:
        filtered_results = [
            result for result in results
            if result.get('fused_score', 0) >= threshold
        ]
        
        return filtered_results
    
    def diversity_aware_ranking(self, results: List[Dict[str, Any]], 
                               diversity_weight: float = 0.2) -> List[Dict[str, Any]]:
        if not results:
            return []
        
        ranked_results = []
        remaining_results = results.copy()
        
        while remaining_results:
            best_idx = 0
            best_score = -float('inf')
            
            for i, result in enumerate(remaining_results):
                base_score = result.get('fused_score', 0)
                
                diversity_score = 0
                for ranked in ranked_results:
                    similarity = self._compute_diversity_similarity(result, ranked)
                    diversity_score += similarity
                
                diversity_penalty = diversity_weight * diversity_score
                final_score = base_score - diversity_penalty
                
                if final_score > best_score:
                    best_score = final_score
                    best_idx = i
            
            ranked_results.append(remaining_results.pop(best_idx))
        
        return ranked_results
    
    def _compute_diversity_similarity(self, result1: Dict[str, Any], 
                                    result2: Dict[str, Any]) -> float:
        similarity = 0
        
        if result1.get('tech_field') == result2.get('tech_field'):
            similarity += 0.5
        
        keywords1 = set(result1.get('keywords', []))
        keywords2 = set(result2.get('keywords', []))
        
        if keywords1 and keywords2:
            overlap = len(keywords1 & keywords2) / len(keywords1 | keywords2)
            similarity += 0.5 * overlap
        
        return similarity
    
    def explain_fusion(self, result: Dict[str, Any]) -> str:
        structural = result.get('structural_score', 0)
        semantic = result.get('semantic_score', 0)
        fused = result.get('fused_score', 0)
        
        explanation = f"综合匹配得分: {fused:.3f}\n"
        explanation += f"- 结构相似度: {structural:.3f} (权重: {self.structural_weight:.2f})\n"
        explanation += f"- 语义相似度: {semantic:.3f} (权重: {self.semantic_weight:.2f})\n"
        
        if structural > semantic:
            explanation += "主要基于图谱结构匹配"
        elif semantic > structural:
            explanation += "主要基于文本语义匹配"
        else:
            explanation += "结构和语义匹配均衡"
        
        return explanation
    
    def update_weights(self, structural_weight: float, semantic_weight: float):
        self.structural_weight = structural_weight
        self.semantic_weight = semantic_weight
        self.normalize_weights()
    
    def get_weights(self) -> Dict[str, float]:
        return {
            'structural_weight': self.structural_weight,
            'semantic_weight': self.semantic_weight
        }
