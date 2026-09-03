#!/bin/bash
# This script restarts the server if it dies
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=2048"

while true; do
  echo "[$(date)] Starting Next.js dev server..."
  node node_modules/.bin/next dev -p 3000
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 2s..."
  sleep 2
done
