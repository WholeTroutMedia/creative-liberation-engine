import { describe, expect, it, vi, afterEach } from 'vitest';
import type { HelixTask } from './schema.js';
import { topologicalSortHelixTasks } from './task-order.js';

function task(partial: Pick<HelixTask, 'id'> & Partial<HelixTask>): HelixTask {
    return {
        description: partial.description ?? 'x',
        status: partial.status ?? 'PENDING',
        autoRun: partial.autoRun ?? false,
        ...partial,
    };
}

describe('topologicalSortHelixTasks', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('orders a linear dependency chain before dependents', () => {
        const tasks = [
            task({ id: 'c', dependsOn: ['b'] }),
            task({ id: 'a' }),
            task({ id: 'b', dependsOn: ['a'] }),
        ];
        const ordered = topologicalSortHelixTasks(tasks);
        expect(ordered.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    });

    it('breaks ties by stable declaration order', () => {
        const tasks = [task({ id: 'z' }), task({ id: 'y' }), task({ id: 'x' })];
        expect(topologicalSortHelixTasks(tasks).map((t) => t.id)).toEqual(['z', 'y', 'x']);
    });

    it('ignores dependsOn ids that are not present in the task list', () => {
        const tasks = [
            task({ id: 'first' }),
            task({ id: 'second', dependsOn: ['ghost'] }),
        ];
        expect(topologicalSortHelixTasks(tasks).map((t) => t.id)).toEqual(['first', 'second']);
    });

    it('appends cyclic tasks in declaration order and warns once', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const tasks = [
            task({ id: 'a', dependsOn: ['b'] }),
            task({ id: 'b', dependsOn: ['a'] }),
        ];
        const ordered = topologicalSortHelixTasks(tasks);
        expect(ordered.map((t) => t.id)).toEqual(['a', 'b']);
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });
});
