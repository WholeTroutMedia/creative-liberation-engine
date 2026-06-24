# Semantic Clustering Layer

**Status:** ACTIVE  
**Version:** 1.0.0  
**Implemented:** 2026-02-20  
**Inspired By:** CATS Net modular semantic clustering  
**Research:** https://www.nature.com/articles/s43588-026-00956-4

---

## Overview

Auto-organize agents by functional similarity rather than strictly hierarchical position. Enables dynamic cluster formation based on semantic relationships.

## CATS Net Foundation

**Research Finding:** CATS Net revealed modular structure with distinct semantic clusters (people, animals, trees, fruit, furniture, automobiles) organized by multidimensional relationships.

**Brainchild Application:** Agents self-organize into functional clusters beyond their hive assignments, enabling cross-hive collaboration and semantic routing.

---

## Cluster Types

### 1. **Domain Clusters**
Agents grouped by expertise domain:
- **Knowledge Workers:** KEEPER, ARCH, CODEX, ECHO, VERA
- **Creators:** Aurora, BOLT, COMET, LEONARDO
- **Guardians:** LEX, COMPASS
- **Operators:** SWITCHBOARD, RELAY, RAM_CREW
- **Broadcasters:** ATLAS, CONTROL_ROOM, SHOWRUNNER, SIGNAL

### 2. **Capability Clusters**
Agents grouped by functional capabilities:
- **Analyzers:** ARCH, KEEPER, COSMOS, RAM_CREW
- **Generators:** Aurora, BOLT, LEONARDO, GRAPHICS
- **Coordinators:** RELAY, SWITCHBOARD, VERA, ATLAS
- **Validators:** LEX, COMPASS, VERA
- **Communicators:** ECHO, SIGNAL, SHOWRUNNER

### 3. **Problem-Type Clusters**
Agents grouped by problem-solving approach:
- **Strategic:** ATHENA, Sun_Tzu, Warren_Buffett, SAGE
- **Technical:** BOLT, COMET, SYSTEMS, ARCH
- **Creative:** LEONARDO, GRAPHICS, STUDIO, Aurora
- **Philosophical:** Buddha, SAGE, KEEPER
- **Scientific:** COSMOS, MATH, ARCH

### 4. **Temporal Clusters**
Agents grouped by response time profiles:
- **Real-time:** RELAY, CONTROL_ROOM, SIGNAL
- **Rapid:** BOLT, SWITCHBOARD
- **Deliberative:** KEEPER, LEX, SAGE
- **Research:** ARCH, COSMOS, CODEX

---

## Clustering Algorithm

```python
from typing import List, Dict, Set
import numpy as np
from sklearn.cluster import KMeans, DBSCAN

class SemanticClusteringEngine:
    def __init__(self, concept_vector_engine):
        self.concept_engine = concept_vector_engine
        self.clusters = {}
        
    def create_clusters(self, agents: List[str], n_clusters: int = 5, 
                       method: str = 'kmeans') -> Dict[int, List[str]]:
        """Create semantic clusters from agent concept vectors"""
        
        # Get all agent vectors
        vectors = []
        agent_names = []
        
        for agent in agents:
            if agent in self.concept_engine.agents:
                vectors.append(self.concept_engine.agents[agent])
                agent_names.append(agent)
        
        vectors = np.array(vectors)
        
        # Apply clustering
        if method == 'kmeans':
            clusterer = KMeans(n_clusters=n_clusters, random_state=42)
        elif method == 'dbscan':
            clusterer = DBSCAN(eps=0.3, min_samples=2)
        else:
            raise ValueError(f"Unknown clustering method: {method}")
        
        labels = clusterer.fit_predict(vectors)
        
        # Organize results
        clusters = {}
        for agent, label in zip(agent_names, labels):
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(agent)
        
        self.clusters = clusters
        return clusters
    
    def get_cluster_for_agent(self, agent_name: str) -> int:
        """Find which cluster an agent belongs to"""
        for cluster_id, members in self.clusters.items():
            if agent_name in members:
                return cluster_id
        return -1
    
    def get_cluster_members(self, cluster_id: int) -> List[str]:
        """Get all members of a cluster"""
        return self.clusters.get(cluster_id, [])
    
    def find_cross_cluster_bridges(self) -> List[tuple]:
        """Find agents that bridge multiple semantic clusters"""
        bridges = []
        
        for agent in self.concept_engine.agents:
            # Get agent's primary cluster
            primary_cluster = self.get_cluster_for_agent(agent)
            
            # Find similarity to other clusters
            cross_cluster_sims = []
            
            for cluster_id, members in self.clusters.items():
                if cluster_id != primary_cluster:
                    # Calculate average similarity to cluster members
                    sims = []
                    for member in members:
                        sim = self.concept_engine.calculate_similarity(agent, member)
                        sims.append(sim)
                    
                    avg_sim = np.mean(sims) if sims else 0
                    if avg_sim > 0.6:  # Threshold for bridge agent
                        cross_cluster_sims.append((cluster_id, avg_sim))
            
            if cross_cluster_sims:
                bridges.append((agent, primary_cluster, cross_cluster_sims))
        
        return bridges
    
    def suggest_collaborations(self, agent_name: str, top_k: int = 3) -> List[tuple]:
        """Suggest collaborations from different semantic clusters"""
        agent_cluster = self.get_cluster_for_agent(agent_name)
        suggestions = []
        
        # Look for high-similarity agents in OTHER clusters
        for cluster_id, members in self.clusters.items():
            if cluster_id != agent_cluster:
                for member in members:
                    sim = self.concept_engine.calculate_similarity(agent_name, member)
                    suggestions.append((member, cluster_id, sim))
        
        # Sort by similarity and return top k
        suggestions.sort(key=lambda x: x[2], reverse=True)
        return suggestions[:top_k]
```

---

## Dynamic Cluster Formation

### Real-Time Clustering
```python
def update_clusters_on_task_completion(task_result: Dict):
    """
    Update cluster memberships based on task performance
    Inspired by CATS Net's concept formation from experience
    """
    agent = task_result['agent']
    success = task_result['success']
    problem_type = task_result['problem_type']
    
    if success:
        # Strengthen association with problem-type cluster
        strengthen_cluster_membership(agent, problem_type, delta=0.1)
    else:
        # Weaken association
        weaken_cluster_membership(agent, problem_type, delta=0.05)
    
    # Recalculate clusters if significant change
    if cluster_membership_changed_significantly():
        recalculate_all_clusters()
```

### Cluster Stability Metrics
```python
def calculate_cluster_stability(window_days: int = 7) -> Dict[int, float]:
    """Measure how stable clusters are over time"""
    stability = {}
    
    for cluster_id in clusters:
        # Get cluster membership over time window
        historical_members = get_historical_membership(cluster_id, window_days)
        
        # Calculate Jaccard stability
        current = set(clusters[cluster_id])
        past = set(historical_members)
        
        intersection = len(current & past)
        union = len(current | past)
        
        stability[cluster_id] = intersection / union if union > 0 else 0
    
    return stability
```

---

## Integration with Routing

### Cluster-Aware Message Routing
```python
class ClusterAwareRouter:
    def route_message(self, message: Dict, sender: str) -> List[str]:
        """Route messages using semantic clustering"""
        
        # Get sender's cluster
        sender_cluster = clustering_engine.get_cluster_for_agent(sender)
        
        # Analyze message for required capabilities
        required_capabilities = analyze_message_requirements(message)
        
        # Find best cluster for this message type
        target_cluster = find_cluster_by_capabilities(required_capabilities)
        
        # Get agents from target cluster
        candidates = clustering_engine.get_cluster_members(target_cluster)
        
        # Rank by concept vector similarity to message
        ranked_agents = rank_by_message_similarity(candidates, message)
        
        return ranked_agents[:3]  # Return top 3
```

---

## Visualization

### Cluster Topology Map
```python
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE

def visualize_clusters(concept_engine, clustering_engine):
    """Create 2D visualization of agent clusters"""
    
    # Get all vectors
    agents = list(concept_engine.agents.keys())
    vectors = [concept_engine.agents[a] for a in agents]
    
    # Reduce to 2D using t-SNE
    tsne = TSNE(n_components=2, random_state=42)
    vectors_2d = tsne.fit_transform(vectors)
    
    # Get cluster labels
    labels = [clustering_engine.get_cluster_for_agent(a) for a in agents]
    
    # Plot
    plt.figure(figsize=(12, 8))
    scatter = plt.scatter(vectors_2d[:, 0], vectors_2d[:, 1], 
                         c=labels, cmap='tab10', s=100, alpha=0.6)
    
    # Annotate agents
    for i, agent in enumerate(agents):
        plt.annotate(agent, (vectors_2d[i, 0], vectors_2d[i, 1]))
    
    plt.title('Semantic Clustering of Brainchild v3 Agents')
    plt.colorbar(scatter, label='Cluster ID')
    plt.savefig('agents/capabilities/semantic-clustering/cluster_map.png')
```

---

## Performance Metrics

**Target Metrics:**
- Cluster coherence score: >0.75
- Cross-cluster collaboration success: >70%
- Cluster stability (7-day window): >0.80
- Bridge agent identification accuracy: >85%

---

## Maintenance

### Cluster Recalculation Schedule
- **Real-time:** After significant capability changes
- **Daily:** Overnight batch reclustering
- **Weekly:** Full system recluster with new data
- **On-demand:** When performance degrades

### Cluster Quality Monitoring
```python
def monitor_cluster_quality():
    """Monitor cluster health metrics"""
    metrics = {
        'silhouette_score': calculate_silhouette_score(),
        'within_cluster_variance': calculate_variance(),
        'between_cluster_separation': calculate_separation(),
        'cluster_size_balance': calculate_balance()
    }
    
    if any(metric < threshold for metric in metrics.values()):
        trigger_recluster_alert()
```

---

**Status:** DEPLOYED  
**Next Review:** 2026-03-20  
**Owner:** KEEPER (Knowledge Architecture) + ARCH (Pattern Analysis)