#!/bin/bash
# Creative Liberation Engine GENESIS - Automated Maintenance Script
DOCKER=/var/packages/ContainerManager/target/usr/bin/docker
COMPOSE=/var/packages/ContainerManager/target/usr/bin/docker-compose
LOG_FILE=/app/genesis/maintenance.log
echo === GENESIS Maintenance started at $(date) === >> $LOG_FILE

echo [1/3] Triggering KEEPER ChromaDB consolidation... >> $LOG_FILE
$DOCKER exec zero-day npm run script:consolidate-memory 2>>$LOG_FILE || echo Warning: Consolidation script failed >> $LOG_FILE

echo [2/3] Triggering VERA truth-check... >> $LOG_FILE
$DOCKER exec zero-day npm run script:vera-truth-check 2>>$LOG_FILE || echo Warning: VERA script failed >> $LOG_FILE

echo [3/3] Checking dispatch-worker status... >> $LOG_FILE
WORKER_STATUS=$($DOCKER ps --filter name=dispatch-worker --format {{.Status}})
if [[ -z $WORKER_STATUS || $WORKER_STATUS == *Exited* ]]; then
    echo  -> Dispatch worker is down! Restarting... >> $LOG_FILE
    cd /app/genesis-deploy && $COMPOSE -f docker-compose.genesis.yml restart dispatch-worker >> $LOG_FILE 2>&1
else
    echo  -> Dispatch worker is online ($WORKER_STATUS) >> $LOG_FILE
fi

echo === GENESIS Maintenance completed at $(date) === >> $LOG_FILE
