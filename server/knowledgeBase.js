const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const KB_DIR = path.join(__dirname, '..', 'knowledge_base');
const PATTERNS_FILE = path.join(KB_DIR, 'patterns.json');
const FEEDBACK_FILE = path.join(KB_DIR, 'feedback.json');
const LEARNINGS_FILE = path.join(KB_DIR, 'learnings.json');
const TECHNOLOGY_PPTS_FILE = path.join(KB_DIR, 'technology_ppts.json');
const TECHNOLOGY_PPT_DIR = path.join(__dirname, '..', 'public', 'technology_ppt');

let technologyPPTIndexCache = null;
let technologyPPTSyncPromise = null;

if (!fs.existsSync(KB_DIR)) {
  fs.mkdirSync(KB_DIR, { recursive: true });
}

function readJSON(filePath, defaultVal) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error(`Failed to read knowledge base file ${filePath}:`, error.message);
  }
  return defaultVal;
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    if (filePath === TECHNOLOGY_PPTS_FILE) {
      return;
    }
    console.warn(`Knowledge base cache is not writable, continuing with in-memory index: ${error.message}`);
  }
}

function loadPatterns() {
  return readJSON(PATTERNS_FILE, []);
}

function savePatterns(patterns) {
  writeJSON(PATTERNS_FILE, patterns);
}

function loadFeedback() {
  return readJSON(FEEDBACK_FILE, []);
}

function saveFeedback(feedback) {
  writeJSON(FEEDBACK_FILE, feedback);
}

function loadLearnings() {
  return readJSON(LEARNINGS_FILE, []);
}

function saveLearnings(learnings) {
  writeJSON(LEARNINGS_FILE, learnings);
}

function defaultTechnologyPPTIndex() {
  return {
    fingerprint: '',
    updatedAt: null,
    items: [],
  };
}

function listTechnologyPPTFiles() {
  if (!fs.existsSync(TECHNOLOGY_PPT_DIR)) {
    return [];
  }

  return fs.readdirSync(TECHNOLOGY_PPT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.pptx$/i.test(entry.name))
    .map((entry) => {
      const fullPath = path.join(TECHNOLOGY_PPT_DIR, entry.name);
      const stats = fs.statSync(fullPath);
      return {
        fileName: entry.name,
        fullPath,
        title: path.basename(entry.name, path.extname(entry.name)),
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      };
    })
    .sort((a, b) => a.fileName.localeCompare(b.fileName, 'zh-CN'));
}

function buildTechnologyPPTFingerprint(files) {
  return files
    .map((file) => `${file.fileName}:${file.size}:${Math.floor(file.mtimeMs)}`)
    .join('|');
}

function decodeXmlEntities(text) {
  return String(text || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'');
}

function compactText(text, maxLength = 260) {
  const compact = String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength)}...`;
}

function buildPPTAnswerContent(content, maxLength = 1600) {
  return compactText(content, maxLength);
}

function normalizeSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '');
}

function getQueryCandidates(query) {
  const raw = String(query || '').trim();
  const normalized = normalizeSearchText(raw);
  const cleaned = raw
    .replace(/请|帮我|介绍|详细|具体|讲讲|说明|解释|分析|一下|这个|该技术|该项|有关|关于|技术|成果|内容|原理|特点|应用|PPT|ppt|汇报/g, ' ')
    .trim();

  const candidates = new Set();

  [raw, normalized, cleaned].forEach((value) => {
    if (!value) {
      return;
    }
    candidates.add(value);
    const segments = value
      .split(/[\s,，。；;、:：()（）"“”'‘’]+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length >= 2);
    segments.forEach((segment) => candidates.add(segment));
  });

  return [...candidates]
    .map((item) => normalizeSearchText(item))
    .filter((item) => item.length >= 2);
}

function buildExcerpt(content, query) {
  const compact = String(content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!compact) {
    return '';
  }

  const candidates = getQueryCandidates(query)
    .map((item) => String(item))
    .sort((a, b) => b.length - a.length);

  let bestIndex = -1;
  let bestTerm = '';

  for (const term of candidates) {
    if (!term) {
      continue;
    }
    const index = compact.indexOf(term);
    if (index !== -1) {
      bestIndex = index;
      bestTerm = term;
      break;
    }
  }

  if (bestIndex === -1) {
    return compactText(compact, 180);
  }

  const start = Math.max(0, bestIndex - 40);
  const end = Math.min(compact.length, bestIndex + bestTerm.length + 120);
  const excerpt = compact.slice(start, end);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < compact.length ? '...' : '';
  return `${prefix}${excerpt}${suffix}`;
}

async function extractTechnologyPPTContent(filePath) {
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((entryPath) => /^ppt\/slides\/slide\d+\.xml$/i.test(entryPath))
    .sort((a, b) => {
      const aNum = Number((a.match(/slide(\d+)\.xml/i) || [])[1] || 0);
      const bNum = Number((b.match(/slide(\d+)\.xml/i) || [])[1] || 0);
      return aNum - bNum;
    });

  const slideTexts = [];

  for (const [index, slidePath] of slidePaths.entries()) {
    const slideEntry = zip.file(slidePath);
    if (!slideEntry) {
      continue;
    }

    const xml = await slideEntry.async('string');
    const texts = [];
    const pattern = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
    let match = pattern.exec(xml);

    while (match) {
      const text = decodeXmlEntities(match[1])
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) {
        texts.push(text);
      }
      match = pattern.exec(xml);
    }

    if (texts.length > 0) {
      slideTexts.push(`第${index + 1}页：${texts.join(' ')}`);
    }
  }

  const content = slideTexts.join('\n').trim();
  return {
    slideCount: slidePaths.length,
    content,
    summary: compactText(content, 260),
  };
}

function loadTechnologyPPTIndexSync() {
  if (technologyPPTIndexCache) {
    return technologyPPTIndexCache;
  }
  technologyPPTIndexCache = readJSON(TECHNOLOGY_PPTS_FILE, defaultTechnologyPPTIndex());
  return technologyPPTIndexCache;
}

async function syncTechnologyPPTKnowledge(forceRebuild = false) {
  const files = listTechnologyPPTFiles();
  const fingerprint = buildTechnologyPPTFingerprint(files);

  if (!forceRebuild && technologyPPTIndexCache && technologyPPTIndexCache.fingerprint === fingerprint) {
    return technologyPPTIndexCache;
  }

  const savedIndex = readJSON(TECHNOLOGY_PPTS_FILE, defaultTechnologyPPTIndex());
  if (!forceRebuild && savedIndex.fingerprint === fingerprint) {
    technologyPPTIndexCache = savedIndex;
    return savedIndex;
  }

  if (technologyPPTSyncPromise) {
    return technologyPPTSyncPromise;
  }

  technologyPPTSyncPromise = (async () => {
    const previousItems = new Map(
      (savedIndex.items || []).map((item) => [item.file_name, item])
    );
    const items = [];

    for (const file of files) {
      const previous = previousItems.get(file.fileName);
      if (
        !forceRebuild &&
        previous &&
        previous.size === file.size &&
        Math.floor(previous.mtimeMs || 0) === Math.floor(file.mtimeMs) &&
        previous.content
      ) {
        items.push(previous);
        continue;
      }

      try {
        const extracted = await extractTechnologyPPTContent(file.fullPath);
        items.push({
          id: `tech_ppt_${normalizeSearchText(file.title) || Date.now()}`,
          title: file.title,
          file_name: file.fileName,
          ppt_url: `/technology_ppt/${file.fileName}`,
          file_path: file.fullPath,
          size: file.size,
          mtimeMs: file.mtimeMs,
          slide_count: extracted.slideCount,
          summary: extracted.summary,
          content: extracted.content,
          source: 'technology_ppt',
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`Failed to parse technology PPT ${file.fileName}:`, error.message);
        if (previous) {
          items.push(previous);
        }
      }
    }

    items.sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh-CN'));

    const nextIndex = {
      fingerprint,
      updatedAt: new Date().toISOString(),
      items,
    };

    writeJSON(TECHNOLOGY_PPTS_FILE, nextIndex);
    technologyPPTIndexCache = nextIndex;
    return nextIndex;
  })();

  try {
    return await technologyPPTSyncPromise;
  } finally {
    technologyPPTSyncPromise = null;
  }
}

function scoreTechnologyPPT(item, query) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedTitle = normalizeSearchText(item.title);
  const normalizedContent = normalizeSearchText(item.content);

  if (!normalizedQuery || !normalizedTitle) {
    return 0;
  }

  let score = 0;
  if (normalizedQuery.includes(normalizedTitle)) {
    score += 200;
  }
  if (normalizedTitle.includes(normalizedQuery)) {
    score += 140;
  }

  const candidates = getQueryCandidates(query);
  for (const term of candidates) {
    if (normalizedTitle.includes(term)) {
      score += Math.min(90, 8 + term.length * 10);
    }
    if (normalizedContent.includes(term)) {
      score += Math.min(45, 4 + term.length * 4);
    }
  }

  return score;
}

function formatTechnologyPPTMatch(item, query, score) {
  return {
    id: item.id,
    title: item.title,
    file_name: item.file_name,
    ppt_url: item.ppt_url,
    slide_count: item.slide_count,
    summary: item.summary,
    excerpt: buildExcerpt(item.content, query),
    content: buildPPTAnswerContent(item.content),
    source: item.source,
    score,
  };
}

function searchTechnologyPPTsFromIndex(index, query, limit = 5) {
  const items = Array.isArray(index?.items) ? index.items : [];
  const ranked = items
    .map((item) => ({
      item,
      score: scoreTechnologyPPT(item, query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || String(a.item.title).localeCompare(String(b.item.title), 'zh-CN'))
    .slice(0, limit)
    .map((entry) => formatTechnologyPPTMatch(entry.item, query, entry.score));

  return ranked;
}

async function searchTechnologyPPTs(query, limit = 5) {
  const index = await syncTechnologyPPTKnowledge();
  return searchTechnologyPPTsFromIndex(index, query, limit);
}

function searchTechnologyPPTsSync(query, limit = 3) {
  return searchTechnologyPPTsFromIndex(loadTechnologyPPTIndexSync(), query, limit);
}

function getTechnologyPPTStats() {
  const index = loadTechnologyPPTIndexSync();
  return {
    count: Array.isArray(index.items) ? index.items.length : 0,
    updatedAt: index.updatedAt || null,
  };
}

function recordPattern({ userInput, chainLinks, achievements, toolSequence }) {
  const patterns = loadPatterns();
  const entry = {
    id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userInput,
    chainLinks,
    achievementCount: achievements ? achievements.length : 0,
    toolSequence,
    timestamp: new Date().toISOString(),
    hitCount: 0,
  };
  patterns.push(entry);
  if (patterns.length > 500) {
    patterns.splice(0, patterns.length - 500);
  }
  savePatterns(patterns);
  return entry.id;
}

function recordFeedback({ patternId, rating, comment, correctedChainLinks }) {
  const feedback = loadFeedback();
  const entry = {
    id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    patternId,
    rating,
    comment,
    correctedChainLinks,
    timestamp: new Date().toISOString(),
  };
  feedback.push(entry);
  if (feedback.length > 300) {
    feedback.splice(0, feedback.length - 300);
  }
  saveFeedback(feedback);

  if (correctedChainLinks && correctedChainLinks.length > 0 && patternId) {
    const patterns = loadPatterns();
    const pattern = patterns.find((item) => item.id === patternId);
    if (pattern) {
      pattern.chainLinks = correctedChainLinks;
      pattern.corrected = true;
      savePatterns(patterns);
    }
  }

  return entry.id;
}

function recordLearning({ category, key, value, source }) {
  const learnings = loadLearnings();
  const existing = learnings.find((item) => item.category === category && item.key === key);
  if (existing) {
    existing.value = value;
    existing.updatedAt = new Date().toISOString();
    existing.hitCount = (existing.hitCount || 0) + 1;
  } else {
    learnings.push({
      id: `l_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category,
      key,
      value,
      source,
      hitCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  if (learnings.length > 1000) {
    learnings.sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0));
    learnings.splice(800);
  }
  saveLearnings(learnings);
}

function searchPatterns(userInput) {
  const patterns = loadPatterns();
  const inputLower = String(userInput || '').toLowerCase();
  const keywords = inputLower.split(/[\s,锛屻€傘€侊紱;]+/).filter((word) => word.length > 1);

  const scored = patterns.map((pattern) => {
    let score = 0;
    const patternLower = String(pattern.userInput || '').toLowerCase();
    keywords.forEach((keyword) => {
      if (patternLower.includes(keyword)) {
        score += 3;
      }
    });
    if (pattern.hitCount > 0) {
      score += Math.min(pattern.hitCount, 5);
    }
    if (pattern.corrected) {
      score += 2;
    }
    const timeDiff = Date.now() - new Date(pattern.timestamp).getTime();
    const dayAge = timeDiff / (1000 * 60 * 60 * 24);
    score += Math.max(0, 3 - dayAge * 0.1);
    return { ...pattern, relevanceScore: score };
  });

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return scored.filter((pattern) => pattern.relevanceScore > 0).slice(0, 5);
}

function getRelevantLearnings(category, query) {
  const learnings = loadLearnings();
  const queryLower = String(query || '').toLowerCase();
  return learnings
    .filter((learning) => {
      if (category && learning.category !== category) {
        return false;
      }
      if (
        queryLower &&
        !String(learning.key || '').toLowerCase().includes(queryLower) &&
        !String(learning.value || '').toLowerCase().includes(queryLower)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0))
    .slice(0, 10);
}

function getKnowledgeContext(userInput) {
  const similarPatterns = searchPatterns(userInput);
  const chainLearnings = getRelevantLearnings('chain_mapping', userInput);
  const techLearnings = getRelevantLearnings('tech_search', userInput);
  const technologyPPTs = searchTechnologyPPTsSync(userInput, 3);

  let context = '';

  if (similarPatterns.length > 0) {
    context += '\n\n【历史相似案例】\n';
    similarPatterns.forEach((pattern, index) => {
      context += `案例${index + 1}：用户输入 "${String(pattern.userInput || '').substring(0, 50)}" -> 环节：${(pattern.chainLinks || []).join('、')}${pattern.corrected ? '（已纠偏）' : ''} -> 命中成果 ${pattern.achievementCount} 项\n`;
    });
  }

  if (chainLearnings.length > 0) {
    context += '\n【产业环节映射经验】\n';
    chainLearnings.forEach((learning) => {
      context += `- ${learning.key} -> ${learning.value}\n`;
    });
  }

  if (techLearnings.length > 0) {
    context += '\n【技术检索经验】\n';
    techLearnings.forEach((learning) => {
      context += `- ${learning.key}: ${learning.value}\n`;
    });
  }

  if (technologyPPTs.length > 0) {
    context += '\n【技术PPT知识：回答技术成果介绍时优先依据以下内容】\n';
    technologyPPTs.forEach((item) => {
      context += `- ${item.title}（${item.file_name}）：${item.content || item.summary || item.excerpt}\n`;
    });
  }

  return context;
}

function incrementPatternHit(patternId) {
  if (!patternId) {
    return;
  }
  const patterns = loadPatterns();
  const pattern = patterns.find((item) => item.id === patternId);
  if (pattern) {
    pattern.hitCount = (pattern.hitCount || 0) + 1;
    savePatterns(patterns);
  }
}

syncTechnologyPPTKnowledge().catch((error) => {
  console.error('Failed to warm technology PPT knowledge:', error.message);
});

module.exports = {
  recordPattern,
  recordFeedback,
  recordLearning,
  searchPatterns,
  getRelevantLearnings,
  getKnowledgeContext,
  incrementPatternHit,
  loadPatterns,
  loadFeedback,
  loadLearnings,
  syncTechnologyPPTKnowledge,
  searchTechnologyPPTs,
  getTechnologyPPTStats,
};

