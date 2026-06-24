"""Attractor Network Dynamics for Agent Coordination

Implements neural attractor dynamics for stable multi-agent coordination:
1. Pattern completion - Fill in missing information
2. State stabilization - Converge to coherent solutions
3. Noise tolerance - Robust to incomplete inputs
4. Multi-stable states - Multiple valid solution attractors

Research Foundation:
- BioRxiv: Mechanistic theory of planning in prefrontal cortex (2025)
- Neural network attractor dynamics

Performance Target: +7% on ambiguous problems, +12% solution diversity
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
import copy


@dataclass
class Agent:
    """Agent representation for attractor network"""
    name: str
    concept_vector: np.ndarray
    activation: float = 0.0
    bias: float = 0.0


@dataclass
class Problem:
    """Problem specification"""
    description: str
    problem_vector: np.ndarray
    constraints: Dict[str, any] = field(default_factory=dict)
    partial: bool = False  # True if incomplete specification


@dataclass
class Solution:
    """Solution from attractor network"""
    team: List[Agent]
    team_activation_pattern: np.ndarray
    confidence: float
    solution_vector: np.ndarray
    iterations_to_converge: int
    energy: float  # Network energy at convergence


class AttractorNetwork:
    """Neural dynamics for stable agent coordination"""
    
    def __init__(self, agents: List[Agent], concept_engine):
        self.agents = {a.name: a for a in agents}
        self.concept_engine = concept_engine
        self.vector_dim = 2048
        
        # State vector: concatenated agent activations × concept vectors
        self.state_vector = self._initialize_state()
        
        # Connection weight matrix (Hebbian-style)
        self.weight_matrix = self._build_connection_weights()
        
        # Attractor memories (stored solution patterns)
        self.attractors = []
        
    # ========== INITIALIZATION ==========
    
    def _initialize_state(self) -> np.ndarray:
        """Initialize state vector with random small values"""
        n = len(self.agents)
        return np.random.randn(n * self.vector_dim) * 0.01
    
    def _build_connection_weights(self) -> np.ndarray:
        """Build synaptic weight matrix from concept vectors
        
        Uses Hebbian learning rule: W = sum(v_i ⊗ v_j) for all agent pairs
        """
        n = len(self.agents)
        total_dim = n * self.vector_dim
        W = np.zeros((total_dim, total_dim))
        
        agent_list = list(self.agents.values())
        
        for i, agent1 in enumerate(agent_list):
            for j, agent2 in enumerate(agent_list):
                if i == j:
                    continue
                
                # Connection strength = concept vector similarity
                similarity = self._cosine_similarity(
                    agent1.concept_vector,
                    agent2.concept_vector
                )
                
                # Hebbian-style weight: outer product scaled by similarity
                v1 = agent1.concept_vector
                v2 = agent2.concept_vector
                
                # Place in appropriate block of weight matrix
                i_start, i_end = i * self.vector_dim, (i + 1) * self.vector_dim
                j_start, j_end = j * self.vector_dim, (j + 1) * self.vector_dim
                
                W[i_start:i_end, j_start:j_end] = similarity * np.outer(v1, v2)
        
        # Normalize to prevent explosion
        W = W / (np.linalg.norm(W) + 1e-8)
        
        return W
    
    def _cosine_similarity(self, v1: np.ndarray, v2: np.ndarray) -> float:
        """Calculate cosine similarity"""
        return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-8)
    
    # ========== PATTERN COMPLETION ==========
    
    def pattern_completion(self, partial_problem: Problem, max_iterations: int = 100, 
                          convergence_threshold: float = 1e-4) -> Solution:
        """Complete partial problem specification via attractor dynamics
        
        Uses continuous attractor network update rule:
        s_{t+1} = tanh(W @ s_t + input)
        """
        # Encode partial problem as initial state
        initial_state = self._encode_partial_problem(partial_problem)
        
        # Run attractor dynamics until convergence
        state = initial_state.copy()
        
        # External input from problem
        problem_input = self._problem_to_input(partial_problem)
        
        for iteration in range(max_iterations):
            # Update rule: s_{t+1} = tanh(W @ s_t + input)
            state_new = np.tanh(self.weight_matrix @ state + 0.5 * problem_input)
            
            # Check convergence
            delta = np.linalg.norm(state_new - state)
            if delta < convergence_threshold:
                state = state_new
                break
            
            state = state_new
        
        # Decode converged state to agent activation pattern
        agent_activations = self._decode_state_to_agents(state)
        
        # Form team from highly activated agents
        threshold = 0.7
        team = [agent for agent, activation in agent_activations if activation > threshold]
        
        # Calculate solution vector
        solution_vector = self._compute_solution_vector(team)
        
        # Calculate confidence
        confidence = self._calculate_solution_confidence(agent_activations, state)
        
        # Calculate energy
        energy = self._calculate_energy(state)
        
        return Solution(
            team=team,
            team_activation_pattern=np.array([a for _, a in agent_activations]),
            confidence=confidence,
            solution_vector=solution_vector,
            iterations_to_converge=iteration + 1,
            energy=energy
        )
    
    def _encode_partial_problem(self, problem: Problem) -> np.ndarray:
        """Encode problem as initial state vector"""
        state = np.zeros(len(self.agents) * self.vector_dim)
        
        # If problem vector provided, use it to activate relevant agents
        if problem.problem_vector is not None:
            for i, agent in enumerate(self.agents.values()):
                similarity = self._cosine_similarity(
                    problem.problem_vector,
                    agent.concept_vector
                )
                
                # Initialize agent's state proportional to similarity
                i_start = i * self.vector_dim
                i_end = (i + 1) * self.vector_dim
                state[i_start:i_end] = similarity * agent.concept_vector
        
        return state
    
    def _problem_to_input(self, problem: Problem) -> np.ndarray:
        """Convert problem to external input vector"""
        input_vector = np.zeros(len(self.agents) * self.vector_dim)
        
        if problem.problem_vector is not None:
            # Replicate problem vector across all agent slots
            for i in range(len(self.agents)):
                i_start = i * self.vector_dim
                i_end = (i + 1) * self.vector_dim
                input_vector[i_start:i_end] = problem.problem_vector
        
        return input_vector
    
    def _decode_state_to_agents(self, state: np.ndarray) -> List[Tuple[Agent, float]]:
        """Decode state vector to agent activation levels"""
        activations = []
        
        for i, agent in enumerate(self.agents.values()):
            # Extract agent's portion of state
            i_start = i * self.vector_dim
            i_end = (i + 1) * self.vector_dim
            agent_state = state[i_start:i_end]
            
            # Activation = similarity between agent state and concept vector
            activation = self._cosine_similarity(agent_state, agent.concept_vector)
            activation = max(0.0, activation)  # ReLU
            
            activations.append((agent, activation))
        
        return activations
    
    def _compute_solution_vector(self, team: List[Agent]) -> np.ndarray:
        """Compute solution vector from team composition"""
        if not team:
            return np.zeros(self.vector_dim)
        
        # Average concept vectors of team members
        vectors = [agent.concept_vector for agent in team]
        solution = np.mean(vectors, axis=0)
        
        return solution / np.linalg.norm(solution)
    
    def _calculate_solution_confidence(self, activations: List[Tuple[Agent, float]], 
                                      state: np.ndarray) -> float:
        """Calculate confidence in solution"""
        # Confidence factors:
        # 1. Peak activation strength
        max_activation = max(a for _, a in activations)
        
        # 2. Activation concentration (fewer highly activated = better)
        high_activations = sum(1 for _, a in activations if a > 0.7)
        concentration = 1.0 / (1.0 + high_activations * 0.1)
        
        # 3. State stability (low gradient = stable)
        gradient = np.linalg.norm(self.weight_matrix @ state)
        stability = 1.0 / (1.0 + gradient)
        
        # Aggregate
        confidence = (max_activation + concentration + stability) / 3.0
        return min(confidence, 1.0)
    
    def _calculate_energy(self, state: np.ndarray) -> float:
        """Calculate network energy (Hopfield energy function)
        
        E = -0.5 * s^T * W * s
        """
        energy = -0.5 * state @ self.weight_matrix @ state
        return float(energy)
    
    # ========== MULTI-STABLE SEARCH ==========
    
    def multi_stable_search(self, problem: Problem, num_trials: int = 10) -> List[Solution]:
        """Find multiple valid solution attractors
        
        Different initial conditions → different attractors
        """
        solutions = []
        
        # Run with different random initializations
        for trial in range(num_trials):
            # Random initialization with problem bias
            initial_state = self._random_initialization()
            
            # Encode problem as external input
            problem_input = self._problem_to_input(problem)
            
            # Run dynamics
            state = initial_state
            for iteration in range(100):
                state_new = np.tanh(self.weight_matrix @ state + 0.5 * problem_input)
                
                # Check convergence
                if np.linalg.norm(state_new - state) < 1e-4:
                    state = state_new
                    break
                
                state = state_new
            
            # Decode to solution
            solution = self._state_to_solution(state, iteration + 1)
            
            # Only add if distinct from previous solutions
            if not self._is_duplicate(solution, solutions):
                solutions.append(solution)
        
        # Sort by confidence descending
        solutions.sort(key=lambda s: s.confidence, reverse=True)
        
        return solutions
    
    def _random_initialization(self) -> np.ndarray:
        """Create random initial state"""
        return np.random.randn(len(self.agents) * self.vector_dim) * 0.1
    
    def _state_to_solution(self, state: np.ndarray, iterations: int) -> Solution:
        """Convert converged state to Solution object"""
        agent_activations = self._decode_state_to_agents(state)
        team = [agent for agent, activation in agent_activations if activation > 0.7]
        solution_vector = self._compute_solution_vector(team)
        confidence = self._calculate_solution_confidence(agent_activations, state)
        energy = self._calculate_energy(state)
        
        return Solution(
            team=team,
            team_activation_pattern=np.array([a for _, a in agent_activations]),
            confidence=confidence,
            solution_vector=solution_vector,
            iterations_to_converge=iterations,
            energy=energy
        )
    
    def _is_duplicate(self, solution: Solution, existing: List[Solution], 
                     threshold: float = 0.9) -> bool:
        """Check if solution is duplicate of existing"""
        for existing_sol in existing:
            # Compare team compositions
            team1_names = {a.name for a in solution.team}
            team2_names = {a.name for a in existing_sol.team}
            
            # Jaccard similarity
            intersection = len(team1_names & team2_names)
            union = len(team1_names | team2_names)
            
            if union == 0:
                continue
            
            similarity = intersection / union
            
            if similarity >= threshold:
                return True
        
        return False
    
    # ========== ATTRACTOR STORAGE ==========
    
    def store_attractor(self, solution: Solution) -> None:
        """Store successful solution as attractor"""
        self.attractors.append({
            'team_names': [a.name for a in solution.team],
            'solution_vector': solution.solution_vector,
            'activation_pattern': solution.team_activation_pattern,
            'energy': solution.energy
        })
        
        # Update weight matrix to strengthen this attractor
        self._strengthen_attractor(solution)
    
    def _strengthen_attractor(self, solution: Solution) -> None:
        """Strengthen synaptic connections for this solution pattern"""
        # Hebbian learning: ΔW = η * x * x^T
        learning_rate = 0.01
        
        # Reconstruct full state from solution
        state = self._solution_to_state(solution)
        
        # Outer product update
        delta_W = learning_rate * np.outer(state, state)
        
        # Update weights
        self.weight_matrix += delta_W
        
        # Normalize to prevent explosion
        self.weight_matrix = self.weight_matrix / (np.linalg.norm(self.weight_matrix) + 1e-8)
    
    def _solution_to_state(self, solution: Solution) -> np.ndarray:
        """Reconstruct state vector from solution"""
        state = np.zeros(len(self.agents) * self.vector_dim)
        
        agent_list = list(self.agents.values())
        
        for i, agent in enumerate(agent_list):
            if agent in solution.team:
                # Activated agent: use its concept vector
                i_start = i * self.vector_dim
                i_end = (i + 1) * self.vector_dim
                state[i_start:i_end] = agent.concept_vector
        
        return state
    
    # ========== RETRIEVAL ==========
    
    def retrieve_similar_attractors(self, problem: Problem, top_k: int = 5) -> List[Dict]:
        """Retrieve stored attractors similar to problem"""
        similarities = []
        
        for attractor in self.attractors:
            sim = self._cosine_similarity(
                problem.problem_vector,
                attractor['solution_vector']
            )
            similarities.append((sim, attractor))
        
        # Sort by similarity
        similarities.sort(reverse=True, key=lambda x: x[0])
        
        return [att for _, att in similarities[:top_k]]


class AttractorCoordinationAgent:
    """Main interface for attractor-based coordination"""
    
    def __init__(self, agents: List[Agent], concept_engine):
        self.network = AttractorNetwork(agents, concept_engine)
        self.name = "ATTRACTOR_COORDINATOR"
        self.version = "1.0.0"
    
    def solve(self, problem: Problem, find_alternatives: bool = False) -> List[Solution]:
        """Solve problem using attractor dynamics"""
        if find_alternatives:
            # Find multiple solutions
            return self.network.multi_stable_search(problem, num_trials=10)
        else:
            # Find single best solution
            solution = self.network.pattern_completion(problem)
            return [solution]
    
    def learn_from_solution(self, solution: Solution) -> None:
        """Store successful solution as attractor"""
        self.network.store_attractor(solution)
