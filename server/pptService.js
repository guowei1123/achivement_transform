const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const PptxGenJS = require('pptxgenjs');

const PPTService = {
  getTechnologyPptDir() {
    return path.join(__dirname, '..', 'public', 'technology_ppt');
  },

  sanitizePPTFileName(name) {
    return String(name || '未命名成果').trim().replace(/[<>:"/\\|?*]/g, '_');
  },

  getTechnologyPptFileName(name) {
    return `${this.sanitizePPTFileName(name)}.pptx`;
  },

  getAchievementLabel(achievement) {
    const values = [
      achievement?.label,
      achievement?.name,
      achievement?.technical_name,
      achievement?.title,
      achievement?.project_name,
      achievement?.achievement_name,
      achievement?.['成果名称'],
      achievement?.['技术名称'],
      achievement?.['名称']
    ];

    const label = values
      .map((item) => String(item || '').trim())
      .find((item) => item && item !== '未命名成果' && item !== 'undefined' && item !== 'null');

    return label || '';
  },

  isPlaceholderPPTFileName(fileName) {
    const normalized = this.normalizePPTSearchText(path.basename(fileName || '', path.extname(fileName || '')));
    return !normalized ||
      normalized.includes('未命名成果') ||
      normalized.includes('模板') ||
      normalized.includes('template');
  },

  normalizePPTSearchText(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[\s\u3000]+/g, '')
      .replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '');
  },

  getPPTSearchCandidates(achievement) {
    const values = [
      typeof achievement === 'string' ? achievement : '',
      achievement?.label,
      achievement?.name,
      achievement?.technical_name,
      achievement?.category,
      achievement?.field,
      achievement?.technical_field,
      achievement?.keywords,
    ];

    const candidates = new Set();
    values
      .flatMap((item) => Array.isArray(item) ? item : [item])
      .filter(Boolean)
      .forEach((item) => {
        const raw = String(item).trim();
        const normalized = this.normalizePPTSearchText(raw);
        if (normalized.length >= 2) {
          candidates.add(normalized);
        }

        raw
          .split(/[\s,锛屻€傦紱;銆?锛?)锛堬級"鈥溾€?鈥樷€檁-]+/)
          .map((segment) => this.normalizePPTSearchText(segment))
          .filter((segment) => segment.length >= 2)
          .forEach((segment) => candidates.add(segment));
      });

    return [...candidates].sort((a, b) => b.length - a.length);
  },

  scoreExistingTechnologyPPT(title, achievement) {
    const normalizedTitle = this.normalizePPTSearchText(title);
    const candidates = this.getPPTSearchCandidates(achievement);
    if (!normalizedTitle || candidates.length === 0) {
      return 0;
    }

    let score = 0;
    for (const candidate of candidates) {
      if (normalizedTitle === candidate) {
        score += 240;
      } else if (normalizedTitle.includes(candidate)) {
        score += Math.min(160, 30 + candidate.length * 10);
      } else if (candidate.includes(normalizedTitle)) {
        score += Math.min(130, 20 + normalizedTitle.length * 8);
      }
    }

    return score;
  },

  findExistingTechnologyPPT(name, achievement = null) {
    const technologyPptDir = this.getTechnologyPptDir();
    const searchName = String(name || '').trim();
    if (!searchName || searchName === '未命名成果') {
      return null;
    }

    const fileName = this.getTechnologyPptFileName(name);
    const filePath = path.join(technologyPptDir, fileName);

    if (!fs.existsSync(filePath) || this.isPlaceholderPPTFileName(fileName)) {
      if (!fs.existsSync(technologyPptDir)) {
        return null;
      }

      const scoredFiles = fs.readdirSync(technologyPptDir)
        .filter((item) => /\.pptx$/i.test(item))
        .filter((item) => !this.isPlaceholderPPTFileName(item))
        .map((item) => {
          const title = path.basename(item, path.extname(item));
          return {
            fileName: item,
            score: this.scoreExistingTechnologyPPT(title, achievement || name),
          };
        })
        .filter((item) => item.score >= 120)
        .sort((a, b) => b.score - a.score || a.fileName.localeCompare(b.fileName, 'zh-CN'));

      if (scoredFiles.length === 0) {
        return null;
      }

      return {
        ppt_url: `/technology_ppt/${scoredFiles[0].fileName}`,
        file_name: scoredFiles[0].fileName,
        reused_existing: true,
        match_score: scoredFiles[0].score,
      };
    }

    return {
      ppt_url: `/technology_ppt/${fileName}`,
      file_name: fileName,
      reused_existing: true,
      match_score: 999,
    };
  },

  async getOrCreateTechnologyPPT(data, achievement = null) {
    const existingPPT = this.findExistingTechnologyPPT(data.technical_name, achievement || data);
    if (existingPPT) {
      return {
        success: true,
        data: existingPPT
      };
    }

    return this.generatePPTFromTemplate('妯℃澘', data);
  },

  async isUsableTechnologyPPT(pptUrl) {
    const fileName = path.basename(pptUrl || '');
    if (this.isPlaceholderPPTFileName(fileName)) {
      return false;
    }

    const relative = String(pptUrl || '').replace(/^\/+/, '');
    const filePath = path.join(__dirname, '..', 'public', relative);
    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      const ppt = await JSZip.loadAsync(fs.readFileSync(filePath));
      const slideFiles = Object.keys(ppt.files).filter((key) =>
        key.startsWith('ppt/slides/slide') && key.endsWith('.xml')
      );

      for (const slideFile of slideFiles) {
        const xml = await ppt.file(slideFile).async('string');
        if (/\{technical_[^}]+_content\}/i.test(xml) || xml.includes('未命名成果')) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  },

  getAchievementTypeOrder() {
    return [
      '新材料与绿色建材',
      '船舶与海洋工程',
      '新能源与智能交通',
      '信息技术与人工智能',
      '智能制造与高端装备',
      '光纤传感与光电技术',
      '资源环境与安全应急',
      '土木建筑与城乡发展'
    ];
  },

  getAchievementTypeKeywords() {
    return [
      {
        type: '新材料与绿色建材',
        keywords: ['新材料', '绿色建材', '建材', '材料', '混凝土', '骨料', '涂层', '纳米', '复合材料', '胶凝', '水泥', '沥青']
      },
      {
        type: '船舶与海洋工程',
        keywords: ['船舶', '海洋', '船型', '船组', '船闸', '航道', '港口', '疏浚', '助航', '过闸', '通航', '水运', '枢纽', '码头']
      },
      {
        type: '新能源与智能交通',
        keywords: ['新能源', '智能交通', '交通', '车联网', '车路协同', '自动驾驶', '充电', '换电', '动力电池', '轨道交通', '车辆']
      },
      {
        type: '信息技术与人工智能',
        keywords: ['人工智能', '智能体', '大模型', '算法', '模型', '数据', '数字孪生', '大数据', '云平台', '软件', '仿真', '决策支持', '分布式计算']
      },
      {
        type: '智能制造与高端装备',
        keywords: ['智能制造', '高端装备', '机器人', '装备', '装置', '设备', '机组', '控制系统', '监控系统', '成套']
      },
      {
        type: '光纤传感与光电技术',
        keywords: ['光纤', '光栅', '传感', '光电', '激光', '测温', '解调', '雷达', '探地雷达', '电缆测温']
      },
      {
        type: '资源环境与安全应急',
        keywords: ['资源化', '环境', '生态', '鱼类', '过鱼', '漂浮物', '安全', '应急', '监测', '预警', '消防', '风险评估', '诊断', '渗流']
      },
      {
        type: '土木建筑与城乡发展',
        keywords: ['土木', '建筑', '城乡', '大坝', '边坡', '隧道', '爆破', '施工', '探测', '枢纽建筑', '工程']
      }
    ];
  },

  classifyAchievementType(achievement) {
    const order = this.getAchievementTypeOrder();
    const textParts = typeof achievement === 'string'
      ? [achievement]
      : [
          achievement?.label,
          achievement?.name,
          achievement?.category,
          achievement?.field,
          achievement?.technical_field,
          achievement?.keywords,
          achievement?.ppt_content,
          achievement?.description,
          achievement?.summary,
          achievement?.abstract,
          achievement?.application,
          achievement?.innovation
        ];

    const normalizedParts = textParts
      .flatMap((item) => Array.isArray(item) ? item : [item])
      .filter(Boolean)
      .map((item) => String(item).trim());

    for (const type of order) {
      if (normalizedParts.some((item) => item.includes(type))) {
        return type;
      }
    }

    const searchText = normalizedParts.join(' ').toLowerCase();
    for (const rule of this.getAchievementTypeKeywords()) {
      if (rule.keywords.some((keyword) => searchText.includes(String(keyword).toLowerCase()))) {
        return rule.type;
      }
    }

    return '淇℃伅鎶€鏈笌浜哄伐鏅鸿兘';
  },

  sortPPTFilesByAchievementType(pptFiles) {
    const orderMap = new Map(
      this.getAchievementTypeOrder().map((type, index) => [type, index])
    );

    return [...pptFiles].sort((a, b) => {
      const typeA = a.achievementType || this.classifyAchievementType(a.achievementLabel);
      const typeB = b.achievementType || this.classifyAchievementType(b.achievementLabel);
      const orderA = orderMap.has(typeA) ? orderMap.get(typeA) : Number.MAX_SAFE_INTEGER;
      const orderB = orderMap.has(typeB) ? orderMap.get(typeB) : Number.MAX_SAFE_INTEGER;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return String(a.achievementLabel || '').localeCompare(String(b.achievementLabel || ''), 'zh-CN');
    });
  },

  getActiveAchievementTypes(typeCounts = {}) {
    return this.getAchievementTypeOrder().filter((type) => (typeCounts[type] || 0) > 0);
  },

  async generateDynamicTOCPPT(chapterTypes = []) {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'TechAgent';
    pptx.subject = '汇报目录';
    pptx.title = '汇报内容';

    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };

    slide.addText('汇报内容', {
      x: -0.03,
      y: 0.36,
      w: 13.35,
      h: 0.78,
      align: 'center',
      margin: 0,
      fontFace: 'Microsoft YaHei',
      fontSize: 24,
      bold: true,
      color: 'FF0000',
    });

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.83,
      y: 1.78,
      w: 11.70,
      h: 3.03,
      rectRadius: 0.08,
      line: { color: '00469A', pt: 1.6, dashType: 'sysDash' },
      fill: { color: 'FFFFFF' },
    });

    const safeChapterTypes = chapterTypes.length > 0 ? chapterTypes : ['信息技术与人工智能'];
    const itemCount = safeChapterTypes.length;
    const contentTop = 2.18;
    const contentBottom = 4.52;
    const gap = itemCount >= 7 ? 0.045 : itemCount >= 5 ? 0.065 : 0.10;
    const availableHeight = contentBottom - contentTop;
    const rowHeight = Math.max(0.28, Math.min(0.62, (availableHeight - gap * Math.max(0, itemCount - 1)) / itemCount));
    const fontSize = itemCount >= 7 ? 14 : itemCount >= 5 ? 16 : 18;
    const numberFontSize = itemCount >= 7 ? 15 : itemCount >= 5 ? 17 : 18;
    const numberBoxWidth = 1.32;
    const rowStartX = 2.10;
    const titleX = 3.50;
    const titleWidth = 8.84;

    safeChapterTypes.forEach((chapterType, index) => {
      const y = contentTop + index * (rowHeight + gap);

      slide.addShape(pptx.ShapeType.rect, {
        x: rowStartX,
        y,
        w: numberBoxWidth,
        h: rowHeight,
        line: { color: 'FFD966', pt: 0.5 },
        fill: { color: 'FFD966' },
      });

      slide.addShape(pptx.ShapeType.rect, {
        x: titleX,
        y,
        w: titleWidth,
        h: rowHeight,
        line: { color: '00469A', pt: 0.6 },
        fill: { color: '00469A' },
      });

      slide.addText(String(index + 1), {
        x: rowStartX,
        y: y + 0.01,
        w: numberBoxWidth,
        h: rowHeight - 0.02,
        align: 'center',
        valign: 'mid',
        margin: 0,
        fontFace: 'Microsoft YaHei',
        fontSize: numberFontSize,
        bold: true,
        color: '00469A',
      });

      slide.addText(chapterType, {
        x: titleX + 0.18,
        y: y + 0.01,
        w: titleWidth - 0.36,
        h: rowHeight - 0.02,
        align: 'left',
        valign: 'mid',
        margin: 0,
        fontFace: 'Microsoft YaHei',
        fontSize,
        bold: true,
        color: 'FFFFFF',
        fit: 'shrink',
      });
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 7.17,
      w: 13.33,
      h: 0.36,
      line: { color: '0B5AA2', pt: 0 },
      fill: { color: '0B5AA2' },
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0.0,
      y: 7.17,
      w: 1.92,
      h: 0.36,
      line: { color: 'FBC540', pt: 0 },
      fill: { color: 'FBC540' },
    });

    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    return JSZip.loadAsync(buffer);
  },

  async getNodePPTContent(graphStore, nodeLabel) {
    try {
      const node = (await graphStore.getNodes({ label: nodeLabel }))[0] ||
        (await graphStore.getNodes({ name: nodeLabel }))[0];

      if (!node) {
        return {
          success: false,
          error: '未找到该节点'
        };
      }

      return {
        success: true,
        data: {
          ppt_content: node.ppt_content || '暂无PPT描述',
          type: node.type,
          category: node.category
        }
      };
    } catch (error) {
      console.error('鑾峰彇PPT鍐呭澶辫触:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  async generatePPTFromTemplate(templateName, data) {
    try {
      const templatePath = path.join(__dirname, '..', 'public', 'ppt_template', `${templateName}.pptx`);
      
      if (!fs.existsSync(templatePath)) {
        return {
          success: false,
          error: `妯℃澘鏂囦欢涓嶅瓨鍦? ${templateName}`
        };
      }
      
      const templateContent = fs.readFileSync(templatePath);
      const zip = await JSZip.loadAsync(templateContent);

      function escapeXmlText(s) {
        return String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      function replaceAcrossTextRuns(xml, replacements) {
        const paragraphRe = /<a:p[^>]*>[\s\S]*?<\/a:p>/g;
        let result = xml;
        
        result = result.replace(paragraphRe, (paragraph) => {
          const runRe = /<a:t(\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
          const runs = [];
          let m;
          while ((m = runRe.exec(paragraph)) !== null) {
            runs.push({
              fullMatch: m[0],
              attrs: m[1] || '',
              text: m[2] || '',
            });
          }
          if (runs.length === 0) return paragraph;

          let texts = runs.map(r => r.text);

          const concat = () => texts.join('');

          function indexToRunPos(idx) {
            let acc = 0;
            for (let i = 0; i < texts.length; i++) {
              const len = texts[i].length;
              if (idx <= acc + len) return { runIndex: i, offset: idx - acc };
              acc += len;
            }
            return { runIndex: texts.length - 1, offset: texts[texts.length - 1].length };
          }

          function applyOneReplace(startIdx, endIdx, replacementText) {
            const start = indexToRunPos(startIdx);
            const end = indexToRunPos(endIdx);
            const escaped = escapeXmlText(replacementText);

            if (start.runIndex === end.runIndex) {
              const t = texts[start.runIndex];
              texts[start.runIndex] = t.slice(0, start.offset) + escaped + t.slice(end.offset);
              return;
            }

            const firstText = texts[start.runIndex];
            texts[start.runIndex] = firstText.slice(0, start.offset) + escaped;

            for (let i = start.runIndex + 1; i < end.runIndex; i++) {
              texts[i] = '';
            }

            const lastText = texts[end.runIndex];
            texts[end.runIndex] = lastText.slice(end.offset);
          }

          for (const [key, rawValue] of Object.entries(replacements)) {
            const placeholder = `{${key}}`;
            const value = rawValue ?? '';

            for (;;) {
              const s = concat();
              const idx = s.indexOf(placeholder);
              if (idx === -1) break;
              applyOneReplace(idx, idx + placeholder.length, value);
            }
          }

          let runIdx = 0;
          return paragraph.replace(runRe, (_full, attrs = '', _text) => {
            const nextText = texts[runIdx] ?? '';
            const out = `<a:t${attrs || ''}>${nextText}</a:t>`;
            runIdx += 1;
            return out;
          });
        });
        
        return result;
      }

      function escapeRegExp(text) {
        return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir && relativePath.endsWith('.xml')) {
          let content = await zipEntry.async('string');
          content = replaceAcrossTextRuns(content, data);
          zip.file(relativePath, content);
        }
      }
      
      const generatedContent = await zip.generateAsync({ type: 'nodebuffer' });
      
      const fileName = this.getTechnologyPptFileName(data.technical_name);
      const technologyPptDir = this.getTechnologyPptDir();
      const filePath = path.join(technologyPptDir, fileName);

      if (!fs.existsSync(technologyPptDir)) {
        fs.mkdirSync(technologyPptDir, { recursive: true });
      }
      
      fs.writeFileSync(filePath, generatedContent);
      
      return {
        success: true,
        data: {
          ppt_url: `/technology_ppt/${fileName}`,
          file_name: fileName
        }
      };
      
    } catch (error) {
      console.error('鐢熸垚PPT澶辫触:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  async mergePPTs(pptFiles, enterpriseName, typeCounts) {
    try {
      const outputDir = path.join(__dirname, '..', 'public', 'chain_ppts');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      const outputFileName = `${enterpriseName}_产业链汇报PPT_${timestamp}.pptx`;
      const outputFilePath = path.join(outputDir, outputFileName);
      
      const zip = new JSZip();
      
      const coverPPTPath = path.join(__dirname, '..', 'public', 'ppt_template', '封面_修复.pptx');
      const coverPPT = await JSZip.loadAsync(fs.readFileSync(coverPPTPath));
      
      const activeAchievementTypes = this.getActiveAchievementTypes(typeCounts);
      const tocPPT = await this.generateDynamicTOCPPT(activeAchievementTypes);
      
      const chapterPPTPath = path.join(__dirname, '..', 'public', 'ppt_template', '章节页.pptx');
      const chapterPPT = await JSZip.loadAsync(fs.readFileSync(chapterPPTPath));
      
      const coverSlideContent = await coverPPT.file('ppt/slides/slide1.xml').async('string');
      const currentDate = new Date();
      const dateStr = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月${currentDate.getDate()}日`;
      
      function escapeXmlText(s) {
        return String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      function replaceAcrossTextRuns(xml, replacements) {
        const paragraphRe = /<a:p[^>]*>[\s\S]*?<\/a:p>/g;
        let result = xml;
        
        result = result.replace(paragraphRe, (paragraph) => {
          const runRe = /<a:t(\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
          const runs = [];
          let m;
          while ((m = runRe.exec(paragraph)) !== null) {
            runs.push({
              fullMatch: m[0],
              attrs: m[1] || '',
              text: m[2] || '',
            });
          }
          if (runs.length === 0) return paragraph;

          let texts = runs.map(r => r.text);

          const concat = () => texts.join('');

          function indexToRunPos(idx) {
            let acc = 0;
            for (let i = 0; i < texts.length; i++) {
              const len = texts[i].length;
              if (idx <= acc + len) return { runIndex: i, offset: idx - acc };
              acc += len;
            }
            return { runIndex: texts.length - 1, offset: texts[texts.length - 1].length };
          }

          function applyOneReplace(startIdx, endIdx, replacementText) {
            const start = indexToRunPos(startIdx);
            const end = indexToRunPos(endIdx);
            const escaped = escapeXmlText(replacementText);

            if (start.runIndex === end.runIndex) {
              const t = texts[start.runIndex];
              texts[start.runIndex] = t.slice(0, start.offset) + escaped + t.slice(end.offset);
              return;
            }

            const firstText = texts[start.runIndex];
            texts[start.runIndex] = firstText.slice(0, start.offset) + escaped;

            for (let i = start.runIndex + 1; i < end.runIndex; i++) {
              texts[i] = '';
            }

            const lastText = texts[end.runIndex];
            texts[end.runIndex] = lastText.slice(end.offset);
          }

          for (const [key, rawValue] of Object.entries(replacements)) {
            const placeholder = `{${key}}`;
            const value = rawValue ?? '';

            for (;;) {
              const s = concat();
              const idx = s.indexOf(placeholder);
              if (idx === -1) break;
              applyOneReplace(idx, idx + placeholder.length, value);
            }
          }

          let runIdx = 0;
          return paragraph.replace(runRe, (_full, attrs = '', _text) => {
            const nextText = texts[runIdx] ?? '';
            const out = `<a:t${attrs || ''}>${nextText}</a:t>`;
            runIdx += 1;
            return out;
          });
        });
        
        return result;
      }

      function escapeRegExp(text) {
        return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      
      const replacedCoverSlide = replaceAcrossTextRuns(coverSlideContent, {
        enterprise: enterpriseName,
        date: dateStr
      });
      
      const tocSlideContent = await tocPPT.file('ppt/slides/slide1.xml').async('string');
      
      let mediaFileCounter = 1000;
      const mediaFileMapping = new Map();
      
      for (const [relativePath, file] of Object.entries(coverPPT.files)) {
        if (!file.dir) {
          zip.file(relativePath, file.async('arraybuffer'));
        }
      }
      
      zip.file('ppt/slides/slide1.xml', replacedCoverSlide);
      
      const coverRelsContent = await coverPPT.file('ppt/slides/_rels/slide1.xml.rels').async('string');
      zip.file('ppt/slides/_rels/slide1.xml.rels', coverRelsContent);
      
      zip.file('ppt/slides/slide2.xml', tocSlideContent);
      
      const tocRelsContent = await tocPPT.file('ppt/slides/_rels/slide1.xml.rels').async('string');
      
      for (const [relativePath, file] of Object.entries(tocPPT.files)) {
        if (relativePath.startsWith('ppt/media/') && !file.dir) {
          const ext = relativePath.split('.').pop();
          const baseName = relativePath.split('/').pop().split('.')[0];
          const newMediaName = `image${mediaFileCounter}.${ext}`;
          mediaFileMapping.set(`toc_${baseName}`, newMediaName);
          zip.file(`ppt/media/${newMediaName}`, file.async('arraybuffer'));
          mediaFileCounter++;
        }
      }
      
      let updatedTocRelsContent = tocRelsContent.replace('slide1.xml', 'slide2.xml');
      for (const [key, value] of mediaFileMapping.entries()) {
        if (key.startsWith('toc_')) {
          const originalBaseName = key.replace('toc_', '');
          updatedTocRelsContent = updatedTocRelsContent.replace(
            new RegExp(`Target="../media/${originalBaseName}\\.(png|jpg|jpeg|gif)"`, 'g'),
            `Target="../media/${value}"`
          );
        }
      }
      zip.file('ppt/slides/_rels/slide2.xml.rels', updatedTocRelsContent);
      
      let slideId = 3;
      let chapterNumber = 1;
      let currentType = null;
      const contentTypeOverrides = new Map();
      const addContentTypeOverride = (partName, contentType) => {
        contentTypeOverrides.set(partName.startsWith('/') ? partName : `/${partName}`, contentType);
      };
      
      const sortedPptFiles = this.sortPPTFilesByAchievementType(pptFiles);

      for (let pptIndex = 0; pptIndex < sortedPptFiles.length; pptIndex++) {
        const pptFile = sortedPptFiles[pptIndex];
        const achievementType = pptFile.achievementType || this.classifyAchievementType(pptFile.achievementLabel);
        
        if (currentType !== achievementType) {
          const chapterSlideContent = await chapterPPT.file('ppt/slides/slide1.xml').async('string');
          const replacedChapterSlide = replaceAcrossTextRuns(chapterSlideContent, {
            number: chapterNumber.toString(),
            technical_type: achievementType
          });
          
          const chapterSlideName = `ppt/slides/slide${slideId}.xml`;
          zip.file(chapterSlideName, replacedChapterSlide);
          
          for (const [relativePath, file] of Object.entries(chapterPPT.files)) {
            if (relativePath.startsWith('ppt/media/') && !file.dir) {
              const ext = relativePath.split('.').pop();
              const baseName = relativePath.split('/').pop().split('.')[0];
              const newMediaName = `image${mediaFileCounter}.${ext}`;
              mediaFileMapping.set(`chapter_${baseName}`, newMediaName);
              zip.file(`ppt/media/${newMediaName}`, file.async('arraybuffer'));
              mediaFileCounter++;
            }
          }
          
          const chapterRelsContent = await chapterPPT.file('ppt/slides/_rels/slide1.xml.rels').async('string');
          let updatedChapterRelsContent = chapterRelsContent.replace('slide1.xml', `slide${slideId}.xml`);
          for (const [key, value] of mediaFileMapping.entries()) {
            if (key.startsWith('chapter_')) {
              const originalBaseName = key.replace('chapter_', '');
              updatedChapterRelsContent = updatedChapterRelsContent.replace(
                new RegExp(`Target="../media/${originalBaseName}\\.(png|jpg|jpeg|gif)"`, 'g'),
                `Target="../media/${value}"`
              );
            }
          }
          zip.file(`ppt/slides/_rels/slide${slideId}.xml.rels`, updatedChapterRelsContent);
          
          slideId++;
          chapterNumber++;
          currentType = achievementType;
        }
        
        const pptPath = path.join(__dirname, '..', 'public', pptFile.pptUrl);
        const ppt = await JSZip.loadAsync(fs.readFileSync(pptPath));
        const pptMediaMapping = new Map();
        const scopedPrefix = `ua${pptIndex + 1}`;

        const copyScopedMedia = async (originalMediaName) => {
          if (pptMediaMapping.has(originalMediaName)) {
            return pptMediaMapping.get(originalMediaName);
          }

          const ext = originalMediaName.split('.').pop();
          const newMediaName = `image${mediaFileCounter}.${ext}`;
          pptMediaMapping.set(originalMediaName, newMediaName);
          mediaFileMapping.set(`ppt_${pptIndex}_${originalMediaName}`, newMediaName);

          const originalMediaFile = `ppt/media/${originalMediaName}`;
          if (ppt.file(originalMediaFile)) {
            const mediaContent = await ppt.file(originalMediaFile).async('arraybuffer');
            zip.file(`ppt/media/${newMediaName}`, mediaContent);
            mediaFileCounter++;
          }

          return newMediaName;
        };

        const rewriteMediaTargets = async (relsContent) => {
          let updated = relsContent;
          const mediaMatches = [...updated.matchAll(/Target="\.\.\/media\/([^"]+)"/g)];

          for (const match of mediaMatches) {
            await copyScopedMedia(match[1]);
          }

          for (const match of mediaMatches) {
            const originalMediaName = match[1];
            if (pptMediaMapping.has(originalMediaName)) {
              updated = updated.replace(
                new RegExp(`Target="../media/${escapeRegExp(originalMediaName)}"`, 'g'),
                `Target="../media/${pptMediaMapping.get(originalMediaName)}"`
              );
            }
          }

          return updated;
        };

        const copyScopedTheme = async (themeName) => {
          const sourceTheme = `ppt/theme/${themeName}`;
          const newThemeName = `${scopedPrefix}_${themeName}`;
          if (ppt.file(sourceTheme) && !zip.file(`ppt/theme/${newThemeName}`)) {
            zip.file(`ppt/theme/${newThemeName}`, await ppt.file(sourceTheme).async('arraybuffer'));
            addContentTypeOverride(
              `ppt/theme/${newThemeName}`,
              'application/vnd.openxmlformats-officedocument.theme+xml'
            );
          }
          return newThemeName;
        };

        const copyScopedMaster = async (masterName) => {
          const sourceMaster = `ppt/slideMasters/${masterName}`;
          const newMasterName = `${scopedPrefix}_${masterName}`;
          if (!ppt.file(sourceMaster)) {
            return masterName;
          }

          zip.file(`ppt/slideMasters/${newMasterName}`, await ppt.file(sourceMaster).async('arraybuffer'));
          addContentTypeOverride(
            `ppt/slideMasters/${newMasterName}`,
            'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml'
          );

          const sourceMasterRels = `ppt/slideMasters/_rels/${masterName}.rels`;
          if (ppt.file(sourceMasterRels)) {
            let masterRels = await ppt.file(sourceMasterRels).async('string');
            masterRels = await rewriteMediaTargets(masterRels);

            const themeMatches = [...masterRels.matchAll(/Target="\.\.\/theme\/([^"]+)"/g)];
            for (const match of themeMatches) {
              const newThemeName = await copyScopedTheme(match[1]);
              masterRels = masterRels.replace(
                new RegExp(`Target="../theme/${escapeRegExp(match[1])}"`, 'g'),
                `Target="../theme/${newThemeName}"`
              );
            }

            zip.file(`ppt/slideMasters/_rels/${newMasterName}.rels`, masterRels);
          }

          return newMasterName;
        };

        const copyScopedLayout = async (layoutName) => {
          const sourceLayout = `ppt/slideLayouts/${layoutName}`;
          const newLayoutName = `${scopedPrefix}_${layoutName}`;
          if (!ppt.file(sourceLayout)) {
            return layoutName;
          }

          zip.file(`ppt/slideLayouts/${newLayoutName}`, await ppt.file(sourceLayout).async('arraybuffer'));
          addContentTypeOverride(
            `ppt/slideLayouts/${newLayoutName}`,
            'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml'
          );

          const sourceLayoutRels = `ppt/slideLayouts/_rels/${layoutName}.rels`;
          if (ppt.file(sourceLayoutRels)) {
            let layoutRels = await ppt.file(sourceLayoutRels).async('string');
            layoutRels = await rewriteMediaTargets(layoutRels);

            const masterMatches = [...layoutRels.matchAll(/Target="\.\.\/slideMasters\/([^"]+)"/g)];
            for (const match of masterMatches) {
              const newMasterName = await copyScopedMaster(match[1]);
              layoutRels = layoutRels.replace(
                new RegExp(`Target="../slideMasters/${escapeRegExp(match[1])}"`, 'g'),
                `Target="../slideMasters/${newMasterName}"`
              );
            }

            zip.file(`ppt/slideLayouts/_rels/${newLayoutName}.rels`, layoutRels);
          }

          return newLayoutName;
        };
        
        const slideFiles = Object.keys(ppt.files).filter(key => 
          key.startsWith('ppt/slides/slide') && key.endsWith('.xml')
        );
        
        for (const slideFile of slideFiles) {
          const slideContent = await ppt.file(slideFile).async('string');
          const newSlideName = `ppt/slides/slide${slideId}.xml`;
          zip.file(newSlideName, slideContent);
          
          const relsFile = `ppt/slides/_rels/slide${slideId}.xml.rels`;
          const originalRelsFile = slideFile.replace('.xml', '.xml.rels').replace('ppt/slides/', 'ppt/slides/_rels/');
          
          if (ppt.file(originalRelsFile)) {
            let relsContent = await ppt.file(originalRelsFile).async('string');
            relsContent = await rewriteMediaTargets(relsContent);

            const layoutMatches = [...relsContent.matchAll(/Target="\.\.\/slideLayouts\/([^"]+)"/g)];
            for (const match of layoutMatches) {
              const newLayoutName = await copyScopedLayout(match[1]);
              relsContent = relsContent.replace(
                new RegExp(`Target="../slideLayouts/${escapeRegExp(match[1])}"`, 'g'),
                `Target="../slideLayouts/${newLayoutName}"`
              );
            }
            
            const newRelsContent = relsContent.replace(/slide\d+\.xml/g, `slide${slideId}.xml`);
            zip.file(relsFile, newRelsContent);
          }
          
          slideId++;
        }
      }
      
      const presentationXml = await zip.file('ppt/presentation.xml').async('string');
      const presentationRels = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
      
      const totalSlides = slideId - 1;
      
      let newSlideList = '';
      let newRelsList = '';
      
      const existingRels = presentationRels.match(/<Relationship[^>]*Id="rId(\d+)"[^>]*\/>/g) || [];
      const maxRId = existingRels.reduce((max, rel) => {
        const match = rel.match(/Id="rId(\d+)"/);
        return match ? Math.max(max, parseInt(match[1])) : max;
      }, 0);
      
      newSlideList += `<p:sldId id="256" r:id="rId${maxRId + 1}"/>`;
      newRelsList += `<Relationship Id="rId${maxRId + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>`;
      
      for (let i = 2; i <= totalSlides; i++) {
        newSlideList += `<p:sldId id="${i + 255}" r:id="rId${maxRId + i}"/>`;
        newRelsList += `<Relationship Id="rId${maxRId + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`;
      }
      
      const newPresentationXml = presentationXml.replace(
        /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
        `<p:sldIdLst>${newSlideList}</p:sldIdLst>`
      );
      
      const newRelsContent = presentationRels.replace(
        /<\/Relationships>/,
        `${newRelsList}</Relationships>`
      );
      
      zip.file('ppt/presentation.xml', newPresentationXml);
      zip.file('ppt/_rels/presentation.xml.rels', newRelsContent);
      
      const contentTypesXml = await zip.file('[Content_Types].xml').async('string');
      let newContentTypesXml = contentTypesXml;

      for (let i = 1; i <= totalSlides; i++) {
        addContentTypeOverride(
          `ppt/slides/slide${i}.xml`,
          'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'
        );
      }
      
      const mediaExtensions = new Set();
      mediaFileMapping.forEach((newName) => {
        const ext = newName.split('.').pop();
        mediaExtensions.add(ext);
      });
      
      mediaExtensions.forEach(ext => {
        const contentType = ext === 'png' ? 'image/png' : 
                        ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                        ext === 'gif' ? 'image/gif' :
                        ext === 'wmf' ? 'image/x-wmf' :
                        ext === 'emf' ? 'image/x-emf' :
                        ext === 'svg' ? 'image/svg+xml' : 'application/octet-stream';
        
        const defaultTag = `<Default Extension="${ext}" ContentType="${contentType}"/>`;
        if (!newContentTypesXml.includes(`Extension="${ext}"`)) {
          newContentTypesXml = newContentTypesXml.replace('</Types>', `${defaultTag}</Types>`);
        }
      });

      for (const [partName, contentType] of contentTypeOverrides.entries()) {
        if (!newContentTypesXml.includes(`PartName="${partName}"`)) {
          newContentTypesXml = newContentTypesXml.replace(
            '</Types>',
            `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`
          );
        }
      }
      
      zip.file('[Content_Types].xml', newContentTypesXml);
      
      const content = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(outputFilePath, content);
      
      console.log(`浜т笟閾綪PT宸茬敓鎴? ${outputFilePath}`);
      
      return {
        success: true,
        data: {
          ppt_url: `/chain_ppts/${outputFileName}`,
          file_name: outputFileName
        }
      };
      
    } catch (error) {
      console.error('鍚堝苟PPT澶辫触:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  getTechnicalType(type) {
    const typeMap = {
      Patent: '专利技术',
      Paper: '学术论文',
      Project: '科研项目'
    };
    return typeMap[type] || '技术成果';
  },

  async exportChainPPT(graphStore, enterpriseName) {
    try {
      const enterpriseNodes = await graphStore.searchNodes(enterpriseName, { limit: 10 });
      const enterprise = enterpriseNodes.find((node) =>
        String(node.name || '').includes(enterpriseName) ||
        String(node.label || '').includes(enterpriseName)
      );

      let techNodes = [];
      if (enterprise) {
        const graph = await graphStore.findNeighbors(enterprise.id || enterprise.name || enterprise.label, {
          maxDepth: 3,
          types: ['Tech'],
        });
        techNodes = graph.nodes.filter((node) => (node.nodeType || node.type) === 'Tech');
      }

      if (techNodes.length === 0) {
        techNodes = (await graphStore.getNodes({ nodeTypes: ['Tech'], limit: 30 }));
      }

      techNodes = techNodes.slice(0, 30).map((node) => ({
        name: node.name,
        type: node.type,
        category: node.category,
        ppt_content: node.ppt_content,
        label: node.label,
        description: node.description,
        abstract: node.abstract,
        summary: node.summary,
        keywords: node.keywords,
        innovation: node.innovation,
        technical_field: node.technical_field,
        authors: node.authors,
        application: node.application,
        achievements: node.achievements,
        benefits: node.benefits,
        publication_date: node.publication_date,
        nodeType: node.nodeType || node.type || 'Tech'
      }));

      if (techNodes.length === 0) {
        return {
          success: false,
          error: '未找到关联的技术成果'
        };
      }

      const pptFiles = [];
      const typeCounts = {};
      const missingPPTs = [];

      for (const tech of techNodes) {
        const techLabel = this.getAchievementLabel(tech);
        if (!techLabel) {
          missingPPTs.push('未命名成果');
          continue;
        }

        const achType = this.classifyAchievementType(tech);
        typeCounts[achType] = (typeCounts[achType] || 0) + 1;

        const existingPPT = this.findExistingTechnologyPPT(techLabel, tech);
        const pptResult = existingPPT
          ? { success: true, data: existingPPT }
          : { success: false, error: `public/technology_ppt 涓湭鎵惧埌瀵瑰簲鎶€鏈疨PT锛?{techLabel}` };

        if (pptResult.success && await this.isUsableTechnologyPPT(pptResult.data.ppt_url)) {
          pptFiles.push({
            pptUrl: pptResult.data.ppt_url,
            achievementLabel: techLabel,
            achievementType: achType
          });
        } else {
          missingPPTs.push(techLabel);
          console.error(`鐢熸垚鎶€鏈疨PT澶辫触 [${techLabel}]:`, pptResult.error || 'PPT 含模板占位符或不可用');
        }
      }

      if (pptFiles.length === 0) {
        return {
          success: false,
          error: 'public/technology_ppt 中未找到可汇总的技术PPT：' + (missingPPTs.join('、') || '全部技术成果')
        };
      }

      const mergeResult = await this.mergePPTs(pptFiles, enterpriseName, typeCounts);

      if (mergeResult.success) {
        return {
          success: true,
          data: {
            ppt_url: mergeResult.data.ppt_url,
            file_name: mergeResult.data.file_name,
            total_slides: pptFiles.length + 2 + Object.keys(typeCounts).filter(k => typeCounts[k] > 0).length,
            total_achievements: pptFiles.length,
            missing_ppts: missingPPTs
          }
        };
      } else {
        return mergeResult;
      }
    } catch (error) {
      console.error('瀵煎嚭浜т笟閾綪PT澶辫触:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  async exportChainPPTFromAchievements(achievements, enterpriseName) {
    try {
      if (!achievements || achievements.length === 0) {
        return {
          success: false,
          error: '没有可汇总PPT的成果数据'
        };
      }

      const pptFiles = [];
      const typeCounts = {};
      const missingPPTs = [];

      for (const ach of achievements) {
        const techLabel = this.getAchievementLabel(ach);
        if (!techLabel) {
          missingPPTs.push('未命名成果');
          continue;
        }

        const achType = this.classifyAchievementType(ach);
        typeCounts[achType] = (typeCounts[achType] || 0) + 1;

        const existingPPT = this.findExistingTechnologyPPT(techLabel, ach);
        const pptResult = existingPPT
          ? { success: true, data: existingPPT }
          : { success: false, error: `public/technology_ppt 涓湭鎵惧埌瀵瑰簲鎶€鏈疨PT锛?{techLabel}` };

        if (pptResult.success && await this.isUsableTechnologyPPT(pptResult.data.ppt_url)) {
          pptFiles.push({
            pptUrl: pptResult.data.ppt_url,
            achievementLabel: techLabel,
            achievementType: achType,
            reusedExisting: Boolean(pptResult.data.reused_existing),
            matchedFileName: pptResult.data.file_name
          });
        } else {
          missingPPTs.push(techLabel);
          console.error(`鐢熸垚鎶€鏈疨PT澶辫触 [${techLabel}]:`, pptResult.error || 'PPT 含模板占位符或不可用');
        }
      }

      if (pptFiles.length === 0) {
        return {
          success: false,
          error: 'public/technology_ppt 中未找到可汇总的技术PPT：' + (missingPPTs.join('、') || '全部技术成果')
        };
      }

      const mergeResult = await this.mergePPTs(pptFiles, enterpriseName, typeCounts);

      if (mergeResult.success) {
        return {
          success: true,
          data: {
            ppt_url: mergeResult.data.ppt_url,
            file_name: mergeResult.data.file_name,
            total_slides: pptFiles.length + 2 + Object.keys(typeCounts).filter(k => typeCounts[k] > 0).length,
            total_achievements: pptFiles.length,
            missing_ppts: missingPPTs
          }
        };
      } else {
        return mergeResult;
      }
    } catch (error) {
      console.error('浠庢垚鏋滃垪琛ㄥ鍑轰骇涓氶摼PPT澶辫触:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  async generateAgentReportPPT({ achievements, enterpriseName, chainLinks = [] }) {
    const result = await this.exportChainPPTFromAchievements(
      achievements,
      enterpriseName || '智能体汇报'
    );

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: {
        ppt_url: result.data.ppt_url,
        file_name: result.data.file_name,
        total_slides: result.data.total_slides,
        total_achievements: result.data.total_achievements,
        missing_ppts: result.data.missing_ppts || [],
        chain_links: Array.isArray(chainLinks) ? chainLinks : []
      }
    };
  },

  extractTechnicalPrinciple(node) {
    if (node.description) {
      return node.description.substring(0, 500);
    }
    if (node.abstract) {
      return node.abstract.substring(0, 500);
    }
    if (node.summary) {
      return node.summary.substring(0, 500);
    }
    return '暂无技术原理描述';
  },

  extractTechnicalFeatures(node) {
    const features = [];
    
    if (node.keywords && Array.isArray(node.keywords)) {
      features.push('关键词: ' + node.keywords.join('、'));
    }
    
    if (node.innovation) {
      features.push('创新点: ' + node.innovation);
    }
    
    if (node.technical_field) {
      features.push('技术领域: ' + node.technical_field);
    }
    
    if (node.authors) {
      features.push('作者: ' + node.authors);
    }
    
    return features.length > 0 ? features.join('\n') : '暂无技术特点描述';
  },

  extractTechnicalApplication(node) {
    const applications = [];
    
    if (node.application) {
      applications.push('应用场景: ' + node.application);
    }
    
    if (node.achievements) {
      applications.push('成果: ' + node.achievements);
    }
    
    if (node.benefits) {
      applications.push('效益: ' + node.benefits);
    }
    
    if (node.publication_date) {
      applications.push('发布时间: ' + node.publication_date);
    }
    
    return applications.length > 0 ? applications.join('\n') : '暂无应用情况描述';
  }
};

module.exports = PPTService;
