const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const outDir = path.join(root, '.understand-anything');
const intermediateDir = path.join(outDir, 'intermediate');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(intermediateDir, { recursive: true });

const ignoreText = [
  '# .understandignore - patterns for files/dirs to exclude from analysis',
  'node_modules/',
  '.git/',
  'dist/',
  'logs/',
  'uploads/',
  '.understand-anything/tmp/',
  '*.lock',
  'package-lock.json',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.ico',
  '*.pptx',
  '*.zip',
  '*.tar',
  '*.gz',
  '*.rdb',
  '*.log',
  ''
].join('\n');
fs.writeFileSync(path.join(outDir, '.understandignore'), ignoreText, 'utf8');
fs.writeFileSync(path.join(outDir, 'config.json'), JSON.stringify({
  outputLanguage: 'zh',
  autoUpdate: false
}, null, 2), 'utf8');

const skipDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'logs',
  'uploads',
  '.understand-anything',
  '.understand-anything/tmp'
]);
const skipExt = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.pptx',
  '.zip',
  '.tar',
  '.gz',
  '.rdb',
  '.log',
  '.lock'
]);
const includeExt = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.html',
  '.css',
  '.scss',
  '.yml',
  '.yaml',
  '.toml',
  '.conf',
  '.sh',
  '.bat',
  '.env'
]);
const includeNames = new Set(['Dockerfile', 'Makefile', 'nginx.conf']);

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = rel(full);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name) || skipDirs.has(relative)) continue;
      walk(full, files);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (skipExt.has(ext)) continue;
    if (includeExt.has(ext) || includeNames.has(entry.name) || entry.name.startsWith('.env')) {
      files.push(full);
    }
  }
  return files.sort((a, b) => rel(a).localeCompare(rel(b)));
}

function languageFor(file) {
  const name = path.basename(file);
  const ext = path.extname(name).toLowerCase();
  if (['.ts', '.tsx'].includes(ext)) return 'typescript';
  if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'javascript';
  if (ext === '.json') return 'json';
  if (ext === '.md') return 'markdown';
  if (ext === '.html') return 'html';
  if (['.css', '.scss'].includes(ext)) return 'css';
  if (['.yml', '.yaml'].includes(ext)) return 'yaml';
  if (ext === '.toml') return 'toml';
  if (ext === '.sh') return 'shell';
  if (ext === '.bat') return 'batch';
  if (name.startsWith('.env')) return 'config';
  if (name === 'nginx.conf' || ext === '.conf') return 'nginx';
  return 'text';
}

function categoryFor(file) {
  const r = rel(file);
  const name = path.basename(file);
  const ext = path.extname(name).toLowerCase();
  if (['.md'].includes(ext)) return 'docs';
  if (['.env', '.json', '.yml', '.yaml', '.toml', '.conf'].includes(ext) || name.startsWith('.env')) return 'config';
  if (['.sh', '.bat'].includes(ext) || r.startsWith('scripts/')) return 'script';
  if (r.startsWith('public/') || ['.html', '.css', '.scss'].includes(ext)) return 'markup';
  return 'code';
}

function nodeTypeFor(category) {
  if (category === 'docs') return 'document';
  if (category === 'config') return 'config';
  if (category === 'script') return 'file';
  if (category === 'markup') return 'file';
  return 'file';
}

function nodeIdFor(file, category) {
  const prefix = nodeTypeFor(category);
  return `${prefix}:${rel(file)}`;
}

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function lineCount(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function summarize(relative, category, language) {
  if (relative === 'package.json') return '项目清单文件，定义脚本、依赖和包元数据。';
  if (relative === 'index.html') return 'Vite 前端应用的 HTML 入口文件。';
  if (relative.startsWith('src/')) return `React 前端应用中的 ${language} 源文件。`;
  if (relative.startsWith('server/')) return `后端服务中的 ${language} 源文件，用于 API、数据或服务逻辑。`;
  if (relative.startsWith('scripts/')) return '用于服务启动、数据导入、维护或自动化的运维脚本。';
  if (category === 'docs') return '项目文档和运行说明。';
  if (category === 'config') return '应用、工具链、部署或环境使用的配置文件。';
  if (category === 'markup') return '前端标记文件或静态资源源文件。';
  return `项目中的 ${language} 源文件。`;
}

function tagsFor(relative, category, language) {
  const tags = [category, language].filter(Boolean);
  if (relative.startsWith('src/')) tags.push('frontend');
  if (relative.startsWith('server/')) tags.push('backend');
  if (relative.startsWith('scripts/')) tags.push('automation');
  if (relative.includes('neo4j')) tags.push('neo4j');
  if (relative.includes('ppt') || relative.includes('PPT')) tags.push('presentation');
  if (relative.includes('match')) tags.push('matching');
  return [...new Set(tags)];
}

function extractImports(file, fileByRelative) {
  const text = safeRead(file);
  const dir = path.dirname(rel(file));
  const candidates = [];
  const regexes = [
    /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g
  ];
  for (const rx of regexes) {
    let match;
    while ((match = rx.exec(text))) candidates.push(match[1]);
  }
  const resolved = [];
  for (const spec of candidates) {
    if (!spec.startsWith('.')) continue;
    const base = path.posix.normalize(path.posix.join(dir, spec));
    const tries = [
      base,
      `${base}.js`,
      `${base}.jsx`,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.json`,
      `${base}/index.js`,
      `${base}/index.jsx`,
      `${base}/index.ts`,
      `${base}/index.tsx`
    ];
    const target = tries.find(t => fileByRelative.has(t));
    if (target) resolved.push(target);
  }
  return [...new Set(resolved)];
}

function edge(source, target, type, weight = 0.6) {
  return { source, target, type, weight };
}

const files = walk(root);
const fileByRelative = new Set(files.map(rel));
const scanFiles = files.map(file => {
  const text = safeRead(file);
  const relative = rel(file);
  const language = languageFor(file);
  const fileCategory = categoryFor(file);
  return { path: relative, language, sizeLines: lineCount(text), fileCategory };
});

const nodes = scanFiles.map(item => ({
  id: nodeIdFor(path.join(root, item.path), item.fileCategory),
  type: nodeTypeFor(item.fileCategory),
  name: path.basename(item.path),
  filePath: item.path,
  summary: summarize(item.path, item.fileCategory, item.language),
  tags: tagsFor(item.path, item.fileCategory, item.language),
  language: item.language,
  sizeLines: item.sizeLines
}));
const nodeByPath = new Map(nodes.map(n => [n.filePath, n]));
const edges = [];

for (const item of scanFiles) {
  const source = nodeByPath.get(item.path);
  if (!source) continue;
  for (const targetPath of extractImports(path.join(root, item.path), fileByRelative)) {
    const target = nodeByPath.get(targetPath);
    if (target) edges.push(edge(source.id, target.id, 'imports', 0.7));
  }
}

function addConfigures(configPath, targets) {
  const config = nodeByPath.get(configPath);
  if (!config) return;
  for (const targetPath of targets) {
    const target = nodeByPath.get(targetPath);
    if (target) edges.push(edge(config.id, target.id, 'configures', 0.6));
  }
}
addConfigures('package.json', ['index.html', 'vite.config.js']);
addConfigures('vite.config.js', ['index.html']);
addConfigures('nginx.conf', ['dist/index.html', 'index.html']);

for (const docName of ['DEPLOYMENT.md', 'QUICK_START.md', 'NEO4J_SETUP.md']) {
  const doc = nodeByPath.get(docName);
  if (!doc) continue;
  const target = nodeByPath.get('package.json');
  if (target) edges.push(edge(doc.id, target.id, 'documents', 0.5));
}

const layerDefs = [
  {
    id: 'layer:frontend-application',
    name: '前端应用',
    description: 'React、Vite、公共资源以及面向浏览器的源文件。',
    test: p => p.startsWith('src/') || p.startsWith('public/') || p === 'index.html' || p === 'vite.config.js'
  },
  {
    id: 'layer:backend-services',
    name: '后端服务',
    description: '服务端 API、图谱导入、Redis 启动以及数据服务逻辑。',
    test: p => p.startsWith('server/')
  },
  {
    id: 'layer:automation-and-imports',
    name: '自动化与导入',
    description: '用于导入、匹配、部署和检查的运维脚本及根目录工具。',
    test: p => p.startsWith('scripts/') || /^(check-|import-|match-|deploy\.)/.test(path.basename(p))
  },
  {
    id: 'layer:documentation-and-deployment',
    name: '文档与部署',
    description: 'Markdown 指南、部署说明、Neo4j 设置和基础设施配置。',
    test: p => p.endsWith('.md') || p === 'nginx.conf'
  },
  {
    id: 'layer:configuration',
    name: '配置',
    description: '包配置、环境配置和应用配置文件。',
    test: p => categoryFor(path.join(root, p)) === 'config'
  },
  {
    id: 'layer:other-project-files',
    name: '其他项目文件',
    description: '未归入主要层级的其余源文件和支撑文件。',
    test: () => true
  }
];

const assigned = new Set();
const layers = layerDefs.map(def => {
  const nodeIds = nodes
    .filter(n => !assigned.has(n.id) && def.test(n.filePath))
    .map(n => {
      assigned.add(n.id);
      return n.id;
    });
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    nodeIds
  };
}).filter(l => l.nodeIds.length > 0);

const pick = (...paths) => paths.map(p => nodeByPath.get(p)?.id).filter(Boolean);
const tour = [
  {
    order: 1,
    title: '项目清单与目标',
    description: '从 package.json 和快速开始文档入手，理解应用形态、脚本和依赖。',
    nodeIds: pick('package.json', 'QUICK_START.md', 'DEPLOYMENT.md')
  },
  {
    order: 2,
    title: '前端入口',
    description: '查看 Vite 入口和 React 源码区域，了解浏览器端应用如何组装。',
    nodeIds: pick('index.html', 'vite.config.js', 'src/main.jsx', 'src/main.tsx', 'src/App.jsx', 'src/App.tsx')
  },
  {
    order: 3,
    title: '后端与数据服务',
    description: '阅读服务端层和导入流程，理解 API 行为、数据加载和图谱持久化。',
    nodeIds: nodes.filter(n => n.filePath.startsWith('server/')).slice(0, 8).map(n => n.id)
  },
  {
    order: 4,
    title: '自动化与部署',
    description: '沿着运维脚本、部署文件和设置指南，理解本地运行和生产部署支撑。',
    nodeIds: [
      ...nodes.filter(n => n.filePath.startsWith('scripts/')).slice(0, 5).map(n => n.id),
      ...pick('deploy.sh', 'deploy.bat', 'nginx.conf', 'NEO4J_SETUP.md')
    ]
  }
].filter(step => step.nodeIds.length > 0);

const pkg = JSON.parse(safeRead(path.join(root, 'package.json')) || '{}');
const languages = [...new Set(scanFiles.map(f => f.language).filter(Boolean))].sort();
const frameworks = ['React', 'Vite', 'Express', 'Neo4j', 'Redis', 'Ant Design', 'Cytoscape'].filter(name => {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  return Object.keys(deps).some(dep => dep.toLowerCase().includes(name.toLowerCase().replace(' ', '-')) || dep.toLowerCase() === name.toLowerCase());
});
const commit = (() => {
  if (process.env.UNDERSTAND_COMMIT) return process.env.UNDERSTAND_COMMIT;
  try {
    const result = cp.spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
    return result.status === 0 ? result.stdout.trim() : 'unknown';
  } catch {
    return 'unknown';
  }
})();
const now = new Date().toISOString();

const graph = {
  version: '1.0.0',
  project: {
    name: pkg.name || path.basename(root),
    languages,
    frameworks,
    description: pkg.description || '科技服务知识图谱应用。',
    analyzedAt: now,
    gitCommitHash: commit
  },
  nodes,
  edges,
  layers,
  tour
};

const byCategory = scanFiles.reduce((acc, f) => {
  acc[f.fileCategory] = (acc[f.fileCategory] || 0) + 1;
  return acc;
}, {});
const byLanguage = scanFiles.reduce((acc, f) => {
  acc[f.language] = (acc[f.language] || 0) + 1;
  return acc;
}, {});
const nodeTypes = nodes.reduce((acc, n) => {
  acc[n.type] = (acc[n.type] || 0) + 1;
  return acc;
}, {});
const edgeTypes = edges.reduce((acc, e) => {
  acc[e.type] = (acc[e.type] || 0) + 1;
  return acc;
}, {});

const scanResult = {
  projectName: graph.project.name,
  projectDescription: graph.project.description,
  languages,
  frameworks,
  files: scanFiles,
  totalFiles: scanFiles.length,
  filteredByIgnore: 0,
  estimatedComplexity: scanFiles.length > 500 ? 'large' : scanFiles.length > 100 ? 'moderate' : 'small',
  stats: { filesScanned: scanFiles.length, byCategory, byLanguage },
  importMap: Object.fromEntries(scanFiles.map(f => [f.path, extractImports(path.join(root, f.path), fileByRelative)]))
};

fs.writeFileSync(path.join(intermediateDir, 'scan-result.json'), JSON.stringify(scanResult, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, 'knowledge-graph.json'), JSON.stringify(graph, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({
  lastAnalyzedAt: now,
  gitCommitHash: commit,
  version: '1.0.0',
  analyzedFiles: scanFiles.length
}, null, 2), 'utf8');

console.log(JSON.stringify({
  project: graph.project,
  filesAnalyzed: scanFiles.length,
  byCategory,
  nodes: nodes.length,
  nodeTypes,
  edges: edges.length,
  edgeTypes,
  layers: layers.map(l => l.name),
  tourSteps: tour.length,
  output: path.join(outDir, 'knowledge-graph.json')
}, null, 2));
