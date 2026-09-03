const { spawn } = require('child_process');
const fs = require('fs');

// ── Self-healing .env guard ───────────────────────────────────────────
// Some sandbox processes clobber .env and drop MONGODB_URI — without it the
// app silently falls back to localhost MongoDB (which doesn't exist here)
// and every login 500s. Ensure the line exists before every server start.
const ENV_PATH = '/home/z/my-project/.env';
const REQUIRED_LINE = 'MONGODB_URI=mongodb+srv://vedaerp:Veda0201@cluster0.q5b2ye0.mongodb.net/veda-erp';
try {
  let env = '';
  try { env = fs.readFileSync(ENV_PATH, 'utf8'); } catch { env = 'DATABASE_URL=file:/home/z/my-project/db/custom.db\n'; }
  if (!/^MONGODB_URI=.+/m.test(env)) {
    env = env.trimEnd() + '\n' + REQUIRED_LINE + '\n';
    fs.writeFileSync(ENV_PATH, env);
    console.log('[daemon] .env was missing MONGODB_URI — restored it automatically');
  }
} catch (e) {
  console.warn('[daemon] .env guard failed:', e.message);
}

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
