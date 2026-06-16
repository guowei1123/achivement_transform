const path = require('path');
const fs = require('fs');
const { createClient } = require('redis');

const PPTService = require('../pptService');
const { createGraphStore } = require('../services/graphStore');
const { createMemoryRedisClient } = require('../utils/memoryRedisClient');
const {
  runAgent,
  knowledgeBase,
  recordAgentFeedback,
  getAgentProfile,
  getRawAgentProfile,
} = require('../agentEngine');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs.readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return env;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        return env;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, '');
      if (key) {
        env[key] = value;
      }
      return env;
    }, {});
}

function loadProjectEnv(projectRoot) {
  const envFiles = ['.env.local', '.env'];
  for (const envFile of envFiles) {
    const values = parseEnvFile(path.join(projectRoot, envFile));
    for (const [key, value] of Object.entries(values)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  if (!process.env.DEEPSEEK_API_KEY && process.env.VITE_DEEPSEEK_API_KEY) {
    process.env.DEEPSEEK_API_KEY = process.env.VITE_DEEPSEEK_API_KEY;
  }
}

async function createServerContext() {
  const serverRoot = path.join(__dirname, '..');
  const projectRoot = path.join(serverRoot, '..');
  loadProjectEnv(projectRoot);

  const graphStore = createGraphStore({
    type: process.env.GRAPH_STORE || 'json',
    projectRoot,
  });

  let redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    socket: {
      connectTimeout: 1000,
      reconnectStrategy: false,
    },
  });
  redisClient.on('error', (err) => console.error('Redis connection error:', err));
  try {
    await redisClient.connect();
    console.log('Redis connected');
  } catch (error) {
    if (process.env.REQUIRE_REDIS === '1') {
      throw error;
    }
    console.warn('Redis unavailable, using in-memory chat history fallback:', error.message);
    redisClient = createMemoryRedisClient();
  }

  return {
    graphStore,
    redisClient,
    PPTService,
    runAgent,
    knowledgeBase,
    recordAgentFeedback,
    getAgentProfile,
    getRawAgentProfile,
    runtime: {
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
      MATCHING_ENGINE_URL: process.env.MATCHING_ENGINE_URL || 'http://localhost:5001',
      AIPPT_BACKEND: process.env.AIPPT_BACKEND || 'http://127.0.0.1:6800',
    },
    paths: {
      serverRoot,
      projectRoot,
      publicDir: path.join(projectRoot, 'public'),
      snapshotDir: path.join(serverRoot, 'snapshots'),
      trainPptTemplateDir: path.join(projectRoot, 'TrainPPTAgent', 'backend', 'main_api', 'template'),
    },
  };
}

async function closeServerContext(context) {
  if (context.redisClient && typeof context.redisClient.quit === 'function') {
    await context.redisClient.quit();
  }
}

module.exports = {
  createServerContext,
  closeServerContext,
};
