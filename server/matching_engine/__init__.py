import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from data_preprocessor import DataPreprocessor
from gnn_aligner import GNNGraphAligner
from semantic_encoder import SemanticEncoder
from vector_retrieval import AchievementVectorDB
from score_fusion import ScoreFusion
from rule_constraint import RuleConstraintFilter
from online_learning import OnlineLearningModule
from recommendation_engine import MatchingRecommendationEngine
import numpy as np
from typing import List, Dict, Any, Optional
import pickle

class MatchingEngine:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or self._default_config()
        
        self.data_preprocessor = DataPreprocessor()
        self.gnn_aligner = GNNGraphAligner(
            num_node_features=64,
            num_relations=10,
            hidden_dim=128,
            num_layers=2,
            device=self.config.get('device', 'cpu')
        )
        self.semantic_encoder = SemanticEncoder(
            model_name='sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
            device=self.config.get('device', 'cpu')
        )
        self.vector_db = AchievementVectorDB(
            embedding_dim=384,
            index_type='IVF'
        )
        self.score_fusion = ScoreFusion(
            structural_weight=0.6,
            semantic_weight=0.4
        )
        self.rule_filter = RuleConstraintFilter()
        self.online_learning = OnlineLearningModule(
            learning_rate=0.01,
            decay_rate=0.95
        )
        
        self.recommendation_engine = MatchingRecommendationEngine(
            self.data_preprocessor,
            self.gnn_aligner,
            self.semantic_encoder,
            self.vector_db,
            self.score_fusion,
            self.rule_filter,
            self.online_learning
        )
        
        self.is_initialized = False
    
    def _default_config(self) -> Dict[str, Any]:
        return {
            'device': 'cpu',
            'embedding_dim': 384,
            'gnn_hidden_dim': 128,
            'gnn_num_layers': 2,
            'structural_weight': 0.6,
            'semantic_weight': 0.4,
            'top_k': 10
        }
    
    def initialize_from_graph_data(self, nodes: List[Dict[str, Any]], 
                                edges: List[Dict[str, Any]]):
        try:
            achievement_nodes = [
                node for node in nodes
                if node.get('type') in ['Patent', 'Paper', 'Project']
            ]
            
            if achievement_nodes:
                processed_achievements = []
                for node in achievement_nodes:
                    processed = self.data_preprocessor.preprocess_school_achievement(node)
                    embedding = self.semantic_encoder.encode_text(processed['normalized_text'])
                    processed['semantic_embedding'] = embedding.tolist()
                    processed_achievements.append(processed)
                
                self.vector_db.batch_add_achievements(processed_achievements)
                
                graph = self.gnn_aligner.build_heterogeneous_graph(nodes, edges)
                self.graph = graph
                self.nodes = nodes
                self.edges = edges
            
            self.is_initialized = True
            return True
        except Exception as e:
            print(f"Error initializing matching engine: {e}")
            return False
    
    def match_demand_to_achievements(self, demand: Dict[str, Any], 
                                   top_k: int = 10) -> List[Dict[str, Any]]:
        if not self.is_initialized:
            raise RuntimeError("Matching engine not initialized. Call initialize_from_graph_data first.")
        
        recommendations = self.recommendation_engine.generate_recommendations(
            demand, top_k
        )
        
        return recommendations
    
    def batch_match_demands(self, demands: List[Dict[str, Any]], 
                           top_k: int = 10) -> Dict[str, List[Dict[str, Any]]]:
        if not self.is_initialized:
            raise RuntimeError("Matching engine not initialized. Call initialize_from_graph_data first.")
        
        results = self.recommendation_engine.batch_generate_recommendations(
            demands, top_k
        )
        
        return results
    
    def record_feedback(self, demand_id: str, achievement_id: str, 
                      feedback_type: str, scores: Dict[str, float]):
        self.recommendation_engine.record_user_feedback(
            demand_id, achievement_id, feedback_type, scores
        )
    
    def get_performance_report(self) -> Dict[str, Any]:
        return self.recommendation_engine.get_performance_report()
    
    def update_parameters(self, parameters: Dict[str, Any]):
        if 'structural_weight' in parameters and 'semantic_weight' in parameters:
            self.score_fusion.update_weights(
                parameters['structural_weight'],
                parameters['semantic_weight']
            )
        
        self.recommendation_engine.update_model_parameters(parameters)
    
    def save_models(self, path: str):
        self.recommendation_engine.save_models(path)
    
    def load_models(self, path: str):
        success = self.recommendation_engine.load_models(path)
        if success:
            self.is_initialized = True
        return success
    
    def get_engine_stats(self) -> Dict[str, Any]:
        vector_db_stats = self.vector_db.get_stats()
        performance_report = self.get_performance_report()
        
        return {
            'is_initialized': self.is_initialized,
            'vector_database': vector_db_stats,
            'performance': performance_report,
            'config': self.config
        }
    
    def export_recommendations_csv(self, recommendations: List[Dict[str, Any]]) -> str:
        return self.recommendation_engine.export_recommendations(recommendations, 'csv')
    
    def export_recommendations_json(self, recommendations: List[Dict[str, Any]]) -> str:
        return self.recommendation_engine.export_recommendations(recommendations, 'json')
    
    def reset(self):
        self.vector_db = AchievementVectorDB(embedding_dim=384, index_type='IVF')
        self.online_learning.reset()
        self.is_initialized = False

_global_matching_engine = None

def get_matching_engine(config: Optional[Dict[str, Any]] = None) -> MatchingEngine:
    global _global_matching_engine
    if _global_matching_engine is None:
        _global_matching_engine = MatchingEngine(config)
    return _global_matching_engine

def initialize_matching_engine(nodes: List[Dict[str, Any]], 
                              edges: List[Dict[str, Any]],
                              config: Optional[Dict[str, Any]] = None) -> bool:
    engine = get_matching_engine(config)
    return engine.initialize_from_graph_data(nodes, edges)
