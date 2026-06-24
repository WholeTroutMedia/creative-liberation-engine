---
description: Retrieve large generation payload sequences like UI exports or extensive research spec data from dispatch tasks to a local file.
---

# /pickup-artifact

**Activates on:**
- "pull the artifact from task [ID]"
- "pickup the stitch output for [ID]"
- "grab the artifact payload for task [ID]"

---

## Steps

// turbo
1. **Fetch the target task from the dispatch API**
   Use standard CLI tools like `curl` or `Invoke-RestMethod` to get the full task payload containing the artifact.

   ```powershell
   $task = Invoke-RestMethod -Uri "http://127.0.0.1:5050/api/tasks/[TASK_ID]"
   ```

2. **Verify payloads are present**
   Check if `$task.artifact_payload` (or `$task.spec_payload`) has content. If it's missing, inform the user that the task contains no payload data.

// turbo
3. **Write the payload to a local target file**
   If the user specified a local file location (e.g. `index.html`), output the loaded payload to the file:

   ```powershell
   $task.artifact_payload | Out-File -FilePath "[TARGET_FILE]" -Encoding UTF8
   ```

4. **Surface completion snippet**
   Read the first 50 lines or summarize the contents of the payload into the Chat to state that the retrieve was completed successfully. Use markdown or syntax highlighting appropriately.

## Rules
- The dispatch server is located at `http://127.0.0.1:5050`
- Never execute payloads implicitly; always dump as instructed to the target text file.
