import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import RGCNConv, global_mean_pool
from torch_geometric.data import Data, Batch
from typing import Dict, List, Tuple, Any
import numpy as np

class RGCNEncoder(nn.Module):
    def __init__(self, num_node_features: int, num_relations: int, hidden_dim: int = 128, num_layers: int = 2):
        super(RGCNEncoder, self).__init__()
        self.num_relations = num_relations
        self.hidden_dim = hidden_dim
        
        self.convs = nn.ModuleList()
        self.convs.append(RGCNConv(num_node_features, hidden_dim, num_relations))
        
        for _ in range(num_layers - 1):
            self.convs.append(RGCNConv(hidden_dim, hidden_dim, num_relations))
        
        self.batch_norms = nn.ModuleList([nn.BatchNorm1d(hidden_dim) for _ in range(num_layers)])
        
    def forward(self, x: torch.Tensor, edge_index: torch.Tensor, edge_type: torch.Tensor) -> torch.Tensor:
        for i, (conv, bn) in enumerate(zip(self.convs, self.batch_norms)):
            x = conv(x, edge_index, edge_type)
            x = bn(x)
            x = F.relu(x)
            x = F.dropout(x, p=0.2, training=self.training)
        
        return x

class ContrastiveLearningLoss(nn.Module):
    def __init__(self, temperature: float = 0.07):
        super(ContrastiveLearningLoss, self).__init__()
        self.temperature = temperature
    
    def forward(self, embeddings: torch.Tensor, positive_pairs: List[Tuple[int, int]], 
                negative_pairs: List[Tuple[int, int]]) -> torch.Tensor:
        loss = 0.0
        count = 0
        
        for i, j in positive_pairs:
            pos_sim = F.cosine_similarity(embeddings[i].unsqueeze(0), embeddings[j].unsqueeze(0))
            pos_score = torch.exp(pos_sim / self.temperature)
            
            neg_scores = []
            for k, l in negative_pairs:
                if k == i:
                    neg_sim = F.cosine_similarity(embeddings[i].unsqueeze(0), embeddings[l].unsqueeze(0))
                    neg_scores.append(torch.exp(neg_sim / self.temperature))
            
            if neg_scores:
                neg_score = sum(neg_scores)
                loss -= torch.log(pos_score / (pos_score + neg_score))
                count += 1
        
        return loss / count if count > 0 else torch.tensor(0.0)

class GNNGraphAligner:
    def __init__(self, num_node_features: int = 64, num_relations: int = 10, 
                 hidden_dim: int = 128, num_layers: int = 2, device: str = 'cpu'):
        self.device = torch.device(device if torch.cuda.is_available() else 'cpu')
        self.model = RGCNEncoder(num_node_features, num_relations, hidden_dim, num_layers).to(self.device)
        self.contrastive_loss = ContrastiveLearningLoss()
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=0.001)
        self.relation_types = self._init_relation_types()
        self.node_type_mapping = self._init_node_type_mapping()
        
    def _init_relation_types(self) -> Dict[str, int]:
        return {
            'BELONGS_TO': 0,
            'APPLIES_TO': 1,
            'DEVELOPED_BY': 2,
            'REQUIRES': 3,
            'MATCHES_WITH': 4,
            'RELATED_TO': 5,
            'PART_OF': 6,
            'CONNECTS_TO': 7,
            'DEPENDS_ON': 8,
            'PROVIDES': 9
        }
    
    def _init_node_type_mapping(self) -> Dict[str, int]:
        return {
            'Enterprise': 0,
            'Vessel': 1,
            'Port': 2,
            'technical requirements': 3,
            'Patent': 4,
            'Paper': 5,
            'Project': 6,
            'University': 7,
            'Person': 8,
            'Application': 9
        }
    
    def create_node_features(self, nodes: List[Dict[str, Any]]) -> torch.Tensor:
        num_nodes = len(nodes)
        features = torch.zeros(num_nodes, 64, device=self.device)
        
        for i, node in enumerate(nodes):
            node_type = node.get('type', 'unknown')
            type_idx = self.node_type_mapping.get(node_type, 0)
            features[i, type_idx] = 1.0
            
            keywords = node.get('keywords', [])
            for j, keyword in enumerate(keywords[:10]):
                hash_val = hash(keyword) % 54
                features[i, 10 + hash_val] = 1.0
            
            trl_level = node.get('trl_level', 3)
            features[i, 63] = trl_level / 9.0
        
        return features
    
    def build_heterogeneous_graph(self, nodes: List[Dict[str, Any]], 
                                  edges: List[Dict[str, Any]]) -> Data:
        node_features = self.create_node_features(nodes)
        
        node_id_to_idx = {node['id']: i for i, node in enumerate(nodes)}
        
        edge_indices = []
        edge_types = []
        
        for edge in edges:
            source_idx = node_id_to_idx.get(edge['source'])
            target_idx = node_id_to_idx.get(edge['target'])
            
            if source_idx is not None and target_idx is not None:
                edge_indices.append([source_idx, target_idx])
                
                relation_label = edge.get('label', 'RELATED_TO')
                edge_type = self.relation_types.get(relation_label, 5)
                edge_types.append(edge_type)
        
        edge_index = torch.tensor(edge_indices, dtype=torch.long).t().contiguous()
        edge_type = torch.tensor(edge_types, dtype=torch.long)
        
        return Data(x=node_features, edge_index=edge_index, edge_type=edge_type)
    
    def compute_structural_similarity(self, graph: Data, demand_idx: int, 
                                     achievement_idx: int) -> float:
        self.model.eval()
        with torch.no_grad():
            embeddings = self.model(graph.x, graph.edge_index, graph.edge_type)
            
            demand_emb = embeddings[demand_idx]
            achievement_emb = embeddings[achievement_idx]
            
            similarity = F.cosine_similarity(demand_emb.unsqueeze(0), 
                                          achievement_emb.unsqueeze(0))
            
            return similarity.item()
    
    def compute_all_similarities(self, graph: Data, demand_indices: List[int], 
                               achievement_indices: List[int]) -> np.ndarray:
        self.model.eval()
        with torch.no_grad():
            embeddings = self.model(graph.x, graph.edge_index, graph.edge_type)
            
            demand_embeddings = embeddings[demand_indices]
            achievement_embeddings = embeddings[achievement_indices]
            
            similarities = F.cosine_similarity(
                demand_embeddings.unsqueeze(1),
                achievement_embeddings.unsqueeze(0),
                dim=2
            )
            
            return similarities.cpu().numpy()
    
    def train_step(self, graph: Data, positive_pairs: List[Tuple[int, int]], 
                  negative_pairs: List[Tuple[int, int]]) -> float:
        self.model.train()
        self.optimizer.zero_grad()
        
        embeddings = self.model(graph.x, graph.edge_index, graph.edge_type)
        
        loss = self.contrastive_loss(embeddings, positive_pairs, negative_pairs)
        
        loss.backward()
        self.optimizer.step()
        
        return loss.item()
    
    def save_model(self, path: str):
        torch.save({
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'relation_types': self.relation_types,
            'node_type_mapping': self.node_type_mapping
        }, path)
    
    def load_model(self, path: str):
        checkpoint = torch.load(path, map_location=self.device)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        self.relation_types = checkpoint['relation_types']
        self.node_type_mapping = checkpoint['node_type_mapping']
    
    def find_matching_path(self, graph: Data, demand_idx: int, 
                          achievement_idx: int, max_depth: int = 3) -> List[str]:
        from collections import deque
        
        edge_index = graph.edge_index.cpu().numpy()
        edge_type = graph.edge_type.cpu().numpy()
        
        reverse_relation_types = {v: k for k, v in self.relation_types.items()}
        
        queue = deque([(demand_idx, [demand_idx])])
        visited = {demand_idx}
        
        while queue:
            current_idx, path = queue.popleft()
            
            if current_idx == achievement_idx:
                return path
            
            if len(path) >= max_depth:
                continue
            
            neighbors = []
            for i, (src, tgt) in enumerate(edge_index.T):
                if src == current_idx and tgt not in visited:
                    relation = reverse_relation_types.get(edge_type[i], 'RELATED_TO')
                    neighbors.append((tgt, relation))
            
            for neighbor, relation in neighbors:
                visited.add(neighbor)
                new_path = path + [neighbor]
                queue.append((neighbor, new_path))
        
        return []
    
    def get_node_embedding(self, graph: Data, node_idx: int) -> np.ndarray:
        self.model.eval()
        with torch.no_grad():
            embeddings = self.model(graph.x, graph.edge_index, graph.edge_type)
            return embeddings[node_idx].cpu().numpy()
