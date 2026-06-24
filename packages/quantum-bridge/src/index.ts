import { exec } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import os from 'os';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface QuantumGate {
    type: 'H' | 'X' | 'Y' | 'Z' | 'CX' | 'RX' | 'RY' | 'RZ';
    targets: number[]; // qubit indices
    params?: number[]; // e.g. rotation angles
}

export interface Measurement {
    qubit: number;
    classicalReg: number;
}

export interface QuantumExecutionResult {
    success: boolean;
    counts: Record<string, number>;
    probabilities: Record<string, number>;
    statevector?: number[][]; // Real & imaginary components for each state
    adapterUsed: 'qiskit' | 'pennylane' | 'fallback_simulator';
    error?: string;
    stdout?: string;
}

// ─── QUANTUM CIRCUIT ──────────────────────────────────────────────────────────

export class QuantumCircuit {
    numQubits: number;
    numClassicalRegs: number;
    gates: QuantumGate[] = [];
    measurements: Measurement[] = [];

    constructor(qubits: number, classicalRegs: number = 0) {
        if (qubits <= 0) throw new Error("Circuit must have at least 1 qubit.");
        this.numQubits = qubits;
        this.numClassicalRegs = classicalRegs || qubits;
    }

    h(qubit: number): this {
        this.validateQubit(qubit);
        this.gates.push({ type: 'H', targets: [qubit] });
        return this;
    }

    x(qubit: number): this {
        this.validateQubit(qubit);
        this.gates.push({ type: 'X', targets: [qubit] });
        return this;
    }

    y(qubit: number): this {
        this.validateQubit(qubit);
        this.gates.push({ type: 'Y', targets: [qubit] });
        return this;
    }

    z(qubit: number): this {
        this.validateQubit(qubit);
        this.gates.push({ type: 'Z', targets: [qubit] });
        return this;
    }

    cx(control: number, target: number): this {
        this.validateQubit(control);
        this.validateQubit(target);
        if (control === target) throw new Error("Control and target qubits must be distinct.");
        this.gates.push({ type: 'CX', targets: [control, target] });
        return this;
    }

    rx(qubit: number, theta: number): this {
        this.validateQubit(qubit);
        this.gates.push({ type: 'RX', targets: [qubit], params: [theta] });
        return this;
    }

    ry(qubit: number, theta: number): this {
        this.validateQubit(qubit);
        this.gates.push({ type: 'RY', targets: [qubit], params: [theta] });
        return this;
    }

    rz(qubit: number, theta: number): this {
        this.validateQubit(qubit);
        this.gates.push({ type: 'RZ', targets: [qubit], params: [theta] });
        return this;
    }

    measure(qubit: number, classicalReg: number): this {
        this.validateQubit(qubit);
        if (classicalReg < 0 || classicalReg >= this.numClassicalRegs) {
            throw new Error(`Classical register index ${classicalReg} out of bounds (0 to ${this.numClassicalRegs - 1}).`);
        }
        this.measurements.push({ qubit, classicalReg });
        return this;
    }

    private validateQubit(qubit: number) {
        if (qubit < 0 || qubit >= this.numQubits) {
            throw new Error(`Qubit index ${qubit} out of bounds (0 to ${this.numQubits - 1}).`);
        }
    }
}

// ─── PLUGGABLE ADAPTER INTERFACE ──────────────────────────────────────────────

export interface QuantumAdapter {
    name: 'qiskit' | 'pennylane' | 'fallback';
    generatePythonScript(circuit: QuantumCircuit, shots: number): string;
}

// 1. QISKIT ADAPTER
export class QiskitAdapter implements QuantumAdapter {
    name = 'qiskit' as const;

    generatePythonScript(circuit: QuantumCircuit, shots: number): string {
        let py = `
import json
import sys

try:
    from qiskit import QuantumCircuit, transpile
    from qiskit_aer import Aer
    HAS_QISKIT = True
except ImportError:
    HAS_QISKIT = False

if HAS_QISKIT:
    qc = QuantumCircuit(${circuit.numQubits}, ${circuit.numClassicalRegs})
`;

        for (const gate of circuit.gates) {
            if (gate.type === 'H') {
                py += `    qc.h(${gate.targets[0]})\n`;
            } else if (gate.type === 'X') {
                py += `    qc.x(${gate.targets[0]})\n`;
            } else if (gate.type === 'Y') {
                py += `    qc.y(${gate.targets[0]})\n`;
            } else if (gate.type === 'Z') {
                py += `    qc.z(${gate.targets[0]})\n`;
            } else if (gate.type === 'CX') {
                py += `    qc.cx(${gate.targets[0]}, ${gate.targets[1]})\n`;
            } else if (gate.type === 'RX') {
                py += `    qc.rx(${gate.params![0]}, ${gate.targets[0]})\n`;
            } else if (gate.type === 'RY') {
                py += `    qc.ry(${gate.params![0]}, ${gate.targets[0]})\n`;
            } else if (gate.type === 'RZ') {
                py += `    qc.rz(${gate.params![0]}, ${gate.targets[0]})\n`;
            }
        }

        for (const meas of circuit.measurements) {
            py += `    qc.measure(${meas.qubit}, ${meas.classicalReg})\n`;
        }

        py += `
    simulator = Aer.get_backend('aer_simulator')
    compiled_circuit = transpile(qc, simulator)
    job = simulator.run(compiled_circuit, shots=${shots})
    result = job.result()
    counts = result.get_counts(qc)
    
    # Calculate probabilities
    total_shots = sum(counts.values())
    probabilities = {k: v / total_shots for k, v in counts.items()}
    
    print(json.dumps({
        "success": True,
        "counts": counts,
        "probabilities": probabilities,
        "adapterUsed": "qiskit"
    }))
else:
    # Trigger fallback indicator
    print(json.dumps({"success": False, "error": "Qiskit not installed"}))
`;
        return py;
    }
}

// 2. PENNYLANE ADAPTER
export class PennyLaneAdapter implements QuantumAdapter {
    name = 'pennylane' as const;

    generatePythonScript(circuit: QuantumCircuit, shots: number): string {
        let py = `
import json
import sys

try:
    import pennylane as qml
    from pennylane import numpy as np
    HAS_PENNYLANE = True
except ImportError:
    HAS_PENNYLANE = False

if HAS_PENNYLANE:
    dev = qml.device("default.qubit", wires=${circuit.numQubits}, shots=${shots})
    
    @qml.qnode(dev)
    def q_circuit():
`;

        for (const gate of circuit.gates) {
            if (gate.type === 'H') {
                py += `        qml.Hadamard(wires=${gate.targets[0]})\n`;
            } else if (gate.type === 'X') {
                py += `        qml.PauliX(wires=${gate.targets[0]})\n`;
            } else if (gate.type === 'Y') {
                py += `        qml.PauliY(wires=${gate.targets[0]})\n`;
            } else if (gate.type === 'Z') {
                py += `        qml.PauliZ(wires=${gate.targets[0]})\n`;
            } else if (gate.type === 'CX') {
                py += `        qml.CNOT(wires=[${gate.targets[0]}, ${gate.targets[1]}])\n`;
            } else if (gate.type === 'RX') {
                py += `        qml.RX(${gate.params![0]}, wires=${gate.targets[0]})\n`;
            } else if (gate.type === 'RY') {
                py += `        qml.RY(${gate.params![0]}, wires=${gate.targets[0]})\n`;
            } else if (gate.type === 'RZ') {
                py += `        qml.RZ(${gate.params![0]}, wires=${gate.targets[0]})\n`;
            }
        }

        // PennyLane measurements
        const activeQubits = circuit.measurements.map(m => m.qubit);
        if (activeQubits.length > 0) {
            const wiresStr = activeQubits.length === 1 ? `wires=${activeQubits[0]}` : `wires=[${activeQubits.join(', ')}]`;
            py += `        return qml.counts(${wiresStr})\n`;
        } else {
            py += `        return qml.probs(wires=range(${circuit.numQubits}))\n`;
        }

        py += `
    res = q_circuit()
    
    # Format counts and probabilities
    counts = {}
    if isinstance(res, dict):
        counts = {str(k): int(v) for k, v in res.items()}
    else:
        # If it returned probabilities instead
        probs = [float(x) for x in res]
        counts = {format(i, '0${circuit.numQubits}b'): int(p * ${shots}) for i, p in enumerate(probs)}
        
    total_shots = sum(counts.values()) or 1
    probabilities = {k: v / total_shots for k, v in counts.items()}
    
    print(json.dumps({
        "success": True,
        "counts": counts,
        "probabilities": probabilities,
        "adapterUsed": "pennylane"
    }))
else:
    print(json.dumps({"success": False, "error": "PennyLane not installed"}))
`;
        return py;
    }
}

// 3. FALLBACK QUANTUM SIMULATOR (Self-contained in pure Python / NumPy if available, or math)
export class FallbackAdapter implements QuantumAdapter {
    name = 'fallback' as const;

    generatePythonScript(circuit: QuantumCircuit, shots: number): string {
        let py = `
import json
import math
import random

# Pure Python/Math Vector-based Quantum Simulator (No external dependencies)
class FallbackSimulator:
    def __init__(self, num_qubits):
        self.n = num_qubits
        self.size = 1 << num_qubits
        # Initialize state to |00...0>
        self.state = [0.0] * self.size
        self.state[0] = 1.0 # Real components
        self.state_imag = [0.0] * self.size # Imaginary components

    def apply_h(self, qubit):
        # Apply Hadamard gate to a target qubit
        h_factor = 1.0 / math.sqrt(2.0)
        for i in range(self.size):
            if (i & (1 << qubit)) == 0:
                j = i | (1 << qubit)
                # Compute H transform
                r1, i1 = self.state[i], self.state_imag[i]
                r2, i2 = self.state[j], self.state_imag[j]
                
                self.state[i] = h_factor * (r1 + r2)
                self.state_imag[i] = h_factor * (i1 + i2)
                
                self.state[j] = h_factor * (r1 - r2)
                self.state_imag[j] = h_factor * (i1 - i2)

    def apply_x(self, qubit):
        # Apply Pauli-X (NOT) gate
        for i in range(self.size):
            if (i & (1 << qubit)) == 0:
                j = i | (1 << qubit)
                self.state[i], self.state[j] = self.state[j], self.state[i]
                self.state_imag[i], self.state_imag[j] = self.state_imag[j], self.state_imag[i]

    def apply_y(self, qubit):
        # Apply Pauli-Y gate (rotation + imaginary phase)
        for i in range(self.size):
            if (i & (1 << qubit)) == 0:
                j = i | (1 << qubit)
                # Y = [[0, -i], [i, 0]]
                # state[i] = -i * state[j] -> real = imag[j], imag = -real[j]
                # state[j] = i * state[i] -> real = -imag[i], imag = real[i]
                r1, i1 = self.state[i], self.state_imag[i]
                r2, i2 = self.state[j], self.state_imag[j]
                
                self.state[i] = i2
                self.state_imag[i] = -r2
                
                self.state[j] = -i1
                self.state_imag[j] = r1

    def apply_z(self, qubit):
        # Apply Pauli-Z gate
        for i in range(self.size):
            if (i & (1 << qubit)) != 0:
                self.state[i] = -self.state[i]
                self.state_imag[i] = -self.state_imag[i]

    def apply_cx(self, control, target):
        # Apply Controlled-NOT gate
        for i in range(self.size):
            if (i & (1 << control)) != 0 and (i & (1 << target)) == 0:
                j = i | (1 << target)
                self.state[i], self.state[j] = self.state[j], self.state[i]
                self.state_imag[i], self.state_imag[j] = self.state_imag[j], self.state_imag[i]

    def apply_rx(self, qubit, theta):
        cos_val = math.cos(theta / 2.0)
        sin_val = math.sin(theta / 2.0)
        for i in range(self.size):
            if (i & (1 << qubit)) == 0:
                j = i | (1 << qubit)
                r1, i1 = self.state[i], self.state_imag[i]
                r2, i2 = self.state[j], self.state_imag[j]
                # RX = [[cos, -i*sin], [-i*sin, cos]]
                self.state[i] = r1 * cos_val + i2 * sin_val
                self.state_imag[i] = i1 * cos_val - r2 * sin_val
                self.state[j] = r2 * cos_val + i1 * sin_val
                self.state_imag[j] = i2 * cos_val - r1 * sin_val

    def apply_ry(self, qubit, theta):
        cos_val = math.cos(theta / 2.0)
        sin_val = math.sin(theta / 2.0)
        for i in range(self.size):
            if (i & (1 << qubit)) == 0:
                j = i | (1 << qubit)
                r1, i1 = self.state[i], self.state_imag[i]
                r2, i2 = self.state[j], self.state_imag[j]
                # RY = [[cos, -sin], [sin, cos]]
                self.state[i] = r1 * cos_val - r2 * sin_val
                self.state_imag[i] = i1 * cos_val - i2 * sin_val
                self.state[j] = r1 * sin_val + r2 * cos_val
                self.state_imag[j] = i1 * sin_val + i2 * cos_val

    def apply_rz(self, qubit, theta):
        cos_val = math.cos(theta / 2.0)
        sin_val = math.sin(theta / 2.0)
        for i in range(self.size):
            if (i & (1 << qubit)) != 0:
                # Multiply by e^(i * theta/2)
                r, img = self.state[i], self.state_imag[i]
                self.state[i] = r * cos_val - img * sin_val
                self.state_imag[i] = r * sin_val + img * cos_val
            else:
                # Multiply by e^(-i * theta/2)
                r, img = self.state[i], self.state_imag[i]
                self.state[i] = r * cos_val + img * sin_val
                self.state_imag[i] = -r * sin_val + img * cos_val

    def get_probabilities(self):
        return [self.state[i]**2 + self.state_imag[i]**2 for i in range(self.size)]

    def measure(self, shots):
        probs = self.get_probabilities()
        counts = {}
        
        # Cumulative probabilities for sampling
        cum_probs = []
        current = 0.0
        for p in probs:
            current += p
            cum_probs.append(current)
            
        for _ in range(shots):
            r = random.random()
            sampled_state = 0
            for idx, cp in enumerate(cum_probs):
                if r <= cp:
                    sampled_state = idx
                    break
            
            # Format state index as binary string (reverse order for qubit listing)
            binary_state = format(sampled_state, '0' + str(self.n) + 'b')
            # Standard convention lists q0 as rightmost/leftmost depending on framework.
            # We map q0 to first qubit index.
            counts[binary_state] = counts.get(binary_state, 0) + 1
            
        return counts, probs

# Execute fallback circuit
sim = FallbackSimulator(${circuit.numQubits})
`;

        for (const gate of circuit.gates) {
            if (gate.type === 'H') {
                py += `sim.apply_h(${gate.targets[0]})\n`;
            } else if (gate.type === 'X') {
                py += `sim.apply_x(${gate.targets[0]})\n`;
            } else if (gate.type === 'Y') {
                py += `sim.apply_y(${gate.targets[0]})\n`;
            } else if (gate.type === 'Z') {
                py += `sim.apply_z(${gate.targets[0]})\n`;
            } else if (gate.type === 'CX') {
                py += `sim.apply_cx(${gate.targets[0]}, ${gate.targets[1]})\n`;
            } else if (gate.type === 'RX') {
                py += `sim.apply_rx(${gate.targets[0]}, ${gate.params![0]})\n`;
            } else if (gate.type === 'RY') {
                py += `sim.apply_ry(${gate.targets[0]}, ${gate.params![0]})\n`;
            } else if (gate.type === 'RZ') {
                py += `sim.apply_rz(${gate.targets[0]}, ${gate.params![0]})\n`;
            }
        }

        py += `
counts, probs = sim.measure(${shots})
probabilities = {format(i, '0' + str(${circuit.numQubits}) + 'b'): p for i, p in enumerate(probs)}
statevector = [[sim.state[i], sim.state_imag[i]] for i in range(sim.size)]

print(json.dumps({
    "success": True,
    "counts": counts,
    "probabilities": probabilities,
    "statevector": statevector,
    "adapterUsed": "fallback_simulator"
}))
`;
        return py;
    }
}

// ─── EXECUTION BRIDGE ─────────────────────────────────────────────────────────

export class QuantumBridge {
    private adapters: QuantumAdapter[] = [
        new QiskitAdapter(),
        new PennyLaneAdapter(),
        new FallbackAdapter()
    ];

    async execute(circuit: QuantumCircuit, options?: { shots?: number; preferredAdapter?: 'qiskit' | 'pennylane' | 'fallback' }): Promise<QuantumExecutionResult> {
        const shots = options?.shots || 1024;
        const preferred = options?.preferredAdapter;

        // Determine adapters to try in sequence
        let tryAdapters = [...this.adapters];
        if (preferred) {
            const found = this.adapters.find(a => a.name === preferred);
            if (found) {
                tryAdapters = [found, ...this.adapters.filter(a => a.name !== preferred)];
            }
        }

        let lastError: string | undefined;

        for (const adapter of tryAdapters) {
            try {
                const pyScript = adapter.generatePythonScript(circuit, shots);
                const tempFile = path.join(os.tmpdir(), `quantum_circuit_${Date.now()}_${adapter.name}.py`);
                
                // Write Python script to temp file
                writeFileSync(tempFile, pyScript, 'utf8');

                const result = await this.runPythonFile(tempFile);
                
                // Clean up temp file
                try { unlinkSync(tempFile); } catch {}

                if (result.success) {
                    return result;
                } else {
                    lastError = result.error;
                }
            } catch (err: any) {
                lastError = err.message;
            }
        }

        return {
            success: false,
            counts: {},
            probabilities: {},
            adapterUsed: 'fallback_simulator',
            error: `All adapters failed. Last error: ${lastError}`
        };
    }

    private runPythonFile(filePath: string): Promise<QuantumExecutionResult> {
        return new Promise((resolve) => {
            exec(`python3 "${filePath}" || python "${filePath}"`, (error, stdout, stderr) => {
                if (error) {
                    return resolve({
                        success: false,
                        counts: {},
                        probabilities: {},
                        adapterUsed: 'fallback_simulator',
                        error: stderr || error.message,
                        stdout
                    });
                }

                try {
                    const parsed = JSON.parse(stdout.trim());
                    if (parsed.success === false) {
                        resolve({
                            success: false,
                            counts: {},
                            probabilities: {},
                            adapterUsed: 'fallback_simulator',
                            error: parsed.error,
                            stdout
                        });
                    } else {
                        resolve(parsed);
                    }
                } catch (parseError: any) {
                    resolve({
                        success: false,
                        counts: {},
                        probabilities: {},
                        adapterUsed: 'fallback_simulator',
                        error: `Failed to parse python stdout: ${parseError.message}. Raw: ${stdout}`,
                        stdout
                    });
                }
            });
        });
    }
}
