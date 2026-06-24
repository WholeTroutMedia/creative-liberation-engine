#!/usr/bin/env python3
"""
Concept Vector Engine for Brainchild v3
Implements 2048-dimension semantic relationship mapping for agents

Inspired by: CATS Net Framework (Nature Computational Science, Feb 2026)
Research: https://www.nature.com/articles/s43588-026-00956-4
"""

import numpy as np
import json
from typing import Dict, List, Tuple, Optional
from pathlib import Path
from datetime import datetime
import hashlib


class ConceptVectorEngine:
    """2048-dimension concept vector system for multi-agent intelligence"""
    
    VECTOR_DIM = 2048
    
    # Dimension ranges for different feature types
    FEATURE_RANGES = {
        'domain_expertise': (0, 256),
        'collaboration_patterns': (256, 512),
        'problem_types': (512, 768),
        'output_formats': (768, 1024),
        'temporal_context': (1024, 1280),
        'complexity_handling': (1280, 1536),
        'resource_requirements': (1536, 1792),
        'ethical_boundaries': (1792, 2048)
    }
    
    def __init__(self, storage_path: str = 'agents/capabilities/concept-vectors/vectors/'):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.agents: Dict[str, np.ndarray] = {}
        self.metadata: Dict[str, Dict] = {}
        
    def generate_agent_vector(self, agent_name: str, metadata: Dict) -> np.ndarray:
        """Generate 2048-dimension concept vector for agent"""
        vector = np.zeros(self.VECTOR_DIM, dtype=np.float32)
        
        # Domain expertise encoding (0:256)
        vector[0:256] = self._encode_domain_expertise(metadata.get('expertise', []))
        
        # Collaboration patterns (256:512)
        vector[256:512] = self._encode_collaboration_history(metadata.get('collaboration_history', []))
        
        # Problem types (512:768)
        vector[512:768] = self._encode_problem_types(metadata.get('capabilities', []))
        
        # Output formats (768:1024)
        vector[768:1024] = self._encode_output_formats(metadata.get('output_types', []))
        
        # Temporal context (1024:1280)
        vector[1024:1280] = self._encode_temporal_context(metadata.get('temporal', {}))
        
        # Complexity handling (1280:1536)
        vector[1280:1536] = self._encode_complexity_profile(metadata.get('complexity', {}))
        
        # Resource requirements (1536:1792)
        vector[1536:1792] = self._encode_resource_needs(metadata.get('resources', {}))
        
        # Ethical boundaries (1792:2048)
        vector[1792:2048] = self._encode_ethical_constraints(metadata.get('ethics', {}))
        
        # Normalize vector
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
        
        self.agents[agent_name] = vector
        self.metadata[agent_name] = metadata
        
        return vector
    
    def _encode_domain_expertise(self, expertise: List[str]) -> np.ndarray:
        """Encode agent's domain expertise into 256-dim vector"""
        vector = np.zeros(256, dtype=np.float32)
        
        domain_map = {
            'architecture': 0, 'design': 32, 'engineering': 64,
            'legal': 96, 'compliance': 128, 'knowledge': 160,
            'operations': 192, 'broadcast': 224
        }
        
        for exp in expertise:
            if exp in domain_map:
                idx = domain_map[exp]
                vector[idx:idx+32] = np.random.randn(32) * 0.1 + 1.0
        
        return vector
    
    def _encode_collaboration_history(self, history: List[Dict]) -> np.ndarray:
        """Encode historical collaboration patterns"""
        vector = np.zeros(256, dtype=np.float32)
        
        for i, collab in enumerate(history[:32]):
            success_rate = collab.get('success_rate', 0.5)
            frequency = collab.get('frequency', 0)
            vector[i*8:(i+1)*8] = [success_rate] * 4 + [frequency] * 4
        
        return vector
    
    def _encode_problem_types(self, capabilities: List[str]) -> np.ndarray:
        """Encode problem type handling capabilities"""
        vector = np.zeros(256, dtype=np.float32)
        
        problem_map = {
            'analytical': 0, 'creative': 32, 'technical': 64,
            'strategic': 96, 'operational': 128, 'research': 160,
            'communication': 192, 'coordination': 224
        }
        
        for cap in capabilities:
            if cap in problem_map:
                idx = problem_map[cap]
                vector[idx:idx+32] = 1.0
        
        return vector
    
    def _encode_output_formats(self, outputs: List[str]) -> np.ndarray:
        """Encode output format preferences"""
        vector = np.zeros(256, dtype=np.float32)
        
        format_map = {
            'code': 0, 'documentation': 32, 'analysis': 64,
            'visualization': 96, 'report': 128, 'protocol': 160,
            'schema': 192, 'narrative': 224
        }
        
        for output in outputs:
            if output in format_map:
                idx = format_map[output]
                vector[idx:idx+32] = 1.0
        
        return vector
    
    def _encode_temporal_context(self, temporal: Dict) -> np.ndarray:
        """Encode time-sensitive aspects"""
        vector = np.zeros(256, dtype=np.float32)
        
        # Response time preference
        vector[0:64] = temporal.get('response_urgency', 0.5)
        
        # Time zone optimization
        vector[64:128] = temporal.get('timezone_score', 0.5)
        
        # Historical context depth
        vector[128:192] = temporal.get('context_depth', 0.5)
        
        # Freshness requirement
        vector[192:256] = temporal.get('freshness_need', 0.5)
        
        return vector
    
    def _encode_complexity_profile(self, complexity: Dict) -> np.ndarray:
        """Encode complexity handling capabilities"""
        vector = np.zeros(256, dtype=np.float32)
        
        vector[0:64] = complexity.get('max_complexity', 0.7)
        vector[64:128] = complexity.get('preferred_complexity', 0.5)
        vector[128:192] = complexity.get('multi_step_ability', 0.6)
        vector[192:256] = complexity.get('abstraction_level', 0.5)
        
        return vector
    
    def _encode_resource_needs(self, resources: Dict) -> np.ndarray:
        """Encode resource requirements"""
        vector = np.zeros(256, dtype=np.float32)
        
        vector[0:64] = resources.get('compute_need', 0.5)
        vector[64:128] = resources.get('memory_need', 0.5)
        vector[128:192] = resources.get('external_api', 0.3)
        vector[192:256] = resources.get('collaboration_need', 0.6)
        
        return vector
    
    def _encode_ethical_constraints(self, ethics: Dict) -> np.ndarray:
        """Encode ethical and constitutional boundaries"""
        vector = np.zeros(256, dtype=np.float32)
        
        vector[0:64] = ethics.get('constitutional_compliance', 1.0)
        vector[64:128] = ethics.get('privacy_sensitivity', 0.9)
        vector[128:192] = ethics.get('transparency_level', 0.8)
        vector[192:256] = ethics.get('human_oversight', 0.9)
        
        return vector
    
    def calculate_similarity(self, agent1: str, agent2: str, 
                           relationship_type: str = 'all') -> float:
        """Calculate cosine similarity between agents"""
        if agent1 not in self.agents or agent2 not in self.agents:
            return 0.0
        
        v1 = self.agents[agent1]
        v2 = self.agents[agent2]
        
        if relationship_type == 'all':
            return float(np.dot(v1, v2))
        
        # Focused similarity on specific dimensions
        if relationship_type in self.FEATURE_RANGES:
            start, end = self.FEATURE_RANGES[relationship_type]
            v1_slice = v1[start:end]
            v2_slice = v2[start:end]
            
            norm1 = np.linalg.norm(v1_slice)
            norm2 = np.linalg.norm(v2_slice)
            
            if norm1 > 0 and norm2 > 0:
                return float(np.dot(v1_slice, v2_slice) / (norm1 * norm2))
        
        return 0.0
    
    def find_similar_agents(self, agent_name: str, top_k: int = 5, 
                          relationship_type: str = 'all') -> List[Tuple[str, float]]:
        """Find k most similar agents by concept vector distance"""
        if agent_name not in self.agents:
            return []
        
        similarities = []
        
        for other_agent in self.agents:
            if other_agent != agent_name:
                sim = self.calculate_similarity(agent_name, other_agent, relationship_type)
                similarities.append((other_agent, sim))
        
        return sorted(similarities, key=lambda x: x[1], reverse=True)[:top_k]
    
    def save_vector(self, agent_name: str) -> str:
        """Save agent vector to disk with SHA-256 hash"""
        if agent_name not in self.agents:
            raise ValueError(f"Agent {agent_name} not found")
        
        vector = self.agents[agent_name]
        metadata = self.metadata[agent_name]
        
        # Create versioned filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{agent_name}_v{timestamp}.npy"
        filepath = self.storage_path / filename
        
        # Save vector
        np.save(filepath, vector)
        
        # Calculate SHA-256
        sha256 = hashlib.sha256(vector.tobytes()).hexdigest()
        
        # Save metadata
        meta_file = filepath.with_suffix('.json')
        meta_data = {
            'agent_name': agent_name,
            'timestamp': timestamp,
            'sha256': sha256,
            'vector_dim': self.VECTOR_DIM,
            'metadata': metadata
        }
        
        with open(meta_file, 'w') as f:
            json.dump(meta_data, f, indent=2)
        
        return sha256
    
    def load_vector(self, agent_name: str, version: Optional[str] = None) -> np.ndarray:
        """Load agent vector from disk"""
        if version:
            filename = f"{agent_name}_v{version}.npy"
        else:
            # Load latest version
            pattern = f"{agent_name}_v*.npy"
            files = sorted(self.storage_path.glob(pattern))
            if not files:
                raise FileNotFoundError(f"No vectors found for {agent_name}")
            filename = files[-1].name
        
        filepath = self.storage_path / filename
        vector = np.load(filepath)
        
        self.agents[agent_name] = vector
        
        # Load metadata
        meta_file = filepath.with_suffix('.json')
        with open(meta_file, 'r') as f:
            meta_data = json.load(f)
            self.metadata[agent_name] = meta_data.get('metadata', {})
        
        return vector


if __name__ == '__main__':
    # Example usage
    engine = ConceptVectorEngine()
    
    # Generate vector for KEEPER
    keeper_metadata = {
        'expertise': ['knowledge', 'architecture'],
        'capabilities': ['analytical', 'research', 'coordination'],
        'output_types': ['documentation', 'protocol', 'schema'],
        'temporal': {'response_urgency': 0.6, 'context_depth': 0.9},
        'complexity': {'max_complexity': 0.8, 'abstraction_level': 0.7},
        'resources': {'collaboration_need': 0.8},
        'ethics': {'constitutional_compliance': 1.0}
    }
    
    keeper_vector = engine.generate_agent_vector('KEEPER', keeper_metadata)
    print(f"Generated KEEPER vector: shape={keeper_vector.shape}")
    
    # Find similar agents
    similar = engine.find_similar_agents('KEEPER', top_k=3)
    print(f"Similar agents to KEEPER: {similar}")