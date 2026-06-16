const fs = require('fs');
const path = require('path');
const neo4j = require('neo4j-driver');

const config = require('../config');
const { ensureNodeId } = require('../services/graphStore/jsonGraphStore');

function toPlainValue(value) {
  if (value && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  if (Array.isArray(value)) {
    return value.map(toPlainValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toPlainValue(item)]));
  }
  return value;
}

function backupExistingFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const parsed = path.parse(filePath);
  const backupPath = path.join(parsed.dir, `${parsed.name}.${Date.now()}.backup${parsed.ext}`);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

async function migrate() {
  const projectRoot = path.join(__dirname, '..', '..');
  const outputPath = process.env.GRAPH_STORE_FILE || path.join(projectRoot, 'server', 'data', 'graph-store.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const driver = neo4j.driver(
    config.neo4j.uri,
    neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
  );
  const session = driver.session({ database: config.neo4j.database || undefined });

  try {
    const nodeResult = await session.run('MATCH (n) RETURN n, labels(n) as labels');
    const edgeResult = await session.run(
      `MATCH (a)-[r]->(b)
       RETURN a.name as sourceName, a.id as sourceId, a.label as sourceLabel,
              b.name as targetName, b.id as targetId, b.label as targetLabel,
              type(r) as relType, properties(r) as props`
    );

    const nodes = nodeResult.records.map((record, index) => {
      const node = record.get('n');
      const labels = record.get('labels') || [];
      const properties = toPlainValue(node.properties || {});
      return ensureNodeId({
        ...properties,
        nodeType: properties.nodeType || labels[0] || properties.type || 'Node',
      }, index);
    });

    const edges = edgeResult.records.map((record) => {
      const props = toPlainValue(record.get('props') || {});
      const relType = record.get('relType');
      return {
        ...props,
        source: record.get('sourceName') || record.get('sourceId') || record.get('sourceLabel'),
        target: record.get('targetName') || record.get('targetId') || record.get('targetLabel'),
        relType,
        label: props.label || relType,
      };
    }).filter((edge) => edge.source && edge.target);

    const backupPath = backupExistingFile(outputPath);
    fs.writeFileSync(outputPath, `${JSON.stringify({
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`, 'utf-8');

    console.log(`Migrated ${nodes.length} nodes and ${edges.length} edges to ${outputPath}`);
    if (backupPath) {
      console.log(`Existing JSON backup: ${backupPath}`);
    }
  } finally {
    await session.close();
    await driver.close();
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
