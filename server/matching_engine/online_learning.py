import numpy as np
from typing import List, Dict, Any, Optional, Tuple
import pickle
import os
from datetime import datetime, timedelta
from collections import defaultdict

class OnlineLearningModule:
    def __init__(self, learning_rate: float = 0.01, decay_rate: float = 0.95):
        self.learning_rate = learning_rate
        self.decay_rate = decay_rate
        self.feedback_history = []
        self.model_parameters = {
            'structural_weight': 0.6,
            'semantic_weight': 0.4,
            'tech_field_importance': 1.0,
            'trl_importance': 1.0,
            'region_importance': 0.5,
            'cooperation_importance': 0.5
        }
        self.performance_metrics = {
            'accuracy': 0.0,
            'precision': 0.0,
            'recall': 0.0,
            'f1_score': 0.0,
            'total_feedback': 0,
            'positive_feedback': 0,
            'negative_feedback': 0
        }
        self.last_update_time = datetime.now()
    
    def record_feedback(self, demand_id: str, achievement_id: str, 
                      feedback_type: str, scores: Dict[str, float],
                      metadata: Optional[Dict[str, Any]] = None):
        feedback = {
            'demand_id': demand_id,
            'achievement_id': achievement_id,
            'feedback_type': feedback_type,
            'scores': scores,
            'timestamp': datetime.now(),
            'metadata': metadata or {}
        }
        
        self.feedback_history.append(feedback)
        
        if feedback_type in ['click', 'contact', 'contract', 'positive']:
            self.performance_metrics['positive_feedback'] += 1
        elif feedback_type in ['skip', 'negative', 'reject']:
            self.performance_metrics['negative_feedback'] += 1
        
        self.performance_metrics['total_feedback'] += 1
    
    def compute_feedback_statistics(self, time_window: Optional[timedelta] = None) -> Dict[str, Any]:
        if time_window:
            cutoff_time = datetime.now() - time_window
            recent_feedback = [
                fb for fb in self.feedback_history
                if fb['timestamp'] >= cutoff_time
            ]
        else:
            recent_feedback = self.feedback_history
        
        if not recent_feedback:
            return {
                'total': 0,
                'positive': 0,
                'negative': 0,
                'positive_rate': 0.0
            }
        
        positive_count = sum(
            1 for fb in recent_feedback
            if fb['feedback_type'] in ['click', 'contact', 'contract', 'positive']
        )
        negative_count = sum(
            1 for fb in recent_feedback
            if fb['feedback_type'] in ['skip', 'negative', 'reject']
        )
        
        return {
            'total': len(recent_feedback),
            'positive': positive_count,
            'negative': negative_count,
            'positive_rate': positive_count / len(recent_feedback) if recent_feedback else 0.0
        }
    
    def update_weights_by_feedback(self):
        if len(self.feedback_history) < 10:
            return
        
        recent_stats = self.compute_feedback_statistics(timedelta(days=7))
        
        if recent_stats['total'] < 5:
            return
        
        positive_rate = recent_stats['positive_rate']
        
        structural_scores = []
        semantic_scores = []
        
        for fb in self.feedback_history[-100:]:
            if fb['feedback_type'] in ['click', 'contact', 'contract', 'positive']:
                structural_scores.append(fb['scores'].get('structural_score', 0))
                semantic_scores.append(fb['scores'].get('semantic_score', 0))
        
        if structural_scores and semantic_scores:
            avg_structural = np.mean(structural_scores)
            avg_semantic = np.mean(semantic_scores)
            
            total = avg_structural + avg_semantic
            if total > 0:
                new_structural_weight = avg_structural / total
                new_semantic_weight = avg_semantic / total
                
                alpha = self.learning_rate * positive_rate
                self.model_parameters['structural_weight'] = (
                    (1 - alpha) * self.model_parameters['structural_weight'] +
                    alpha * new_structural_weight
                )
                self.model_parameters['semantic_weight'] = (
                    (1 - alpha) * self.model_parameters['semantic_weight'] +
                    alpha * new_semantic_weight
                )
    
    def update_feature_importance(self):
        if len(self.feedback_history) < 10:
            return
        
        feature_feedback = defaultdict(list)
        
        for fb in self.feedback_history[-100:]:
            if fb['feedback_type'] in ['click', 'contact', 'contract', 'positive']:
                metadata = fb.get('metadata', {})
                
                if metadata.get('tech_field_match'):
                    feature_feedback['tech_field'].append(1)
                else:
                    feature_feedback['tech_field'].append(0)
                
                if metadata.get('trl_match'):
                    feature_feedback['trl'].append(1)
                else:
                    feature_feedback['trl'].append(0)
                
                if metadata.get('region_match'):
                    feature_feedback['region'].append(1)
                else:
                    feature_feedback['region'].append(0)
                
                if metadata.get('cooperation_match'):
                    feature_feedback['cooperation'].append(1)
                else:
                    feature_feedback['cooperation'].append(0)
        
        for feature, values in feature_feedback.items():
            if values:
                importance = np.mean(values)
                param_key = f'{feature}_importance'
                
                if param_key in self.model_parameters:
                    alpha = self.learning_rate
                    self.model_parameters[param_key] = (
                        (1 - alpha) * self.model_parameters[param_key] +
                        alpha * importance
                    )
    
    def compute_performance_metrics(self) -> Dict[str, float]:
        total = self.performance_metrics['total_feedback']
        
        if total == 0:
            return {
                'accuracy': 0.0,
                'precision': 0.0,
                'recall': 0.0,
                'f1_score': 0.0
            }
        
        positive = self.performance_metrics['positive_feedback']
        negative = self.performance_metrics['negative_feedback']
        
        accuracy = positive / total if total > 0 else 0.0
        precision = positive / (positive + negative) if (positive + negative) > 0 else 0.0
        recall = positive / total if total > 0 else 0.0
        
        f1_score = (
            2 * (precision * recall) / (precision + recall)
            if (precision + recall) > 0 else 0.0
        )
        
        self.performance_metrics.update({
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1_score
        })
        
        return {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1_score
        }
    
    def adaptive_learning_rate(self) -> float:
        performance = self.compute_performance_metrics()
        f1 = performance['f1_score']
        
        if f1 > 0.8:
            return self.learning_rate * 0.5
        elif f1 > 0.6:
            return self.learning_rate * 0.8
        elif f1 > 0.4:
            return self.learning_rate
        else:
            return self.learning_rate * 1.5
    
    def train_step(self):
        current_lr = self.adaptive_learning_rate()
        original_lr = self.learning_rate
        self.learning_rate = current_lr
        
        self.update_weights_by_feedback()
        self.update_feature_importance()
        
        self.learning_rate = original_lr
        self.last_update_time = datetime.now()
    
    def should_retrain(self, min_feedback: int = 20, 
                      time_threshold: timedelta = timedelta(days=7)) -> bool:
        recent_feedback = [
            fb for fb in self.feedback_history
            if fb['timestamp'] >= datetime.now() - time_threshold
        ]
        
        if len(recent_feedback) >= min_feedback:
            return True
        
        time_since_update = datetime.now() - self.last_update_time
        if time_since_update >= time_threshold:
            return True
        
        return False
    
    def get_model_parameters(self) -> Dict[str, float]:
        return self.model_parameters.copy()
    
    def update_parameter(self, param_name: str, value: float):
        if param_name in self.model_parameters:
            self.model_parameters[param_name] = value
    
    def get_performance_report(self) -> Dict[str, Any]:
        performance = self.compute_performance_metrics()
        recent_stats = self.compute_feedback_statistics(timedelta(days=7))
        
        report = {
            'overall_performance': performance,
            'recent_feedback': recent_stats,
            'model_parameters': self.model_parameters,
            'total_feedback_count': len(self.feedback_history),
            'last_update': self.last_update_time.isoformat()
        }
        
        return report
    
    def save_model(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        
        model_data = {
            'model_parameters': self.model_parameters,
            'performance_metrics': self.performance_metrics,
            'feedback_history': [
                {
                    **fb,
                    'timestamp': fb['timestamp'].isoformat()
                }
                for fb in self.feedback_history[-1000:]
            ],
            'last_update_time': self.last_update_time.isoformat()
        }
        
        with open(path, 'wb') as f:
            pickle.dump(model_data, f)
    
    def load_model(self, path: str):
        if not os.path.exists(path):
            return False
        
        with open(path, 'rb') as f:
            model_data = pickle.load(f)
        
        self.model_parameters = model_data.get('model_parameters', self.model_parameters)
        self.performance_metrics = model_data.get('performance_metrics', self.performance_metrics)
        
        feedback_history = model_data.get('feedback_history', [])
        self.feedback_history = [
            {
                **fb,
                'timestamp': datetime.fromisoformat(fb['timestamp'])
            }
            for fb in feedback_history
        ]
        
        last_update = model_data.get('last_update_time')
        if last_update:
            self.last_update_time = datetime.fromisoformat(last_update)
        
        return True
    
    def reset(self):
        self.feedback_history = []
        self.model_parameters = {
            'structural_weight': 0.6,
            'semantic_weight': 0.4,
            'tech_field_importance': 1.0,
            'trl_importance': 1.0,
            'region_importance': 0.5,
            'cooperation_importance': 0.5
        }
        self.performance_metrics = {
            'accuracy': 0.0,
            'precision': 0.0,
            'recall': 0.0,
            'f1_score': 0.0,
            'total_feedback': 0,
            'positive_feedback': 0,
            'negative_feedback': 0
        }
        self.last_update_time = datetime.now()
    
    def export_feedback_data(self) -> List[Dict[str, Any]]:
        return [
            {
                **fb,
                'timestamp': fb['timestamp'].isoformat()
            }
            for fb in self.feedback_history
        ]
    
    def import_feedback_data(self, feedback_data: List[Dict[str, Any]]):
        for fb in feedback_data:
            self.feedback_history.append({
                **fb,
                'timestamp': datetime.fromisoformat(fb['timestamp'])
            })
