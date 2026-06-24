FROM mcr.microsoft.com/playwright/python:v1.42.0-jammy

# Install tini as a proper init system for PID 1.
# tini forwards signals and reaps orphaned zombie processes automatically,
# which Python's asyncio event loop does not do by default.
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# We expect the CORTEX Chrome profile to be mounted at /app/chrome-data
# so that the watcher can operate fully authenticated without manual login.

COPY . .

# Use tini as PID 1 to properly reap zombie children.
# Without this, Playwright's Node.js driver subprocesses accumulate as zombies.
ENTRYPOINT ["tini", "--"]
CMD ["python", "main.py"]
