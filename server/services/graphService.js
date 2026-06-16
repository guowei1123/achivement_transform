const axios = require('axios');

const CHAIN_NODE_TYPES = ['Input', 'Industry', 'MidProduct', 'FinalProduct', 'Layer2', 'Layer3', 'Layer4', 'Value'];
const TECH_NODE_TYPES = ['Tech', 'Patent', 'Paper', 'Project'];

const GENERIC_PREFIXES = ['智能', '智慧', '数字化', '联合', '应急', '计划性', '大型', '特种', '下游', '库区'];
const GENERIC_SUFFIXES = [
  '管理', '服务', '企业', '系统', '平台', '施工', '供应', '制造', '工程', '设备',
  '保障', '控制', '监测', '运行', '调度', '安装', '配送', '采购', '浇筑', '围堰',
  '开挖', '衬砌', '外送', '扶持', '用户',
];

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
}

function trimGenericAffixes(term) {
  let current = String(term || '').trim();
  let changed = true;

  while (changed && current.length > 2) {
    changed = false;
    for (const prefix of GENERIC_PREFIXES) {
      if (current.startsWith(prefix) && current.length - prefix.length >= 2) {
        current = current.slice(prefix.length);
        changed = true;
      }
    }
    for (const suffix of GENERIC_SUFFIXES) {
      if (current.endsWith(suffix) && current.length - suffix.length >= 2) {
        current = current.slice(0, -suffix.length);
        changed = true;
      }
    }
  }

  return current;
}

function extractKeywords(terms) {
  const keywords = new Set();

  for (const rawTerm of terms) {
    const term = String(rawTerm || '').replace(/[()（）]/g, '').trim();
    if (!term) continue;
    keywords.add(term);

    const trimmed = trimGenericAffixes(term);
    if (trimmed && trimmed !== term) {
      keywords.add(trimmed);
    }

    const source = trimmed || term;
    if (/^[\u4e00-\u9fa5]+$/.test(source) && source.length >= 4) {
      for (let size = 2; size <= Math.min(4, source.length); size += 1) {
        for (let index = 0; index <= source.length - size; index += 1) {
          keywords.add(source.slice(index, index + size));
        }
      }
    }

    term
      .split(/[、，,\s-]+/)
      .map((segment) => segment.trim())
      .filter(Boolean)
      .forEach((segment) => {
        keywords.add(segment);
        const cleaned = trimGenericAffixes(segment);
        if (cleaned && cleaned !== segment) {
          keywords.add(cleaned);
        }
      });
  }

  return uniqueStrings([...keywords]).filter((keyword) => keyword.length >= 2);
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

function scoreTextMatch(keyword, node) {
  const normalizedKeyword = String(keyword || '').trim();
  if (!normalizedKeyword) {
    return 0;
  }

  let score = 0;
  const primary = [node.name, node.label];
  const secondary = [node.field, node.category, node.type, node.nodeType];
  const tertiary = [node.description, node.ppt_content, node.summary, node.abstract, node.keywords];

  primary.forEach((field) => {
    if (String(field || '').includes(normalizedKeyword)) {
      score += normalizedKeyword.length >= 4 ? 8 : 6;
    }
  });
  secondary.forEach((field) => {
    if (String(field || '').includes(normalizedKeyword)) {
      score += normalizedKeyword.length >= 4 ? 5 : 3;
    }
  });
  tertiary.flatMap((field) => Array.isArray(field) ? field : [field]).forEach((field) => {
    if (String(field || '').includes(normalizedKeyword)) {
      score += 1;
    }
  });

  return score;
}

async function analyzeChainLevelWithAI(nodes, edges, runtime) {
  const chainText = edges.map((edge) => {
    const sourceNode = nodes.find((node) => node.id === edge.source || node.name === edge.source || node.label === edge.source);
    const targetNode = nodes.find((node) => node.id === edge.target || node.name === edge.target || node.label === edge.target);
    return `${sourceNode?.label || sourceNode?.name || edge.source} -> ${targetNode?.label || targetNode?.name || edge.target} (${edge.label})`;
  }).join('\n');

  const response = await axios.post(
    'https://api.deepseek.com/v1/chat/completions',
    {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是产业链分析专家，请根据关系判断企业或环节层级，并严格返回 JSON。',
        },
        {
          role: 'user',
          content: `请分析以下产业链关系，并返回 {"levels":{"名称": 层级数字}}：\n${chainText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${runtime.DEEPSEEK_API_KEY}`,
      },
    }
  );

  const aiResponse = response.data.choices[0].message.content;
  const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI response is not valid JSON');
  }
  const levelData = JSON.parse(jsonMatch[0]);
  return levelData.levels || {};
}

async function getChainNodesFromDB(graphStore) {
  const nodes = await graphStore.getNodes({ nodeTypes: CHAIN_NODE_TYPES });
  return nodes
    .filter((node) => node.name || node.label)
    .map((node) => ({
      name: node.name || node.label,
      type: node.nodeType || node.type,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'));
}

async function searchTechInFusionGraph(graphStore, chainLinks) {
  const normalizedLinks = uniqueStrings(Array.isArray(chainLinks) ? chainLinks : []);
  if (normalizedLinks.length === 0) {
    return [];
  }

  const chainNodes = await graphStore.getNodes({ nodeTypes: CHAIN_NODE_TYPES });
  const relatedNames = new Set(normalizedLinks);
  normalizedLinks.forEach((linkName) => {
    chainNodes.forEach((node) => {
      const name = node.name || node.label || '';
      if (name.includes(linkName) || linkName.includes(name)) {
        relatedNames.add(name);
      }
    });
  });

  const keywords = extractKeywords([...relatedNames]);
  const techNodes = await graphStore.getNodes({ nodeTypes: TECH_NODE_TYPES });
  const ranked = techNodes
    .map((node) => {
      const score = keywords.reduce((sum, keyword) => sum + scoreTextMatch(keyword, node), 0);
      const matchedLink = normalizedLinks.find((link) => getNodeSearchText(node).includes(link)) || normalizedLinks[0];
      return {
        ...node,
        name: node.name || node.label,
        label: node.label || node.name,
        nodeType: node.nodeType || node.type,
        matchedLink,
        score,
      };
    })
    .filter((node) => node.score > 0)
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), 'zh-CN'));

  if (ranked.length > 0) {
    return ranked.slice(0, 20);
  }

  return techNodes.slice(0, 30).map((node) => ({
    ...node,
    name: node.name || node.label,
    label: node.label || node.name,
    nodeType: node.nodeType || node.type,
    matchedLink: normalizedLinks[0],
    score: 0,
  }));
}

module.exports = {
  analyzeChainLevelWithAI,
  getChainNodesFromDB,
  searchTechInFusionGraph,
  CHAIN_NODE_TYPES,
  TECH_NODE_TYPES,
};
