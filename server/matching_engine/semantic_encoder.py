import numpy as np
from typing import List, Dict, Any, Tuple
import torch
from transformers import AutoTokenizer, AutoModel
from sentence_transformers import SentenceTransformer
import jieba

class SemanticEncoder:
    def __init__(self, model_name: str = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', 
                 device: str = 'cpu'):
        self.device = torch.device(device if torch.cuda.is_available() else 'cpu')
        self.model = SentenceTransformer(model_name)
        self.model.to(self.device)
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        
    def encode_text(self, text: str) -> np.ndarray:
        cleaned_text = self._preprocess_text(text)
        embedding = self.model.encode(cleaned_text, convert_to_numpy=True)
        return embedding
    
    def encode_texts(self, texts: List[str]) -> np.ndarray:
        cleaned_texts = [self._preprocess_text(text) for text in texts]
        embeddings = self.model.encode(cleaned_texts, convert_to_numpy=True)
        return embeddings
    
    def _preprocess_text(self, text: str) -> str:
        text = text.strip()
        text = ' '.join(jieba.cut(text))
        return text
    
    def compute_similarity(self, text1: str, text2: str) -> float:
        emb1 = self.encode_text(text1)
        emb2 = self.encode_text(text2)
        
        similarity = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
        return similarity
    
    def compute_similarities(self, query_text: str, candidate_texts: List[str]) -> np.ndarray:
        query_emb = self.encode_text(query_text)
        candidate_embs = self.encode_texts(candidate_texts)
        
        similarities = np.dot(candidate_embs, query_emb) / (
            np.linalg.norm(candidate_embs, axis=1) * np.linalg.norm(query_emb)
        )
        
        return similarities
    
    def batch_encode_achievements(self, achievements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        texts = [achievement.get('label', '') for achievement in achievements]
        embeddings = self.encode_texts(texts)
        
        for i, achievement in enumerate(achievements):
            achievement['semantic_embedding'] = embeddings[i].tolist()
        
        return achievements
    
    def batch_encode_demands(self, demands: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        texts = [demand.get('label', '') for demand in demands]
        embeddings = self.encode_texts(texts)
        
        for i, demand in enumerate(demands):
            demand['semantic_embedding'] = embeddings[i].tolist()
        
        return demands
    
    def extract_key_phrases(self, text: str, top_k: int = 5) -> List[str]:
        words = jieba.cut(text)
        word_list = list(words)
        
        word_freq = {}
        for word in word_list:
            if len(word) > 1:
                word_freq[word] = word_freq.get(word, 0) + 1
        
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        key_phrases = [word for word, freq in sorted_words[:top_k]]
        
        return key_phrases
    
    def compute_phrase_similarity(self, phrases1: List[str], phrases2: List[str]) -> float:
        if not phrases1 or not phrases2:
            return 0.0
        
        similarities = []
        for phrase1 in phrases1:
            for phrase2 in phrases2:
                sim = self.compute_similarity(phrase1, phrase2)
                similarities.append(sim)
        
        return np.mean(similarities) if similarities else 0.0
    
    def enhanced_encode(self, text: str, include_keywords: bool = True) -> np.ndarray:
        base_embedding = self.encode_text(text)
        
        if include_keywords:
            keywords = self.extract_key_phrases(text, top_k=10)
            keyword_embeddings = []
            
            for keyword in keywords:
                keyword_emb = self.encode_text(keyword)
                keyword_embeddings.append(keyword_emb)
            
            if keyword_embeddings:
                keyword_avg = np.mean(keyword_embeddings, axis=0)
                enhanced_embedding = 0.7 * base_embedding + 0.3 * keyword_avg
                return enhanced_embedding
        
        return base_embedding
    
    def compute_semantic_distance(self, text1: str, text2: str) -> float:
        similarity = self.compute_similarity(text1, text2)
        distance = 1.0 - similarity
        return distance
    
    def find_semantic_neighbors(self, query_text: str, corpus: List[Dict[str, Any]], 
                               top_k: int = 10) -> List[Tuple[Dict[str, Any], float]]:
        if not corpus:
            return []
        
        query_embedding = self.encode_text(query_text)
        
        corpus_embeddings = np.array([
            item.get('semantic_embedding', np.zeros(self.embedding_dim))
            for item in corpus
        ])
        
        similarities = np.dot(corpus_embeddings, query_embedding) / (
            np.linalg.norm(corpus_embeddings, axis=1) * np.linalg.norm(query_embedding)
        )
        
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = [
            (corpus[idx], similarities[idx])
            for idx in top_indices
        ]
        
        return results
    
    def save_embeddings(self, embeddings: Dict[str, np.ndarray], path: str):
        np.savez(path, **embeddings)
    
    def load_embeddings(self, path: str) -> Dict[str, np.ndarray]:
        data = np.load(path, allow_pickle=True)
        return {key: data[key] for key in data.files}
    
    def get_embedding_dimension(self) -> int:
        return self.embedding_dim
    
    def compute_batch_similarities(self, query_texts: List[str], 
                                   candidate_texts: List[str]) -> np.ndarray:
        query_embs = self.encode_texts(query_texts)
        candidate_embs = self.encode_texts(candidate_texts)
        
        similarities = np.dot(query_embs, candidate_embs.T) / (
            np.linalg.norm(query_embs, axis=1, keepdims=True) * 
            np.linalg.norm(candidate_embs, axis=1)
        )
        
        return similarities
