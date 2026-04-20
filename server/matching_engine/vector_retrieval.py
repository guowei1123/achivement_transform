import numpy as np
import faiss
from typing import List, Dict, Any, Tuple, Optional
import pickle
import os

class VectorRetrievalEngine:
    def __init__(self, embedding_dim: int = 384, index_type: str = 'IVF', 
                 nlist: int = 100, use_gpu: bool = False):
        self.embedding_dim = embedding_dim
        self.index_type = index_type
        self.nlist = nlist
        self.use_gpu = use_gpu and faiss.get_num_gpus() > 0
        
        self.index = None
        self.id_to_data = {}
        self.is_trained = False
        
        self._initialize_index()
    
    def _initialize_index(self):
        if self.index_type == 'IVF':
            quantizer = faiss.IndexFlatL2(self.embedding_dim)
            self.index = faiss.IndexIVFFlat(quantizer, self.embedding_dim, self.nlist)
        elif self.index_type == 'HNSW':
            self.index = faiss.IndexHNSWFlat(self.embedding_dim, 32)
        elif self.index_type == 'Flat':
            self.index = faiss.IndexFlatL2(self.embedding_dim)
        else:
            self.index = faiss.IndexFlatL2(self.embedding_dim)
        
        if self.use_gpu:
            res = faiss.StandardGpuResources()
            self.index = faiss.index_cpu_to_gpu(res, 0, self.index)
    
    def add_vectors(self, vectors: np.ndarray, ids: List[Any], 
                   metadata: Optional[List[Dict[str, Any]]] = None):
        if not self.is_trained and self.index_type == 'IVF':
            self.index.train(vectors)
            self.is_trained = True
        
        vectors = vectors.astype('float32')
        self.index.add(vectors)
        
        for i, vec_id in enumerate(ids):
            self.id_to_data[vec_id] = {
                'index': self.index.ntotal - len(ids) + i,
                'vector': vectors[i],
                'metadata': metadata[i] if metadata else {}
            }
    
    def search(self, query_vector: np.ndarray, k: int = 10) -> List[Tuple[Any, float, Dict[str, Any]]]:
        if self.index.ntotal == 0:
            return []
        
        query_vector = query_vector.astype('float32').reshape(1, -1)
        
        if self.index_type == 'IVF':
            self.index.nprobe = min(self.nlist, self.index.ntotal)
        
        distances, indices = self.index.search(query_vector, k)
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1:
                continue
            
            vec_id = self._find_id_by_index(idx)
            if vec_id is not None:
                metadata = self.id_to_data[vec_id]['metadata']
                similarity = 1.0 - (dist / 2.0)
                results.append((vec_id, similarity, metadata))
        
        return results
    
    def batch_search(self, query_vectors: np.ndarray, k: int = 10) -> List[List[Tuple[Any, float, Dict[str, Any]]]:
        if self.index.ntotal == 0:
            return [[] for _ in range(len(query_vectors))]
        
        query_vectors = query_vectors.astype('float32')
        
        if self.index_type == 'IVF':
            self.index.nprobe = min(self.nlist, self.index.ntotal)
        
        distances, indices = self.index.search(query_vectors, k)
        
        all_results = []
        for i in range(len(query_vectors)):
            results = []
            for dist, idx in zip(distances[i], indices[i]):
                if idx == -1:
                    continue
                
                vec_id = self._find_id_by_index(idx)
                if vec_id is not None:
                    metadata = self.id_to_data[vec_id]['metadata']
                    similarity = 1.0 - (dist / 2.0)
                    results.append((vec_id, similarity, metadata))
            
            all_results.append(results)
        
        return all_results
    
    def _find_id_by_index(self, index: int) -> Optional[Any]:
        for vec_id, data in self.id_to_data.items():
            if data['index'] == index:
                return vec_id
        return None
    
    def remove_vector(self, vec_id: Any) -> bool:
        if vec_id not in self.id_to_data:
            return False
        
        del self.id_to_data[vec_id]
        return True
    
    def update_vector(self, vec_id: Any, new_vector: np.ndarray,
                     new_metadata: Optional[Dict[str, Any]] = None):
        if vec_id not in self.id_to_data:
            return False
        
        old_index = self.id_to_data[vec_id]['index']
        self.id_to_data[vec_id]['vector'] = new_vector.astype('float32')
        
        if new_metadata:
            self.id_to_data[vec_id]['metadata'] = new_metadata
        
        return True
    
    def get_vector(self, vec_id: Any) -> Optional[np.ndarray]:
        if vec_id not in self.id_to_data:
            return None
        return self.id_to_data[vec_id]['vector']
    
    def get_metadata(self, vec_id: Any) -> Optional[Dict[str, Any]]:
        if vec_id not in self.id_to_data:
            return None
        return self.id_to_data[vec_id]['metadata']
    
    def save_index(self, filepath: str):
        faiss.write_index(self.index, filepath)
        
        metadata_path = filepath.replace('.index', '.metadata')
        with open(metadata_path, 'wb') as f:
            pickle.dump(self.id_to_data, f)
    
    def load_index(self, filepath: str):
        self.index = faiss.read_index(filepath)
        
        metadata_path = filepath.replace('.index', '.metadata')
        if os.path.exists(metadata_path):
            with open(metadata_path, 'rb') as f:
                self.id_to_data = pickle.load(f)
        
        self.is_trained = True
    
    def get_stats(self) -> Dict[str, Any]:
        return {
            'total_vectors': self.index.ntotal,
            'index_type': self.index_type,
            'embedding_dim': self.embedding_dim,
            'is_trained': self.is_trained,
            'use_gpu': self.use_gpu
        }


class AchievementVectorDB:
    def __init__(self, embedding_dim: int = 384, index_type: str = 'IVF'):
        self.vector_engine = VectorRetrievalEngine(embedding_dim, index_type)
        self.achievement_cache = {}
        
    def add_achievement(self, achievement: Dict[str, Any]):
        vec_id = achievement['id']
        embedding = np.array(achievement.get('semantic_embedding', []))
        
        if len(embedding) == 0:
            embedding = np.zeros(self.vector_engine.embedding_dim, dtype='float32')
        
        if len(embedding) != self.vector_engine.embedding_dim:
            embedding = np.resize(embedding, self.vector_engine.embedding_dim)
        
        metadata = {
            'name': achievement.get('label', ''),
            'type': achievement.get('type', ''),
            'category': achievement.get('category', ''),
            'tech_field': achievement.get('tech_field', ''),
            'trl_level': achievement.get('trl_level', 0),
            'patent_number': achievement.get('patent_number', ''),
            'team': achievement.get('team', ''),
            'university': achievement.get('university', ''),
            'transferable': achievement.get('transferable', True),
            'cooperation_modes': achievement.get('cooperation_modes', [])
        }
        
        self.vector_engine.add_vectors(
            embedding.reshape(1, -1),
            [vec_id],
            [metadata]
        )
        
        self.achievement_cache[vec_id] = achievement
    
    def batch_add_achievements(self, achievements: List[Dict[str, Any]]):
        embeddings = []
        ids = []
        metadata_list = []
        
        for achievement in achievements:
            vec_id = achievement['id']
            embedding = np.array(achievement.get('semantic_embedding', []))
            
            if len(embedding) == 0:
                embedding = np.zeros(self.vector_engine.embedding_dim, dtype='float32')
            
            if len(embedding) != self.vector_engine.embedding_dim:
                embedding = np.resize(embedding, self.vector_engine.embedding_dim)
            
            metadata = {
                'name': achievement.get('label', ''),
                'type': achievement.get('type', ''),
                'category': achievement.get('category', ''),
                'tech_field': achievement.get('tech_field', ''),
                'trl_level': achievement.get('trl_level', 0),
                'patent_number': achievement.get('patent_number', ''),
                'team': achievement.get('team', ''),
                'university': achievement.get('university', ''),
                'transferable': achievement.get('transferable', True),
                'cooperation_modes': achievement.get('cooperation_modes', [])
            }
            
            embeddings.append(embedding)
            ids.append(vec_id)
            metadata_list.append(metadata)
            
            self.achievement_cache[vec_id] = achievement
        
        if embeddings:
            embeddings_array = np.array(embeddings, dtype='float32')
            self.vector_engine.add_vectors(embeddings_array, ids, metadata_list)
    
    def search_similar_achievements(self, query_embedding: np.ndarray, 
                                    top_k: int = 50) -> List[Dict[str, Any]]:
        if self.vector_engine.index.ntotal == 0:
            return []
        
        results = self.vector_engine.search(query_embedding, top_k)
        
        matched_achievements = []
        for vec_id, similarity, metadata in results:
            if vec_id in self.achievement_cache:
                achievement = self.achievement_cache[vec_id].copy()
                achievement['semantic_similarity'] = similarity
                matched_achievements.append(achievement)
        
        return matched_achievements
    
    def get_achievement_by_id(self, achievement_id: str) -> Optional[Dict[str, Any]]:
        return self.achievement_cache.get(achievement_id)
    
    def get_stats(self) -> Dict[str, Any]:
        stats = self.vector_engine.get_stats()
        stats['cached_achievements'] = len(self.achievement_cache)
        return stats
