-- One-shot: align legacy Telnyx SMS tasks with worker PROJECT filter (creative-liberation-engine-v5).
UPDATE tasks
SET project = 'creative-liberation-engine-v5'
WHERE source = 'telnyx-sms'
  AND project = 'communications'
  AND status = 'queued';
