---
description: Deploy a service to Cloud Run via MCP — full sovereign deploy pipeline
---

# /deploy — Deploy to Cloud Run

Deploy a service directly from the IDE using the Cloud Run MCP. No terminal required.

## Steps

1. Confirm with user:
   - **Service name** (e.g., `cle-genkit`, `zero-day`, `comet-browser`)
   - **Project ID** (GCP project — confirm explicitly, never assume)
   - **Region** (default: `europe-west1`)
   - **Deploy method**: local folder or container image

2. **Check existing services**:

Use `cloudrun` MCP `list_services` with the confirmed `project`.

3a. **If deploying local folder**:

Use `cloudrun` MCP `deploy_local_folder` with:

- `project`: [confirmed GCP project ID]
- `folderPath`: absolute path to the service root
- `service`: [service name]
- `region`: [region]

3b. **If deploying container image**:

Use `cloudrun` MCP `deploy_container_image` with:

- `project`: [confirmed GCP project ID]
- `imageUrl`: [container image URL]
- `service`: [service name]
- `region`: [region]

// turbo
4. **Verify deployment**:

Use `cloudrun` MCP `get_service` to check the deployed service status and URL.

1. **Health check** the live URL:

```powershell
Invoke-WebRequest -Uri "[service URL]/health" -UseBasicParsing | Select-Object StatusCode, Content
```

1. Report: "Deployed **[service]** → [URL]. Status: [health check result]."

// turbo
7. Write to SCRIBE memory:

```powershell
python "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\cli\scribe.py" "Deployed [service-name] to Cloud Run ([project], [region]). URL: [url]. Status: healthy." --tags deploy cloud-run production
```
