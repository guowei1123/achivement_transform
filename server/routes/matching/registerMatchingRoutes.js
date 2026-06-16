const axios = require('axios');

const { filterAchievementsWithAI } = require('../../services/matchingAiService');

function extractListFromText(text) {
  const jsonMatch = String(text || '').match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  }

  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[\.\)、\)]?\s*/, '').trim())
    .filter(Boolean);
}

function buildNeedKeywords(need) {
  return String(need || '')
    .split(/[\s,，;；、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAchievement(item) {
  return {
    id: item.id,
    label: item.label || item.name,
    name: item.name || item.label,
    type: item.type,
    nodeType: item.nodeType,
    category: item.category,
    patent_number: item.patent_number || '',
    team: item.team || '',
    university: item.university || '',
    transferable: item.transferable !== false,
    cooperation_modes: item.cooperation_modes || ['技术转让'],
    keywords: item.keywords || [],
  };
}

function registerMatchingRoutes(app, context) {
  const { graphStore, runtime } = context;

  app.get('/api/node-tech-needs/:nodeLabel', async (req, res) => {
    const { nodeLabel } = req.params;

    try {
      const node = (await graphStore.getNodes({ label: nodeLabel }))[0];
      if (!node) {
        return res.status(404).json({ success: false, error: '节点不存在' });
      }

      const relationGraph = await graphStore.findNeighbors(node.id || node.label || node.name, { maxDepth: 1 });
      const techNeeds = relationGraph.nodes
        .filter((item) => item !== node && item.type === 'technical requirements')
        .map((item) => ({
          id: item.id,
          label: item.label || item.name,
          type: item.type,
          category: item.category,
        }));

      const allAchievements = (await graphStore.getNodes({ types: ['Patent', 'Paper', 'Project'] }))
        .slice(0, 100)
        .map(normalizeAchievement);

      const nodes = [node, ...techNeeds, ...allAchievements];
      const edges = techNeeds.map((need) => ({
        source: node.id,
        target: need.id,
        label: '存在技术需求',
      }));

      try {
        await axios.post(`${runtime.MATCHING_ENGINE_URL}/initialize`, {
          nodes,
          edges,
          config: {
            device: 'cpu',
            structural_weight: 0.6,
            semantic_weight: 0.4,
          },
        });

        const matchResults = [];
        for (const techNeed of techNeeds) {
          const matchResponse = await axios.post(`${runtime.MATCHING_ENGINE_URL}/match`, {
            demand: techNeed,
            top_k: 10,
          });

          if (!matchResponse.data.success) {
            continue;
          }

          for (const recommendation of matchResponse.data.recommendations) {
            matchResults.push({
              demand_id: techNeed.id,
              achievement_id: recommendation.achievement.id,
              structural_score: recommendation.matching_scores.structural_score,
              semantic_score: recommendation.matching_scores.semantic_score,
              fused_score: recommendation.matching_scores.fused_score,
              recommendation_reason: recommendation.recommendation_reason,
              matching_path: recommendation.matching_path,
            });
            edges.push({
              source: techNeed.id,
              target: recommendation.achievement.id,
              label: '智能匹配推荐',
            });
          }
        }

        const matchedAchievements = [];
        matchResults.forEach((match) => {
          const achievement = allAchievements.find((item) => item.id === match.achievement_id);
          if (achievement && !matchedAchievements.find((item) => item.id === achievement.id)) {
            matchedAchievements.push({
              ...achievement,
              structural_score: match.structural_score,
              semantic_score: match.semantic_score,
              fused_score: match.fused_score,
              recommendation_reason: match.recommendation_reason,
              matching_path: match.matching_path,
            });
          }
        });

        return res.json({
          success: true,
          data: {
            node,
            techNeeds,
            achievements: matchedAchievements,
            nodes: [node, ...techNeeds, ...matchedAchievements],
            edges,
            matchResults,
          },
        });
      } catch (matchingError) {
        console.error('Matching engine unavailable, using AI fallback:', matchingError.message);

        const achievements = [];
        const matchEdges = [];
        const matchResults = [];

        for (const techNeed of techNeeds) {
          const filteredAchievements = await filterAchievementsWithAI(techNeed, allAchievements, runtime);
          filteredAchievements.forEach((achievement) => {
            achievements.push(achievement);
            matchEdges.push({
              source: techNeed.id,
              target: achievement.id,
              label: '智能匹配推荐',
            });
            matchResults.push({
              demand_id: techNeed.id,
              achievement_id: achievement.id,
              structural_score: achievement.structural_score || 0.7,
              semantic_score: achievement.semantic_score || 0.8,
              fused_score: achievement.fused_score || 0.75,
              recommendation_reason: achievement.recommendation_reason || 'AI 根据需求语义给出的候选结果',
              matching_path: achievement.matching_path || [techNeed.label, 'AI 匹配', achievement.label],
            });
          });
        }

        return res.json({
          success: true,
          data: {
            node,
            techNeeds,
            achievements,
            nodes: [node, ...techNeeds, ...achievements],
            edges: [...edges, ...matchEdges],
            matchResults,
          },
        });
      }
    } catch (error) {
      console.error('Failed to query node tech needs:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/analyze-demand', async (req, res) => {
    try {
      const { demand } = req.body;
      if (!demand || !String(demand).trim()) {
        return res.status(400).json({ success: false, error: '请提供需求描述' });
      }

      const deepseekResponse = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是技术需求分析助手，请将模糊需求拆解为 3 到 5 条可执行、可检索的技术子需求，尽量返回 JSON 数组。',
            },
            {
              role: 'user',
              content: `请分析下面的技术需求，并给出更具体的拆解结果：\n\n${demand}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            Authorization: `Bearer ${runtime.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const preciseNeeds = extractListFromText(deepseekResponse.data.choices[0].message.content);
      const allAchievements = (await graphStore.getNodes({ types: ['Patent', 'Paper', 'Project'], limit: 20 }))
        .map(normalizeAchievement);
      const achievements = [];

      preciseNeeds.forEach((need, needIndex) => {
        const needKeywords = buildNeedKeywords(need);

        allAchievements.forEach((achievement) => {
          const keywords = Array.isArray(achievement.keywords) ? achievement.keywords : [];
          const searchable = [achievement.label, achievement.name, achievement.category, ...keywords].filter(Boolean);
          const matchScore = needKeywords.filter((keyword) =>
            searchable.some((field) => String(field).includes(keyword) || keyword.includes(String(field)))
          ).length;

          if (matchScore <= 0) {
            return;
          }

          const existingAchievement = achievements.find((item) => item.id === achievement.id);
          if (existingAchievement) {
            if (!existingAchievement.matchedNeeds.includes(needIndex)) {
              existingAchievement.matchedNeeds.push(needIndex);
            }
            return;
          }

          achievements.push({
            ...achievement,
            matchedNeeds: [needIndex],
          });
        });
      });

      res.json({
        success: true,
        data: {
          preciseNeeds,
          achievements,
        },
      });
    } catch (error) {
      console.error('Failed to analyze demand:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/matching-feedback', async (req, res) => {
    try {
      const { demand_id, achievement_id, feedback_type, scores } = req.body;
      await axios.post(`${runtime.MATCHING_ENGINE_URL}/feedback`, {
        demand_id,
        achievement_id,
        feedback_type,
        scores: scores || {},
      });
      res.json({ success: true, message: '反馈已保存' });
    } catch (error) {
      console.error('Failed to save matching feedback:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/matching-performance', async (req, res) => {
    try {
      const performanceResponse = await axios.get(`${runtime.MATCHING_ENGINE_URL}/performance`);
      res.json({ success: true, performance: performanceResponse.data.report });
    } catch (error) {
      console.error('Failed to get matching performance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/matching-stats', async (req, res) => {
    try {
      const statsResponse = await axios.get(`${runtime.MATCHING_ENGINE_URL}/stats`);
      res.json({ success: true, stats: statsResponse.data.stats });
    } catch (error) {
      console.error('Failed to get matching stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/export-matching-results', async (req, res) => {
    try {
      const { recommendations, format } = req.body;
      const exportResponse = await axios.post(`${runtime.MATCHING_ENGINE_URL}/export`, {
        recommendations,
        format: format || 'json',
      });
      res.json({
        success: true,
        content: exportResponse.data.content,
        format: exportResponse.data.format,
      });
    } catch (error) {
      console.error('Failed to export matching results:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = {
  registerMatchingRoutes,
};
