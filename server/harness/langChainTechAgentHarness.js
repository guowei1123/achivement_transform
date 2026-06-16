const { executeTool } = require('../agentTools');
const { loadProfile, recordRun, buildStrategySummary } = require('./profileStore');

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeUserFacingResponse(content) {
  return String(content || '')
    .replace(/\|+/g, '；')
    .replace(/；\s*；+/g, '；')
    .replace(/\s+；\s+/g, '；')
    .replace(/；\s*([。！？；，、\n])/g, '$1');
}

function shouldResolveChainBeforeSearch(userInput) {
  const text = String(userInput || '');
  return /为.+企业.*服务|企业.*服务|服务.+企业|为.+产业链.*服务|产业链.*服务|服务.+产业链|如何.*服务|怎么.*服务|可以服务|对接.*企业|匹配.*产业需求|服务.*集团|服务.*公司/.test(text);
}

function cloneStreamState(state) {
  return {
    chainLinks: safeArray(state.chainLinks).slice(),
    achievements: safeArray(state.achievements).slice(),
    analysis: state.analysis || '',
    pptUrl: state.pptUrl || '',
    pptFileName: state.pptFileName || '',
    patternId: state.patternId || null,
    toolSequence: safeArray(state.toolSequence).slice(),
    harness: state.harness ? { ...state.harness } : undefined,
  };
}

function updateStateFromTool(state, tool, result) {
  if (tool === 'parse_chain_links' && result.success) {
    state.chainLinks = safeArray(result.chainLinks);
    state.analysis = result.analysis || state.analysis;
  }
  if (tool === 'search_tech' && result.success) {
    state.achievements = safeArray(result.achievements);
  }
  if (tool === 'generate_ppt' && result.success) {
    state.pptUrl = result.ppt_url || '';
    state.pptFileName = result.file_name || '';
  }
}

class LangChainTechAgentHarness {
  constructor({ knowledgeBase }) {
    this.knowledgeBase = knowledgeBase;
  }

  reflectOnStep(step, state) {
    if (!step.result?.success) {
      return `Tool ${step.tool} failed. Retry with narrower parameters or switch to a safer tool.`;
    }
    if (step.tool === 'parse_chain_links') {
      const count = safeArray(step.result.chainLinks).length;
      return count > 0
        ? `Parsed ${count} chain links and can continue to technology search.`
        : 'No chain links were found. Use knowledge base memory or ask the model to infer closest links.';
    }
    if (step.tool === 'search_tech') {
      const total = safeArray(step.result.achievements).length;
      return total > 0
        ? `Retrieved ${total} achievements. Summarize and rank before answering.`
        : 'No achievements found. Consider refining chain links or broadening the search scope.';
    }
    if (step.tool === 'query_knowledge_base') {
      const technologyPPTs = safeArray(step.result.technologyPPTs).length;
      return technologyPPTs > 0
        ? `Knowledge base returned ${technologyPPTs} technology PPT matches. Use the matched PPT content as the primary source.`
        : 'Knowledge base lookup completed. Continue with other tools if more evidence is needed.';
    }
    if (step.tool === 'save_learning') {
      return 'A reusable lesson was saved into memory.';
    }
    if (step.tool === 'generate_ppt') {
      return state.pptUrl ? 'PPT artifact is available.' : 'PPT generation completed.';
    }
    return `Tool ${step.tool} completed successfully.`;
  }

  buildFallbackResponse(state) {
    if (state.achievements.length > 0) {
      const lines = state.achievements.slice(0, 10).map((item, index) => {
        const name = item.label || item.name || `achievement_${index + 1}`;
        const type = item.type ? ` (${item.type})` : '';
        return `${index + 1}. ${name}${type}`;
      });
      return [
        '## 初步结果',
        '',
        state.analysis || '已完成初步分析。',
        '',
        state.chainLinks.length > 0 ? `识别环节：${state.chainLinks.join('、')}` : '',
        '',
        '相关成果：',
        ...lines,
      ].filter(Boolean).join('\n');
    }

    if (state.chainLinks.length > 0) {
      return `已识别产业环节：${state.chainLinks.join('、')}。当前未检索到足够成果，建议继续细化需求关键词。`;
    }

    return '已完成一次规划执行，但当前结果不足以形成稳定推荐。请补充更具体的产业场景、技术方向或目标企业。';
  }

  evaluateRun(finalResponse, state, trace) {
    const toolResults = trace.map((item) => ({
      tool: item.tool,
      success: Boolean(item.result?.success),
    }));
    const successfulTools = toolResults.filter((item) => item.success).length;
    const toolSuccessRate = trace.length > 0 ? successfulTools / trace.length : 0;
    const score = (
      (state.chainLinks.length > 0 ? 0.25 : 0) +
      (state.achievements.length > 0 ? 0.35 : 0) +
      (state.pptUrl ? 0.1 : 0) +
      (finalResponse ? 0.15 : 0) +
      (toolSuccessRate * 0.15)
    );
    const success = Boolean(finalResponse) && (state.chainLinks.length > 0 || state.achievements.length > 0 || trace.length > 0);

    return {
      success,
      score: Number(score.toFixed(3)),
      summary: success
        ? `LangChain run completed with ${state.chainLinks.length} chain links and ${state.achievements.length} achievements.`
        : `LangChain run was weak. chainLinks=${state.chainLinks.length}, achievements=${state.achievements.length}, traceSteps=${trace.length}.`,
      toolSequence: state.toolSequence.slice(),
      toolResults,
    };
  }

  persistLearnings(userInput, state, evaluation, profileSummary) {
    if (state.chainLinks.length > 0) {
      state.patternId = this.knowledgeBase.recordPattern({
        userInput,
        chainLinks: state.chainLinks,
        achievements: state.achievements,
        toolSequence: state.toolSequence,
      });
    }

    if (state.chainLinks.length > 0 && state.achievements.length > 0) {
      this.knowledgeBase.recordLearning({
        category: 'chain_mapping',
        key: userInput.substring(0, 80),
        value: `links=${state.chainLinks.join('|')}; achievements=${state.achievements.length}; sequence=${state.toolSequence.join('>')}`,
        source: 'langchain_harness_auto',
      });

      this.knowledgeBase.recordLearning({
        category: 'tech_search',
        key: state.chainLinks.join('+'),
        value: `achievements=${state.achievements.length}; preferredSequence=${profileSummary.preferredSequence.join('>')}`,
        source: 'langchain_harness_auto',
      });
    }

    this.knowledgeBase.recordLearning({
      category: 'optimization',
      key: `langchain:${new Date().toISOString().slice(0, 10)}`,
      value: `score=${evaluation.score}; success=${evaluation.success}; sequence=${state.toolSequence.join('>')}`,
      source: 'langchain_harness_auto',
    });
  }

  async loadLangChain() {
    const [
      { ChatOpenAI },
      { ChatPromptTemplate, MessagesPlaceholder },
      { AIMessage, HumanMessage },
      { DynamicStructuredTool },
      { createToolCallingAgent, AgentExecutor },
      { z },
    ] = await Promise.all([
      import('@langchain/openai'),
      import('@langchain/core/prompts'),
      import('@langchain/core/messages'),
      import('@langchain/core/tools'),
      import('langchain/agents'),
      import('zod'),
    ]);

    return {
      ChatOpenAI,
      ChatPromptTemplate,
      MessagesPlaceholder,
      AIMessage,
      HumanMessage,
      DynamicStructuredTool,
      createToolCallingAgent,
      AgentExecutor,
      z,
    };
  }

  async emitEvent(options, event) {
    if (typeof options?.onEvent === 'function') {
      await options.onEvent(event);
    }
  }

  async emitContentDeltas(options, content, chunkSize = 6) {
    if (!content || options?.streamContent === false) {
      return false;
    }
    for (let index = 0; index < content.length; index += chunkSize) {
      await this.emitEvent(options, {
        type: 'content_delta',
        data: { chunk: content.slice(index, index + chunkSize) },
      });
    }
    return true;
  }

  buildTools({ DynamicStructuredTool, z }, context, state, trace, options) {
    const makeTool = ({ name, description, schema, normalize }) => new DynamicStructuredTool({
      name,
      description,
      schema,
      func: async (input) => {
        const params = normalize ? normalize(input || {}) : (input || {});
        state.toolSequence.push(name);
        if (name === 'search_tech' && state.requiresChainFirst && state.chainLinks.length === 0) {
          const parseParams = { text: state.originalUserInput || '' };
          state.toolSequence.push('parse_chain_links');
          let parseResult;
          try {
            parseResult = await executeTool('parse_chain_links', parseParams, context);
          } catch (error) {
            parseResult = { success: false, error: error.message };
          }
          updateStateFromTool(state, 'parse_chain_links', parseResult);

          const parseStep = {
            iteration: trace.length + 1,
            tool: 'parse_chain_links',
            params: parseParams,
            thinking: '先解析企业业务或产业链环节，再进行技术匹配。',
            result: parseResult,
            reflection: this.reflectOnStep({ tool: 'parse_chain_links', result: parseResult }, state),
          };
          trace.push(parseStep);
          await this.emitEvent(options, {
            type: 'step',
            data: {
              step: parseStep,
              state: cloneStreamState(state),
              trace: trace.slice(),
            },
          });
          if (state.chainLinks.length > 0) {
            params.chainLinks = state.chainLinks;
          }
        }
        let result;
        try {
          result = await executeTool(name, params, context);
        } catch (error) {
          result = { success: false, error: error.message };
        }
        updateStateFromTool(state, name, result);

        const step = {
          iteration: trace.length + 1,
          tool: name,
          params,
          thinking: '',
          result,
          reflection: this.reflectOnStep({ tool: name, result }, state),
        };
        trace.push(step);
        await this.emitEvent(options, {
          type: 'step',
          data: {
            step,
            state: cloneStreamState(state),
            trace: trace.slice(),
          },
        });
        return JSON.stringify(result);
      },
    });

    return [
      makeTool({
        name: 'query_knowledge_base',
        description: '查询知识库、历史经验、public/technology_ppt 下的技术PPT内容。介绍技术成果、原理、特点、应用时必须先调用此工具；若返回 technologyPPTs，回答必须以其 summary/excerpt/content 为主要依据。',
        schema: z.object({ query: z.string().describe('用户需求或查询关键词') }),
      }),
      makeTool({
        name: 'parse_chain_links',
        description: '从用户需求中解析产业环节。产业环节不明确时先调用此工具。',
        schema: z.object({ text: z.string().describe('需要解析的用户需求文本') }),
      }),
      makeTool({
        name: 'search_tech',
        description: '根据产业环节检索相关技术成果。',
        schema: z.object({ chainLinks: z.array(z.string()).describe('产业环节名称列表') }),
        normalize: (input) => ({
          chainLinks: safeArray(input.chainLinks).length > 0 ? input.chainLinks : state.chainLinks,
        }),
      }),
      makeTool({
        name: 'generate_ppt',
        description: '根据已检索到的技术成果生成汇报PPT。',
        schema: z.object({
          chainLinks: z.array(z.string()).optional().describe('产业环节名称列表'),
          achievements: z.array(z.any()).optional().describe('技术成果列表'),
          enterpriseName: z.string().optional().describe('企业名称或汇报标题'),
        }),
        normalize: (input) => ({
          chainLinks: safeArray(input.chainLinks).length > 0 ? input.chainLinks : state.chainLinks,
          achievements: safeArray(input.achievements).length > 0 ? input.achievements : state.achievements,
          enterpriseName: input.enterpriseName,
        }),
      }),
      makeTool({
        name: 'save_learning',
        description: '保存本次处理中可复用的映射、检索或用户偏好经验。',
        schema: z.object({
          category: z.enum(['chain_mapping', 'tech_search', 'user_preference', 'optimization']),
          key: z.string(),
          value: z.string(),
          source: z.string().optional(),
        }),
      }),
    ];
  }

  buildChatHistory(conversationHistory, HumanMessage, AIMessage) {
    return safeArray(conversationHistory).map((item) => {
      if (item.role === 'assistant') {
        return new AIMessage(item.content || '');
      }
      return new HumanMessage(item.content || '');
    });
  }

  async run(userInput, context, conversationHistory = [], options = {}) {
    const profile = loadProfile();
    const profileSummary = buildStrategySummary(profile);
    const lc = await this.loadLangChain();
    const {
      ChatOpenAI,
      ChatPromptTemplate,
      MessagesPlaceholder,
      createToolCallingAgent,
      AgentExecutor,
      HumanMessage,
      AIMessage,
    } = lc;

    const state = {
      chainLinks: [],
      achievements: [],
      analysis: '',
      pptUrl: '',
      pptFileName: '',
      patternId: null,
      toolSequence: [],
      originalUserInput: userInput,
      requiresChainFirst: shouldResolveChainBeforeSearch(userInput),
      harness: {
        framework: 'langchain',
        profileVersion: profile.version,
        recentAdjustments: profileSummary.recentAdjustments,
      },
    };
    const trace = [];

    await this.emitEvent(options, {
      type: 'start',
      data: {
        framework: 'langchain',
        strategy: profileSummary,
        maxIterations: Math.max(4, Math.min(profileSummary.maxIterations || 8, 10)),
      },
    });

    const model = new ChatOpenAI({
      apiKey: context.DEEPSEEK_API_KEY,
      model: 'deepseek-chat',
      temperature: 0.4,
      maxTokens: 3000,
      configuration: {
        baseURL: 'https://api.deepseek.com/v1',
      },
    });
    const tools = this.buildTools(lc, context, state, trace, options);
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', [
        '你是基于 LangChain 工具调用框架运行的 TechAgent。',
        '你需要用中文 Markdown 回复用户。',
        '新任务优先查询知识库；产业环节不明确时先解析产业环节，再检索技术成果。',
        '当用户询问“如何为企业服务”“学校成果可以服务哪些企业/集团/公司”“如何服务产业链”“为某产业链环节提供技术服务”等问题时，必须先调用 parse_chain_links 解析企业当前业务、需求场景或产业链环节；只有得到环节后才能调用 search_tech 做技术匹配。',
        '这类服务型问题的最终回答顺序必须是：先说明企业业务/产业链环节识别结果，再说明技术成果匹配结果，最后给出服务建议或汇报PPT生成建议。',
        '当用户要求介绍某项图谱技术成果、技术原理、技术特点或应用成果时，必须优先调用 query_knowledge_base，并基于 public/technology_ppt 中命中的 PPT 内容作答。',
        '如果 query_knowledge_base 返回 technologyPPTs，最终回答必须引用这些 PPT 的 summary/excerpt/content 组织，不得脱离 PPT 内容编造。',
        '当用户明确要求生成汇报PPT，且已有技术成果时，调用 generate_ppt。',
        '工具返回结果后，综合证据给出最终答案，不要暴露内部 JSON。',
        '面向用户的回复不要使用竖线符号 | 作为段落、分类或关键词分隔；需要分类时使用中文分号“；”、顿号“、”、句号“。”或换行列表。',
        `当前策略：preferredSequence=${profileSummary.preferredSequence.join(' -> ') || 'none'}; maxIterations=${profileSummary.maxIterations}`,
        this.knowledgeBase.getKnowledgeContext(userInput),
      ].filter(Boolean).join('\n')],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);
    const agent = await createToolCallingAgent({ llm: model, tools, prompt });
    const executor = new AgentExecutor({
      agent,
      tools,
      maxIterations: Math.max(4, Math.min(profileSummary.maxIterations || 8, 10)),
      returnIntermediateSteps: true,
    });

    const result = await executor.invoke({
      input: userInput,
      chat_history: this.buildChatHistory(conversationHistory, HumanMessage, AIMessage),
    });

    let finalResponse = result.output || '';
    if (!finalResponse) {
      finalResponse = this.buildFallbackResponse(state);
    }
    finalResponse = normalizeUserFacingResponse(finalResponse);
    const contentStreamed = await this.emitContentDeltas(options, finalResponse);
    const evaluation = this.evaluateRun(finalResponse, state, trace);
    const updatedProfile = recordRun(profile, evaluation);
    const updatedSummary = buildStrategySummary(updatedProfile);
    this.persistLearnings(userInput, state, evaluation, updatedSummary);
    state.harness = {
      ...state.harness,
      profileVersion: updatedProfile.version,
      evaluation,
      strategy: updatedSummary,
    };

    return {
      success: true,
      content: finalResponse,
      state,
      trace,
      iterations: trace.length,
      contentStreamed,
    };
  }
}

module.exports = {
  LangChainTechAgentHarness,
};
