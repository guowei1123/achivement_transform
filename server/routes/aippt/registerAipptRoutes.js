const fs = require('fs');
const path = require('path');
const http = require('http');

const AdmZip = require('adm-zip');
const axios = require('axios');
const JSZip = require('jszip');
const multer = require('multer');
const PptxGenJS = require('pptxgenjs');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function deleteUploadedFile(filePath, allowedDir) {
  if (!filePath) return;

  try {
    const resolvedFilePath = path.resolve(filePath);
    const resolvedAllowedDir = path.resolve(allowedDir);
    const isInsideAllowedDir =
      resolvedFilePath === resolvedAllowedDir ||
      resolvedFilePath.startsWith(`${resolvedAllowedDir}${path.sep}`);

    if (isInsideAllowedDir && fs.existsSync(resolvedFilePath)) {
      fs.unlinkSync(resolvedFilePath);
    }
  } catch (error) {
    console.warn('清理上传临时文件失败:', error.message);
  }
}

function parseColor(colorStr) {
  if (!colorStr) return '333333';
  const value = String(colorStr).trim();

  if (value.startsWith('rgb(')) {
    const match = value.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (match) {
      return [match[1], match[2], match[3]]
        .map((item) => parseInt(item, 10).toString(16).padStart(2, '0'))
        .join('');
    }
  }

  if (value.startsWith('rgba(')) {
    const match = value.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/);
    if (match) {
      return [match[1], match[2], match[3]]
        .map((item) => parseInt(item, 10).toString(16).padStart(2, '0'))
        .join('');
    }
  }

  return value.replace('#', '');
}

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function extractFontSize(html) {
  const match = String(html || '').match(/font-size:\s*(\d+)px/);
  return match ? parseInt(match[1], 10) : 14;
}

function extractFontColor(html, defaultColor) {
  const match = String(html || '').match(/color:\s*([^;"]+)/);
  return match ? parseColor(match[1]) : defaultColor;
}

function isBold(html) {
  const value = String(html || '');
  return value.includes('<strong>') || value.includes('<b>');
}

function escapeHtmlText(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTemplateElements(pptx, pptSlide, elements, scaleX, scaleY, replacements = {}) {
  for (const element of elements) {
    const x = (element.left || 0) * scaleX;
    const y = (element.top || 0) * scaleY;
    const w = (element.width || 0) * scaleX;
    const h = (element.height || 0) * scaleY;

    if (element.type === 'shape') {
      const shapeOptions = {
        x,
        y,
        w,
        h,
        fill: { color: parseColor(element.fill || '#FFFFFF') },
      };

      if (element.rotate) {
        shapeOptions.rotate = element.rotate;
      }

      if (element.shadow) {
        shapeOptions.shadow = {
          type: 'outer',
          blur: (element.shadow.blur || 4) * 0.75,
          offset: (element.shadow.v || 2) * 0.75,
          color: parseColor(element.shadow.color || '#000000'),
          opacity: 0.2,
        };
      }

      if (element.pathFormula === 'roundRect' && Array.isArray(element.keypoints) && element.keypoints.length > 0) {
        shapeOptions.rectRadius = element.keypoints[0] * Math.min(w, h) * 0.5;
        pptSlide.addShape(pptx.ShapeType.roundRect, shapeOptions);
      } else {
        pptSlide.addShape(pptx.ShapeType.rect, shapeOptions);
      }

      continue;
    }

    if (element.type === 'image' && element.data) {
      pptSlide.addImage({
        data: element.data,
        x,
        y,
        w,
        h,
      });
      continue;
    }

    if (element.type === 'line') {
      pptSlide.addShape(pptx.ShapeType.line, {
        x,
        y,
        w: Math.max(w, 0.01),
        h: Math.max(h, 0.01),
        line: {
          color: parseColor(element.color || '#000000'),
          width: element.width || 1,
          style: element.style || 'solid',
        },
      });
      continue;
    }

    if (element.type !== 'text') {
      continue;
    }

    const textType = element.textType || '';
    const rawContent = element.content || '';
    let textContent = stripHtml(rawContent);

    if (textType === 'title' && replacements.title) {
      textContent = replacements.title;
    } else if (textType === 'content' && replacements.content) {
      textContent = replacements.content;
    } else if (textType === 'subtitle' && replacements.subtitle) {
      textContent = replacements.subtitle;
    } else if (textType === 'item' && replacements.itemText) {
      textContent = replacements.itemText;
    } else if (textType === 'itemNumber' && replacements.itemNumber) {
      textContent = replacements.itemNumber;
    }

    if (!textContent) {
      continue;
    }

    const fontSize = Math.max(6, Math.round(extractFontSize(rawContent) * 0.75));
    pptSlide.addText(textContent, {
      x,
      y,
      w,
      h,
      fontSize,
      color: extractFontColor(rawContent, parseColor(element.defaultColor || '#333333')),
      bold: isBold(rawContent),
      fontFace: element.defaultFontName || 'Microsoft YaHei',
      align: rawContent.includes('text-align: center')
        ? 'center'
        : rawContent.includes('text-align: right')
          ? 'right'
          : 'left',
      valign: 'middle',
      wrap: true,
    });
  }
}

function extractJsonObject(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('AI 返回内容不是有效 JSON');
  }
  return JSON.parse(match[0]);
}

function cleanMarkdownFence(content) {
  return String(content || '')
    .replace(/```markdown/gi, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<think[\s\S]*?<\/think>/g, '')
    .trim();
}

function decodeXmlText(text) {
  return String(text || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseXmlAttrs(tagText) {
  const attrs = {};
  const attrRegex = /([\w:.-]+)="([^"]*)"/g;
  let match;
  while ((match = attrRegex.exec(tagText || '')) !== null) {
    attrs[match[1]] = decodeXmlText(match[2]);
  }
  return attrs;
}

function firstXmlMatch(xml, regex) {
  const match = String(xml || '').match(regex);
  if (!match) return '';
  return match[1] === undefined ? match[0] : match[1];
}

function xmlBlocks(xml, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`, 'g');
  return String(xml || '').match(pattern) || [];
}

function normalizeHexColor(value) {
  if (!value) return '';
  const color = String(value).replace('#', '').trim();
  return /^[0-9a-f]{6}$/i.test(color) ? `#${color.toUpperCase()}` : '';
}

function parseThemeColors(themeXml) {
  const colorNames = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  const colors = {};
  for (const name of colorNames) {
    const block = firstXmlMatch(themeXml, new RegExp(`<a:${name}>[\\s\\S]*?<\\/a:${name}>`));
    const srgb = firstXmlMatch(block, /<a:srgbClr\b[^>]*\bval="([^"]+)"/);
    const sys = firstXmlMatch(block, /<a:sysClr\b[^>]*\blastClr="([^"]+)"/);
    const color = normalizeHexColor(srgb || sys);
    if (color) colors[name] = color;
  }
  return colors;
}

function resolvePptxColor(xml, themeColors = {}) {
  const srgb = firstXmlMatch(xml, /<a:srgbClr\b[^>]*\bval="([^"]+)"/);
  if (srgb) return normalizeHexColor(srgb);

  const scheme = firstXmlMatch(xml, /<a:schemeClr\b[^>]*\bval="([^"]+)"/);
  if (scheme && themeColors[scheme]) return themeColors[scheme];

  const sys = firstXmlMatch(xml, /<a:sysClr\b[^>]*\blastClr="([^"]+)"/);
  return normalizeHexColor(sys);
}

function parseSlideSize(presentationXml) {
  const tag = firstXmlMatch(presentationXml, /(<p:sldSz\b[^>]*>)/);
  const attrs = parseXmlAttrs(tag);
  const cx = Number(attrs.cx) || 12192000;
  const cy = Number(attrs.cy) || 6858000;
  return {
    cx,
    cy,
    width: 1000,
    height: Math.round((cy / cx) * 1000 * 100) / 100,
  };
}

function emuToTemplate(value, axisSize, templateSize) {
  return (Number(value) || 0) / axisSize * templateSize;
}

function resolveZipPath(baseDir, target) {
  const parts = `${baseDir}/${target}`.split('/');
  const stack = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return stack.join('/');
}

async function parseSlideRelationships(zip, slideFile) {
  const slideName = path.posix.basename(slideFile);
  const relsPath = `ppt/slides/_rels/${slideName}.rels`;
  const relsXml = await zip.file(relsPath)?.async('string');
  const relationships = {};
  if (!relsXml) return relationships;

  const relRegex = /<Relationship\b[^>]*\/>/g;
  const relTags = relsXml.match(relRegex) || [];
  for (const tag of relTags) {
    const attrs = parseXmlAttrs(tag);
    if (!attrs.Id || !attrs.Target) continue;
    relationships[attrs.Id] = resolveZipPath('ppt/slides', attrs.Target);
  }
  return relationships;
}

function imageMimeType(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/png';
}

function parsePptxText(shapeXml, defaultFontName, defaultColor) {
  const textValues = [];
  const textRegex = /<a:t>([\s\S]*?)<\/a:t>/g;
  let textMatch;
  while ((textMatch = textRegex.exec(shapeXml)) !== null) {
    textValues.push(decodeXmlText(textMatch[1]));
  }

  const text = textValues.join('').trim();
  if (!text) return null;

  const firstRun = firstXmlMatch(shapeXml, /<a:r\b[\s\S]*?<\/a:r>/);
  const rPrTag = firstXmlMatch(firstRun || shapeXml, /(<a:rPr\b[^>]*>)/);
  const rPrAttrs = parseXmlAttrs(rPrTag);
  const sz = Number(rPrAttrs.sz);
  const fontSize = sz ? Math.round(sz / 100) : 18;
  const fontColor = resolvePptxColor(firstRun || shapeXml) || defaultColor;
  const bold = rPrAttrs.b === '1' || rPrAttrs.b === 'true';
  const latinTag = firstXmlMatch(firstRun || shapeXml, /(<a:latin\b[^>]*>)/);
  const latinAttrs = parseXmlAttrs(latinTag);
  const alignAttr = parseXmlAttrs(firstXmlMatch(shapeXml, /(<a:pPr\b[^>]*>)/)).algn;
  const alignMap = { ctr: 'center', r: 'right', just: 'justify' };

  return {
    text,
    fontSize,
    color: fontColor,
    bold,
    fontName: latinAttrs.typeface || defaultFontName,
    align: alignMap[alignAttr] || 'left',
  };
}

function classifyPptxTextElements(elements, slideIndex) {
  const textElements = elements
    .filter((item) => item.type === 'text')
    .sort((a, b) => {
      const fontDelta = extractFontSize(b.content) - extractFontSize(a.content);
      if (fontDelta !== 0) return fontDelta;
      return (a.top || 0) - (b.top || 0);
    });

  if (!textElements.length) return;

  const explicitTitle = textElements.find((item) => item.placeholderType === 'title' || item.placeholderType === 'ctrTitle');
  const explicitSubtitle = textElements.find((item) => item.placeholderType === 'subTitle');
  const bodyElements = textElements.filter((item) => ['body', 'obj'].includes(item.placeholderType));

  const titleElement = explicitTitle || textElements[0];
  titleElement.textType = 'title';

  if (slideIndex === 0) {
    const subtitleElement = explicitSubtitle || textElements.find((item) => item !== titleElement);
    if (subtitleElement) subtitleElement.textType = 'subtitle';
    return;
  }

  const contentCandidates = bodyElements.length
    ? bodyElements
    : textElements.filter((item) => item !== titleElement);

  contentCandidates.forEach((item) => {
    if (!item.textType) item.textType = 'item';
  });
}

async function parsePptxTemplate(pptxBuffer, templateId, title) {
  const zip = await JSZip.loadAsync(pptxBuffer);
  const presentationXml = await zip.file('ppt/presentation.xml')?.async('string') || '';
  const themeXml = await zip.file('ppt/theme/theme1.xml')?.async('string') || '';
  const slideSize = parseSlideSize(presentationXml);
  const themeColorsByName = parseThemeColors(themeXml);
  const accentColors = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']
    .map((name) => themeColorsByName[name])
    .filter(Boolean);
  const defaultThemeColors = accentColors.length
    ? accentColors
    : ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'];
  const defaultFontColor = '#333333';
  const defaultFontName = 'Microsoft YaHei';

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => parseInt(a.match(/slide(\d+)/)[1], 10) - parseInt(b.match(/slide(\d+)/)[1], 10));

  const slides = [];
  for (let index = 0; index < slideFiles.length; index += 1) {
    const fileName = slideFiles[index];
    const slideXml = await zip.file(fileName).async('string');
    const relationships = await parseSlideRelationships(zip, fileName);
    const backgroundColor = resolvePptxColor(firstXmlMatch(slideXml, /<p:bgPr\b[\s\S]*?<\/p:bgPr>/), themeColorsByName)
      || '#FFFFFF';
    const elements = [];

    const drawingRegex = /<p:(sp|pic)\b[\s\S]*?<\/p:\1>/g;
    const drawingBlocks = [...slideXml.matchAll(drawingRegex)];
    for (const blockMatch of drawingBlocks) {
      const elementType = blockMatch[1];
      const elementXml = blockMatch[0];
      const xfrm = firstXmlMatch(elementXml, /<a:xfrm\b[\s\S]*?<\/a:xfrm>/);
      const offAttrs = parseXmlAttrs(firstXmlMatch(xfrm, /(<a:off\b[^>]*\/>)/));
      const extAttrs = parseXmlAttrs(firstXmlMatch(xfrm, /(<a:ext\b[^>]*\/>)/));
      const left = emuToTemplate(offAttrs.x, slideSize.cx, slideSize.width);
      const top = emuToTemplate(offAttrs.y, slideSize.cy, slideSize.height);
      const width = emuToTemplate(extAttrs.cx, slideSize.cx, slideSize.width);
      const height = emuToTemplate(extAttrs.cy, slideSize.cy, slideSize.height);

      if (width <= 0 || height <= 0) {
        continue;
      }

      const idSuffix = `${index + 1}_${elements.length + 1}`;

      if (elementType === 'pic') {
        const blipAttrs = parseXmlAttrs(firstXmlMatch(elementXml, /(<a:blip\b[^>]*>)/));
        const relId = blipAttrs['r:embed'] || blipAttrs.embed || blipAttrs['r:link'];
        const mediaPath = relationships[relId];
        const mediaFile = mediaPath ? zip.file(mediaPath) : null;
        if (!mediaFile) {
          continue;
        }
        const mediaBuffer = await mediaFile.async('nodebuffer');
        elements.push({
          type: 'image',
          id: `pptx_image_${idSuffix}`,
          left,
          top,
          width,
          height,
          data: `data:${imageMimeType(mediaPath)};base64,${mediaBuffer.toString('base64')}`,
          rotate: 0,
          lock: true,
        });
        continue;
      }

      const fillColor = resolvePptxColor(firstXmlMatch(elementXml, /<a:solidFill\b[\s\S]*?<\/a:solidFill>/), themeColorsByName);
      const textInfo = parsePptxText(elementXml, defaultFontName, defaultFontColor);
      const phAttrs = parseXmlAttrs(firstXmlMatch(elementXml, /(<p:ph\b[^>]*\/>)/));

      if (fillColor && !textInfo) {
        elements.push({
          type: 'shape',
          id: `pptx_shape_${idSuffix}`,
          left,
          top,
          width,
          height,
          fill: fillColor,
          rotate: 0,
          lock: true,
        });
        continue;
      }

      if (textInfo) {
        if (fillColor) {
          elements.push({
            type: 'shape',
            id: `pptx_shape_${idSuffix}`,
            left,
            top,
            width,
            height,
            fill: fillColor,
            rotate: 0,
            lock: true,
          });
        }

        elements.push({
          type: 'text',
          id: `pptx_text_${idSuffix}`,
          left,
          top,
          width,
          height,
          content: `<p style="text-align: ${textInfo.align};"><span style="font-size: ${textInfo.fontSize}px; color: ${textInfo.color};">${textInfo.bold ? '<strong>' : ''}${escapeHtmlText(textInfo.text)}${textInfo.bold ? '</strong>' : ''}</span></p>`,
          rotate: 0,
          defaultFontName: textInfo.fontName,
          defaultColor: textInfo.color,
          vertical: false,
          placeholderType: phAttrs.type || '',
        });
      }
    }

    classifyPptxTextElements(elements, index);

    slides.push({
      id: `${templateId}_${index + 1}`,
      sourceFile: fileName,
      elements,
      type: index === 0 ? 'cover' : 'content',
      background: { type: 'solid', color: backgroundColor },
    });
  }

  return {
    title,
    width: slideSize.width,
    height: slideSize.height,
    theme: {
      themeColors: defaultThemeColors,
      fontColor: defaultFontColor,
      fontName: defaultFontName,
      backgroundColor: '#FFFFFF',
    },
    slides,
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 180000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readResponseText(response) {
  const chunks = [];
  for await (const chunk of response.body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function requestTrainOutlineFromFile(filePath, originalName, runtime) {
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const fileType = path.extname(originalName).replace('.', '').toLowerCase() || 'unknown';
  const sessionId = `ppt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  formData.append('file', new Blob([fileBuffer]), originalName);
  formData.append('user_id', sessionId);
  formData.append('folder_id', '0');
  formData.append('file_type', fileType);
  formData.append('language', 'chinese');

  const response = await fetchWithTimeout(
    `${runtime.AIPPT_BACKEND.replace(/\/$/, '')}/tools/aippt_outline_from_file`,
    {
      method: 'POST',
      body: formData,
    },
    360000
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TrainPPTAgent 大纲生成失败: ${response.status} ${errorText}`);
  }

  return {
    outline: cleanMarkdownFence(await readResponseText(response)),
    sessionId,
  };
}

function parseAipptStreamEvents(streamText) {
  const slides = [];
  const chunks = String(streamText || '').split(/\r?\n\r?\n/);

  for (const chunk of chunks) {
    const dataLines = chunk
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());

    const payload = dataLines.length > 0 ? dataLines.join('\n').trim() : chunk.trim();
    if (!payload || payload === '[DONE]' || payload.startsWith(':')) {
      continue;
    }

    try {
      slides.push(JSON.parse(cleanMarkdownFence(payload)));
    } catch (error) {
      console.warn('跳过无法解析的 TrainPPTAgent 幻灯片事件:', payload.slice(0, 120));
    }
  }

  return slides;
}

function normalizeTrainSlide(slide, fallbackTitle) {
  if (!slide || typeof slide !== 'object') {
    return null;
  }

  const data = slide.data || slide;

  if (slide.type === 'cover') {
    return {
      type: 'cover',
      title: data.title || fallbackTitle || '技术成果汇报',
      subtitle: data.text || data.subtitle || '',
    };
  }

  if (slide.type === 'contents') {
    return {
      type: 'contents',
      items: Array.isArray(data.items) ? data.items : [],
    };
  }

  if (slide.type === 'transition') {
    return {
      type: 'transition',
      title: data.title || '',
      subtitle: data.text || data.subtitle || '',
    };
  }

  if (slide.type === 'content') {
    const items = Array.isArray(data.items) ? data.items : [];
    return {
      type: 'content',
      title: data.title || '',
      items: items
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return { title: '', text: String(item || '') };
          }
          if (item.kind === 'chart') {
            return {
              title: item.title || '数据图表',
              text: item.text || `${item.chartType || 'chart'}: ${(item.labels || []).join('、')}`,
            };
          }
          if (item.kind === 'image') {
            return {
              title: item.title || '图片说明',
              text: item.text || '',
            };
          }
          return {
            title: item.title || '',
            text: item.text || '',
          };
        })
        .filter((item) => item.title || item.text),
    };
  }

  if (slide.type === 'reference') {
    const references = Array.isArray(data.references) ? data.references : [];
    return {
      type: 'content',
      title: data.title || '参考资料',
      items: references.map((item) => ({
        title: item.number ? `参考 ${item.number}` : '',
        text: item.text || item.url || item.doi || item.pmid || '',
      })),
    };
  }

  if (slide.type === 'end') {
    return {
      type: 'end',
      title: data.title || '感谢观看',
    };
  }

  return null;
}

async function requestTrainSlidesFromOutline({ outline, title, runtime, sessionId }) {
  const response = await fetchWithTimeout(
    `${runtime.AIPPT_BACKEND.replace(/\/$/, '')}/tools/aippt`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        content: outline,
        language: 'chinese',
        model: 'default',
        style: '通用',
        stream: true,
        generateFromUploadedFile: Boolean(sessionId),
        generateFromWebSearch: false,
        sessionId: sessionId || '',
      }),
    },
    360000
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TrainPPTAgent PPT 内容生成失败: ${response.status} ${errorText}`);
  }

  const streamText = await readResponseText(response);
  return parseAipptStreamEvents(streamText)
    .map((slide) => normalizeTrainSlide(slide, title))
    .filter(Boolean);
}

async function buildSlidesData(outline, title, runtime) {
  const prompt = `请根据下面的大纲生成适合演示文稿的幻灯片结构，必须只返回 JSON。

标题：${title || '技术成果汇报'}

大纲：
${outline}

返回格式：
{
  "slides": [
    { "type": "cover", "title": "封面标题", "subtitle": "封面副标题" },
    { "type": "contents", "items": ["目录一", "目录二"] },
    { "type": "transition", "title": "章节标题", "subtitle": "章节摘要" },
    {
      "type": "content",
      "title": "页面标题",
      "items": [
        { "title": "要点标题", "text": "要点说明" }
      ]
    },
    { "type": "end", "title": "感谢观看" }
  ]
}

要求：
1. 首页必须是 cover，第二页必须是 contents，最后一页必须是 end。
2. 每个主要章节前插入一页 transition。
3. content 页面每页放 3 到 5 个要点。
4. 文本必须来自大纲，不要出现“待补充”“占位符”等词。`;

  const response = await axios.post(
    'https://api.deepseek.com/v1/chat/completions',
    {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一名专业 PPT 内容策划师，负责把大纲转成结构化的幻灯片数据。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 6000,
    },
    {
      headers: {
        Authorization: `Bearer ${runtime.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }
  );

  const parsed = extractJsonObject(response.data.choices[0].message.content);
  return Array.isArray(parsed.slides) ? parsed.slides : [];
}

function addFallbackSlide(pptSlide, slide, title, templateData) {
  const theme = templateData.theme || {};
  const themeColors = theme.themeColors || ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'];
  const primaryColor = (themeColors[0] || '#5b9bd5').replace('#', '');
  const fontColor = (theme.fontColor || '#333333').replace('#', '');
  const fontName = theme.fontName || 'Microsoft YaHei';

  if (slide.type === 'cover') {
    pptSlide.background = { fill: primaryColor };
    pptSlide.addText(slide.title || title || '技术成果汇报', {
      x: 0.8, y: 1.5, w: 8.4, h: 1.2,
      fontSize: 28, color: 'FFFFFF', bold: true,
      fontFace: fontName, align: 'center', valign: 'middle',
    });
    if (slide.subtitle) {
      pptSlide.addText(slide.subtitle, {
        x: 1.2, y: 3.1, w: 7.6, h: 0.8,
        fontSize: 16, color: 'E6E6E6',
        fontFace: fontName, align: 'center',
      });
    }
    return;
  }

  if (slide.type === 'contents') {
    pptSlide.addText('目录', {
      x: 0.6, y: 0.3, w: 2.5, h: 0.7,
      fontSize: 24, color: primaryColor, bold: true,
      fontFace: fontName,
    });
    (slide.items || []).forEach((item, index) => {
      pptSlide.addText(`${String(index + 1).padStart(2, '0')}  ${item}`, {
        x: 0.9, y: 1.3 + index * 0.6, w: 8, h: 0.4,
        fontSize: 16, color: fontColor,
        fontFace: fontName,
      });
    });
    return;
  }

  if (slide.type === 'transition') {
    pptSlide.background = { fill: primaryColor };
    pptSlide.addText(slide.title || '', {
      x: 0.8, y: 1.7, w: 8.4, h: 1,
      fontSize: 26, color: 'FFFFFF', bold: true,
      fontFace: fontName, align: 'center', valign: 'middle',
    });
    if (slide.subtitle) {
      pptSlide.addText(slide.subtitle, {
        x: 1.2, y: 2.9, w: 7.6, h: 0.6,
        fontSize: 14, color: 'E6E6E6',
        fontFace: fontName, align: 'center',
      });
    }
    return;
  }

  if (slide.type === 'content') {
    pptSlide.addText(slide.title || '', {
      x: 0.5, y: 0.2, w: 9, h: 0.7,
      fontSize: 22, color: primaryColor, bold: true,
      fontFace: fontName,
    });
    (slide.items || []).forEach((item, index) => {
      const text = item.title ? `${item.title}：${item.text || ''}` : (item.text || item.title || '');
      pptSlide.addText(text, {
        x: 0.8, y: 1.2 + index * 0.75, w: 8.2, h: 0.5,
        fontSize: 14, color: fontColor,
        fontFace: fontName,
        bullet: { indent: 14 },
      });
    });
    return;
  }

  pptSlide.background = { fill: primaryColor };
  pptSlide.addText(slide.title || '感谢观看', {
    x: 1, y: 2, w: 8, h: 1.2,
    fontSize: 30, color: 'FFFFFF', bold: true,
    fontFace: fontName, align: 'center', valign: 'middle',
  });
}

function slideItemText(item) {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';
  return item.title ? `${item.title}：${item.text || ''}` : (item.text || item.title || '');
}

function addTemplateTextFallback(pptSlide, slide, templateData) {
  const theme = templateData.theme || {};
  const themeColors = theme.themeColors || ['#005EA4', '#00479A', '#FBC540', '#333333'];
  const primaryColor = parseColor(themeColors[0] || '#005EA4');
  const accentColor = parseColor(themeColors[2] || '#FBC540');
  const fontColor = parseColor(theme.fontColor || '#1F2937');
  const fontName = theme.fontName || 'Microsoft YaHei';

  if (slide.type === 'contents') {
    pptSlide.addText('目录', {
      x: 0.75, y: 0.48, w: 2.4, h: 0.55,
      fontSize: 24, color: primaryColor, bold: true, fontFace: fontName,
    });
    (slide.items || []).slice(0, 6).forEach((item, index) => {
      pptSlide.addText(String(index + 1).padStart(2, '0'), {
        x: 1.1, y: 1.42 + index * 0.55, w: 0.65, h: 0.34,
        fontSize: 15, color: accentColor, bold: true, fontFace: fontName,
      });
      pptSlide.addText(String(item), {
        x: 1.85, y: 1.4 + index * 0.55, w: 6.8, h: 0.38,
        fontSize: 15, color: fontColor, fontFace: fontName,
      });
    });
    return;
  }

  if (slide.type !== 'content') {
    return;
  }

  pptSlide.addText(slide.title || '', {
    x: 0.7, y: 0.42, w: 8.6, h: 0.55,
    fontSize: 22, color: primaryColor, bold: true, fontFace: fontName,
  });

  (slide.items || []).slice(0, 7).forEach((item, index) => {
    const text = slideItemText(item);
    if (!text) return;
    pptSlide.addText(text, {
      x: 0.95, y: 1.25 + index * 0.55, w: 8.15, h: 0.42,
      fontSize: index === 0 && text.startsWith('概述：') ? 13 : 14,
      color: fontColor,
      fontFace: fontName,
      bullet: index === 0 ? undefined : { indent: 14 },
      fit: 'shrink',
      breakLine: false,
    });
  });
}

async function generatePptFromOutline({ outline, templateData, title, runtime, publicDir, sessionId, slidesDataOverride }) {
  let slidesData = Array.isArray(slidesDataOverride) ? slidesDataOverride : [];
  if (slidesData.length === 0) {
    try {
      slidesData = await requestTrainSlidesFromOutline({ outline, title, runtime, sessionId });
    } catch (error) {
      console.warn('TrainPPTAgent 内容生成不可用，回退到本地 DeepSeek 结构化生成:', error.message);
      slidesData = await buildSlidesData(outline, title, runtime);
    }
  }

  if (slidesData.length === 0) {
    throw new Error('未能生成有效的幻灯片结构');
  }

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Tech Service Knowledge Graph';
  pptx.title = title || '技术成果汇报';

  const templateSlides = templateData.slides || [];
  const templateWidth = templateData.width || 1000;
  const templateHeight = templateData.height || 562.5;
  const scaleX = 10 / templateWidth;
  const scaleY = 5.625 / templateHeight;

  const templateSlidesByType = {};
  for (const templateSlide of templateSlides) {
    const type = templateSlide.type || 'content';
    if (!templateSlidesByType[type]) {
      templateSlidesByType[type] = [];
    }
    templateSlidesByType[type].push(templateSlide);
  }

  const pickTemplateSlide = (type, index) => {
    const pool = templateSlidesByType[type] || templateSlidesByType.content || [];
    if (pool.length === 0) {
      return null;
    }
    return pool[index % pool.length];
  };

  let contentSlideIndex = 0;
  let transitionSlideIndex = 0;

  for (const slide of slidesData) {
    const pptSlide = pptx.addSlide();
    const templateSlide = pickTemplateSlide(
      slide.type,
      slide.type === 'content' ? contentSlideIndex++ : slide.type === 'transition' ? transitionSlideIndex++ : 0
    );

    if (templateSlide?.background?.color) {
      pptSlide.background = { fill: parseColor(templateSlide.background.color) };
    }

    if (!templateSlide?.elements?.length) {
      addFallbackSlide(pptSlide, slide, title, templateData);
      continue;
    }

    if (slide.type === 'cover') {
      renderTemplateElements(pptx, pptSlide, templateSlide.elements, scaleX, scaleY, {
        title: slide.title || title || '技术成果汇报',
        subtitle: slide.subtitle || '',
      });
      continue;
    }

    if (slide.type === 'transition') {
      renderTemplateElements(pptx, pptSlide, templateSlide.elements, scaleX, scaleY, {
        title: slide.title || '',
        subtitle: slide.subtitle || '',
      });
      continue;
    }

    if (slide.type === 'end') {
      renderTemplateElements(pptx, pptSlide, templateSlide.elements, scaleX, scaleY, {
        title: slide.title || '感谢观看',
      });
      continue;
    }

    if (slide.type === 'contents') {
      const itemElements = templateSlide.elements.filter((item) => item.type === 'text' && item.textType === 'item');
      const numberElements = templateSlide.elements.filter((item) => item.type === 'text' && item.textType === 'itemNumber');
      const baseElements = templateSlide.elements.filter((item) => !(item.type === 'text' && ['item', 'itemNumber'].includes(item.textType)));

      renderTemplateElements(pptx, pptSlide, baseElements, scaleX, scaleY);

      if (itemElements.length === 0 && numberElements.length === 0) {
        addTemplateTextFallback(pptSlide, slide, templateData);
      } else {
        (slide.items || []).forEach((item, index) => {
          if (itemElements[index]) {
            renderTemplateElements(pptx, pptSlide, [itemElements[index]], scaleX, scaleY, { itemText: item });
          }
          if (numberElements[index]) {
            renderTemplateElements(pptx, pptSlide, [numberElements[index]], scaleX, scaleY, {
              itemNumber: String(index + 1).padStart(2, '0'),
            });
          }
        });
      }
      continue;
    }

    if (slide.type === 'content') {
      const titleElements = templateSlide.elements.filter((item) => item.type === 'text' && item.textType === 'title');
      const itemElements = templateSlide.elements.filter((item) => item.type === 'text' && ['content', 'item'].includes(item.textType));
      const baseElements = templateSlide.elements.filter((item) => !(item.type === 'text' && ['title', 'content', 'item', 'itemNumber'].includes(item.textType)));

      renderTemplateElements(pptx, pptSlide, baseElements, scaleX, scaleY);

      if (titleElements[0]) {
        renderTemplateElements(pptx, pptSlide, [titleElements[0]], scaleX, scaleY, {
          title: slide.title || '',
        });
      }

      if (itemElements.length === 0) {
        addTemplateTextFallback(pptSlide, slide, templateData);
      } else {
        (slide.items || []).forEach((item, index) => {
          if (!itemElements[index]) {
            return;
          }
          const itemText = slideItemText(item);
          renderTemplateElements(pptx, pptSlide, [itemElements[index]], scaleX, scaleY, {
            itemText,
            content: itemText,
          });
        });
      }
      continue;
    }

    addFallbackSlide(pptSlide, slide, title, templateData);
  }

  const outputDir = path.join(publicDir, 'generated_ppt');
  ensureDir(outputDir);

  const rawTitle = title || '技术成果汇报';
  const safeFileName = rawTitle.replace(/[<>:"/\\|?*]/g, '_');
  const fileName = `${safeFileName}_${Date.now()}.pptx`;
  const filePath = path.join(outputDir, fileName);
  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  fs.writeFileSync(filePath, buffer);

  return {
    downloadUrl: `/generated_ppt/${fileName}`,
    fileName,
    slideCount: slidesData.length,
    slides: slidesData,
  };
}

async function extractTextFromDocx(filePath) {
  const zip = new AdmZip(filePath);
  const xmlData = zip.readAsText('word/document.xml');
  const textMatches = xmlData.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
  return textMatches
    .map((match) => match.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
    .join('');
}

async function extractTextFromPptx(filePath) {
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => parseInt(a.match(/slide(\d+)/)[1], 10) - parseInt(b.match(/slide(\d+)/)[1], 10));

  const slideTexts = [];
  for (const slideFile of slideFiles) {
    const xmlData = await zip.files[slideFile].async('string');
    const textMatches = xmlData.match(/<a:t>([^<]+)<\/a:t>/g) || [];
    if (textMatches.length > 0) {
      slideTexts.push(textMatches.map((match) => match.replace(/<a:t>/, '').replace(/<\/a:t>/, '')).join(' '));
    }
  }

  return slideTexts.join('\n\n');
}

async function extractEmbeddedImages(filePath, ext) {
  if (!['.docx', '.pptx'].includes(ext)) {
    return [];
  }

  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const imagePrefix = ext === '.docx' ? 'word/media/' : 'ppt/media/';
  const images = [];

  for (const fileName of Object.keys(zip.files)) {
    if (!fileName.startsWith(imagePrefix) || zip.files[fileName].dir) {
      continue;
    }

    const mimeType = imageMimeType(fileName);
    if (mimeType === 'image/svg+xml') {
      continue;
    }

    const buffer = await zip.files[fileName].async('nodebuffer');
    images.push({
      name: path.basename(fileName),
      mimeType,
      data: `data:${mimeType};base64,${buffer.toString('base64')}`,
    });

    if (images.length >= 6) {
      break;
    }
  }

  return images;
}

function normalizeTextList(value, maxItems = 6) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, maxItems);
  }
  return String(value || '')
    .split(/\r?\n|[；;]/)
    .map((item) => item.replace(/^[-*•\d.\s、]+/, '').trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeTechContent(raw, fallbackTitle) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const sections = data.sections && typeof data.sections === 'object' ? data.sections : data;

  return {
    title: String(data.title || fallbackTitle || '技术成果汇报').trim(),
    subtitle: String(data.subtitle || '技术成果转化汇报').trim(),
    background: {
      title: '技术背景',
      summary: String(sections.background?.summary || data.background || '').trim(),
      points: normalizeTextList(sections.background?.points || sections.background || data.background, 6),
    },
    principleFeatures: {
      title: '技术原理与特点',
      summary: String(sections.principleFeatures?.summary || data.principleFeatures || data.features || '').trim(),
      points: normalizeTextList(sections.principleFeatures?.points || sections.principleFeatures || data.features, 8),
    },
    achievements: {
      title: '技术前期应用成果',
      summary: String(sections.achievements?.summary || data.achievements || '').trim(),
      points: normalizeTextList(sections.achievements?.points || sections.achievements || data.achievements, 8),
    },
  };
}

function buildTechOutline(content) {
  const sectionToMd = (section) => [
    `## ${section.title}`,
    section.summary ? `### 概述\n- ${section.summary}` : '',
    section.points.length ? `### 关键要点\n${section.points.map((item) => `- ${item}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  return [
    `# ${content.title || '技术成果汇报'}`,
    sectionToMd(content.background),
    sectionToMd(content.principleFeatures),
    sectionToMd(content.achievements),
  ].join('\n\n');
}

function splitItemsForSlide(section, maxItems = 5) {
  const items = [];
  if (section.summary) {
    items.push({ title: '概述', text: section.summary });
  }
  for (const point of section.points || []) {
    items.push({ title: '', text: point });
  }
  return items.slice(0, maxItems).map((item) => {
    if (typeof item === 'string') return { title: '', text: item };
    return item;
  });
}

function buildTechSlidesData(content) {
  const title = content.title || '技术成果汇报';
  const sections = [content.background, content.principleFeatures, content.achievements];
  const slides = [
    { type: 'cover', title, subtitle: content.subtitle || '技术成果转化汇报' },
    { type: 'contents', items: sections.map((section) => section.title) },
  ];

  for (const section of sections) {
    slides.push({ type: 'transition', title: section.title, subtitle: section.summary || '' });
    slides.push({
      type: 'content',
      title: section.title,
      items: splitItemsForSlide(section, section.title === '技术原理与特点' ? 6 : 5),
    });
  }

  slides.push({ type: 'end', title: '感谢观看' });
  return slides;
}

function sectionText(section) {
  const lines = [];
  if (section.summary) {
    lines.push(`概述：${section.summary}`);
  }
  for (const point of section.points || []) {
    lines.push(`• ${point}`);
  }
  return lines.filter(Boolean).join('\n');
}

function chunkSection(section, maxChars = 420, maxLines = 7) {
  const lines = sectionText(section).split('\n').filter(Boolean);
  if (lines.length === 0) {
    return [''];
  }

  const chunks = [];
  let current = [];
  let currentLength = 0;

  for (const line of lines) {
    const projectedLength = currentLength + line.length;
    if (current.length > 0 && (projectedLength > maxChars || current.length >= maxLines)) {
      chunks.push(current.join('\n'));
      current = [];
      currentLength = 0;
    }
    current.push(line);
    currentLength += line.length;
  }

  if (current.length > 0) {
    chunks.push(current.join('\n'));
  }

  return chunks;
}

function xmlEscapeText(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replacePptTextPlaceholders(xml, replacements) {
  const textRegex = /<a:t>([\s\S]*?)<\/a:t>/g;
  const nodes = [];
  let match;
  let combined = '';

  while ((match = textRegex.exec(xml)) !== null) {
    const decoded = decodeXmlText(match[1]);
    nodes.push({
      start: match.index,
      end: match.index + match[0].length,
      open: '<a:t>',
      close: '</a:t>',
      text: decoded,
      combinedStart: combined.length,
      combinedEnd: combined.length + decoded.length,
    });
    combined += decoded;
  }

  const nodeTexts = nodes.map((node) => node.text);
  for (const [placeholder, replacement] of Object.entries(replacements)) {
    const idx = combined.indexOf(placeholder);
    if (idx === -1) continue;

    const endIdx = idx + placeholder.length;
    let replaced = false;
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (node.combinedEnd <= idx || node.combinedStart >= endIdx) {
        continue;
      }

      const localStart = Math.max(0, idx - node.combinedStart);
      const localEnd = Math.min(node.text.length, endIdx - node.combinedStart);
      if (!replaced) {
        nodeTexts[i] = `${nodeTexts[i].slice(0, localStart)}${replacement}${nodeTexts[i].slice(localEnd)}`;
        replaced = true;
      } else {
        nodeTexts[i] = `${nodeTexts[i].slice(0, localStart)}${nodeTexts[i].slice(localEnd)}`;
      }
    }

    combined = combined.replace(placeholder, replacement);
  }

  let output = '';
  let cursor = 0;
  nodes.forEach((node, index) => {
    output += xml.slice(cursor, node.start);
    output += `${node.open}${xmlEscapeText(nodeTexts[index])}${node.close}`;
    cursor = node.end;
  });
  output += xml.slice(cursor);
  return output;
}

function contentTypeForImage(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpeg';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

async function addImageToSlideZip(zip, slideNumber, image, imageIndex) {
  if (!image?.data) {
    return;
  }

  const base64 = image.data.split(',')[1];
  if (!base64) {
    return;
  }

  const ext = contentTypeForImage(image.mimeType || 'image/png');
  const mediaPath = `ppt/media/uploaded-${slideNumber}-${imageIndex}.${ext}`;
  zip.file(mediaPath, Buffer.from(base64, 'base64'));

  const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
  let relsXml = await zip.file(relsPath)?.async('string');
  if (!relsXml) {
    relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  }

  const relIds = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  const nextRelId = `rId${Math.max(0, ...relIds) + 1}`;
  const imageTarget = `../media/uploaded-${slideNumber}-${imageIndex}.${ext}`;
  relsXml = relsXml.replace(
    '</Relationships>',
    `<Relationship Id="${nextRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${imageTarget}"/></Relationships>`
  );
  zip.file(relsPath, relsXml);

  const slidePath = `ppt/slides/slide${slideNumber}.xml`;
  let slideXml = await zip.file(slidePath).async('string');
  const picId = 9000 + imageIndex;
  const picXml = `<p:pic><p:nvPicPr><p:cNvPr id="${picId}" name="${xmlEscapeText(image.name || 'uploaded image')}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${nextRelId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="7559040" y="1554480"/><a:ext cx="2743200" cy="2057400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  slideXml = slideXml.replace('</p:spTree>', `${picXml}</p:spTree>`);
  zip.file(slidePath, slideXml);
}

async function generatePptFromBodyTemplate({ techContent, publicDir }) {
  const preferredTemplatePath = path.join(publicDir, 'template_ppt', '模板.pptx');
  const fallbackTemplatePath = path.join(publicDir, 'ppt_template', '模板.pptx');
  const templatePath = fs.existsSync(preferredTemplatePath) ? preferredTemplatePath : fallbackTemplatePath;
  if (!fs.existsSync(templatePath)) {
    throw new Error('系统正文模板不存在：public/template_ppt/模板.pptx 或 public/ppt_template/模板.pptx');
  }

  const zip = await JSZip.loadAsync(fs.readFileSync(templatePath));
  const baseSlides = {
    background: await zip.file('ppt/slides/slide1.xml').async('string'),
    principle: await zip.file('ppt/slides/slide2.xml').async('string'),
    achievements: await zip.file('ppt/slides/slide3.xml').async('string'),
  };
  const baseRels = {
    background: await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('string'),
    principle: await zip.file('ppt/slides/_rels/slide2.xml.rels')?.async('string'),
    achievements: await zip.file('ppt/slides/_rels/slide3.xml.rels')?.async('string'),
  };

  const sections = [
    { key: 'background', placeholder: '{technical_principle_content}', section: techContent.background },
    { key: 'principle', placeholder: '{technical_feature_content}', section: techContent.principleFeatures },
    { key: 'achievements', placeholder: '{technical_application_content}', section: techContent.achievements },
  ];

  const generatedSlides = [];
  for (const spec of sections) {
    const chunks = chunkSection(spec.section);
    chunks.forEach((content, index) => {
      generatedSlides.push({
        key: spec.key,
        placeholder: spec.placeholder,
        content,
        titleSuffix: chunks.length > 1 ? `（${index + 1}/${chunks.length}）` : '',
      });
    });
  }

  for (const name of Object.keys(zip.files)) {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(name) || /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(name)) {
      zip.remove(name);
    }
  }

  generatedSlides.forEach((slide, index) => {
    const slideNumber = index + 1;
    const replacements = {
      '{technical_name}': `${techContent.title}${slide.titleSuffix}`,
      [slide.placeholder]: slide.content,
    };
    const slideXml = replacePptTextPlaceholders(baseSlides[slide.key], replacements);
    zip.file(`ppt/slides/slide${slideNumber}.xml`, slideXml);
    if (baseRels[slide.key]) {
      zip.file(`ppt/slides/_rels/slide${slideNumber}.xml.rels`, baseRels[slide.key]);
    }
  });

  const contentTypesPath = '[Content_Types].xml';
  let contentTypesXml = await zip.file(contentTypesPath).async('string');
  contentTypesXml = contentTypesXml.replace(/<Override PartName="\/ppt\/slides\/slide\d+\.xml" ContentType="application\/vnd\.openxmlformats-officedocument\.presentationml\.slide\+xml"\/>/g, '');
  const overrides = generatedSlides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');
  contentTypesXml = contentTypesXml.replace('</Types>', `${overrides}</Types>`);
  zip.file(contentTypesPath, contentTypesXml);

  const relsPath = 'ppt/_rels/presentation.xml.rels';
  let presRelsXml = await zip.file(relsPath).async('string');
  presRelsXml = presRelsXml.replace(/<Relationship Id="rId\d+" Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/slide" Target="slides\/slide\d+\.xml"\/>/g, '');
  const existingRelIds = [...presRelsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  const relStart = Math.max(0, ...existingRelIds) + 1;
  const slideRels = generatedSlides.map((_, index) => `<Relationship Id="rId${relStart + index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join('');
  presRelsXml = presRelsXml.replace('</Relationships>', `${slideRels}</Relationships>`);
  zip.file(relsPath, presRelsXml);

  const presentationPath = 'ppt/presentation.xml';
  let presentationXml = await zip.file(presentationPath).async('string');
  const slideIds = generatedSlides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${relStart + index}"/>`).join('');
  presentationXml = presentationXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${slideIds}</p:sldIdLst>`);
  zip.file(presentationPath, presentationXml);

  const images = Array.isArray(techContent.images) ? techContent.images : [];
  for (let i = 0; i < Math.min(images.length, generatedSlides.length); i += 1) {
    await addImageToSlideZip(zip, i + 1, images[i], i + 1);
  }

  const outputDir = path.join(publicDir, 'generated_ppt');
  ensureDir(outputDir);
  const rawTitle = techContent.title || '技术成果汇报';
  const safeFileName = rawTitle.replace(/[<>:"/\\|?*]/g, '_');
  const fileName = `${safeFileName}_${Date.now()}.pptx`;
  const filePath = path.join(outputDir, fileName);
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(filePath, buffer);

  return {
    downloadUrl: `/generated_ppt/${fileName}`,
    fileName,
    slideCount: generatedSlides.length,
    slides: generatedSlides.map((slide) => ({
      type: 'content',
      title: techContent.title,
      section: slide.key,
      content: slide.content,
    })),
  };
}

let defaultTechTemplateCache = null;

async function getDefaultTechTemplate(publicDir) {
  const templateDir = path.join(publicDir, 'ppt_template');
  const specs = [
    { file: '封面_修复.pptx', type: 'cover', fallback: '封面.pptx' },
    { file: '目录.pptx', type: 'contents' },
    { file: '章节页.pptx', type: 'transition' },
    { file: '模板.pptx', type: 'content' },
    { file: '成果章节页.pptx', type: 'transition' },
  ];
  const cacheKey = specs.map((spec) => {
    const filePath = path.join(templateDir, spec.file);
    const fallbackPath = spec.fallback ? path.join(templateDir, spec.fallback) : '';
    const actualPath = fs.existsSync(filePath) ? filePath : fallbackPath;
    const stat = actualPath && fs.existsSync(actualPath) ? fs.statSync(actualPath) : null;
    return `${actualPath}:${stat?.mtimeMs || 0}`;
  }).join('|');

  if (defaultTechTemplateCache?.key === cacheKey) {
    return defaultTechTemplateCache.template;
  }

  const slides = [];
  let width = 1000;
  let height = 562.5;
  let theme = null;

  for (const spec of specs) {
    const filePath = path.join(templateDir, spec.file);
    const fallbackPath = spec.fallback ? path.join(templateDir, spec.fallback) : '';
    const actualPath = fs.existsSync(filePath) ? filePath : fallbackPath;
    if (!actualPath || !fs.existsSync(actualPath)) continue;

    const parsed = await parsePptxTemplate(fs.readFileSync(actualPath), spec.type, spec.file.replace('.pptx', ''));
    width = parsed.width || width;
    height = parsed.height || height;
    theme = theme || parsed.theme;
    const slide = parsed.slides[0];
    if (slide) {
      slides.push({
        ...slide,
        id: `default_${spec.type}_${slides.length + 1}`,
        type: spec.type,
        elements: slide.elements.filter((element) => element.type === 'image' || element.type === 'text'),
      });
    }
  }

  const template = {
    title: '系统默认技术成果模板',
    width,
    height,
    theme: theme || {
      themeColors: ['#005EA4', '#00479A', '#FBC540', '#333333'],
      fontColor: '#333333',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#FFFFFF',
    },
    slides,
  };

  defaultTechTemplateCache = { key: cacheKey, template };
  return template;
}

async function extractTechContentWithLLM(documentText, title, runtime) {
  const prompt = `请严格根据用户上传的技术文档内容，抽取并改写成技术成果PPT可用的三部分内容。

只返回 JSON，不要 Markdown，不要解释。字段如下：
{
  "title": "技术成果标题，优先使用文档中的成果/项目名称",
  "subtitle": "一句汇报副标题",
  "sections": {
    "background": {
      "summary": "技术背景概述，80字以内",
      "points": ["背景要点1", "背景要点2", "背景要点3"]
    },
    "principleFeatures": {
      "summary": "技术原理与特点概述，100字以内",
      "points": ["原理或特点1", "原理或特点2", "原理或特点3", "原理或特点4"]
    },
    "achievements": {
      "summary": "前期应用成果概述，100字以内",
      "points": ["应用或成果1", "应用或成果2", "应用或成果3"]
    }
  }
}

要求：
1. 必须基于文档原文，不得引入文档没有的技术、数据、单位、场景和效果。
2. 如果某部分原文信息不足，保留可确认内容，points 可以少于示例数量。
3. 语言正式、适合技术成果转化汇报。

文件名标题：${title || '技术成果汇报'}

文档内容：
${documentText}`;

  const aiResponse = await axios.post(
    'https://api.deepseek.com/v1/chat/completions',
    {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一名技术成果转化PPT策划师，擅长从技术文档中抽取事实并组织成汇报材料。必须严格基于原文。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    },
    {
      headers: {
        Authorization: `Bearer ${runtime.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }
  );

  return normalizeTechContent(extractJsonObject(aiResponse.data.choices[0].message.content), title);
}

function registerAipptRoutes(app, context) {
  const { runtime, paths } = context;
  const { publicDir, trainPptTemplateDir } = paths;

  const templateStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      ensureDir(trainPptTemplateDir);
      cb(null, trainPptTemplateDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext);
      const safeName = baseName.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_');
      cb(null, `${safeName}${ext}`);
    },
  });

  const templateUpload = multer({
    storage: templateStorage,
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.pptx' || ext === '.json') {
        return cb(null, true);
      }
      cb(new Error('仅支持上传 .pptx 或 .json 模板文件'));
    },
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  const docStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(publicDir, 'uploads', 'docs');
      ensureDir(uploadDir);
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 11)}${ext}`);
    },
  });

  const docUpload = multer({
    storage: docStorage,
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (['.docx', '.doc', '.pdf', '.pptx', '.ppt', '.txt'].includes(ext)) {
        return cb(null, true);
      }
      cb(new Error('仅支持 .docx、.doc、.pdf、.pptx、.ppt、.txt 文件'));
    },
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  app.use('/aippt-api', (req, res) => {
    const proxyPath = req.originalUrl.replace('/aippt-api', '');
    const targetUrl = new URL(proxyPath, runtime.AIPPT_BACKEND);

    if (req.method === 'GET') {
      const proxyReq = http.request(
        {
          hostname: targetUrl.hostname,
          port: targetUrl.port || 80,
          path: `${targetUrl.pathname}${targetUrl.search}`,
          method: 'GET',
        },
        (proxyRes) => {
          res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          proxyRes.pipe(res);
        }
      );

      proxyReq.on('error', (error) => {
        console.error('AIPPT GET 代理失败:', error.message);
        if (!res.headersSent) {
          res.status(502).json({ error: `AIPPT 后端不可用: ${error.message}` });
        }
      });

      proxyReq.end();
      return;
    }

    if (req.method === 'POST') {
      const isStream = req.headers.accept === 'text/event-stream' || req.body?.stream === true;

      if (isStream) {
        const postData = JSON.stringify(req.body || {});
        const proxyReq = http.request(
          {
            hostname: targetUrl.hostname,
            port: targetUrl.port || 80,
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
              Accept: 'text/event-stream',
            },
          },
          (proxyRes) => {
            res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.flushHeaders();
            proxyRes.on('data', (chunk) => res.write(chunk));
            proxyRes.on('end', () => res.end());
            proxyRes.on('error', () => res.end());
          }
        );

        proxyReq.on('error', (error) => {
          console.error('AIPPT 流式代理失败:', error.message);
          if (!res.headersSent) {
            res.status(502).json({ error: `AIPPT 后端不可用: ${error.message}` });
          }
        });

        proxyReq.write(postData);
        proxyReq.end();
        return;
      }

      axios({
        method: 'POST',
        url: targetUrl.href,
        data: req.body,
        timeout: 60000,
      }).then((response) => {
        res.json(response.data);
      }).catch((error) => {
        console.error('AIPPT POST 代理失败:', error.message);
        res.status(error.response?.status || 502).json({ error: `AIPPT 后端请求失败: ${error.message}` });
      });
      return;
    }

    res.status(405).json({ error: '不支持的请求方法' });
  });

  app.post('/api/aippt/upload-template', templateUpload.single('template'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '未上传模板文件' });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext === '.json') {
        const templateData = JSON.parse(fs.readFileSync(req.file.path, 'utf-8'));
        if (!Array.isArray(templateData.slides)) {
          return res.status(400).json({ success: false, error: 'JSON 模板必须包含 slides 数组' });
        }

        const templateId = path.basename(req.file.path, '.json');
        return res.json({
          success: true,
          data: {
            id: templateId,
            name: req.body.name || templateData.title || templateId,
            message: 'JSON 模板上传成功',
          },
        });
      }

      const templateId = path.basename(req.file.path, '.pptx');
      const pptxBuffer = fs.readFileSync(req.file.path);
      const templateJson = await parsePptxTemplate(pptxBuffer, templateId, req.body.name || templateId);

      fs.writeFileSync(
        path.join(trainPptTemplateDir, `${templateId}.json`),
        JSON.stringify(templateJson, null, 2)
      );

      res.json({
        success: true,
        data: {
          id: templateId,
          name: req.body.name || templateId,
          message: 'PPTX 模板上传成功，已提取基础版式和占位元素',
        },
      });
    } catch (error) {
      console.error('上传模板失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/aippt/templates', async (req, res) => {
    try {
      const templatesRes = await axios.get(`${runtime.AIPPT_BACKEND}/templates`, { timeout: 5000 });
      res.json(templatesRes.data);
    } catch (error) {
      console.error('AIPPT 模板服务不可用，回退到本地模板目录:', error.message);

      if (!fs.existsSync(trainPptTemplateDir)) {
        return res.json({ data: [] });
      }

      const files = fs.readdirSync(trainPptTemplateDir).filter((file) => file.endsWith('.json'));
      const templates = files.map((fileName) => {
        const id = fileName.replace('.json', '');
        let name = id;

        try {
          const data = JSON.parse(fs.readFileSync(path.join(trainPptTemplateDir, fileName), 'utf-8'));
          name = data.title || id;
        } catch (readError) {}

        return {
          id,
          name,
          cover: `/api/aippt-template-cover/${id}`,
        };
      });

      res.json({ data: templates });
    }
  });

  app.get('/api/aippt-template-cover/:id', (req, res) => {
    const coverDir = path.join(trainPptTemplateDir, 'cover');
    for (const ext of ['.png', '.jpg', '.jpeg']) {
      const coverPath = path.join(coverDir, `${req.params.id}${ext}`);
      if (fs.existsSync(coverPath)) {
        return res.sendFile(coverPath);
      }
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225">
      <rect width="400" height="225" fill="#f5f7fb"/>
      <rect x="24" y="24" width="352" height="177" rx="12" fill="#5b9bd5" opacity="0.15"/>
      <text x="200" y="108" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="20" fill="#2f4f6f">PPT Template</text>
      <text x="200" y="138" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="14" fill="#5b6b7a">${req.params.id}</text>
    </svg>`);
  });

  app.get('/api/aippt/download/:fileName', (req, res) => {
    const safeName = path.basename(req.params.fileName || '');
    if (!safeName.endsWith('.pptx')) {
      return res.status(400).json({ success: false, error: '文件名无效' });
    }

    const outputDir = path.join(publicDir, 'generated_ppt');
    const filePath = path.join(outputDir, safeName);
    const resolvedOutputDir = path.resolve(outputDir);
    const resolvedFilePath = path.resolve(filePath);

    if (!resolvedFilePath.startsWith(resolvedOutputDir) || !fs.existsSync(resolvedFilePath)) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }

    res.download(resolvedFilePath, safeName);
  });

  app.post('/api/aippt/extract-content', docUpload.single('document'), async (req, res) => {
    const uploadDir = path.join(publicDir, 'uploads', 'docs');
    let uploadedDocPath = '';

    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '未上传文档' });
      }

      const filePath = req.file.path;
      uploadedDocPath = filePath;
      const ext = path.extname(req.file.originalname).toLowerCase();
      let documentText = '';

      if (ext === '.txt') {
        documentText = fs.readFileSync(filePath, 'utf-8');
      } else if (ext === '.docx') {
        documentText = await extractTextFromDocx(filePath);
      } else if (ext === '.doc') {
        return res.status(400).json({ success: false, error: '当前仅支持解析 docx，不支持旧版 doc 二进制文档' });
      } else if (ext === '.pptx') {
        documentText = await extractTextFromPptx(filePath);
      } else if (ext === '.ppt') {
        return res.status(400).json({ success: false, error: '当前仅支持解析 pptx，不支持旧版 ppt 二进制文件' });
      } else if (ext === '.pdf') {
        return res.status(400).json({ success: false, error: '当前版本暂不支持 PDF 自动抽取，请先转换为 docx、txt 或 pptx' });
      }

      if (!documentText.trim()) {
        return res.status(400).json({ success: false, error: '未能从文档中提取到有效文本' });
      }

      if (documentText.length > 30000) {
        documentText = documentText.slice(0, 30000);
      }

      const titleFromFile = req.file.originalname.replace(/\.[^.]+$/, '');
      const techContent = await extractTechContentWithLLM(documentText, titleFromFile, runtime);
      techContent.images = await extractEmbeddedImages(filePath, ext);
      const outline = buildTechOutline(techContent);

      res.json({
        success: true,
        data: {
          fileName: req.file.originalname,
          rawTextLength: documentText.length,
          title: techContent.title,
          background: [techContent.background.summary, ...(techContent.background.points || [])].filter(Boolean).join('\n'),
          features: [techContent.principleFeatures.summary, ...(techContent.principleFeatures.points || [])].filter(Boolean).join('\n'),
          achievements: [techContent.achievements.summary, ...(techContent.achievements.points || [])].filter(Boolean).join('\n'),
          outline,
          structuredContent: techContent,
          source: 'local-deepseek-tech-ppt',
        },
      });
    } catch (error) {
      console.error('抽取文档内容失败:', error);
      res.status(500).json({ success: false, error: error.message || '抽取文档内容失败' });
    } finally {
      deleteUploadedFile(uploadedDocPath, uploadDir);
    }
  });

  app.post('/api/aippt/generate-outline', async (req, res) => {
    try {
      const { background, features, achievements, title, outline } = req.body;
      if (outline && String(outline).trim()) {
        return res.json({
          success: true,
          data: {
            outline: cleanMarkdownFence(outline),
          },
        });
      }

      if (!background && !features && !achievements) {
        return res.status(400).json({ success: false, error: '请至少提供背景、特点或成果中的一项内容' });
      }

      const prompt = `请基于以下内容生成一份适合技术成果汇报的 PPT 大纲，输出为 Markdown：

标题：${title || '技术成果汇报'}

项目背景：
${background || '无'}

技术特点：
${features || '无'}

成果与应用：
${achievements || '无'}

要求：
1. 包含封面建议、目录、3 到 5 个主体章节以及结束页建议。
2. 每个章节列出适合做成幻灯片的要点。
3. 结构清晰，语言适合商务/技术汇报。`;

      const aiResponse = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一名 PPT 大纲策划助手，负责把技术资料整理成清晰的演示文稿结构。',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 3000,
        },
        {
          headers: {
            Authorization: `Bearer ${runtime.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
        }
      );

      res.json({
        success: true,
        data: {
          outline: aiResponse.data.choices[0].message.content,
        },
      });
    } catch (error) {
      console.error('生成大纲失败:', error);
      res.status(500).json({ success: false, error: error.message || '生成大纲失败' });
    }
  });

  app.post('/api/aippt/generate-ppt', async (req, res) => {
    try {
      const { outline, templateId, title, aipptSessionId, structuredContent } = req.body;
      if (!outline || !String(outline).trim()) {
        return res.status(400).json({ success: false, error: '请提供 PPT 大纲内容' });
      }
      const useDefaultTemplate = !templateId || templateId === 'system_default_tech';
      const techContent = normalizeTechContent(structuredContent || {}, title || '技术成果汇报');
      if (Array.isArray(structuredContent?.images)) {
        techContent.images = structuredContent.images;
      }
      if (useDefaultTemplate) {
        const result = await generatePptFromBodyTemplate({ techContent, publicDir });
        return res.json({
          success: true,
          data: result,
        });
      }

      const templateData = useDefaultTemplate
        ? await getDefaultTechTemplate(publicDir)
        : JSON.parse(fs.readFileSync(path.join(trainPptTemplateDir, `${templateId}.json`), 'utf-8'));
      const slidesData = buildTechSlidesData(techContent);
      const result = await generatePptFromOutline({
        outline,
        templateData,
        title: techContent.title || title,
        runtime,
        publicDir,
        sessionId: aipptSessionId,
        slidesDataOverride: useDefaultTemplate ? slidesData : undefined,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('生成 PPT 失败:', error);
      res.status(500).json({ success: false, error: error.message || '生成 PPT 失败' });
    }
  });
}

module.exports = {
  registerAipptRoutes,
};
