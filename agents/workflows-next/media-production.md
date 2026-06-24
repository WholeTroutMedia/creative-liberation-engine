# media-production

## Purpose

Orchestrate the end-to-end media production pipeline, integrating ALFRED (or equivalent agents) for script breakdown, genmedia pipeline execution, and final assembly tasks.

## Steps

1. Ingest raw script or storyboard via NAS watcher.
2. Break down script into discrete shot or scene tasks.
3. Assign tasks to genmedia swarm (Gaussians, FLUX, spatial rendering).
4. Monitor rendering telemetry for quality and speed (via ProphetEngine).
5. Compile and proxy generated assets into a daily review package.
6. Notify creative directors upon assembly completion.
