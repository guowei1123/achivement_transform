const fs = require('fs');
const net = require('net');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function parseRedisConfig() {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const url = new URL(redisUrl);
  return {
    host: url.hostname || '127.0.0.1',
    port: Number(url.port || 6379),
  };
}

function canConnect(host, port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

async function waitForPort(host, port, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await canConnect(host, port, 1000)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function resolveRedisExecutable() {
  const pathCandidates = [
    process.env.REDIS_SERVER_PATH,
    'D:\\redis\\Redis-x64-5.0.14.1\\redis-server.exe',
    'D:\\redis\\redis-server.exe',
    'C:\\Redis\\redis-server.exe',
    'C:\\Program Files\\Redis\\redis-server.exe',
    'C:\\Program Files\\Memurai\\redis-server.exe',
  ].filter(Boolean);

  for (const candidate of pathCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const redisFromPath = execFileSync('where.exe', ['redis-server'], {
      encoding: 'utf-8',
      windowsHide: true,
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (redisFromPath) {
      return redisFromPath;
    }
  } catch (error) {
    // redis-server is not available on PATH.
  }

  return null;
}

async function ensureRedisRunning() {
  const { host, port } = parseRedisConfig();

  if (await canConnect(host, port)) {
    console.log(`Redis already running at ${host}:${port}`);
    return;
  }

  const redisExecutable = resolveRedisExecutable();
  if (!redisExecutable) {
    throw new Error(
      'Redis is not running and redis-server.exe was not found. Install Redis or set REDIS_SERVER_PATH to redis-server.exe.'
    );
  }

  console.log(`Starting Redis using: ${redisExecutable}`);

  const args = ['--port', String(port)];
  if (host && host !== 'localhost') {
    args.push('--bind', host);
  }

  const spawnOptions = { detached: true, stdio: 'ignore', windowsHide: true };

  const redisProcess = spawn(redisExecutable, args, spawnOptions);
  redisProcess.unref();

  const ready = await waitForPort(host, port);
  if (!ready) {
    throw new Error(`Redis failed to start on ${host}:${port}`);
  }

  console.log(`Redis started at ${host}:${port}`);
}

function startNodeServer() {
  const child = spawn(process.execPath, [path.join(PROJECT_ROOT, 'server', 'server.js')], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
      REQUIRE_REDIS: '1',
    },
    stdio: 'inherit',
    windowsHide: false,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code || 0);
  });
}

async function main() {
  await ensureRedisRunning();
  startNodeServer();
}

main().catch((error) => {
  console.error('Failed to start backend stack:', error.message);
  process.exit(1);
});
