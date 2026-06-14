#!/bin/bash
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=4096"
node node_modules/.bin/next start -p 3000 >> /home/z/my-project/server.log 2>&1
