---
description: Deploy a service to Cloud Run via MCP Ã¢â‚¬â€ builds, pushes, and deploys the specified Creative Liberation Engine service
---

# /deploy <service>

Deploy any Creative Liberation Engine microservice to Cloud Run. Handles build verification, image push, and deployment confirmation.

**Activates on:**
- `/deploy <service-name>` Ã¢â‚¬â€ e.g. `/deploy zero-day`, `/deploy genkit`, `/deploy comet`
- "deploy to production" / "push to Cloud Run" / "ship <service>"

---

## Service Map (Always True Ã¢â‚¬â€ Do Not Ask)

| Service | Directory | Port | Cloud Run Name |
|---------|-----------|------|----------------|
| `genkit` | `packages/genkit` | 4100 | `cle-genkit` |
| `zero-day` | `packages/zero-day` | 3001 | `cle-zero-day` |
| `comet` | `services/comet` | 3002 | `cle-comet` |
| `campaign` | `services/campaign` | 3003 | `cle-campaign` |
| `console` | `packages/console-ui` | 3000 | `cle-console` |

Default region: `us-central1`  
GCP project: confirm from user or read from `.env` / `firebase.json` if present.

---

## Steps

// turbo-all

1. **Identify service.** Parse `<service>` from the command. Look up directory and Cloud Run name from the Service Map above.

2. **Check for Dockerfile.**
   ```powershell
   Test-Path "Y:\\creative-liberation-engine\<service-dir>\Dockerfile"
   ```
   If missing Ã¢â€ â€™ warn and stop: "No Dockerfile found at `<path>`. Create one before deploying."

3. **Verify build (dry-run check).**
   ```powershell
   # Check for TypeScript errors before deploying
   npx tsc --noEmit --project "Y:\\creative-liberation-engine\<service-dir>\tsconfig.json"
   ```
   If TS errors Ã¢â€ â€™ report them and stop. Do not deploy broken code (Article IX).

4. **Deploy via Cloud Run MCP.**
   Call `mcp_cloudrun_deploy_local_folder` with:
   - `folderPath`: absolute path to service directory
   - `project`: GCP project ID (from context or ask user once)
   - `service`: Cloud Run service name from Service Map
   - `region`: `us-central1`

5. **Confirm deployment.** Call `mcp_cloudrun_get_service` to verify the new revision is serving traffic.

6. **Report result.**
   ```
   Ã¢Å“â€¦ /deploy complete Ã¢â‚¬â€ <service>

   SERVICE    <cloud-run-name>
   URL        <service-url>
   REVISION   <revision-id>
   REGION     us-central1
   STATUS     serving 100% traffic

   Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
   Next: /pr to open a pull request, or /release to chain commit Ã¢â€ â€™ PR Ã¢â€ â€™ deploy
   ```

---

## Rollback

If the new revision is unhealthy, immediately run:
```powershell
gcloud run services update-traffic <cloud-run-name> --to-revisions=PREVIOUS=100 --region=us-central1
```
Report: "Ã¢Å¡Â Ã¯Â¸Â Deployment unhealthy Ã¢â‚¬â€ rolled back to previous revision."

---

## Rules

- Never deploy if TypeScript build fails Ã¢â‚¬â€ Article IX: no MVPs
- Always confirm deployment health before reporting success
- If GCP project ID is unknown, ask once and cache for the session
- Sovereign NAS (Forgejo CI) is preferred over manual Cloud Run for production Ã¢â‚¬â€ use this workflow for hotfixes and staging only

