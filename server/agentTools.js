const axios = require('axios');

const TOOL_DEFINITIONS = [
  {
    name: 'parse_chain_links',
    description: '从用户输入中解析涉及的产业环节。',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '需要解析的用户输入文本' }
      },
      required: ['text']
    }
  },
  {
    name: 'search_tech',
    description: '根据产业环节搜索相关技术成果。',
    parameters: {
      type: 'object',
      properties: {
        chainLinks: {
          type: 'array',
          items: { type: 'string' },
          description: '产业环节名称列表'
        }
      },
      required: ['chainLinks']
    }
  },
  {
    name: 'generate_ppt',
    description: '将技术成果汇总成汇报PPT。该工具只复用 public/technology_ppt 中已有的对应技术PPT，不会为缺失成果临时生成技术PPT。',
    parameters: {
      type: 'object',
      properties: {
        chainLinks: {
          type: 'array',
          items: { type: 'string' },
          description: '产业环节名称列表'
        },
        achievements: {
          type: 'array',
          description: '技术成果列表'
        },
        enterpriseName: {
          type: 'string',
          description: '企业名称或汇报标题'
        }
      },
      required: ['chainLinks', 'achievements']
    }
  },
  {
    name: 'query_knowledge_base',
    description: '查询知识库和 public/technology_ppt 中的技术PPT内容。介绍技术成果、原理、特点或应用时必须优先使用命中的PPT内容。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '查询关键词' }
      },
      required: ['query']
    }
  },
  {
    name: 'save_learning',
    description: '保存本次处理中可复用的映射、检索或用户偏好经验。',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['chain_mapping', 'tech_search', 'user_preference', 'optimization'],
          description: '经验类别'
        },
        key: { type: 'string', description: '经验关键词或标题' },
        value: { type: 'string', description: '经验内容' },
        source: { type: 'string', description: '经验来源' }
      },
      required: ['category', 'key', 'value']
    }
  }
];

function ensureApiKey(apiKey) {
  if (!apiKey || String(apiKey).trim() === '') {
    throw new Error('缺少 DEEPSEEK_API_KEY 环境变量，请配置后重试');
  }
}

function extractJsonObject(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }
  return JSON.parse(match[0]);
}

async function executeTool(toolName, params, context) {
  const {
    DEEPSEEK_API_KEY,
    PPTService,
    knowledgeBase,
    getChainNodesFromDB,
    searchTechInFusionGraph
  } = context;

  switch (toolName) {
    case 'parse_chain_links': {
      ensureApiKey(DEEPSEEK_API_KEY);
      const chainNodes = await getChainNodesFromDB();
      const chainNodeNames = chainNodes.map((node) => node.name).filter(Boolean);
      const kbContext = knowledgeBase.getKnowledgeContext(params.text);

      const prompt = `你是一名产业分析专家。请根据用户输入识别涉及的产业环节。

当前图谱中可选产业环节如下：
${chainNodeNames.join('、')}

${kbContext}

要求：
1. chainLinks 必须优先从上述产业环节中选择。
2. 如果用户表达不完全一致，请选择最接近的已有产业环节。
3. 只返回 JSON，不要返回额外文字。

用户输入：
${params.text}

JSON 格式：
{
  "chainLinks": ["产业环节1", "产业环节2"],
  "analysis": "简要说明匹配依据"
}`;

      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: '你擅长从需求文本中识别产业环节，并严格输出 JSON。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1500
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`
          },
          proxy: false
        }
      );

      const aiContent = response.data.choices[0].message.content;
      const parsed = extractJsonObject(aiContent);
      if (!parsed) {
        return { success: false, error: 'AI 返回格式错误', rawContent: aiContent };
      }

      const validLinks = (parsed.chainLinks || []).filter((link) =>
        chainNodeNames.some((name) => name.includes(link) || link.includes(name))
      );

      return {
        success: true,
        chainLinks: validLinks.length > 0 ? validLinks : (parsed.chainLinks || []),
        analysis: parsed.analysis || '',
        availableChainNodes: chainNodeNames
      };
    }

    case 'search_tech': {
      const achievements = await searchTechInFusionGraph(params.chainLinks || []);
      return {
        success: true,
        chainLinks: params.chainLinks || [],
        achievements,
        total: achievements.length
      };
    }

    case 'generate_ppt': {
      if (!params.achievements || params.achievements.length === 0) {
        return { success: false, error: '没有可汇总PPT的成果数据' };
      }

      const result = await PPTService.generateAgentReportPPT({
        achievements: params.achievements,
        enterpriseName: params.enterpriseName,
        chainLinks: params.chainLinks || []
      });

      if (!result.success) {
        return { success: false, error: result.error || 'PPT汇总失败' };
      }

      return {
        success: true,
        ppt_url: result.data.ppt_url,
        file_name: result.data.file_name,
        total_slides: result.data.total_slides,
        total_achievements: result.data.total_achievements,
        missing_ppts: result.data.missing_ppts || [],
        chain_links: result.data.chain_links || []
      };
    }

    case 'query_knowledge_base': {
      const similarPatterns = knowledgeBase.searchPatterns(params.query);
      const chainLearnings = knowledgeBase.getRelevantLearnings('chain_mapping', params.query);
      const techLearnings = knowledgeBase.getRelevantLearnings('tech_search', params.query);
      const technologyPPTs = await knowledgeBase.searchTechnologyPPTs(params.query, 5);

      return {
        success: true,
        similarPatterns: similarPatterns.map((pattern) => ({
          userInput: pattern.userInput,
          chainLinks: pattern.chainLinks,
          achievementCount: pattern.achievementCount,
          corrected: pattern.corrected
        })),
        chainLearnings: chainLearnings.map((learning) => ({ key: learning.key, value: learning.value })),
        techLearnings: techLearnings.map((learning) => ({ key: learning.key, value: learning.value })),
        technologyPPTs: technologyPPTs.map((item) => ({
          title: item.title,
          file_name: item.file_name,
          ppt_url: item.ppt_url,
          slide_count: item.slide_count,
          summary: item.summary,
          excerpt: item.excerpt,
          content: item.content,
          score: item.score
        }))
      };
    }

    case 'save_learning': {
      const id = knowledgeBase.recordLearning({
        category: params.category,
        key: params.key,
        value: params.value,
        source: params.source || 'agent'
      });
      return { success: true, learningId: id };
    }

    default:
      return { success: false, error: `未知工具: ${toolName}` };
  }
}

module.exports = {
  TOOL_DEFINITIONS,
  executeTool
};
