const { spawn } = require('child_process');
const fs = require('fs');

// Open log file as raw fd (no pipe streams -> parent has no refs -> exits instantly)
const out = fs.openSync('/home/z/my-project/server.log', 'a');

const child = spawn('node', ['node_modules/.bin/next', 'start', '-p', '3000'], {
  cwd: '/home/z/my-project',
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=3072' },
  detached: true,
  stdio: ['ignore', out, out]
});

// Write PID file
fs.writeFileSync('/home/z/my-project/server.pid', child.pid.toString());

// Unref so parent can exit immediately
child.unref();

console.log('Server daemon started with PID:', child.pid);
process.exit(0);
