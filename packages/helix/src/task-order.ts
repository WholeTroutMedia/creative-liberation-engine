/**
 * @module helix/task-order
 * @description Topological ordering for intra-Helix task dependency graphs
 */
import type { HelixTask } from './schema.js';

/**
 * Topological sort for intra-Helix tasks based on their dependsOn arrays.
 * Kahn's algorithm with stable tie-breaking (declaration order in `tasks`).
 * Only edges to task IDs present in this helix are considered; unknown deps are ignored.
 * Cycles or unreachable nodes: one console.warn, then remaining unique ids appended in stable order.
 */
export function topologicalSortHelixTasks(tasks: HelixTask[]): HelixTask[] {
    if (tasks.length <= 1) {
        return [...tasks];
    }

    const byId = new Map<string, HelixTask>();
    for (const t of tasks) {
        if (!byId.has(t.id)) {
            byId.set(t.id, t);
        }
    }

    const indegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    for (const id of byId.keys()) {
        indegree.set(id, 0);
        dependents.set(id, []);
    }

    for (const t of byId.values()) {
        for (const d of t.dependsOn ?? []) {
            if (byId.has(d)) {
                indegree.set(t.id, (indegree.get(t.id) ?? 0) + 1);
                dependents.get(d)!.push(t.id);
            }
        }
    }

    const topoIds: string[] = [];
    const placed = new Set<string>();

    while (placed.size < byId.size) {
        let layerCount = 0;
        for (const t of tasks) {
            const id = t.id;
            if (placed.has(id)) {
                continue;
            }
            if ((indegree.get(id) ?? 0) !== 0) {
                continue;
            }
            placed.add(id);
            topoIds.push(id);
            layerCount++;
            for (const childId of dependents.get(id) ?? []) {
                indegree.set(childId, (indegree.get(childId) ?? 1) - 1);
            }
        }
        if (layerCount === 0) {
            break;
        }
    }

    const remainderIds: string[] = [];
    const remSeen = new Set<string>();
    for (const t of tasks) {
        if (!placed.has(t.id) && !remSeen.has(t.id)) {
            remSeen.add(t.id);
            remainderIds.push(t.id);
        }
    }

    if (remainderIds.length > 0) {
        console.warn(
            '[HELIX-ORCHESTRATOR] Task dependency graph has a cycle or unsatisfiable ordering among known tasks; appending remaining tasks in stable declaration order.'
        );
    }

    const idOrder = [...topoIds, ...remainderIds];
    const result: HelixTask[] = [];
    for (const id of idOrder) {
        for (const t of tasks) {
            if (t.id === id) {
                result.push(t);
            }
        }
    }

    return result;
}
