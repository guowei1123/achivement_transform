const path = require('path');

const { JsonGraphStore } = require('./jsonGraphStore');

function createGraphStore(options = {}) {
  const type = String(options.type || process.env.GRAPH_STORE || 'json').toLowerCase();
  if (type !== 'json') {
    throw new Error(`Unsupported GRAPH_STORE "${type}". Only "json" is available in this build.`);
  }

  const projectRoot = options.projectRoot || path.join(__dirname, '..', '..', '..');
  const filePath = options.filePath || process.env.GRAPH_STORE_FILE || path.join(projectRoot, 'server', 'data', 'graph-store.json');
  return new JsonGraphStore({ filePath });
}

module.exports = {
  createGraphStore,
};
