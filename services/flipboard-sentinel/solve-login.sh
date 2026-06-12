#!/bin/bash
echo "[SOLVER] Starting autonomous self-healing login loop..."
for i in {1..30}; do
  echo "=================================================="
  echo "[SOLVER] Attempt #$i of 30"
  echo "=================================================="
  
  # Run the node tsx script inside the container
  docker exec -t flipboard-sentinel npx tsx src/tools/auto-login-solver.ts
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -eq 0 ]; then
    echo "[SOLVER] 🎉 Login succeeded! Session cookies locked in place. Loop complete."
    exit 0
  elif [ $EXIT_CODE -eq 3 ]; then
    echo "[SOLVER] 🔄 Rate limit detected. Rotating Tor SOCKS5 proxy..."
    docker restart cortex-tor
    echo "[SOLVER] Waiting 15s for Tor to bootstrap..."
    sleep 15
  else
    echo "[SOLVER] ❌ Unhandled error (exit code $EXIT_CODE). Retrying in 10s..."
    sleep 10
  fi
done
echo "[SOLVER] ❌ Max retry limit reached. Autonomous loop failed."
exit 1
