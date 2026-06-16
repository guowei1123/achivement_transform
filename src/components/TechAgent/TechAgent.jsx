import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { api } from '../../utils/api'

import './TechAgent.css'

function generateSessionId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)
}

const TOOL_LABELS = {
  query_knowledge_base: '查询知识库',
  parse_chain_links: '解析产业环节',
  search_tech: '搜索技术成果',
  generate_ppt: '生成汇报PPT',
  save_learning: '保存学习经验',
  respond_to_user: '生成回复'
}

function TechAgent() {
  const [sessionId, setSessionId] = useState(generateSessionId())
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '您好！我是**自主规划型科技服务智能体 TechAgent**，基于 DeepSeek 大模型构建，具备知识库记忆和自主学习能力。\n\n我可以帮助您：\n\n- 🧠 **自主规划**：根据您的需求，自主决定执行步骤和工具调用顺序\n- 🔍 **产业环节解析**：分析文本，识别涉及的产业环节\n- 📊 **技术成果搜索**：根据产业环节搜索相关技术成果\n- 📄 **汇报PPT生成**：将技术成果汇总生成汇报PPT\n- 💾 **知识库学习**：从每次交互中积累经验，持续优化服务质量\n\n请输入您的需求文本，我将自主规划并执行任务。'
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const [showHistory, setShowHistory] = useState(false)

  const [workflowState, setWorkflowState] = useState({
    step: 0,
    chainLinks: [],
    achievements: [],
    analysis: '',
    pptUrl: '',
    pptFileName: '',
    patternId: null
  })

  const [agentTrace, setAgentTrace] = useState([])
  const [currentThinking, setCurrentThinking] = useState('')
  const [generatingPPT, setGeneratingPPT] = useState(false)
  const [chatHistories, setChatHistories] = useState([])
  const [knowledgeStats, setKnowledgeStats] = useState(null)
  const [showKnowledgePanel, setShowKnowledgePanel] = useState(false)

  const saveTimerRef = useRef(null)
  const typewriterQueueRef = useRef('')
  const typewriterTimerRef = useRef(null)
  const displayedContentRef = useRef('')
  const workflowStateRef = useRef(workflowState)

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentThinking])

  useEffect(() => {
    loadChatHistories()
    loadKnowledgeStats()
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadChatHistories = async () => {
    try {
      const result = await api.getChatHistories()
      if (result.success) {
        setChatHistories(result.data)
      }
    } catch (e) {
      console.error('加载历史记录失败:', e)
    }
  }

  const loadKnowledgeStats = async () => {
    try {
      const result = await api.getKnowledgeStats()
      if (result.success) {
        setKnowledgeStats(result.data)
      }
    } catch (e) {
      console.error('加载知识库统计失败:', e)
    }
  }

  const buildWorkflowState = useCallback((prev, state) => {
    const merged = {
      ...prev,
      chainLinks: state?.chainLinks || prev.chainLinks,
      achievements: state?.achievements || prev.achievements,
      analysis: state?.analysis || prev.analysis,
      pptUrl: state?.pptUrl || prev.pptUrl,
      pptFileName: state?.pptFileName || prev.pptFileName,
      patternId: state?.patternId || prev.patternId
    }

    merged.step = merged.pptUrl ? 3 :
      (merged.achievements && merged.achievements.length > 0) ? 2 :
        (merged.chainLinks && merged.chainLinks.length > 0) ? 1 : 0

    return merged
  }, [])

  const applyWorkflowState = useCallback((state) => {
    if (!state) return

    setWorkflowState(prev => buildWorkflowState(prev, state))
  }, [buildWorkflowState])

  const updateMessageContent = useCallback((messageId, updater) => {
    setMessages(prev => prev.map(message => {
      if (message.id !== messageId) return message
      const nextContent = typeof updater === 'function'
        ? updater(message.content || '')
        : updater
      return {
        ...message,
        content: nextContent
      }
    }))
  }, [])

  const stopTypewriter = useCallback(() => {
    if (typewriterTimerRef.current) {
      clearInterval(typewriterTimerRef.current)
      typewriterTimerRef.current = null
    }
    typewriterQueueRef.current = ''
  }, [])

  useEffect(() => () => {
    stopTypewriter()
  }, [stopTypewriter])

  const resetTypewriter = useCallback(() => {
    stopTypewriter()
    displayedContentRef.current = ''
  }, [stopTypewriter])

  const enqueueAssistantText = useCallback((messageId, text) => {
    if (!text) return

    typewriterQueueRef.current += text
    if (typewriterTimerRef.current) return

    typewriterTimerRef.current = setInterval(() => {
      const queue = typewriterQueueRef.current
      if (!queue) {
        clearInterval(typewriterTimerRef.current)
        typewriterTimerRef.current = null
        return
      }

      const chunkSize = queue.length > 120 ? 4 : 2
      const chunk = queue.slice(0, chunkSize)
      typewriterQueueRef.current = queue.slice(chunkSize)
      displayedContentRef.current += chunk
      updateMessageContent(messageId, displayedContentRef.current)
    }, 28)
  }, [updateMessageContent])

  const waitForTypewriter = useCallback(() => new Promise(resolve => {
    const check = () => {
      if (!typewriterTimerRef.current && !typewriterQueueRef.current) {
        resolve()
        return
      }
      setTimeout(check, 40)
    }
    check()
  }), [])

  const autoSave = useCallback(async (msgs, wfState, sid) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        const userMsgs = msgs.filter(m => m.role === 'user')
        let title = '新对话'
        if (userMsgs.length > 0) {
          title = userMsgs[0].content.substring(0, 30)
          if (userMsgs[0].content.length > 30) title += '...'
        }
        await api.saveChatHistory({
          sessionId: sid,
          title,
          messages: msgs.map(m => ({ id: m.id, role: m.role, content: m.content })),
          workflowState: wfState
        })
        loadChatHistories()
      } catch (e) {
        console.error('自动保存失败:', e)
      }
    }, 1000)
  }, [])

  useEffect(() => {
    if (messages.length > 1) {
      autoSave(messages, workflowState, sessionId)
    }
  }, [messages, workflowState, sessionId, autoSave])

  useEffect(() => {
    workflowStateRef.current = workflowState
  }, [workflowState])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return
    const shouldAutoRegeneratePPT = Boolean(workflowStateRef.current.pptUrl)

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue
    }
    setMessages(prev => [...prev, userMessage])
    const currentInput = inputValue
    setInputValue('')
    setIsLoading(true)
    setCurrentThinking('智能体正在自主规划任务...')
    setAgentTrace([])
    resetTypewriter()

    const assistantMessageId = Date.now() + 1
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: ''
    }])

    try {
      const conversationHistory = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))

      let streamedContent = ''
      const result = await api.agentAutonomousStream(currentInput, conversationHistory, sessionId, {
        onEvent: (event) => {
          if (event.type === 'start') {
            setCurrentThinking('智能体正在规划任务...')
            return
          }

          if (event.type === 'thinking') {
            setCurrentThinking(event.data?.thinking || '')
            return
          }

          if (event.type === 'step') {
            if (event.data?.trace) {
              setAgentTrace(event.data.trace)
            }
            if (event.data?.state) {
              applyWorkflowState(event.data.state)
            }
            setCurrentThinking(event.data?.step?.reflection || event.data?.step?.thinking || '')
            return
          }

          if (event.type === 'content_delta') {
            const chunk = event.data?.chunk || ''
            streamedContent += chunk
            setCurrentThinking('')
            enqueueAssistantText(assistantMessageId, chunk)
            return
          }

          if (event.type === 'final') {
            if (event.data?.state) {
              applyWorkflowState(event.data.state)
            }
            if (event.data?.trace) {
              setAgentTrace(event.data.trace)
            }
            setCurrentThinking('')
          }
        }
      })

      if (result.success) {
        if (!streamedContent) {
          enqueueAssistantText(
            assistantMessageId,
            result.data?.content || '处理完成，但当前没有生成可展示的文本结果。'
          )
        }
        if (result.data?.state) {
          applyWorkflowState(result.data.state)
        }
        if (result.data?.trace) {
          setAgentTrace(result.data.trace)
        }
        await waitForTypewriter()
        const latestWorkflowState = buildWorkflowState(workflowStateRef.current, result.data?.state)
        if (shouldAutoRegeneratePPT && latestWorkflowState.achievements?.length > 0) {
          await generateReportPPT(latestWorkflowState, { auto: true })
        }
        loadKnowledgeStats()
      } else {
        throw new Error(result.error || 'Agent执行失败')
      }
    } catch (error) {
      console.error('Streamed agent execution failed:', error)
      stopTypewriter()
      updateMessageContent(
        assistantMessageId,
        prev => prev
          ? `${prev}\n\n处理过程中中断：${error.message}`
          : `抱歉，处理过程中遇到问题：${error.message}\n\n请稍后重试。`
      )
    } finally {
      setIsLoading(false)
      setCurrentThinking('')
    }
    return

    try {
      const conversationHistory = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))

      const result = await api.agentAutonomous(currentInput, conversationHistory, sessionId)

      if (result.success) {
        const { content, state, trace } = result.data

        if (trace && trace.length > 0) {
          setAgentTrace(trace)
          const lastTrace = trace[trace.length - 1]
          if (lastTrace && lastTrace.thinking) {
            setCurrentThinking('')
          }
        }

        if (state) {
          const newStep = state.pptUrl ? 3 :
            (state.achievements && state.achievements.length > 0) ? 2 :
              (state.chainLinks && state.chainLinks.length > 0) ? 1 : 0

          setWorkflowState(prev => ({
            ...prev,
            step: newStep,
            chainLinks: state.chainLinks || prev.chainLinks,
            achievements: state.achievements || prev.achievements,
            analysis: state.analysis || prev.analysis,
            pptUrl: state.pptUrl || prev.pptUrl,
            pptFileName: state.pptFileName || prev.pptFileName,
            patternId: state.patternId || prev.patternId
          }))
        }

        const assistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: content || '处理完成，但未获得有效结果。'
        }
        setMessages(prev => [...prev, assistantMessage])

        loadKnowledgeStats()
      } else {
        throw new Error(result.error || 'Agent执行失败')
      }
    } catch (error) {
      console.error('自主规划Agent执行失败:', error)
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: `抱歉，处理过程中遇到了问题：${error.message}\n\n请检查网络连接或稍后再试。`
      }])
    } finally {
      setIsLoading(false)
      setCurrentThinking('')
    }
  }

  const generateReportPPT = async (sourceState = workflowStateRef.current, options = {}) => {
    const { auto = false } = options
    if (generatingPPT || !sourceState?.achievements || sourceState.achievements.length === 0) return

    setGeneratingPPT(true)
    try {
      const result = await api.agentGenerateReportPPT({
        chainLinks: sourceState.chainLinks,
        achievements: sourceState.achievements,
        enterpriseName: '智能体汇报'
      })

      if (result.success) {
        const { ppt_url, file_name, total_slides, total_achievements } = result.data
        setWorkflowState(prev => ({
          ...prev,
          step: 3,
          pptUrl: ppt_url,
          pptFileName: file_name
        }))

        const pptMessage = {
          id: Date.now(),
          role: 'assistant',
          content: `## ✅ 汇报PPT已生成\n\n- **文件名**：${file_name}\n- **幻灯片数**：${total_slides}页\n- **收录成果**：${total_achievements}项\n- **关联产业环节**：${workflowState.chainLinks.join('、')}\n\n📥 请点击下方 **"下载汇报PPT"** 按钮直接下载到本地\n\n---\n\n💡 如需调整结果，可以继续对话优化。`
        }
        if (!auto) {
          setMessages(prev => [...prev, pptMessage])
        }
        if (auto) {
          setMessages(prev => [...prev, {
            id: Date.now() + 1,
            role: 'assistant',
            content: `已根据你的修改建议自动重新生成汇报PPT：${file_name}\n\n可以直接点击“下载汇报PPT”查看新版。继续提出修改建议后，我会继续自动更新。`
          }])
        }
      } else {
        throw new Error(result.error || 'PPT生成失败')
      }
    } catch (error) {
      console.error('生成PPT失败:', error)
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: `❌ 生成汇报PPT失败：${error.message}\n\n请稍后重试，或继续对话优化结果。`
      }])
    } finally {
      setGeneratingPPT(false)
    }
  }

  const handleGeneratePPT = async () => {
    await generateReportPPT(workflowStateRef.current)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const startNewChat = () => {
    setSessionId(generateSessionId())
    setMessages([
      {
        id: 1,
        role: 'assistant',
        content: '您好！我是**自主规划型科技服务智能体 TechAgent**，基于 DeepSeek 大模型构建，具备知识库记忆和自主学习能力。\n\n我可以帮助您：\n\n- 🧠 **自主规划**：根据您的需求，自主决定执行步骤和工具调用顺序\n- 🔍 **产业环节解析**：分析文本，识别涉及的产业环节\n- 📊 **技术成果搜索**：根据产业环节搜索相关技术成果\n- 📄 **汇报PPT生成**：将技术成果汇总生成汇报PPT\n- 💾 **知识库学习**：从每次交互中积累经验，持续优化服务质量\n\n请输入您的需求文本，我将自主规划并执行任务。'
      }
    ])
    setWorkflowState({
      step: 0,
      chainLinks: [],
      achievements: [],
      analysis: '',
      pptUrl: '',
      pptFileName: '',
      patternId: null
    })
    setAgentTrace([])
  }

  const loadHistorySession = async (sid) => {
    try {
      const result = await api.getChatHistory(sid)
      if (result.success) {
        setSessionId(sid)
        setMessages(result.data.messages.map((m, idx) => ({
          id: Date.now() + idx,
          role: m.role,
          content: m.content
        })))
        setWorkflowState(result.data.workflowState || {
          step: 0,
          chainLinks: [],
          achievements: [],
          analysis: '',
          pptUrl: '',
          pptFileName: '',
          patternId: null
        })
        setShowHistory(false)
      }
    } catch (e) {
      console.error('加载历史会话失败:', e)
    }
  }

  const deleteHistorySession = async (e, sid) => {
    e.stopPropagation()
    try {
      await api.deleteChatHistory(sid)
      setChatHistories(prev => prev.filter(h => h.sessionId !== sid))
    } catch (e) {
      console.error('删除历史会话失败:', e)
    }
  }

  const handleDownloadPPT = async () => {
    if (!workflowState.pptUrl) return
    try {
      const url = `http://localhost:3002${workflowState.pptUrl}`
      const response = await fetch(url)
      if (!response.ok) throw new Error('下载失败')
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = workflowState.pptFileName || '汇报PPT.pptx'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('下载PPT失败:', error)
      const link = document.createElement('a')
      link.href = `http://localhost:3002${workflowState.pptUrl}`
      link.download = workflowState.pptFileName || '汇报PPT.pptx'
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleFeedback = async (rating) => {
    try {
      await api.agentFeedback({
        patternId: workflowState.patternId,
        rating,
        comment: rating >= 4 ? '用户满意' : '用户不满意',
        correctedChainLinks: rating < 3 ? workflowState.chainLinks : undefined
      })
      loadKnowledgeStats()
    } catch (e) {
      console.error('保存反馈失败:', e)
    }
  }

  const quickQuestions = [
    '三峡水运新通道有哪些关键技术成果？',
    '航运新通道建设涉及哪些产业链环节？',
    '智能船舶过闸与助航有哪些技术成果？',
    '航道疏浚与通航安全相关技术如何匹配产业需求？',
  ]

  const getStepStatus = (stepNum) => {
    if (workflowState.step > stepNum) return 'completed'
    if (workflowState.step === stepNum) return 'active'
    return 'pending'
  }

  const formatTime = (isoStr) => {
    if (!isoStr) return ''
    const d = new Date(isoStr)
    const now = new Date()
    const diffMs = now - d
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin}分钟前`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}小时前`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}天前`
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  return (
    <div className="tech-agent">
      <div className="ta-header">
        <h2>🧠 自主规划型科技服务智能体</h2>
        <p>基于DeepSeek大模型，支持自主规划、知识库记忆与持续学习优化</p>
      </div>

      {workflowState.step > 0 && (
        <div className="workflow-steps">
          <div className={`workflow-step ${getStepStatus(1)}`}>
            <div className="step-number">1</div>
            <div className="step-info">
              <span className="step-title">产业环节解析</span>
              {workflowState.chainLinks.length > 0 && (
                <span className="step-detail">{workflowState.chainLinks.length}个环节</span>
              )}
            </div>
          </div>
          <div className="workflow-connector"></div>
          <div className={`workflow-step ${getStepStatus(2)}`}>
            <div className="step-number">2</div>
            <div className="step-info">
              <span className="step-title">技术成果搜索</span>
              {workflowState.achievements.length > 0 && (
                <span className="step-detail">{workflowState.achievements.length}项成果</span>
              )}
            </div>
          </div>
          <div className="workflow-connector"></div>
          <div className={`workflow-step ${getStepStatus(3)}`}>
            <div className="step-number">3</div>
            <div className="step-info">
              <span className="step-title">汇报PPT生成</span>
              {workflowState.pptUrl && (
                <span className="step-detail">✓ 已生成</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="ta-content">
        <div className="ta-chat-area">
          <div className="history-sidebar">
            <div className="history-sidebar-header">
              <h3>对话</h3>
            </div>
            <div className="history-actions">
              <button className="btn btn-secondary history-action-btn" onClick={startNewChat}>
                新对话
              </button>
              <button
                className={`btn btn-secondary history-action-btn ${showHistory ? 'active' : ''}`}
                onClick={() => setShowHistory(!showHistory)}
              >
                历史记录
              </button>
            </div>
            {showHistory && (
              <div className="history-sidebar-list">
                {chatHistories.length === 0 ? (
                  <div className="history-empty">暂无对话历史</div>
                ) : (
                  chatHistories.map(h => (
                    <div
                      key={h.sessionId}
                      className={`history-item ${h.sessionId === sessionId ? 'active' : ''}`}
                      onClick={() => loadHistorySession(h.sessionId)}
                    >
                      <div className="history-item-main">
                        <div className="history-item-title">{h.title}</div>
                        <div className="history-item-meta">
                          <span className="history-item-time">{formatTime(h.updatedAt)}</span>
                          <span className="history-item-count">{h.messageCount}条消息</span>
                          {h.workflowStep > 0 && (
                            <span className="history-item-step">
                              {h.workflowStep === 1 ? '解析中' : h.workflowStep === 2 ? '已搜索' : '已生成PPT'}
                            </span>
                          )}
                        </div>
                        {h.chainLinks && h.chainLinks.length > 0 && (
                          <div className="history-item-links">
                            {h.chainLinks.slice(0, 3).map((link, idx) => (
                              <span key={idx} className="history-link-tag">{link}</span>
                            ))}
                            {h.chainLinks.length > 3 && <span className="history-link-more">+{h.chainLinks.length - 3}</span>}
                          </div>
                        )}
                      </div>
                      <button
                        className="history-item-delete"
                        onClick={(e) => deleteHistorySession(e, h.sessionId)}
                        title="删除"
                      >
                        删除
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="ta-chat">
            <div className="ta-messages">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`message ${message.role}`}
                >
                  <div className="message-content">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="message assistant">
                  <div className="message-content loading">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="loading-text">
                      {currentThinking || '智能体正在自主规划...'}
                    </span>
                  </div>
                  {agentTrace.length > 0 && (
                    <div className="agent-trace">
                      <div className="trace-title">🧠 Agent执行轨迹：</div>
                      {agentTrace.map((step, idx) => (
                        <div key={idx} className="trace-step">
                          <span className="trace-iteration">#{step.iteration}</span>
                          <span className="trace-tool">{TOOL_LABELS[step.tool] || step.tool}</span>
                          {step.result && (
                            <span className={`trace-status ${step.result.success ? 'success' : 'fail'}`}>
                              {step.result.success ? '✓' : '✗'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {!isLoading && agentTrace.length > 0 && messages.length > 0 && (
              <div className="agent-trace-summary">
                <div className="trace-summary-toggle" onClick={() => setAgentTrace([])}>
                  🧠 Agent执行了 {agentTrace.length} 步：{agentTrace.map(s => TOOL_LABELS[s.tool] || s.tool).join(' → ')}
                  <span className="trace-close">✕</span>
                </div>
              </div>
            )}

            <div className="ta-input-area">
              {workflowState.step >= 2 && workflowState.achievements.length > 0 && !workflowState.pptUrl && (
                <div className="ppt-action-bar">
                  <button
                    className="btn btn-primary ppt-generate-btn"
                    onClick={handleGeneratePPT}
                    disabled={generatingPPT}
                  >
                    {generatingPPT ? (
                      <>
                        <span className="spinner"></span>
                        正在生成汇报PPT...
                      </>
                    ) : (
                      <>📄 生成汇报PPT</>
                    )}
                  </button>
                  <span className="ppt-action-hint">
                    将{workflowState.achievements.length}项技术成果汇总生成PPT
                  </span>
                </div>
              )}
              {workflowState.pptUrl && (
                <div className="ppt-action-bar ppt-downloaded">
                  <button
                    className="btn btn-success ppt-download-btn"
                    onClick={handleDownloadPPT}
                  >
                    📥 下载汇报PPT
                  </button>
                  <button
                    className="btn btn-secondary ppt-regenerate-btn"
                    onClick={handleGeneratePPT}
                    disabled={generatingPPT}
                  >
                    {generatingPPT ? '重新生成中...' : '🔄 重新生成'}
                  </button>
                </div>
              )}
              <div className="input-actions" style={{ display: 'none' }}>
                <button className="btn btn-secondary" onClick={startNewChat}>
                  新对话
                </button>
                <button
                  className={`btn btn-secondary ${showHistory ? 'active' : ''}`}
                  onClick={() => setShowHistory(!showHistory)}
                >
                  📋 历史记录
                </button>
                <button
                  className={`btn btn-secondary ${showKnowledgePanel ? 'active' : ''}`}
                  style={{ display: 'none' }}
                  onClick={() => {
                    setShowKnowledgePanel(!showKnowledgePanel)
                    if (!showKnowledgePanel) loadKnowledgeStats()
                  }}
                >
                  🧠 知识库
                </button>
              </div>
              <div className="chat-input-row">
                <textarea
                className="textarea"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="请输入您的需求文本，智能体将自主规划并执行任务..."
                  rows={2}
                />
                <div className="input-buttons">
                <button
                  className="btn btn-primary send-btn"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                >
                  {isLoading ? '处理中...' : '发送'}
                </button>
                </div>
              </div>
              {workflowState.step === 0 && (
                <div className="quick-questions-inline">
                  {quickQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      className="quick-q-btn"
                      onClick={() => setInputValue(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {false && showKnowledgePanel && (
            <div className="knowledge-sidebar">
              <div className="knowledge-sidebar-header">
                <h3>🧠 知识库</h3>
                <button className="history-close-btn" onClick={() => setShowKnowledgePanel(false)}>✕</button>
              </div>
              <div className="knowledge-sidebar-content">
                {knowledgeStats ? (
                  <>
                    <div className="knowledge-stats">
                      <div className="stat-card">
                        <div className="stat-number">{knowledgeStats.patternCount || 0}</div>
                        <div className="stat-label">历史案例</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-number">{knowledgeStats.learningCount || 0}</div>
                        <div className="stat-label">学习经验</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-number">{knowledgeStats.feedbackCount || 0}</div>
                        <div className="stat-label">用户反馈</div>
                      </div>
                    </div>

                    {knowledgeStats.topLearnings && knowledgeStats.topLearnings.length > 0 && (
                      <div className="knowledge-section">
                        <h4>📚 高频经验</h4>
                        {knowledgeStats.topLearnings.slice(0, 8).map((l, idx) => (
                          <div key={idx} className="knowledge-item">
                            <div className="knowledge-item-key">{l.key}</div>
                            <div className="knowledge-item-value">{l.value}</div>
                            <div className="knowledge-item-meta">
                              <span className="knowledge-category">{l.category}</span>
                              <span className="knowledge-hits">引用{l.hitCount || 0}次</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {knowledgeStats.recentPatterns && knowledgeStats.recentPatterns.length > 0 && (
                      <div className="knowledge-section">
                        <h4>🕐 最近案例</h4>
                        {knowledgeStats.recentPatterns.map((p, idx) => (
                          <div key={idx} className="knowledge-item">
                            <div className="knowledge-item-key">{p.userInput?.substring(0, 40)}...</div>
                            <div className="knowledge-item-value">
                              → {p.chainLinks?.join('、')}
                            </div>
                            <div className="knowledge-item-meta">
                              <span className="knowledge-hits">{p.achievementCount || 0}项成果</span>
                              {p.corrected && <span className="knowledge-corrected">已修正</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="knowledge-empty">加载知识库数据中...</div>
                )}
              </div>
            </div>
          )}

          {false && showHistory && (
            <div className="history-sidebar">
              <div className="history-sidebar-header">
                <h3>对话历史</h3>
                <button className="history-close-btn" onClick={() => setShowHistory(false)}>✕</button>
              </div>
              <div className="history-sidebar-list">
                {chatHistories.length === 0 ? (
                  <div className="history-empty">暂无对话历史</div>
                ) : (
                  chatHistories.map(h => (
                    <div
                      key={h.sessionId}
                      className={`history-item ${h.sessionId === sessionId ? 'active' : ''}`}
                      onClick={() => loadHistorySession(h.sessionId)}
                    >
                      <div className="history-item-main">
                        <div className="history-item-title">{h.title}</div>
                        <div className="history-item-meta">
                          <span className="history-item-time">{formatTime(h.updatedAt)}</span>
                          <span className="history-item-count">{h.messageCount}条消息</span>
                          {h.workflowStep > 0 && (
                            <span className="history-item-step">
                              {h.workflowStep === 1 ? '解析中' : h.workflowStep === 2 ? '已搜索' : '已生成PPT'}
                            </span>
                          )}
                        </div>
                        {h.chainLinks && h.chainLinks.length > 0 && (
                          <div className="history-item-links">
                            {h.chainLinks.slice(0, 3).map((link, idx) => (
                              <span key={idx} className="history-link-tag">{link}</span>
                            ))}
                            {h.chainLinks.length > 3 && <span className="history-link-more">+{h.chainLinks.length - 3}</span>}
                          </div>
                        )}
                      </div>
                      <button
                        className="history-item-delete"
                        onClick={(e) => deleteHistorySession(e, h.sessionId)}
                        title="删除"
                      >
                        🗑
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TechAgent
