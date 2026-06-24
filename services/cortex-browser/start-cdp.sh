#!/bin/bash

# Start the official Selenium display entrypoint in the background
echo '[CDP-BOOT] Starting Selenium base display stack (Xvfb, VNC, noVNC)...'
/opt/bin/entry_point.sh &
ENTRY_PID=$!

export DISPLAY=:99

# Wait for Xvfb to initialize the display
echo '[CDP-BOOT] Waiting for Xvfb display :99 to become ready...'
for i in $(seq 1 30); do
  sleep 1
  if xdpyinfo -display ${DISPLAY} >/dev/null 2>&1; then
    echo '[CDP-BOOT] Xvfb display :99 is ready!'
    break
  fi
done

# Start persistent Chromium on DISPLAY=:99
echo '[CDP-BOOT] Cleaning up any stale Chromium profile locks...'
rm -f /home/seluser/SingletonLock /home/seluser/SingletonCookie /home/seluser/SingletonSocket
rm -f /home/seluser/cortex-profile/SingletonLock /home/seluser/cortex-profile/SingletonCookie /home/seluser/cortex-profile/SingletonSocket

echo '[CDP-BOOT] Starting persistent Chrome with CDP...'
PROXY_ARG=""
if [ -n "${CORTEX_PROXY_SERVER}" ]; then
  echo "[CDP-BOOT] Routing Chromium traffic through proxy: ${CORTEX_PROXY_SERVER}"
  PROXY_ARG="--proxy-server=${CORTEX_PROXY_SERVER}"
fi

/usr/bin/chromium --no-sandbox --disable-gpu --remote-debugging-port=9223 --remote-allow-origins=* \
  ${PROXY_ARG} --user-data-dir=/home/seluser --no-first-run --disable-default-apps \
  --disable-extensions --disable-popup-blocking --disable-blink-features=AutomationControlled \
  --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --window-size=1920,1080 about:blank &
CHROME_PID=$!

sleep 5

# Start CDP proxy on port 9224
echo '[CDP-BOOT] Starting CDP proxy on 0.0.0.0:9224...'
python3 /opt/cdp_proxy.py &
PROXY_PID=$!

echo "[CDP-BOOT] VNC Desktop available via noVNC at http://127.0.0.1:7901/vnc.html?host=127.0.0.1&port=7901&autoconnect=true"
echo "[CDP-BOOT] Entry PID=$ENTRY_PID, Chrome PID=$CHROME_PID, Proxy PID=$PROXY_PID"

# Handle shutdown signals cleanly
function shutdown {
  echo "Shutting down Chrome and Selenium stack..."
  kill -s SIGTERM ${CHROME_PID} ${PROXY_PID} ${ENTRY_PID}
  wait ${ENTRY_PID}
  echo "Shutdown complete"
}

trap shutdown SIGTERM SIGINT

wait ${ENTRY_PID}
