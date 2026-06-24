import { Router } from 'express';
import type { Request, Response } from 'express';
import { getTasks } from '../store.js';
import type { Task } from '../types.js';

/**
 * /api/design-ingest — CLE Design Ingest API
 *
 * Transforms live dispatch tasks into CLECardDocument payloads
 * consumable by the design-ingest-canvas application.
 *
 * GET /api/design-ingest           — List available specs (paginated)
 * GET /api/design-ingest/:taskId   — Single task as CLECardDocument
 * GET /api/design-ingest/latest    — Most recent active/queued task as spec
 */

const router: Router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function priorityColor(priority: string): string {
  switch (priority) {
    case 'P0': return '#FF3B30';
    case 'P1': return '#FF9500';
    case 'P2': return '#34C759';
    default:   return '#636366';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':  return '#34C759';
    case 'queued':  return '#007AFF';
    case 'done':    return '#8E8E93';
    case 'blocked': return '#FF3B30';
    default:        return '#636366';
  }
}

/** Map a DispatchTask to a flat CLECardDocument spec. */
function taskToCLECard(task: Task): Record<string, unknown> {
  const accentColor = priorityColor(task.priority ?? 'P2');
  const statusHex   = statusColor(task.status ?? 'queued');

  return {
    card: {
      meta: {
        title:       task.title,
        description: task.description ?? `${task.project ?? 'cle'} / ${task.workstream ?? 'free'}`,
        version:     '1.0',
        created:     task.created ?? new Date().toISOString(),
        author:      task.created_by ?? 'cle-dispatch',
      },
      tokens: {
        colorPrimary:    accentColor,
        colorBackground: '#0A0A0F',
        colorSurface:    '#14141C',
        colorText:       '#F5F5F7',
        colorAccent:     statusHex,
        radiusBase:      '6px',
        fontBody:        "'Inter', system-ui, sans-serif",
        fontCode:        "'JetBrains Mono', monospace",
      },
      topbar: {
        items: [
          { type: 'text', content: task.org ?? 'CLE',          style: 'label' },
          { type: 'text', content: task.project ?? 'engine',         style: 'title' },
          { type: 'text', content: task.workstream ?? 'free',        style: 'label' },
        ],
      },
      sections: [
        {
          id:    'task-status',
          title: 'Status',
          children: [
            { type: 'formField', id: 'field-status',   label: 'Status',      value: task.status ?? 'queued',                               variant: 'badge' },
            { type: 'formField', id: 'field-priority', label: 'Priority',    value: task.priority ?? 'P2',                                 variant: 'badge' },
            { type: 'formField', id: 'field-assigned', label: 'Assigned To', value: task.claimed_by ?? task.assigned_to_agent ?? 'unassigned', variant: 'text' },
          ],
        },
        {
          id:    'task-meta',
          title: 'Task Details',
          children: [
            { type: 'formField', id: 'field-id',          label: 'Task ID', value: task.id,                                                       variant: 'code' },
            { type: 'formField', id: 'field-source',      label: 'Source',  value: task.source ?? task.spawned_by ?? 'operator',                   variant: 'text' },
            { type: 'formField', id: 'field-created',     label: 'Created', value: task.created ? new Date(task.created).toLocaleString() : '—',   variant: 'text' },
          ],
        },
        ...(task.description ? [{
          id: 'task-description', title: 'Description',
          children: [{ type: 'richText', id: 'field-desc', content: task.description }],
        }] : []),
        ...(task.handoff_note ? [{
          id: 'task-handoff', title: 'Handoff Note',
          children: [{ type: 'richText', id: 'field-handoff', content: task.handoff_note }],
        }] : []),
      ],
    },
    // Flat fields for the simple parseDesignIngest parser (non-rich path)
    title:     task.title,
    text:      task.description ?? '',
    bgColor:   '#0A0A0F',
    textColor: '#F5F5F7',
    padding:   32,
    radius:    6,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/design-ingest — list available task specs. */
router.get('/api/design-ingest', async (_req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await getTasks();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      count: tasks.length,
      specs: tasks.slice(0, 50).map((t) => ({
        id:         t.id,
        title:      t.title,
        status:     t.status,
        priority:   t.priority,
        project:    t.project,
        workstream: t.workstream,
        created:    t.created,
        specUrl:    `/api/design-ingest/${t.id}`,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/design-ingest/latest — latest active or queued task as spec. */
router.get('/api/design-ingest/latest', async (_req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await getTasks();
    const candidate =
      tasks.find((t) => t.status === 'active') ??
      tasks.find((t) => t.status === 'queued') ??
      tasks[0] ??
      null;
    if (!candidate) {
      res.status(404).json({ error: 'No tasks available' });
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(taskToCLECard(candidate));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/design-ingest/:taskId — single task as CLECardDocument. */
router.get('/api/design-ingest/:taskId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await getTasks();
    const task  = tasks.find((t) => t.id === req.params['taskId']);
    if (!task) {
      res.status(404).json({ error: `Task not found: ${req.params['taskId']}` });
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(taskToCLECard(task));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export { router as designIngestRouter };
