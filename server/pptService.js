const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const axios = require('axios');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-3f8e9d2c1b4a5e6f7d8c9b0a1e2f3d4c5b6a7e8f';
const MATCHING_ENGINE_URL = process.env.MATCHING_ENGINE_URL || 'http://localhost:5001';

const PPTService = {
  classifyAchievementType(label) {
    const methodKeywords = ['方法', '工艺', '流程', '算法', '模型', '策略'];
    const techKeywords = ['装置', '系统', '设备', '平台', '器', '艇', '船', '门', '标', '板', '栏', '绳'];
    
    for (const keyword of methodKeywords) {
      if (label.includes(keyword)) {
        return '方法类';
      }
    }
    
    for (const keyword of techKeywords) {
      if (label.includes(keyword)) {
        return '技术类';
      }
    }
    
    return '技术类';
  },

  async getNodePPTContent(driver, nodeLabel) {
    try {
      const session = driver.session();
      
      try {
        const result = await session.run(
          `MATCH (n) WHERE n.label = $nodeLabel RETURN n.ppt_content as ppt_content, n.type as type, n.category as category`,
          { nodeLabel }
        );
        
        if (result.records.length === 0) {
          return {
            success: false,
            error: '未找到该节点'
          };
        }
        
        const record = result.records[0];
        const pptContent = record.get('ppt_content');
        
        return {
          success: true,
          data: {
            ppt_content: pptContent || '暂无PPT描述',
            type: record.get('type'),
            category: record.get('category')
          }
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      console.error('获取PPT内容失败:', error);
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
          error: `模板文件不存在: ${templateName}`
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

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir && relativePath.endsWith('.xml')) {
          let content = await zipEntry.async('string');
          content = replaceAcrossTextRuns(content, data);
          zip.file(relativePath, content);
        }
      }
      
      const generatedContent = await zip.generateAsync({ type: 'nodebuffer' });
      
      const safeFileName = data.technical_name.replace(/[<>:"/\\|?*]/g, '_');
      const fileName = `${safeFileName}.pptx`;
      const filePath = path.join(__dirname, '..', 'public', 'technology_ppt', fileName);
      
      const technologyPptDir = path.join(__dirname, '..', 'public', 'technology_ppt');
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
      console.error('生成PPT失败:', error);
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
      
      const firstPPTPath = path.join(__dirname, '..', 'public', pptFiles[0].pptUrl);
      const firstPPT = await JSZip.loadAsync(fs.readFileSync(firstPPTPath));
      
      const coverPPTPath = path.join(__dirname, '..', 'public', 'ppt_template', '封面_修复.pptx');
      const coverPPT = await JSZip.loadAsync(fs.readFileSync(coverPPTPath));
      
      const tocPPTPath = path.join(__dirname, '..', 'public', 'ppt_template', '目录.pptx');
      const tocPPT = await JSZip.loadAsync(fs.readFileSync(tocPPTPath));
      
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
      
      const replacedCoverSlide = replaceAcrossTextRuns(coverSlideContent, {
        enterprise: enterpriseName,
        date: dateStr
      });
      
      const tocSlideContent = await tocPPT.file('ppt/slides/slide1.xml').async('string');
      
      let mediaFileCounter = 3;
      const mediaFileMapping = new Map();
      
      for (const [relativePath, file] of Object.entries(coverPPT.files)) {
        if (!file.dir) {
          zip.file(relativePath, file.async('arraybuffer'));
        }
      }
      
      for (const [relativePath, file] of Object.entries(firstPPT.files)) {
        if (relativePath.startsWith('ppt/slides/slide') || relativePath.startsWith('ppt/slides/_rels/slide')) {
          if (relativePath !== 'ppt/slides/slide1.xml' && relativePath !== 'ppt/slides/_rels/slide1.xml.rels') {
            zip.file(relativePath, file.async('arraybuffer'));
          }
        } else if (relativePath.startsWith('ppt/media/') && !file.dir) {
          const ext = relativePath.split('.').pop();
          const baseName = relativePath.split('/').pop().split('.')[0];
          const newMediaName = `image${mediaFileCounter}.${ext}`;
          mediaFileMapping.set(`firstPPT_${baseName}`, newMediaName);
          zip.file(`ppt/media/${newMediaName}`, file.async('arraybuffer'));
          mediaFileCounter++;
        } else if (!relativePath.startsWith('ppt/media/')) {
          if (!file.dir) {
            zip.file(relativePath, file.async('arraybuffer'));
          }
        }
      }
      
      const firstPPTSlideRelsFiles = Object.keys(firstPPT.files).filter(key => 
        key.startsWith('ppt/slides/_rels/slide') && key.endsWith('.rels') && 
        key !== 'ppt/slides/_rels/slide1.xml.rels'
      );
      
      for (const relsFile of firstPPTSlideRelsFiles) {
        let relsContent = await firstPPT.file(relsFile).async('string');
        
        const mediaMatches = relsContent.match(/Target="\.\.\/media\/([^"]+)"/g);
        if (mediaMatches) {
          mediaMatches.forEach(match => {
            const originalMediaName = match.match(/Target="\.\.\/media\/([^"]+)"/)[1];
            const baseName = originalMediaName.split('.')[0];
            const ext = originalMediaName.split('.').pop();
            
            if (mediaFileMapping.has(`firstPPT_${baseName}`)) {
              const newMediaName = mediaFileMapping.get(`firstPPT_${baseName}`);
              relsContent = relsContent.replace(new RegExp(`Target="\.\.\/media/${originalMediaName}"`, 'g'), `Target="../media/${newMediaName}"`);
            }
          });
        }
        
        zip.file(relsFile, relsContent);
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
      
      for (const pptFile of pptFiles) {
        const achievementType = this.classifyAchievementType(pptFile.achievementLabel);
        
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
            
            const mediaMatches = relsContent.match(/Target="\.\.\/media\/([^"]+)"/g);
            if (mediaMatches) {
              for (const match of mediaMatches) {
                const originalMediaName = match.match(/Target="\.\.\/media\/([^"]+)"/)[1];
                const baseName = originalMediaName.split('.')[0];
                const ext = originalMediaName.split('.').pop();
                
                if (!mediaFileMapping.has(`ppt_${baseName}`)) {
                  const newMediaName = `image${mediaFileCounter}.${ext}`;
                  mediaFileMapping.set(`ppt_${baseName}`, newMediaName);
                  
                  const originalMediaFile = `ppt/media/${originalMediaName}`;
                  if (ppt.file(originalMediaFile)) {
                    const mediaContent = await ppt.file(originalMediaFile).async('arraybuffer');
                    zip.file(`ppt/media/${newMediaName}`, mediaContent);
                    mediaFileCounter++;
                  }
                }
              }
              
              for (const match of mediaMatches) {
                const originalMediaName = match.match(/Target="\.\.\/media\/([^"]+)"/)[1];
                const baseName = originalMediaName.split('.')[0];
                
                if (mediaFileMapping.has(`ppt_${baseName}`)) {
                  const newMediaName = mediaFileMapping.get(`ppt_${baseName}`);
                  relsContent = relsContent.replace(new RegExp(`Target="\.\.\/media/${originalMediaName}"`, 'g'), `Target="../media/${newMediaName}"`);
                }
              }
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
      
      zip.file('[Content_Types].xml', newContentTypesXml);
      
      const content = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(outputFilePath, content);
      
      console.log(`产业链PPT已生成: ${outputFilePath}`);
      
      return {
        success: true,
        data: {
          ppt_url: `/chain_ppts/${outputFileName}`,
          file_name: outputFileName
        }
      };
      
    } catch (error) {
      console.error('合并PPT失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  getTechnicalType(type) {
    const typeMap = {
      'Patent': '专利技术',
      'Paper': '学术论文',
      'Project': '科研项目'
    };
    return typeMap[type] || '技术成果';
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
      features.push(`关键词: ${node.keywords.join('、')}`);
    }
    
    if (node.innovation) {
      features.push(`创新点: ${node.innovation}`);
    }
    
    if (node.technical_field) {
      features.push(`技术领域: ${node.technical_field}`);
    }
    
    if (node.authors) {
      features.push(`作者: ${node.authors}`);
    }
    
    return features.length > 0 ? features.join('\n') : '暂无技术特点描述';
  },

  extractTechnicalApplication(node) {
    const applications = [];
    
    if (node.application) {
      applications.push(`应用场景: ${node.application}`);
    }
    
    if (node.achievements) {
      applications.push(`成果: ${node.achievements}`);
    }
    
    if (node.benefits) {
      applications.push(`效益: ${node.benefits}`);
    }
    
    if (node.publication_date) {
      applications.push(`发布时间: ${node.publication_date}`);
    }
    
    return applications.length > 0 ? applications.join('\n') : '暂无应用情况描述';
  },

  async filterAchievementsWithAI(techNeed, achievements) {
    try {
      const achievementsText = achievements.map((a, index) => 
        `${index + 1}. ${a.label}`
      ).join('\n');

      const prompt = `请根据企业技术需求，筛选出最相关的科技成果。

技术需求：${techNeed.label}

科技成果列表：
${achievementsText}

请按照以下标准筛选：
1. 学校成果与技术需求的相关程度是否高（30%）
2. 技术领域是否匹配（30%）
3. 技术方向是否一致（20%）
4. 应用场景是否相关（20%）

请以JSON格式返回结果，只保留相关性评分大于等于80的科技成果（满分100分），格式如下：
{
  "filtered": [
    {
      "index": 数字,
      "score": 评分,
      "reason": "筛选理由"
    }
  ]
}

注意：
- 只返回相关性评分>=7的科技成果
- index对应科技成果列表中的序号（从1开始）
- score是相关性评分（0-10分）
- reason是筛选理由`;

      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的技术匹配专家，擅长评估科技成果与技术需求的相关性。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiContent = response.data.choices[0].message.content;
      console.log(`AI筛选结果 for ${techNeed.label}:`, aiContent);
      
      let filteredResult;
      try {
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          filteredResult = JSON.parse(jsonMatch[0]);
        } else {
          console.error('AI返回内容无法解析为JSON:', aiContent);
          return [];
        }
      } catch (parseError) {
        console.error('解析AI返回内容失败:', parseError);
        return [];
      }

      if (filteredResult && filteredResult.filtered) {
        const filteredIndices = filteredResult.filtered.map(f => f.index - 1);
        const filteredAchievements = achievements.filter((_, index) => 
          filteredIndices.includes(index)
        ).map((achievement, index) => {
          const filteredInfo = filteredResult.filtered.find(f => f.index === index + 1);
          const score = filteredInfo ? filteredInfo.score : 7.5;
          return {
            ...achievement,
            structural_score: (score / 10) * 0.7,
            semantic_score: (score / 10) * 0.8,
            fused_score: score / 10,
            recommendation_reason: filteredInfo ? filteredInfo.reason : 'AI智能匹配推荐',
            matching_path: [techNeed.label, 'AI匹配', achievement.label]
          };
        });
        console.log(`技术需求 "${techNeed.label}" AI筛选后保留 ${filteredAchievements.length}/${achievements.length} 个科技成果`);
        return filteredAchievements;
      }

      return [];
    } catch (error) {
      console.error('AI筛选失败:', error);
      return [];
    }
  },

  async exportChainPPT(driver, enterpriseName) {
    try {
      console.log(`开始导出产业链PPT，企业: ${enterpriseName}`);
      
      const { getChainEnterprises, matchAchievementsForNode } = require('./server');
      
      const chainResult = await getChainEnterprises(enterpriseName);
      
      if (!chainResult.success) {
        return { success: false, error: chainResult.error || '获取产业链企业失败' };
      }
      
      const { enterprise, enterprises: chainEnterprises } = chainResult.data;
      
      const allMatchedAchievements = [];
      const seenIds = new Set();
      
      for (const ent of chainEnterprises) {
        console.log(`正在匹配企业 "${ent.label}" 的技术需求与成果...`);
        
        try {
          const matchResult = await matchAchievementsForNode(ent.label);
          
          if (matchResult.success && matchResult.data.achievements) {
            const achievements = matchResult.data.achievements;
            console.log(`企业 "${ent.label}" 匹配到 ${achievements.length} 个技术成果`);
            
            achievements.forEach(achievement => {
              if (!seenIds.has(achievement.id)) {
                seenIds.add(achievement.id);
                allMatchedAchievements.push({
                  ...achievement,
                  matched_enterprise: ent.label
                });
              }
            });
          } else {
            console.log(`企业 "${ent.label}" 未匹配到技术成果: ${matchResult.error || '无成果'}`);
          }
        } catch (matchError) {
          console.error(`匹配企业 "${ent.label}" 失败:`, matchError.message);
        }
      }
      
      console.log(`产业链共匹配到 ${allMatchedAchievements.length} 个技术成果`);
      
      if (allMatchedAchievements.length === 0) {
        return {
          success: false,
          error: '未找到匹配的技术成果'
        };
      }
      
      const technologyPptDir = path.join(__dirname, '..', 'public', 'technology_ppt');
      let pptFiles = [];
      
      if (fs.existsSync(technologyPptDir)) {
        const files = fs.readdirSync(technologyPptDir).filter(f => f.endsWith('.pptx'));
        
        files.forEach(f => {
          const achievementLabel = f.replace('.pptx', '');
          const matchedAchievement = allMatchedAchievements.find(a => a.label === achievementLabel);
          
          if (matchedAchievement) {
            pptFiles.push({
              pptUrl: `technology_ppt/${f}`,
              achievementLabel: achievementLabel,
              matched_enterprise: matchedAchievement.matched_enterprise,
              fused_score: matchedAchievement.fused_score
            });
          }
        });
      }
      
      console.log(`找到 ${pptFiles.length} 个匹配的PPT文件`);
      
      const sortedPptFiles = [
        ...pptFiles.filter(f => this.classifyAchievementType(f.achievementLabel) === '方法类')
          .sort((a, b) => (b.fused_score || 0) - (a.fused_score || 0)),
        ...pptFiles.filter(f => this.classifyAchievementType(f.achievementLabel) === '技术类')
          .sort((a, b) => (b.fused_score || 0) - (a.fused_score || 0))
      ];
      
      if (sortedPptFiles.length === 0) {
        return {
          success: false,
          error: '未找到匹配的技术成果PPT文件，请先生成技术成果PPT'
        };
      }
      
      const methodCount = sortedPptFiles.filter(f => this.classifyAchievementType(f.achievementLabel) === '方法类').length;
      const techCount = sortedPptFiles.filter(f => this.classifyAchievementType(f.achievementLabel) === '技术类').length;
      
      console.log(`方法类PPT: ${methodCount}个，技术类PPT: ${techCount}个`);
      
      const mergeResult = await this.mergePPTs(
        sortedPptFiles,
        enterpriseName,
        {
          methodCount: methodCount,
          techCount: techCount
        }
      );
      
      return mergeResult;
    } catch (error) {
      console.error('导出产业链PPT失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

module.exports = PPTService;