const fs = require('fs');
const path = require('path');
const axios = require('axios');

const { analyzeChainLevelWithAI, CHAIN_NODE_TYPES, TECH_NODE_TYPES } = require('../../services/graphService');
const { seedChainDemoData } = require('../../services/chainSeedService');
const {
  AUTOMOTIVE_INDUSTRY,
  getAutomotiveChainGraph,
  getChainIndustries,
  normalizeIndustry,
} = require('../../services/industryChainData');

const TECH_ROOT_NODE_NAME = '武汉理工大学技术成果';
const LEGACY_SHIPPING_TYPES = ['Enterprise', 'Vessel', 'Port', 'Cargo', 'Route', 'Authority'];
const LEGACY_SCHOOL_TYPES = ['TechField', 'Patent', 'Paper', 'Project', 'Researcher', 'Department', 'AcademicTitle', 'Award'];

function clampPositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function normalizeNode(node) {
  return {
    ...node,
    name: node.name || node.label || node.id,
    label: node.label || node.name,
    nodeType: node.nodeType || node.type || 'Node',
  };
}

function normalizeEdge(edge) {
  return {
    source: edge.source,
    target: edge.target,
    label: edge.label || edge.relType || edge.type || 'RELATIONSHIP',
    relType: edge.relType || edge.label || edge.type || 'RELATIONSHIP',
  };
}

function getNodeKey(node) {
  return node.id || node.name || node.label;
}

function getNodeSearchText(node) {
  return [
    node.name,
    node.label,
    node.type,
    node.nodeType,
    node.category,
    node.field,
    node.source,
    node.description,
    node.ppt_content,
    node.summary,
    node.abstract,
    Array.isArray(node.keywords) ? node.keywords.join(' ') : node.keywords,
  ].filter(Boolean).join(' ');
}

function scoreFusionTechMatch(techNode, chainNode) {
  const techText = getNodeSearchText(techNode);
  const chainText = getNodeSearchText(chainNode);
  let score = 0;

  if (chainNode.name && techText) {
    for (let size = 2; size <= 4; size += 1) {
      for (let index = 0; index <= Math.max(0, chainNode.name.length - size); index += 1) {
        const keyword = chainNode.name.slice(index, index + size);
        if (keyword.length === size && techText.includes(keyword)) {
          score += size;
        }
      }
    }
  }

  if (chainText && techText && techText.includes(chainText)) {
    score += 10;
  }

  return score;
}

function buildFusionTechMatches(techNodes, chainNodes, maxMatchesPerTech = 2) {
  const matchEdges = [];
  if (chainNodes.length === 0) {
    return matchEdges;
  }

  techNodes.forEach((techNode, techIndex) => {
    const ranked = chainNodes
      .map((chainNode) => ({
        chainNode,
        score: scoreFusionTechMatch(techNode, chainNode),
      }))
      .sort((a, b) => b.score - a.score || String(a.chainNode.name).localeCompare(String(b.chainNode.name), 'zh-CN'));

    const selected = ranked.filter((item) => item.score > 0).slice(0, maxMatchesPerTech);
    const fallback = selected.length > 0 ? selected : [{ chainNode: chainNodes[techIndex % chainNodes.length], score: 0 }];

    fallback.forEach(({ chainNode, score }) => {
      if (!chainNode?.name || !techNode?.name) {
        return;
      }
      matchEdges.push({
        source: techNode.name,
        target: chainNode.name,
        label: score > 0 ? '技术匹配' : '技术匹配(待校验)',
        score,
      });
    });
  });

  return matchEdges;
}

function extractJsonObject(text) {
  const source = String(text || '');
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = fenced ? fenced[1] : source;
  const start = payload.indexOf('{');
  const end = payload.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI did not return valid JSON');
  }
  return JSON.parse(payload.slice(start, end + 1));
}

function normalizeGraphTextImportType(graphType) {
  if (graphType === 'tech') {
    return {
      graphName: '技术图谱',
      allowedNodeTypes: ['TechField', 'Tech'],
      ontology: ['TechField=一级技术分类', 'Tech=具体技术成果'],
    };
  }

  return {
    graphName: '产业链图谱',
    allowedNodeTypes: CHAIN_NODE_TYPES,
    ontology: CHAIN_NODE_TYPES,
  };
}

async function extractGraphDataFromText(text, graphTypeConfig, runtime) {
  if (!runtime.DEEPSEEK_API_KEY) {
    throw new Error('Missing DEEPSEEK_API_KEY');
  }

  const prompt = `Extract graph nodes and edges for ${graphTypeConfig.graphName}.
Allowed node types: ${graphTypeConfig.allowedNodeTypes.join(', ')}
Return JSON only:
{
  "nodes": [
    { "name": "node name", "nodeType": "Layer2", "properties": { "description": "..." } }
  ],
  "edges": [
    { "source": "source node name", "target": "target node name", "relType": "relationship type" }
  ]
}

Text:
${text}`;

  const response = await axios.post(
    'https://api.deepseek.com/v1/chat/completions',
    {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You extract knowledge graph data and return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${runtime.DEEPSEEK_API_KEY}`,
      },
      timeout: 120000,
    }
  );

  return extractJsonObject(response.data.choices[0].message.content);
}

function sanitizeExtractedGraphData(extracted, graphTypeConfig) {
  const allowedTypes = new Set(graphTypeConfig.allowedNodeTypes);
  const errors = [];
  const nodeMap = new Map();

  for (const [index, rawNode] of (extracted.nodes || []).entries()) {
    const name = String(rawNode.name || '').trim();
    const nodeType = String(rawNode.nodeType || rawNode.type || '').trim();
    if (!name) {
      errors.push(`node ${index + 1} is missing name`);
      continue;
    }
    if (!allowedTypes.has(nodeType)) {
      errors.push(`node "${name}" has invalid type "${nodeType}"`);
      continue;
    }
    const properties = { ...(rawNode.properties || {}) };
    delete properties.name;
    delete properties.nodeType;
    nodeMap.set(name, { name, nodeType, properties });
  }

  const edges = [];
  for (const [index, rawEdge] of (extracted.edges || []).entries()) {
    const source = String(rawEdge.source || '').trim();
    const target = String(rawEdge.target || '').trim();
    const relType = String(rawEdge.relType || rawEdge.label || rawEdge.type || '').trim();
    if (!source || !target || !relType) {
      errors.push(`edge ${index + 1} is missing source, target, or relType`);
      continue;
    }
    edges.push({ source, target, relType, label: relType });
  }

  return {
    nodes: [...nodeMap.values()],
    edges,
    errors,
  };
}

function toCsv(nodes, edges) {
  const rows = [
    ['kind', 'source', 'target', 'label', 'properties'],
    ...nodes.map((node) => ['node', getNodeKey(node), '', node.nodeType || node.type || '', JSON.stringify(node)]),
    ...edges.map((edge) => ['edge', edge.source, edge.target, edge.label || edge.relType || '', JSON.stringify(edge)]),
  ];
  return rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function writeSnapshot(snapshotDir, nodes, edges) {
  fs.mkdirSync(snapshotDir, { recursive: true });
  const fileName = `graph-snapshot-${Date.now()}.json`;
  const filePath = path.join(snapshotDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify({ nodes, edges, createdAt: new Date().toISOString() }, null, 2), 'utf-8');
  return { fileName, filePath };
}

async function getIndustryChainGraph(graphStore, industry) {
  const normalizedIndustry = normalizeIndustry(industry);

  if (normalizedIndustry === AUTOMOTIVE_INDUSTRY) {
    return getAutomotiveChainGraph();
  }

  const graph = await graphStore.getGraph({ nodeTypes: CHAIN_NODE_TYPES });
  const nodes = graph.nodes.filter((node) => !node.industry || node.industry === normalizedIndustry);
  const nodeKeys = new Set(nodes.flatMap((node) => [node.id, node.name, node.label].filter(Boolean).map(String)));
  const edges = graph.edges.filter((edge) => nodeKeys.has(String(edge.source)) && nodeKeys.has(String(edge.target)));
  return { nodes, edges };
}

function registerGraphRoutes(app, context) {
  const { graphStore, paths, runtime } = context;

  app.get('/api/chain-industries', async (req, res) => {
    res.json({ success: true, data: getChainIndustries() });
  });

  app.get('/api/chain-graph-new', async (req, res) => {
    try {
      const graph = await getIndustryChainGraph(graphStore, req.query.industry);
      res.json({
        success: true,
        data: {
          nodes: graph.nodes.map(normalizeNode),
          edges: graph.edges.map(normalizeEdge),
        },
      });
    } catch (error) {
      console.error('Failed to get chain graph:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/init-chain-data', async (req, res) => {
    try {
      const result = await seedChainDemoData(graphStore);
      res.json({ success: true, message: '产业链演示数据初始化完成', data: result });
    } catch (error) {
      console.error('Failed to seed chain demo data:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/tech-graph-new', async (req, res) => {
    try {
      const graph = await graphStore.getGraph({ nodeTypes: ['TechField', 'Tech'] });
      const techNodes = graph.nodes.map(normalizeNode);
      const rootNode = {
        name: TECH_ROOT_NODE_NAME,
        label: TECH_ROOT_NODE_NAME,
        nodeType: 'TechRoot',
        description: '武汉理工大学技术成果总节点',
      };
      const edges = [
        ...techNodes
          .filter((node) => node.nodeType === 'TechField')
          .map((node) => ({ source: TECH_ROOT_NODE_NAME, target: node.name, label: '汇聚' })),
        ...graph.edges.map(normalizeEdge),
      ];
      res.json({ success: true, data: { nodes: [rootNode, ...techNodes], edges } });
    } catch (error) {
      console.error('Failed to get tech graph:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/fusion-graph-new', async (req, res) => {
    try {
      const techLimit = clampPositiveInt(req.query.techLimit, 120, 300);
      const chainGraph = await getIndustryChainGraph(graphStore, req.query.industry);
      const chainNodes = chainGraph.nodes.map(normalizeNode);
      const techNodes = (await graphStore.getNodes({ nodeTypes: ['Tech'], limit: techLimit })).map(normalizeNode);
      const techMatchEdges = buildFusionTechMatches(techNodes, chainNodes);

      res.json({
        success: true,
        data: {
          nodes: [...chainNodes, ...techNodes],
          edges: [...chainGraph.edges.map(normalizeEdge), ...techMatchEdges],
          meta: {
            chainNodeCount: chainNodes.length,
            chainEdgeCount: chainGraph.edges.length,
            techNodeCount: techNodes.length,
            techMatchEdgeCount: techMatchEdges.length,
            note: '融合图谱保留产业链图谱节点与关系，并将技术节点匹配到产业链节点。',
          },
        },
      });
    } catch (error) {
      console.error('Failed to get fusion graph:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/graph-node', async (req, res) => {
    try {
      const { name, nodeType, properties } = req.body;
      if (!name || !nodeType) {
        return res.status(400).json({ success: false, error: 'name and nodeType are required' });
      }
      const node = await graphStore.createNode({ name, nodeType, properties: { ...(properties || {}), name } });
      res.json({ success: true, data: normalizeNode(node) });
    } catch (error) {
      const status = /already exists/.test(error.message) ? 400 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  });

  app.put('/api/graph-node/:name', async (req, res) => {
    try {
      const { nodeType, properties, newName } = req.body;
      const node = await graphStore.updateNode(req.params.name, { nodeType, properties, newName });
      if (!node) {
        return res.status(404).json({ success: false, error: 'node not found' });
      }
      res.json({ success: true, data: normalizeNode(node) });
    } catch (error) {
      const status = /already exists/.test(error.message) ? 400 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/graph-node/:name', async (req, res) => {
    try {
      const deleted = await graphStore.deleteNode(req.params.name);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'node not found' });
      }
      res.json({ success: true, message: 'node deleted' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/graph-edge', async (req, res) => {
    try {
      const { source, target, relType, label } = req.body;
      if (!source || !target || !relType) {
        return res.status(400).json({ success: false, error: 'source, target and relType are required' });
      }
      const edge = await graphStore.createEdge({ source, target, relType, label: label || relType });
      res.json({ success: true, data: normalizeEdge(edge) });
    } catch (error) {
      const status = /already exists|does not exist/.test(error.message) ? 400 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/graph-edge', async (req, res) => {
    try {
      const { source, target, relType } = req.body;
      const deleted = await graphStore.deleteEdge({ source, target, relType });
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'edge not found' });
      }
      res.json({ success: true, deleted });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put('/api/graph-edge', async (req, res) => {
    try {
      const edge = await graphStore.updateEdge(req.body);
      if (!edge) {
        return res.status(404).json({ success: false, error: 'edge not found' });
      }
      res.json({ success: true, data: normalizeEdge(edge) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/graph-batch-import', async (req, res) => {
    try {
      const result = await graphStore.batchImport({
        nodes: req.body.nodes || [],
        edges: req.body.edges || [],
      });
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/graph-text-import', async (req, res) => {
    try {
      const { text, graphType } = req.body;
      if (!text || !String(text).trim()) {
        return res.status(400).json({ success: false, error: 'text is required' });
      }
      const config = normalizeGraphTextImportType(graphType);
      const extracted = await extractGraphDataFromText(text, config, runtime);
      const sanitized = sanitizeExtractedGraphData(extracted, config);
      if (sanitized.errors.length > 0) {
        return res.status(400).json({ success: false, errors: sanitized.errors });
      }
      const result = await graphStore.textImportMerge(sanitized);
      res.json({ success: true, data: { ...result, extracted: sanitized } });
    } catch (error) {
      console.error('Failed to import graph from text:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/graph-export/:format', async (req, res) => {
    try {
      const { format } = req.params;
      const graphType = req.query.graphType;
      let graph;
      if (graphType === 'chain') {
        graph = await getIndustryChainGraph(graphStore, req.query.industry);
      } else if (graphType === 'tech') {
        graph = await graphStore.exportGraph({ nodeTypes: ['TechField', 'Tech'] });
      } else if (graphType === 'fusion') {
        const chainGraph = await getIndustryChainGraph(graphStore, req.query.industry);
        const chainNodes = chainGraph.nodes.map(normalizeNode);
        const techNodes = (await graphStore.getNodes({ nodeTypes: ['Tech'], limit: 120 })).map(normalizeNode);
        graph = {
          nodes: [...chainNodes, ...techNodes],
          edges: [...chainGraph.edges, ...buildFusionTechMatches(techNodes, chainNodes)],
        };
      } else {
        graph = await graphStore.exportGraph();
      }
      const nodes = graph.nodes.map(normalizeNode);
      const edges = graph.edges.map(normalizeEdge);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        return res.send(toCsv(nodes, edges));
      }

      res.json({ success: true, data: { nodes, edges } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/graph-snapshot', async (req, res) => {
    try {
      const graph = await graphStore.exportGraph();
      const snapshot = writeSnapshot(paths.snapshotDir, graph.nodes, graph.edges);
      res.json({ success: true, data: { fileName: snapshot.fileName } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/graph-snapshots', async (req, res) => {
    try {
      fs.mkdirSync(paths.snapshotDir, { recursive: true });
      const snapshots = fs.readdirSync(paths.snapshotDir)
        .filter((fileName) => fileName.endsWith('.json'))
        .map((fileName) => {
          const filePath = path.join(paths.snapshotDir, fileName);
          const stat = fs.statSync(filePath);
          return { fileName, size: stat.size, createdAt: stat.birthtime, updatedAt: stat.mtime };
        })
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      res.json({ success: true, data: snapshots });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/graph-snapshot-restore/:fileName', async (req, res) => {
    try {
      const fileName = path.basename(req.params.fileName);
      const filePath = path.join(paths.snapshotDir, fileName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'snapshot not found' });
      }
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const result = await graphStore.replaceGraph({
        nodes: payload.nodes || [],
        edges: payload.edges || [],
      });
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/node-types', async (req, res) => {
    try {
      res.json({ success: true, data: await graphStore.getNodeTypes() });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/rel-types', async (req, res) => {
    try {
      res.json({ success: true, data: await graphStore.getRelTypes() });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/nodes', async (req, res) => {
    try {
      res.json({ success: true, data: await graphStore.getNodes({ nodeTypes: ['Node'] }) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/nodes/:type', async (req, res) => {
    try {
      res.json({ success: true, data: await graphStore.getNodes({ types: [req.params.type] }) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/edges', async (req, res) => {
    try {
      res.json({ success: true, data: (await graphStore.getEdges()).map(normalizeEdge) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/graph/:type', async (req, res) => {
    try {
      const nodeTypes = req.params.type === 'shipping'
        ? LEGACY_SHIPPING_TYPES
        : req.params.type === 'school'
          ? LEGACY_SCHOOL_TYPES
          : null;
      if (!nodeTypes) {
        return res.status(400).json({ success: false, error: 'invalid graph type' });
      }
      const graph = await graphStore.getGraph({ types: nodeTypes });
      res.json({ success: true, data: { nodes: graph.nodes, edges: graph.edges.map(normalizeEdge) } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/node/:id', async (req, res) => {
    try {
      const node = (await graphStore.getNodes({ name: req.params.id }))[0];
      if (!node) {
        return res.status(404).json({ success: false, error: 'node not found' });
      }
      const graph = await graphStore.findNeighbors(req.params.id, { maxDepth: 1 });
      res.json({
        success: true,
        data: {
          ...node,
          relations: graph.edges.map((edge) => {
            const relatedKey = String(edge.source) === String(getNodeKey(node)) ? edge.target : edge.source;
            const related = graph.nodes.find((item) => [item.id, item.name, item.label].includes(relatedKey));
            return {
              type: edge.relType || edge.label,
              relatedId: related?.id || relatedKey,
              relatedLabel: related?.label || related?.name || relatedKey,
            };
          }),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/search', async (req, res) => {
    try {
      res.json({ success: true, data: await graphStore.searchNodes(req.query.q || '', { limit: 20 }) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/node', async (req, res) => {
    try {
      const node = await graphStore.createNode({
        name: req.body.name || req.body.label || req.body.id,
        nodeType: 'Node',
        properties: { ...req.body, nodeType: 'Node' },
      });
      res.json({ success: true, data: node });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/nodes', async (req, res) => {
    try {
      const createdNodes = [];
      for (const node of req.body.nodes || []) {
        createdNodes.push(await graphStore.createNode({
          name: node.name || node.label || node.id,
          nodeType: 'Node',
          properties: { ...node, nodeType: 'Node' },
        }));
      }
      res.json({ success: true, data: createdNodes });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/edge', async (req, res) => {
    try {
      const edge = await graphStore.createEdge({
        source: req.body.source,
        target: req.body.target,
        relType: 'RELATIONSHIP',
        label: req.body.label || 'RELATIONSHIP',
      });
      res.json({ success: true, data: normalizeEdge(edge) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/edges', async (req, res) => {
    try {
      const createdEdges = [];
      for (const edge of req.body.edges || []) {
        createdEdges.push(await graphStore.createEdge({
          source: edge.source,
          target: edge.target,
          relType: 'RELATIONSHIP',
          label: edge.label || 'RELATIONSHIP',
        }));
      }
      res.json({ success: true, data: createdEdges.map(normalizeEdge) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/enterprise/:name/supply-chain', async (req, res) => {
    try {
      const enterprise = (await graphStore.getNodes({ label: req.params.name }))[0];
      if (!enterprise || enterprise.type !== 'Enterprise') {
        return res.status(404).json({ success: false, error: 'enterprise not found' });
      }
      const graph = await graphStore.findNeighbors(getNodeKey(enterprise), {
        maxDepth: 3,
        types: ['Enterprise', 'Vessel', 'Port', 'Cargo', 'Route'],
      });
      res.json({
        success: true,
        data: {
          nodes: graph.nodes,
          edges: graph.edges.map(normalizeEdge),
          enterprise,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/tech-needs/:needId/match-achievements', async (req, res) => {
    try {
      const techNeed = (await graphStore.getNodes({ name: req.params.needId }))[0];
      if (!techNeed) {
        return res.status(404).json({ success: false, error: 'tech need not found' });
      }
      const keywords = String(techNeed.label || techNeed.name || '').split(/[\s,，、]+/).filter(Boolean);
      const achievements = (await graphStore.getNodes({ types: ['Patent', 'Paper', 'Project'] }))
        .filter((node) => {
          const text = getNodeSearchText(node);
          return keywords.length === 0 || keywords.some((keyword) => text.includes(keyword));
        })
        .slice(0, 10);
      res.json({ success: true, data: { techNeed, achievements } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/integrated-graph/:enterpriseName', async (req, res) => {
    try {
      const enterprise = (await graphStore.getNodes({ label: req.params.enterpriseName }))[0];
      if (!enterprise || enterprise.type !== 'Enterprise') {
        return res.status(404).json({ success: false, error: 'enterprise not found' });
      }
      const graph = await graphStore.findNeighbors(getNodeKey(enterprise), {
        maxDepth: 4,
        types: ['Enterprise', 'Vessel', 'Port', 'Cargo', 'Route'],
      });
      const nodes = graph.nodes.map((node) => ({ ...node }));
      const edges = graph.edges.map(normalizeEdge);
      if (runtime.DEEPSEEK_API_KEY && nodes.length > 1) {
        try {
          const levels = await analyzeChainLevelWithAI(nodes, edges, runtime);
          nodes.forEach((node) => {
            if (levels[node.label] !== undefined) {
              node.level = levels[node.label];
            }
          });
        } catch (error) {
          console.warn('AI level analysis failed:', error.message);
        }
      }
      res.json({ success: true, data: { nodes, edges, enterprise, chainNodes: nodes } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/fusion-chain-tech/:enterpriseName', async (req, res) => {
    try {
      const enterprise = (await graphStore.getNodes({ label: req.params.enterpriseName }))[0];
      if (!enterprise || enterprise.type !== 'Enterprise') {
        return res.status(404).json({ success: false, error: 'enterprise not found' });
      }
      const chainGraph = await graphStore.findNeighbors(getNodeKey(enterprise), {
        maxDepth: 3,
        types: ['Enterprise', 'Vessel', 'Port', 'Cargo', 'Route'],
      });
      const chainNodes = chainGraph.nodes.map(normalizeNode);
      const chainEdges = chainGraph.edges.map(normalizeEdge);
      const allAchievements = await graphStore.getNodes({ types: TECH_NODE_TYPES, limit: 200 });
      const techNodes = [];
      const techEdges = [];
      const seen = new Set();

      chainNodes
        .filter((node) => getNodeKey(node) !== getNodeKey(enterprise))
        .forEach((chainNode) => {
          const ranked = allAchievements
            .map((tech) => ({ tech: normalizeNode(tech), score: scoreFusionTechMatch(normalizeNode(tech), chainNode) }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
          ranked.forEach(({ tech }) => {
            const key = getNodeKey(tech);
            if (!seen.has(key)) {
              seen.add(key);
              techNodes.push({ ...tech, matchedChainNode: chainNode.label || chainNode.name });
            }
            techEdges.push({ source: getNodeKey(chainNode), target: key, label: '技术匹配' });
          });
        });

      res.json({
        success: true,
        data: {
          nodes: [...chainNodes, ...techNodes],
          edges: [...chainEdges, ...techEdges],
          enterprise,
          chainNodes,
          techNodes,
          chainEdges,
          techEdges,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = {
  registerGraphRoutes,
};
