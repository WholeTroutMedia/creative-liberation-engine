/**
 * Sovereign Coding Agent Bridge — Helix γ
 * Local-first coding with plugin architecture and RAG context.
 */
import { randomUUID as uuidv4 } from 'crypto';

export interface CodingTask {
  task_id: string;
  type: 'generate' | 'refactor' | 'test' | 'review' | 'explain' | 'debug';
  status: 'queued' | 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed';
  instruction: string;
  context_files: string[];
  language: string;
  framework?: string;
  output: { files_modified: { path: string; action: string; diff: string }[]; explanation: string; confidence: number } | null;
  plugins_used: string[];
  created_at: string;
  completed_at: string | null;
  token_usage: { input: number; output: number; cached: number };
}

export interface CodingPlugin {
  id: string; name: string; type: 'linter' | 'formatter' | 'analyzer' | 'generator' | 'tester'; enabled: boolean;
}

const tasks = new Map<string, CodingTask>();
const plugins: CodingPlugin[] = [
  { id: 'eslint', name: 'ESLint', type: 'linter', enabled: true },
  { id: 'prettier', name: 'Prettier', type: 'formatter', enabled: true },
  { id: 'vitest-gen', name: 'Vitest Generator', type: 'tester', enabled: true },
  { id: 'ts-analyzer', name: 'TypeScript Analyzer', type: 'analyzer', enabled: true },
  { id: 'schema-gen', name: 'Schema Generator', type: 'generator', enabled: true },
];

function detectType(instruction: string): CodingTask['type'] {
  const l = instruction.toLowerCase();
  if (l.includes('test')) return 'test';
  if (l.includes('refactor')) return 'refactor';
  if (l.includes('review')) return 'review';
  if (l.includes('explain')) return 'explain';
  if (l.includes('debug') || l.includes('fix')) return 'debug';
  return 'generate';
}

export async function createCodingTask(instruction: string, contextFiles: string[], language = 'typescript', framework?: string): Promise<CodingTask> {
  const task: CodingTask = {
    task_id: uuidv4(), type: detectType(instruction), status: 'queued',
    instruction, context_files: contextFiles, language, framework,
    output: null, plugins_used: plugins.filter(p => p.enabled).map(p => p.id),
    created_at: new Date().toISOString(), completed_at: null,
    token_usage: { input: 0, output: 0, cached: 0 },
  };
  tasks.set(task.task_id, task);
  setTimeout(() => executeTask(task).catch(() => {}), 0);
  return task;
}

async function executeTask(task: CodingTask): Promise<void> {
  try {
    task.status = 'planning';
    const INFERENCE_URL = process.env.INFERENCE_URL || 'http://127.0.0.1:8000/v1/chat/completions';
    task.status = 'executing';
    const res = await fetch(INFERENCE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.CODE_MODEL || 'qwen2.5-coder-32b',
        messages: [
          { role: 'system', content: `Sovereign coding agent. Lang: ${task.language}. Framework: ${task.framework || 'none'}.` },
          { role: 'user', content: task.instruction },
        ],
        max_tokens: 8000, temperature: 0.1,
      }),
    });
    const data = await res.json() as any;
    task.output = {
      files_modified: [{ path: 'output.ts', action: 'create', diff: data.choices?.[0]?.message?.content || '' }],
      explanation: `Generated ${task.type}`, confidence: 0.85,
    };
    task.token_usage.output = data.usage?.completion_tokens || 0;
    task.status = 'completed';
    task.completed_at = new Date().toISOString();
  } catch (err: any) {
    task.status = 'failed';
    task.output = { files_modified: [], explanation: err.message, confidence: 0 };
  }
}

export function getCodingTask(id: string) { return tasks.get(id); }
export function getPlugins() { return plugins; }
export function togglePlugin(id: string, enabled: boolean) {
  const p = plugins.find(x => x.id === id);
  if (p) p.enabled = enabled;
  return !!p;
}
