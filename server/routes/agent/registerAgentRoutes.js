const axios = require('axios');

const { getChainNodesFromDB, searchTechInFusionGraph } = require('../../services/graphService');

function registerAgentRoutes(app, context) {
  const {
    graphStore,
    redisClient,
    PPTService,
    runAgent,
    knowledgeBase,
    runtime,
    recordAgentFeedback,
    getAgentProfile,
    getRawAgentProfile,
  } = context;

  app.post('/api/agent/parse-chain-links', async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: '请输入文本内容' });
    }

    try {
      const chainNodes = await getChainNodesFromDB(graphStore);
      const chainNodeNames = chainNodes.map((node) => node.name);
      const prompt = `你是产业链分析助手。请从用户文本中识别可能对应的产业环节，候选环节如下：

${chainNodeNames.join('、')}

用户文本：
${text}

请只返回 JSON：
{
  "chainLinks": ["环节1", "环节2"],
  "analysis": "简要分析"
}`;

      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: '你擅长从中文业务描述中识别产业链环节。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${runtime.DEEPSEEK_API_KEY}`,
          },
        }
      );

      const aiContent = response.data.choices[0].message.content;
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(500).json({ success: false, error: 'AI 返回格式错误' });
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validLinks = (parsed.chainLinks || []).filter((link) =>
        chainNodeNames.some((name) => name.includes(link) || link.includes(name))
      );

      res.json({
        success: true,
        data: {
          chainLinks: validLinks.length > 0 ? validLinks : (parsed.chainLinks || []),
          analysis: parsed.analysis || '',
          availableChainNodes: chainNodeNames,
        },
      });
    } catch (error) {
      console.error('解析产业环节失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/agent/search-tech', async (req, res) => {
    const { chainLinks } = req.body;
    if (!Array.isArray(chainLinks) || chainLinks.length === 0) {
      return res.status(400).json({ success: false, error: '请提供产业环节列表' });
    }

    try {
      const achievements = await searchTechInFusionGraph(graphStore, chainLinks);
      res.json({
        success: true,
        data: {
          chainLinks,
          achievements,
          total: achievements.length,
        },
      });
    } catch (error) {
      console.error('技术搜索失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/agent/generate-report-ppt', async (req, res) => {
    const { chainLinks, achievements, enterpriseName } = req.body;
    if (!achievements || achievements.length === 0) {
      return res.status(400).json({ success: false, error: '没有可生成 PPT 的成果数据' });
    }

    try {
      const result = await PPTService.generateAgentReportPPT({
        achievements,
        enterpriseName,
        chainLinks
      });

      if (!result.success) {
        return res.status(500).json(result);
      }

      res.json({
        success: true,
        data: {
          ppt_url: result.data.ppt_url,
          file_name: result.data.file_name,
          total_slides: result.data.total_slides,
          total_achievements: result.data.total_achievements,
          chain_links: result.data.chain_links,
        },
      });
    } catch (error) {
      console.error('生成汇报 PPT 失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/agent/chat', async (req, res) => {
    const { messages, context: agentContext } = req.body;
    if (!messages || messages.length === 0) {
      return res.status(400).json({ success: false, error: '请提供对话消息' });
    }

    try {
      const chainNodes = await getChainNodesFromDB(graphStore);
      const chainNodeNames = chainNodes.map((node) => node.name);
      const systemPrompt = `你是科技服务智能体 TechAgent，负责：

1. 识别用户描述涉及的产业环节
2. 根据环节搜索相关技术成果
3. 组织结果并生成汇报 PPT

当前可参考的产业环节：
${chainNodeNames.join('、')}

请用简洁的 Markdown 回复。`;

      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map((message) => ({ role: message.role, content: message.content })),
          ],
          temperature: 0.7,
          max_tokens: 2000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${runtime.DEEPSEEK_API_KEY}`,
          },
        }
      );

      res.json({
        success: true,
        data: {
          content: response.data.choices[0].message.content,
          chainLinks: agentContext?.chainLinks || [],
        },
      });
    } catch (error) {
      console.error('智能体对话失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/agent/chat-history', async (req, res) => {
    const { sessionId, title, messages, workflowState } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: '缺少会话 ID' });
    }

    try {
      const historyKey = `chat_history:${sessionId}`;
      const now = new Date().toISOString();
      const historyData = {
        sessionId,
        title: title || '新对话',
        messages: messages || [],
        workflowState: workflowState || {},
        updatedAt: now,
        createdAt: now,
      };

      const existing = await redisClient.get(historyKey);
      if (existing) {
        historyData.createdAt = JSON.parse(existing).createdAt;
      }

      await redisClient.set(historyKey, JSON.stringify(historyData));
      await redisClient.zAdd('chat_sessions', [{ score: Date.now(), value: sessionId }]);
      await redisClient.expire(historyKey, 86400 * 30);
      res.json({ success: true, data: { sessionId, updatedAt: now } });
    } catch (error) {
      console.error('保存对话历史失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/agent/chat-histories', async (req, res) => {
    try {
      const sessionIds = await redisClient.zRange('chat_sessions', 0, -1);
      sessionIds.reverse();
      const histories = [];

      for (const sessionId of sessionIds) {
        const data = await redisClient.get(`chat_history:${sessionId}`);
        if (!data) {
          await redisClient.zRem('chat_sessions', sessionId);
          continue;
        }

        const parsed = JSON.parse(data);
        histories.push({
          sessionId: parsed.sessionId,
          title: parsed.title,
          messageCount: parsed.messages?.length || 0,
          workflowStep: parsed.workflowState?.step || 0,
          chainLinks: parsed.workflowState?.chainLinks || [],
          updatedAt: parsed.updatedAt,
          createdAt: parsed.createdAt,
        });
      }

      res.json({ success: true, data: histories });
    } catch (error) {
      console.error('获取对话历史列表失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/agent/chat-history/:sessionId', async (req, res) => {
    try {
      const data = await redisClient.get(`chat_history:${req.params.sessionId}`);
      if (!data) {
        return res.status(404).json({ success: false, error: '对话历史不存在' });
      }
      res.json({ success: true, data: JSON.parse(data) });
    } catch (error) {
      console.error('获取对话历史详情失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/agent/chat-history/:sessionId', async (req, res) => {
    try {
      await redisClient.del(`chat_history:${req.params.sessionId}`);
      await redisClient.zRem('chat_sessions', req.params.sessionId);
      res.json({ success: true, message: '对话历史已删除' });
    } catch (error) {
      console.error('删除对话历史失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/agent/autonomous', async (req, res) => {
    const { message, conversationHistory } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: '请输入消息内容' });
    }

    try {
      const result = await runAgent(
        message,
        {
          graphStore,
          DEEPSEEK_API_KEY: runtime.DEEPSEEK_API_KEY,
          PPTService,
          knowledgeBase,
          getChainNodesFromDB: () => getChainNodesFromDB(graphStore),
          searchTechInFusionGraph: (chainLinks) => searchTechInFusionGraph(graphStore, chainLinks),
        },
        conversationHistory || []
      );

      res.json({
        success: true,
        data: {
          content: result.content,
          state: result.state,
          trace: result.trace,
          iterations: result.iterations,
        },
      });
    } catch (error) {
      console.error('自主规划 Agent 执行失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/agent/autonomous-stream', async (req, res) => {
    const { message, conversationHistory } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }

    const writeEvent = (type, data) => {
      res.write(`${JSON.stringify({ type, data })}\n`);
      if (typeof res.flush === 'function') {
        res.flush();
      }
    };

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.socket && typeof res.socket.setNoDelay === 'function') {
      res.socket.setNoDelay(true);
    }
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }
    res.write(' '.repeat(2048) + '\n');

    try {
      const result = await runAgent(
        message,
        {
          graphStore,
          DEEPSEEK_API_KEY: runtime.DEEPSEEK_API_KEY,
          PPTService,
          knowledgeBase,
          getChainNodesFromDB: () => getChainNodesFromDB(graphStore),
          searchTechInFusionGraph: (chainLinks) => searchTechInFusionGraph(graphStore, chainLinks),
        },
        conversationHistory || [],
        {
          onEvent: async (event) => {
            writeEvent(event.type, event.data);
          },
        }
      );

      writeEvent('final', {
        content: result.content || '',
        state: result.state,
        trace: result.trace,
        iterations: result.iterations,
        contentStreamed: result.contentStreamed,
      });
      writeEvent('done', { success: true });
      res.end();
    } catch (error) {
      console.error('Streaming agent failed:', error);
      writeEvent('error', { message: error.message });
      res.end();
    }
  });

  app.post('/api/agent/feedback', async (req, res) => {
    try {
      const result = recordAgentFeedback(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('保存反馈失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/agent/knowledge-stats', async (req, res) => {
    try {
      const patterns = knowledgeBase.loadPatterns();
      const feedback = knowledgeBase.loadFeedback();
      const learnings = knowledgeBase.loadLearnings();
      const technologyPPTStats = knowledgeBase.getTechnologyPPTStats();

      res.json({
        success: true,
        data: {
          patternCount: patterns.length,
          feedbackCount: feedback.length,
          learningCount: learnings.length,
          technologyPptCount: technologyPPTStats.count,
          technologyPptUpdatedAt: technologyPPTStats.updatedAt,
          harness: getAgentProfile(),
          recentPatterns: patterns.slice(-5).reverse(),
          topLearnings: learnings
            .sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0))
            .slice(0, 10),
        },
      });
    } catch (error) {
      console.error('获取知识库统计失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.get('/api/agent/harness-profile', async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          summary: getAgentProfile(),
          profile: getRawAgentProfile(),
        },
      });
    } catch (error) {
      console.error('Failed to fetch harness profile:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = {
  registerAgentRoutes,
};
