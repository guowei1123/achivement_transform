const fs = require('fs');
const path = require('path');

const DEFAULT_DATA = {
  nodes: [],
  edges: [],
  updatedAt: '',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map((item) => String(item)))];
}

function getNodeKeys(node) {
  return unique([node.id, node.name, node.label]);
}

function getNodeType(node) {
  return node.nodeType || node.type || 'Node';
}

function getEdgeType(edge) {
  return edge.relType || edge.label || edge.type || 'RELATIONSHIP';
}

function includesText(value, q) {
  return String(value || '').toLowerCase().includes(String(q || '').toLowerCase());
}

function createStableNodeId(node, index = 0) {
  const source = String(node.id || node.name || node.label || `node_${index + 1}`).trim();
  const encoded = Buffer.from(source, 'utf8')
    .toString('base64url')
    .slice(0, 48);
  return `node_${encoded || index + 1}`;
}

function ensureNodeId(node, index = 0) {
  if (node.id !== undefined && node.id !== null && String(node.id).trim() !== '') {
    return node;
  }
  return {
    ...node,
    id: createStableNodeId(node, index),
  };
}

class JsonGraphStore {
  constructor(options = {}) {
    this.filePath = options.filePath;
    if (!this.filePath) {
      throw new Error('JsonGraphStore requires filePath');
    }
    this.ensureDataFile();
  }

  ensureDataFile() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      this.writeData(DEFAULT_DATA);
    }
  }

  readData() {
    this.ensureDataFile();
    const raw = fs.readFileSync(this.filePath, 'utf-8').trim();
    if (!raw) {
      return clone(DEFAULT_DATA);
    }
    const parsed = JSON.parse(raw);
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes.map((node, index) => ensureNodeId(node, index)) : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      updatedAt: parsed.updatedAt || '',
    };
  }

  writeData(data) {
    const payload = {
      nodes: Array.isArray(data.nodes) ? data.nodes.map((node, index) => ensureNodeId(node, index)) : [],
      edges: Array.isArray(data.edges) ? data.edges : [],
      updatedAt: new Date().toISOString(),
    };
    const tempPath = `${this.filePath}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
    try {
      fs.renameSync(tempPath, this.filePath);
    } catch (error) {
      fs.copyFileSync(tempPath, this.filePath);
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Some locked-down Windows environments deny immediate temp cleanup.
      }
    }
    return payload;
  }

  findNodeIndex(data, identifier) {
    const key = String(identifier || '');
    return data.nodes.findIndex((node) => getNodeKeys(node).includes(key));
  }

  findNode(data, identifier) {
    const index = this.findNodeIndex(data, identifier);
    return index >= 0 ? data.nodes[index] : null;
  }

  edgeMatchesNode(edgeValue, node) {
    return getNodeKeys(node).includes(String(edgeValue || ''));
  }

  normalizeEdge(data, edge) {
    const sourceNode = this.findNode(data, edge.source);
    const targetNode = this.findNode(data, edge.target);
    if (!sourceNode || !targetNode) {
      throw new Error('source or target node does not exist');
    }
    const relType = String(edge.relType || edge.label || edge.type || 'RELATIONSHIP').trim();
    if (!relType) {
      throw new Error('edge relType is required');
    }
    return {
      ...edge,
      source: edge.source,
      target: edge.target,
      relType,
      label: edge.label || relType,
    };
  }

  filterNodes(nodes, filter = {}) {
    let result = [...nodes];
    if (filter.nodeTypes?.length) {
      const allowed = new Set(filter.nodeTypes);
      result = result.filter((node) => allowed.has(getNodeType(node)) || allowed.has(node.type));
    }
    if (filter.types?.length) {
      const allowed = new Set(filter.types);
      result = result.filter((node) => allowed.has(node.type) || allowed.has(getNodeType(node)));
    }
    if (filter.ids?.length) {
      const allowed = new Set(filter.ids.map(String));
      result = result.filter((node) => getNodeKeys(node).some((key) => allowed.has(key)));
    }
    if (filter.names?.length) {
      const allowed = new Set(filter.names.map(String));
      result = result.filter((node) => getNodeKeys(node).some((key) => allowed.has(key)));
    }
    if (filter.name) {
      result = result.filter((node) => getNodeKeys(node).includes(String(filter.name)));
    }
    if (filter.label) {
      result = result.filter((node) => String(node.label || '') === String(filter.label));
    }
    if (filter.q) {
      result = result.filter((node) =>
        [node.id, node.name, node.label, node.type, node.nodeType, node.category, node.description]
          .some((field) => includesText(field, filter.q))
      );
    }
    if (filter.limit) {
      result = result.slice(0, Number(filter.limit));
    }
    return result;
  }

  async getNodes(filter = {}) {
    return clone(this.filterNodes(this.readData().nodes, filter));
  }

  filterEdges(data, filter = {}) {
    let result = [...data.edges];
    if (filter.source) {
      const sourceNode = this.findNode(data, filter.source);
      result = result.filter((edge) =>
        sourceNode ? this.edgeMatchesNode(edge.source, sourceNode) : String(edge.source) === String(filter.source)
      );
    }
    if (filter.target) {
      const targetNode = this.findNode(data, filter.target);
      result = result.filter((edge) =>
        targetNode ? this.edgeMatchesNode(edge.target, targetNode) : String(edge.target) === String(filter.target)
      );
    }
    if (filter.relType) {
      result = result.filter((edge) => getEdgeType(edge) === filter.relType || edge.label === filter.relType);
    }
    if (filter.nodeKeys?.length) {
      const allowed = new Set(filter.nodeKeys.map(String));
      result = result.filter((edge) => allowed.has(String(edge.source)) && allowed.has(String(edge.target)));
    }
    if (filter.nodeTypes?.length || filter.types?.length) {
      const nodes = this.filterNodes(data.nodes, filter);
      const allowedKeys = new Set(nodes.flatMap(getNodeKeys));
      result = result.filter((edge) => allowedKeys.has(String(edge.source)) && allowedKeys.has(String(edge.target)));
    }
    return result;
  }

  async getEdges(filter = {}) {
    const data = this.readData();
    return clone(this.filterEdges(data, filter));
  }

  async getGraph(filter = {}) {
    const data = this.readData();
    const nodes = this.filterNodes(data.nodes, filter);
    const nodeKeys = new Set(nodes.flatMap(getNodeKeys));
    const edges = data.edges.filter((edge) => nodeKeys.has(String(edge.source)) && nodeKeys.has(String(edge.target)));
    return clone({ nodes, edges });
  }

  async createNode(input) {
    const data = this.readData();
    const properties = input.properties || {};
    const node = {
      ...properties,
      id: input.id || properties.id,
      name: input.name || properties.name || properties.label || properties.id,
      nodeType: input.nodeType || properties.nodeType || properties.type || 'Node',
    };
    const nodeWithId = ensureNodeId(node, data.nodes.length);
    if (!node.name && !node.id && !node.label) {
      throw new Error('node name is required');
    }
    if (this.findNode(data, node.name) || (nodeWithId.id && this.findNode(data, nodeWithId.id)) || (node.label && this.findNode(data, node.label))) {
      throw new Error('node already exists');
    }
    data.nodes.push(nodeWithId);
    this.writeData(data);
    return clone(nodeWithId);
  }

  async updateNode(identifier, updates = {}) {
    const data = this.readData();
    const index = this.findNodeIndex(data, identifier);
    if (index === -1) {
      return null;
    }
    const current = data.nodes[index];
    const oldKeys = getNodeKeys(current);
    const nextName = String(updates.newName || '').trim();
    if (nextName && !oldKeys.includes(nextName) && this.findNode(data, nextName)) {
      throw new Error('node name already exists');
    }
    const next = ensureNodeId({
      ...current,
      ...(updates.properties || {}),
    }, index);
    if (updates.nodeType) {
      next.nodeType = updates.nodeType;
    }
    if (nextName) {
      next.name = nextName;
    }
    data.nodes[index] = next;
    if (nextName) {
      data.edges = data.edges.map((edge) => ({
        ...edge,
        source: oldKeys.includes(String(edge.source)) ? nextName : edge.source,
        target: oldKeys.includes(String(edge.target)) ? nextName : edge.target,
      }));
    }
    this.writeData(data);
    return clone(next);
  }

  async deleteNode(identifier) {
    const data = this.readData();
    const index = this.findNodeIndex(data, identifier);
    if (index === -1) {
      return false;
    }
    const [node] = data.nodes.splice(index, 1);
    const keys = new Set(getNodeKeys(node));
    data.edges = data.edges.filter((edge) => !keys.has(String(edge.source)) && !keys.has(String(edge.target)));
    this.writeData(data);
    return true;
  }

  async createEdge(input) {
    const data = this.readData();
    const edge = this.normalizeEdge(data, input);
    const exists = data.edges.some((item) =>
      String(item.source) === String(edge.source) &&
      String(item.target) === String(edge.target) &&
      getEdgeType(item) === edge.relType
    );
    if (exists) {
      throw new Error('edge already exists');
    }
    data.edges.push(edge);
    this.writeData(data);
    return clone(edge);
  }

  async updateEdge(input) {
    const data = this.readData();
    const oldRelType = input.oldRelType || input.relType || input.label;
    const index = data.edges.findIndex((edge) =>
      String(edge.source) === String(input.source) &&
      String(edge.target) === String(input.target) &&
      (!oldRelType || getEdgeType(edge) === oldRelType || edge.label === oldRelType)
    );
    if (index === -1) {
      return null;
    }
    const nextRelType = input.newRelType || input.relType || oldRelType || 'RELATIONSHIP';
    data.edges[index] = {
      ...data.edges[index],
      relType: nextRelType,
      label: input.label || nextRelType,
    };
    this.writeData(data);
    return clone(data.edges[index]);
  }

  async deleteEdge(input) {
    const data = this.readData();
    const before = data.edges.length;
    data.edges = data.edges.filter((edge) => {
      const sameEndpoints = String(edge.source) === String(input.source) && String(edge.target) === String(input.target);
      const sameType = !input.relType || getEdgeType(edge) === input.relType || edge.label === input.relType;
      return !(sameEndpoints && sameType);
    });
    this.writeData(data);
    return before - data.edges.length;
  }

  async batchImport({ nodes = [], edges = [] }) {
    let nodeCount = 0;
    let edgeCount = 0;
    for (const node of nodes) {
      try {
        await this.createNode({
          name: node.name || node.label || node.id,
          nodeType: node.nodeType || node.type || 'Node',
          properties: node,
        });
        nodeCount += 1;
      } catch (error) {
        if (!/already exists/.test(error.message)) {
          throw error;
        }
      }
    }
    for (const edge of edges) {
      try {
        await this.createEdge({
          source: edge.source,
          target: edge.target,
          relType: edge.relType || edge.label || edge.type || 'RELATIONSHIP',
          label: edge.label || edge.relType,
        });
        edgeCount += 1;
      } catch (error) {
        if (!/already exists/.test(error.message)) {
          throw error;
        }
      }
    }
    return { nodeCount, edgeCount };
  }

  async textImportMerge({ nodes = [], edges = [] }) {
    let nodeCount = 0;
    let edgeCount = 0;
    for (const node of nodes) {
      const existing = (await this.getNodes({ name: node.name }))[0];
      if (existing) {
        await this.updateNode(node.name, {
          nodeType: node.nodeType,
          properties: node.properties || {},
        });
      } else {
        await this.createNode({
          name: node.name,
          nodeType: node.nodeType,
          properties: node.properties || {},
        });
        nodeCount += 1;
      }
    }
    for (const edge of edges) {
      try {
        await this.createEdge(edge);
        edgeCount += 1;
      } catch (error) {
        if (!/already exists/.test(error.message)) {
          throw error;
        }
      }
    }
    return { nodeCount, edgeCount };
  }

  async exportGraph(filter = {}) {
    return this.getGraph(filter);
  }

  async replaceGraph({ nodes = [], edges = [] }) {
    this.writeData({ nodes: nodes.map((node, index) => ensureNodeId(node, index)), edges });
    return { nodeCount: nodes.length, edgeCount: edges.length };
  }

  async getNodeTypes() {
    const data = this.readData();
    return unique(data.nodes.flatMap((node) => [node.nodeType, node.type]));
  }

  async getRelTypes() {
    const data = this.readData();
    return unique(data.edges.flatMap((edge) => [edge.relType, edge.label]));
  }

  async searchNodes(q, options = {}) {
    return this.getNodes({ q, limit: options.limit || 20 });
  }

  async findNeighbors(identifier, options = {}) {
    const data = this.readData();
    const start = this.findNode(data, identifier);
    if (!start) {
      return { nodes: [], edges: [] };
    }
    const maxDepth = options.maxDepth || 1;
    const allowedTypes = options.types ? new Set(options.types) : null;
    const visited = new Set(getNodeKeys(start));
    const resultNodes = [start];
    const resultEdges = [];
    let frontier = [start];
    for (let depth = 0; depth < maxDepth; depth += 1) {
      const nextFrontier = [];
      for (const node of frontier) {
        const keys = new Set(getNodeKeys(node));
        const incident = data.edges.filter((edge) => keys.has(String(edge.source)) || keys.has(String(edge.target)));
        for (const edge of incident) {
          const otherKey = keys.has(String(edge.source)) ? edge.target : edge.source;
          const other = this.findNode(data, otherKey);
          if (!other) {
            continue;
          }
          if (allowedTypes && !allowedTypes.has(other.type) && !allowedTypes.has(getNodeType(other))) {
            continue;
          }
          resultEdges.push(edge);
          const otherKeys = getNodeKeys(other);
          if (!otherKeys.some((key) => visited.has(key))) {
            otherKeys.forEach((key) => visited.add(key));
            resultNodes.push(other);
            nextFrontier.push(other);
          }
        }
      }
      frontier = nextFrontier;
    }
    return clone({ nodes: resultNodes, edges: resultEdges });
  }
}

module.exports = {
  JsonGraphStore,
  getNodeKeys,
  getNodeType,
  getEdgeType,
  ensureNodeId,
};
