const { spawn } = require('child_process');
const fs = require('fs');

// Detach completely - this process becomes a session leader
const child = spawn('node', ['node_modules/.bin/next', 'start', '-p', '3000'], {
  cwd: '/home/z/my-project',
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe']
});

// Write PID file
fs.writeFileSync('/home/z/my-project/server.pid', child.pid.toString());

// Pipe output to log file
const logStream = fs.createWriteStream('/home/z/my-project/server.log', { flags: 'a' });
child.stdout.pipe(logStream);
child.stderr.pipe(logStream);

// Unref so parent can exit
child.unref();

console.log('Server daemon started with PID:', child.pid);
