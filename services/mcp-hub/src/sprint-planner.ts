/**
 * Sprint Planner — Autonomous sprint management for Sentinel Track.
 * Implements velocity tracking, auto-assignment, and sprint cycle management.
 */
import fs from 'fs';
import path from 'path';
import express from 'express';

const DATA_DIR = process.env.MCP_HUB_DATA_DIR || path.join(process.cwd(), 'data');
const ISSUES_FILE = path.join(DATA_DIR, 'issues.json');
const SPRINTS_FILE = path.join(DATA_DIR, 'sprints.json');

function readJSON(file: string): any[] {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return []; }
}
function writeJSON(file: string, data: any[]): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

interface Sprint {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'completed';
  start_date: string;
  end_date: string;
  issue_ids: string[];
  velocity: number; // story points completed
  created_at: string;
}

export const sprintRouter = express.Router();

// List sprints
sprintRouter.get('/sprints', (_req, res) => {
  const sprints = readJSON(SPRINTS_FILE);
  res.json(sprints);
});

// Get active sprint
sprintRouter.get('/sprints/active', (_req, res) => {
  const sprints = readJSON(SPRINTS_FILE);
  const active = sprints.find((s: Sprint) => s.status === 'active');
  if (!active) return res.status(404).json({ error: 'No active sprint' });

  // Enrich with issue details
  const issues = readJSON(ISSUES_FILE);
  const sprintIssues = issues.filter((i: any) => active.issue_ids.includes(i.id));
  res.json({ ...active, issues: sprintIssues });
});

// Create sprint
sprintRouter.post('/sprints', (req, res) => {
  const sprints = readJSON(SPRINTS_FILE);
  const { name, start_date, end_date, issue_ids } = req.body;
  const sprint: Sprint = {
    id: `sprint-${Date.now()}`,
    name: name || `Sprint ${sprints.length + 1}`,
    status: 'planning',
    start_date: start_date || new Date().toISOString(),
    end_date: end_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks default
    issue_ids: issue_ids || [],
    velocity: 0,
    created_at: new Date().toISOString(),
  };
  sprints.push(sprint);
  writeJSON(SPRINTS_FILE, sprints);
  res.status(201).json(sprint);
});

// Start sprint
sprintRouter.post('/sprints/:id/start', (req, res) => {
  const sprints = readJSON(SPRINTS_FILE);
  const idx = sprints.findIndex((s: Sprint) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Sprint not found' });

  // End any currently active sprint
  for (const s of sprints) {
    if (s.status === 'active') s.status = 'completed';
  }

  sprints[idx].status = 'active';
  sprints[idx].start_date = new Date().toISOString();
  writeJSON(SPRINTS_FILE, sprints);

  // Transition assigned issues to IDEATION if they're in BACKLOG
  const issues = readJSON(ISSUES_FILE);
  for (const issue of issues) {
    if (sprints[idx].issue_ids.includes(issue.id) && issue.status === 'BACKLOG') {
      issue.status = 'IDEATION';
      issue.updated_at = new Date().toISOString();
    }
  }
  writeJSON(ISSUES_FILE, issues);

  res.json(sprints[idx]);
});

// Complete sprint
sprintRouter.post('/sprints/:id/complete', (req, res) => {
  const sprints = readJSON(SPRINTS_FILE);
  const idx = sprints.findIndex((s: Sprint) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Sprint not found' });

  const issues = readJSON(ISSUES_FILE);
  const sprintIssues = issues.filter((i: any) => sprints[idx].issue_ids.includes(i.id));
  const completed = sprintIssues.filter((i: any) => i.status === 'DONE' || i.status === 'VALIDATION');

  sprints[idx].status = 'completed';
  sprints[idx].velocity = completed.length;
  sprints[idx].end_date = new Date().toISOString();
  writeJSON(SPRINTS_FILE, sprints);

  // Move incomplete issues back to BACKLOG
  const incompleteIds = sprintIssues.filter((i: any) => i.status !== 'DONE' && i.status !== 'VALIDATION').map((i: any) => i.id);
  res.json({ sprint: sprints[idx], completed: completed.length, incomplete: incompleteIds });
});

// Add issues to sprint
sprintRouter.post('/sprints/:id/issues', (req, res) => {
  const sprints = readJSON(SPRINTS_FILE);
  const idx = sprints.findIndex((s: Sprint) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Sprint not found' });

  const { issue_ids } = req.body;
  const newIds = (issue_ids || []).filter((id: string) => !sprints[idx].issue_ids.includes(id));
  sprints[idx].issue_ids.push(...newIds);
  writeJSON(SPRINTS_FILE, sprints);
  res.json(sprints[idx]);
});

// Auto-assign: distribute BACKLOG issues to agents based on capacity
sprintRouter.post('/auto-assign', (req, res) => {
  const issues = readJSON(ISSUES_FILE);
  const backlog = issues.filter((i: any) => i.status === 'BACKLOG' && (!i.assignee || i.assignee === 'unassigned'));
  const agents = req.body.agents || ['CORTEX-Architect', 'Swarm-Builder-1', 'Swarm-Builder-2'];

  let assigned = 0;
  for (let i = 0; i < backlog.length; i++) {
    const agent = agents[i % agents.length];
    const idx = issues.findIndex((issue: any) => issue.id === backlog[i].id);
    if (idx !== -1) {
      issues[idx].assignee = agent;
      issues[idx].updated_at = new Date().toISOString();
      assigned++;
    }
  }

  writeJSON(ISSUES_FILE, issues);
  res.json({ assigned, total_backlog: backlog.length, agents });
});
