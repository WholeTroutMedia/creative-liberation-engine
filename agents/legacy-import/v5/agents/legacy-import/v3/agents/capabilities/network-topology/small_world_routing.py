"""Small-World Network Topology Overlay

Overlays small-world architecture on hierarchical hive structure:
1. Local clustering - High connectivity within hives
2. Long-range shortcuts - Semantic similarity-based connections
3. Efficient routing - Shortest paths via concept vectors
4. Resilience - Redundant paths for failure tolerance

Research Foundation:
- Nature: The network architecture of general intelligence (2026)
- Human brain connectome exhibits small-world properties

Performance Target: +10% routing efficiency, +25% failure resilience
"""

import numpy as np
import heapq
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass, field
from collections import defaultdict
import random


@dataclass
class Agent:
    """Agent representation for network topology"""
    id: int
    name: str
    hive: str
    concept_vector: np.ndarray
    subordinates: List[int] = field(default_factory=list)
    status: str = 'active'


@dataclass
class Path:
    """Path through agent network"""
    agents: List[Agent]
    total_distance: float
    hop_count: int
    uses_shortcuts: bool
    reliability: float


class SmallWorldNetwork:
    """Overlay small-world topology on hierarchical hive structure"""
    
    def __init__(self, agents: List[Agent], concept_engine, shortcut_probability: float = 0.1):
        self.agents = {a.id: a for a in agents}
        self.concept_engine = concept_engine
        self.shortcut_prob = shortcut_probability
        
        # Build base adjacency matrix from hierarchy
        self.adjacency_matrix = self._build_adjacency_matrix()
        
        # Add small-world shortcuts
        self.shortcuts = self._add_small_world_shortcuts()
        
        # Calculate network properties
        self.clustering_coefficient = self._calculate_clustering()
        self.characteristic_path_length = self._calculate_path_length()
    
    # ========== GRAPH CONSTRUCTION ==========
    
    def _build_adjacency_matrix(self) -> np.ndarray:
        """Build connectivity graph from hive structure"""
        n = len(self.agents)
        matrix = np.zeros((n, n))
        
        # Add hierarchical connections (parent-child)
        for agent in self.agents.values():
            for subordinate_id in agent.subordinates:
                if subordinate_id in self.agents:
                    matrix[agent.id][subordinate_id] = 1.0
                    matrix[subordinate_id][agent.id] = 1.0  # Bidirectional
        
        # Add within-hive connections (all members connected)
        hives = self._group_by_hive()
        for hive_name, members in hives.items():
            for i, agent1 in enumerate(members):
                for agent2 in members[i+1:]:
                    matrix[agent1.id][agent2.id] = 1.0
                    matrix[agent2.id][agent1.id] = 1.0
        
        return matrix
    
    def _group_by_hive(self) -> Dict[str, List[Agent]]:
        """Group agents by their hive"""
        hives = defaultdict(list)
        for agent in self.agents.values():
            hives[agent.hive].append(agent)
        return dict(hives)
    
    def _add_small_world_shortcuts(self) -> Dict[Tuple[int, int], float]:
        """Add long-range connections based on concept vector similarity
        
        Small-world property: combine local clustering with long-range shortcuts
        """
        shortcuts = {}
        
        for agent1 in self.agents.values():
            # Find semantically similar agents in distant hives
            similar_agents = self._find_similar_remote_agents(agent1, top_k=10)
            
            for agent2, similarity in similar_agents:
                # Only add shortcut if not already connected
                if not self._are_connected(agent1.id, agent2.id):
                    # Probabilistic addition based on similarity
                    if similarity > 0.8 and random.random() < self.shortcut_prob:
                        shortcuts[(agent1.id, agent2.id)] = similarity
                        shortcuts[(agent2.id, agent1.id)] = similarity
                        
                        # Update adjacency matrix
                        self.adjacency_matrix[agent1.id][agent2.id] = 1.0
                        self.adjacency_matrix[agent2.id][agent1.id] = 1.0
        
        return shortcuts
    
    def _find_similar_remote_agents(self, agent: Agent, top_k: int = 10) -> List[Tuple[Agent, float]]:
        """Find similar agents in different hives"""
        similarities = []
        
        for other_agent in self.agents.values():
            if other_agent.id == agent.id:
                continue
            
            # Only consider agents from different hives (long-range)
            if other_agent.hive == agent.hive:
                continue
            
            # Calculate concept vector similarity
            sim = self._cosine_similarity(
                agent.concept_vector,
                other_agent.concept_vector
            )
            
            similarities.append((other_agent, sim))
        
        # Sort by similarity descending
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]
    
    def _cosine_similarity(self, v1: np.ndarray, v2: np.ndarray) -> float:
        """Calculate cosine similarity between vectors"""
        return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-8)
    
    def _are_connected(self, id1: int, id2: int) -> bool:
        """Check if two agents are directly connected"""
        return self.adjacency_matrix[id1][id2] > 0
    
    # ========== ROUTING ALGORITHMS ==========
    
    def find_shortest_path(self, source_id: int, target_id: int) -> Path:
        """Use small-world topology for efficient routing with Dijkstra"""
        if source_id not in self.agents or target_id not in self.agents:
            return Path(agents=[], total_distance=float('inf'), hop_count=0, 
                       uses_shortcuts=False, reliability=0.0)
        
        # Dijkstra with concept vector weights
        distances = {agent_id: float('inf') for agent_id in self.agents}
        distances[source_id] = 0.0
        previous = {}
        unvisited = set(self.agents.keys())
        
        while unvisited:
            # Find node with minimum distance
            current = min(unvisited, key=lambda x: distances[x])
            
            if current == target_id:
                break
            
            if distances[current] == float('inf'):
                break  # No path exists
            
            unvisited.remove(current)
            
            # Check all neighbors
            for neighbor_id in self._get_neighbors(current):
                if neighbor_id in unvisited:
                    # Weight by concept vector similarity (prefer semantic matches)
                    similarity = self._calculate_edge_weight(current, neighbor_id)
                    distance = distances[current] + (2.0 - similarity)  # Lower = better
                    
                    if distance < distances[neighbor_id]:
                        distances[neighbor_id] = distance
                        previous[neighbor_id] = current
        
        # Reconstruct path
        if distances[target_id] == float('inf'):
            return Path(agents=[], total_distance=float('inf'), hop_count=0,
                       uses_shortcuts=False, reliability=0.0)
        
        path_agents = []
        current = target_id
        while current in previous:
            path_agents.append(self.agents[current])
            current = previous[current]
        path_agents.append(self.agents[source_id])
        path_agents.reverse()
        
        # Check if path uses shortcuts
        uses_shortcuts = any(
            (path_agents[i].id, path_agents[i+1].id) in self.shortcuts
            for i in range(len(path_agents) - 1)
        )
        
        # Calculate reliability
        reliability = self._calculate_path_reliability(path_agents)
        
        return Path(
            agents=path_agents,
            total_distance=distances[target_id],
            hop_count=len(path_agents) - 1,
            uses_shortcuts=uses_shortcuts,
            reliability=reliability
        )
    
    def _get_neighbors(self, agent_id: int) -> List[int]:
        """Get all directly connected agents"""
        neighbors = []
        for other_id in self.agents:
            if self.adjacency_matrix[agent_id][other_id] > 0:
                neighbors.append(other_id)
        return neighbors
    
    def _calculate_edge_weight(self, id1: int, id2: int) -> float:
        """Calculate edge weight based on concept vector similarity"""
        agent1 = self.agents[id1]
        agent2 = self.agents[id2]
        return self._cosine_similarity(agent1.concept_vector, agent2.concept_vector)
    
    def _calculate_path_reliability(self, path: List[Agent]) -> float:
        """Calculate reliability of path (all agents operational)"""
        # Assume each active agent has 99% reliability
        agent_reliability = 0.99
        active_count = sum(1 for a in path if a.status == 'active')
        return agent_reliability ** active_count
    
    # ========== RESILIENCE ==========
    
    def find_redundant_paths(self, source_id: int, target_id: int, k: int = 3) -> List[Path]:
        """Find k node-disjoint paths for fault tolerance"""
        paths = []
        
        # Create copy of graph
        original_matrix = self.adjacency_matrix.copy()
        
        for _ in range(k):
            # Find shortest path with current graph
            path = self.find_shortest_path(source_id, target_id)
            
            if not path.agents or path.total_distance == float('inf'):
                break  # No more paths exist
            
            paths.append(path)
            
            # Remove nodes from path (except source/target) to find disjoint path
            for agent in path.agents[1:-1]:
                self.adjacency_matrix[agent.id, :] = 0
                self.adjacency_matrix[:, agent.id] = 0
        
        # Restore original graph
        self.adjacency_matrix = original_matrix
        
        return paths
    
    def calculate_network_resilience(self) -> float:
        """Measure network resilience to random failures
        
        Simulate random agent failures and measure connectivity
        """
        n_simulations = 100
        failure_rate = 0.2  # 20% agents fail
        
        connectivity_scores = []
        
        for _ in range(n_simulations):
            # Randomly fail some agents
            failed = random.sample(list(self.agents.keys()), 
                                 int(len(self.agents) * failure_rate))
            
            # Calculate connectivity with failures
            connectivity = self._calculate_connectivity(exclude=failed)
            connectivity_scores.append(connectivity)
        
        # Average connectivity under failures
        return np.mean(connectivity_scores)
    
    def _calculate_connectivity(self, exclude: List[int] = None) -> float:
        """Calculate what fraction of agent pairs can still communicate"""
        if exclude is None:
            exclude = []
        
        active_agents = [aid for aid in self.agents if aid not in exclude]
        
        if len(active_agents) < 2:
            return 0.0
        
        # Count reachable pairs
        reachable = 0
        total_pairs = 0
        
        for i, agent1 in enumerate(active_agents):
            for agent2 in active_agents[i+1:]:
                total_pairs += 1
                
                # Check if path exists (ignoring failed nodes)
                if self._path_exists_avoiding(agent1, agent2, exclude):
                    reachable += 1
        
        return reachable / total_pairs if total_pairs > 0 else 0.0
    
    def _path_exists_avoiding(self, source_id: int, target_id: int, avoid: List[int]) -> bool:
        """Check if path exists while avoiding certain nodes"""
        # BFS to check connectivity
        visited = set(avoid)
        queue = [source_id]
        visited.add(source_id)
        
        while queue:
            current = queue.pop(0)
            
            if current == target_id:
                return True
            
            for neighbor in self._get_neighbors(current):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        
        return False
    
    # ========== NETWORK METRICS ==========
    
    def _calculate_clustering(self) -> float:
        """Calculate clustering coefficient (local connectivity)"""
        coefficients = []
        
        for agent_id in self.agents:
            neighbors = self._get_neighbors(agent_id)
            
            if len(neighbors) < 2:
                continue  # Need at least 2 neighbors
            
            # Count edges between neighbors
            edges_between_neighbors = 0
            for i, n1 in enumerate(neighbors):
                for n2 in neighbors[i+1:]:
                    if self._are_connected(n1, n2):
                        edges_between_neighbors += 1
            
            # Clustering coefficient for this node
            max_edges = len(neighbors) * (len(neighbors) - 1) / 2
            coefficient = edges_between_neighbors / max_edges if max_edges > 0 else 0
            coefficients.append(coefficient)
        
        return np.mean(coefficients) if coefficients else 0.0
    
    def _calculate_path_length(self) -> float:
        """Calculate characteristic path length (average shortest path)"""
        path_lengths = []
        
        agent_ids = list(self.agents.keys())
        
        for i, source in enumerate(agent_ids):
            for target in agent_ids[i+1:]:
                path = self.find_shortest_path(source, target)
                if path.total_distance < float('inf'):
                    path_lengths.append(path.hop_count)
        
        return np.mean(path_lengths) if path_lengths else 0.0
    
    def is_small_world(self) -> bool:
        """Check if network exhibits small-world properties
        
        Small-world: high clustering + low path length
        """
        # Compare to random graph
        # Small-world has C >> C_random and L ≈ L_random
        
        # For small-world:
        # - Clustering coefficient > 0.3
        # - Average path length < log(N)
        
        n = len(self.agents)
        max_path_length = np.log(n) if n > 1 else 1
        
        return (self.clustering_coefficient > 0.3 and 
                self.characteristic_path_length < max_path_length)
    
    def get_network_stats(self) -> Dict:
        """Get comprehensive network statistics"""
        return {
            'num_agents': len(self.agents),
            'num_shortcuts': len(self.shortcuts) // 2,  # Each shortcut counted twice
            'clustering_coefficient': self.clustering_coefficient,
            'characteristic_path_length': self.characteristic_path_length,
            'is_small_world': self.is_small_world(),
            'resilience': self.calculate_network_resilience()
        }
