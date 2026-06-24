import process from "node:process";

const DISPATCH_URL = process.env.DISPATCH_URL ?? "http://localhost:5150";
const GENKIT_URL = process.env.GENKIT_URL ?? "http://localhost:4100";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOk(url, { timeoutMs = 120_000, intervalMs = 2000 } = {}) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
      lastErr = `${res.status} ${res.statusText}`;
    } catch (err) {
      lastErr = err?.message ?? String(err);
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${url}. Last error: ${lastErr}`);
}

async function createDispatchTask() {
  const payload = {
    title: "V6 generate smoke test",
    project: process.env.PROJECT ?? "creative-liberation-engine",
    workstream: "general",
    priority: "P2",
    description: "Generate a short, clear paragraph stating that V6 dispatch->genkit->ollama works locally.",
    acceptance_criteria: [
      "Return a non-empty response in plain text.",
      "Do not include markdown.",
      "Keep it under 250 words."
    ],
    created_by: "user"
  };

  const res = await fetch(`${DISPATCH_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to create dispatch task: ${res.status} ${res.statusText} ${txt.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data?.task?.id) throw new Error(`Unexpected dispatch response: ${JSON.stringify(data).slice(0, 300)}`);
  return data.task.id;
}

async function getTask(id) {
  const res = await fetch(`${DISPATCH_URL}/api/tasks/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch task ${id}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function findTaskAcrossStatuses(id) {
  const statuses = ["queued", "active", "done", "failed", "handoff", "blocked"];
  for (const status of statuses) {
    const res = await fetch(`${DISPATCH_URL}/api/tasks?status=${encodeURIComponent(status)}`);
    if (!res.ok) continue;
    const listing = await res.json();
    const match = Array.isArray(listing?.tasks)
      ? listing.tasks.find((t) => t?.id === id)
      : null;
    if (match) return match;
  }
  return null;
}

async function run() {
  console.log(`[V6-SMOKE] Waiting for Genkit health at ${GENKIT_URL}/health ...`);
  await waitForOk(`${GENKIT_URL}/health`);
  console.log(`[V6-SMOKE] Waiting for Dispatch health at ${DISPATCH_URL}/health ...`);
  await waitForOk(`${DISPATCH_URL}/health`);

  console.log("[V6-SMOKE] Creating a dispatch task routed to /generate ...");
  const taskId = await createDispatchTask();
  console.log(`[V6-SMOKE] Created task ${taskId}`);

  const timeoutMs = 120_000;
  const start = Date.now();
  let lastSeenTask = null;
  while (Date.now() - start < timeoutMs) {
    let task = await getTask(taskId);
    if (!task) {
      const match = await findTaskAcrossStatuses(taskId);
      if (match) lastSeenTask = match;
      const fallbackStatus = lastSeenTask?.status ?? "not-found";
      console.log(`[V6-SMOKE] Task status: ${fallbackStatus}`);
      if (fallbackStatus === "done" || fallbackStatus === "failed") {
        if (fallbackStatus === "failed") {
          throw new Error(`Task failed: ${lastSeenTask?.handoff_note ?? ""}`.trim());
        }
        const note = String(lastSeenTask?.handoff_note ?? "").trim();
        if (!note) throw new Error("Task completed but handoff_note is empty");
        console.log("[V6-SMOKE] End-to-end success.");
        console.log(`--- handoff_note (trimmed) ---\n${note.slice(0, 400)}\n--- end ---`);
        return;
      }
      await sleep(2500);
      continue;
    }
    lastSeenTask = task;
    const status = task?.status;
    console.log(`[V6-SMOKE] Task status: ${status}`);
    if (status === "done" || status === "failed") {
      if (status === "failed") {
        throw new Error(`Task failed: ${task?.handoff_note ?? ""}`.trim());
      }
      const note = String(task?.handoff_note ?? "").trim();
      if (!note) throw new Error("Task completed but handoff_note is empty");
      console.log("[V6-SMOKE] End-to-end success.");
      console.log(`--- handoff_note (trimmed) ---\n${note.slice(0, 400)}\n--- end ---`);
      return;
    }
    await sleep(2500);
  }

  throw new Error(`Timed out waiting for task ${taskId} to finish`);
}

run().catch((err) => {
  console.error(`[V6-SMOKE] ERROR: ${err?.stack ?? err?.message ?? String(err)}`);
  process.exit(1);
});

