import { describe, it, expect } from 'vitest';
import { QuantumCircuit, QuantumBridge } from './index.js';

describe('Quantum Bridge E2E Checks', () => {
    it('successfully instantiates a quantum circuit', () => {
        const circuit = new QuantumCircuit(2);
        expect(circuit.numQubits).toBe(2);
        expect(circuit.gates.length).toBe(0);

        circuit.h(0);
        expect(circuit.gates.length).toBe(1);
        expect(circuit.gates[0].type).toBe('H');
        expect(circuit.gates[0].targets).toEqual([0]);

        circuit.cx(0, 1);
        expect(circuit.gates.length).toBe(2);
        expect(circuit.gates[1].type).toBe('CX');
        expect(circuit.gates[1].targets).toEqual([0, 1]);
    });

    it('executes a Bell state circuit via bridge using fallback simulator', async () => {
        const circuit = new QuantumCircuit(2);
        // Create Bell state (|00> + |11>) / sqrt(2)
        circuit.h(0);
        circuit.cx(0, 1);
        circuit.measure(0, 0);
        circuit.measure(1, 1);

        const bridge = new QuantumBridge();
        const result = await bridge.execute(circuit, { shots: 500, preferredAdapter: 'fallback' });

        expect(result.success).toBe(true);
        expect(result.adapterUsed).toBe('fallback_simulator');
        
        // Assert that the measurement outputs are only '00' and '11'
        const keys = Object.keys(result.counts);
        expect(keys.length).toBeLessThanOrEqual(2);
        
        for (const state of keys) {
            expect(state === '00' || state === '11').toBe(true);
            expect(result.counts[state]).toBeGreaterThan(150); // statistically highly probable
        }

        // Verify probabilities sum to approximately 1
        const probSum = Object.values(result.probabilities).reduce((acc, p) => acc + p, 0);
        expect(probSum).toBeCloseTo(1.0, 5);

        // Verify statevector has 4 states for 2 qubits
        expect(result.statevector?.length).toBe(4);
    });
});
