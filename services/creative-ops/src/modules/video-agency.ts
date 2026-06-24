/**
 * Video Agency Module — Helix β
 * Extension for creative-ops service.
 * Video project management, timeline orchestration, review workflows.
 */
import { v4 as uuidv4 } from 'uuid';

export interface VideoProject {
  project_id: string;
  title: string;
  client?: string;
  status: 'pre_production' | 'production' | 'post_production' | 'review' | 'delivered';
  timeline: TimelineEntry[];
  deliverables: Deliverable[];
  review_rounds: ReviewRound[];
  created_at: string;
  deadline?: string;
}

export interface TimelineEntry {
  entry_id: string;
  timecode_in: string;
  timecode_out: string;
  description: string;
  type: 'scene' | 'transition' | 'overlay' | 'audio' | 'vfx';
  assigned_to?: string;
  status: 'planned' | 'in_progress' | 'completed';
}

export interface Deliverable {
  deliverable_id: string;
  name: string;
  format: string;
  resolution: string;
  duration_seconds: number;
  file_path?: string;
  status: 'pending' | 'rendering' | 'ready' | 'approved';
}

export interface ReviewRound {
  round_id: string;
  round_number: number;
  reviewer: string;
  feedback: { timecode: string; comment: string; severity: 'note' | 'change' | 'critical' }[];
  status: 'pending' | 'in_review' | 'approved' | 'revision_needed';
  submitted_at: string;
}

const projects = new Map<string, VideoProject>();

export function createProject(title: string, client?: string, deadline?: string): VideoProject {
  const proj: VideoProject = {
    project_id: uuidv4(), title, client, status: 'pre_production',
    timeline: [], deliverables: [], review_rounds: [],
    created_at: new Date().toISOString(), deadline,
  };
  projects.set(proj.project_id, proj);
  return proj;
}

export function addTimelineEntry(projectId: string, entry: Omit<TimelineEntry, 'entry_id'>): TimelineEntry | null {
  const proj = projects.get(projectId);
  if (!proj) return null;
  const e = { ...entry, entry_id: uuidv4() };
  proj.timeline.push(e);
  return e;
}

export function submitReview(projectId: string, reviewer: string, feedback: ReviewRound['feedback']): ReviewRound | null {
  const proj = projects.get(projectId);
  if (!proj) return null;
  const round: ReviewRound = {
    round_id: uuidv4(), round_number: proj.review_rounds.length + 1,
    reviewer, feedback, status: 'in_review', submitted_at: new Date().toISOString(),
  };
  proj.review_rounds.push(round);
  proj.status = 'review';
  return round;
}

export function getProject(id: string) { return projects.get(id); }
export function listProjects() { return Array.from(projects.values()); }
