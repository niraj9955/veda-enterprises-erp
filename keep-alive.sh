#!/bin/bash
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=4096"
while true; do
  node node_modules/.bin/next start -p 3000
  echo "Server crashed, restarting in 3s..."
  sleep 3
done
