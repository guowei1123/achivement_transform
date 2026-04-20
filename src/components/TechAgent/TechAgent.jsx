import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import KnowledgeGraphView from './KnowledgeGraphView'
import EnterpriseDemand from './EnterpriseDemand'
import './TechAgent.css'

function TechAgent() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '您好！我是科技服务智能体TechAgent，基于DeepSeek等AI大模型构建。我可以帮助您：\n\n- **成果对接**：企业产业链与学校科技成果智能匹配\n- 技术成果PPT生成\n- 产业链汇报PPT生成\n- 科技成果评估\n- 技术咨询\n- 知识图谱查询\n\n请问有什么可以帮助您的？'
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTask, setSelectedTask] = useState('general')
  const messagesEndRef = useRef(null)
  
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false)
  const [showEnterpriseDemand, setShowEnterpriseDemand] = useState(false)

  const handleKnowledgeGraph = () => {
    setShowKnowledgeGraph(true)
    setShowEnterpriseDemand(false)
    setSelectedTask('general')
  }

  const handleEnterpriseDemand = () => {
    setShowEnterpriseDemand(true)
    setShowKnowledgeGraph(false)
    setSelectedTask('evaluation')
  }

  const tasks = [
        { id: 'evaluation', name: '企业需求对接', icon: '📊', onClick: handleEnterpriseDemand },
    { id: 'general', name: '产业链需求对接', icon: '💬', onClick: handleKnowledgeGraph },
    //{ id: 'consultation', name: '产业链汇报PPT生成', icon: '🔧' }
  ]

  const quickQuestions = [
    '如何评估一项科技成果的价值？',
    '人工智能领域有哪些最新进展？',
    '帮我推荐相关的技术专利',
    '科技服务主体有哪些类型？',
    '如何进行技术成果转化？'
  ]

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的科技服务智能体，擅长科技成果评估、技术咨询、知识图谱查询等领域。请用专业、准确、友好的语气回答用户的问题。'
            },
            ...messages.map(m => ({
              role: m.role,
              content: m.content
            })),
            {
              role: 'user',
              content: inputValue
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      })

      const data = await response.json()

      if (data.choices && data.choices[0]) {
        const assistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.choices[0].message.content
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error('API返回格式错误')
      }
    } catch (error) {
      console.error('调用DeepSeek API失败:', error)
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '抱歉，我遇到了一些问题。请检查网络连接或稍后再试。'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const generateResponse = (query, task) => {
    const responses = {
      general: `基于知识图谱分析，我为您找到以下相关信息：\n\n**查询内容**: ${query}\n\n**分析结果**:\n- 相关科技资源: 15项\n- 匹配服务主体: 8家\n- 推荐应用场景: 6个\n\n**建议**:\n1. 建议重点关注人工智能和大数据技术领域\n2. 可联系清华大学、中科院等科研院所进行深入合作\n3. 推荐应用场景包括智能客服、智能推荐、图像识别等\n\n如需更详细的信息，请告诉我您的具体需求。`,
      evaluation: `**科技成果评估报告**\n\n**评估维度**:\n- 技术创新性: ⭐⭐⭐⭐⭐\n- 市场前景: ⭐⭐⭐⭐\n- 转化潜力: ⭐⭐⭐⭐\n- 政策支持: ⭐⭐⭐⭐⭐\n\n**综合评分**: 4.5/5.0\n\n**优势分析**:\n1. 技术方案具有原创性\n2. 市场需求明确\n3. 符合国家产业政策\n\n**改进建议**:\n1. 加强知识产权保护\n2. 完善商业模式\n3. 建立产业化团队`,
      consultation: `**技术咨询建议**\n\n针对您的问题：${query}\n\n**技术方案**:\n1. 采用深度学习算法\n2. 结合知识图谱技术\n3. 实现多模态数据融合\n\n**实施路径**:\n- 第一阶段: 数据收集与预处理\n- 第二阶段: 模型训练与优化\n- 第三阶段: 系统集成与测试\n- 第四阶段: 部署与运维\n\n**技术难点**:\n- 数据质量问题\n- 模型可解释性\n- 系统性能优化\n\n**推荐资源**:\n- 相关论文: 23篇\n- 专利技术: 15项\n- 专家团队: 5个`,
      matching: `**智能匹配结果**\n\n**匹配维度**:\n- 技术成熟度: 85%\n- 市场需求紧迫性: 90%\n- 政策支持力度: 95%\n\n**Top 3 匹配结果**:\n\n1. **清华大学人工智能研究院**\n   - 匹配度: 92%\n   - 优势: 技术实力强，科研资源丰富\n   - 合作方式: 技术转让、联合研发\n\n2. **中科院计算技术研究所**\n   - 匹配度: 88%\n   - 优势: 研究成果丰富，产业化经验足\n   - 合作方式: 技术咨询、项目合作\n\n3. **华为技术有限公司**\n   - 匹配度: 85%\n   - 优势: 产业化能力强，市场资源丰富\n   - 合作方式: 战略合作、投资孵化`,
      recommendation: `**智能推荐服务**\n\n基于您的需求，推荐以下科技服务：\n\n**1. 知识产权服务**\n- 专利申请与布局\n- 知识产权战略规划\n- 技术成果转化\n\n**2. 技术咨询服务**\n- 技术可行性分析\n- 市场前景评估\n- 产业化路径规划\n\n**3. 人才服务**\n- 高层次人才引进\n- 技术团队组建\n- 人才培训服务\n\n**4. 资金服务**\n- 科技项目申报\n- 投融资对接\n- 政策资金申请\n\n**5. 市场服务**\n- 市场调研分析\n- 商业模式设计\n- 渠道资源对接`,
      analysis: `**数据分析报告**\n\n**数据概览**:\n- 科技资源总数: 10,000+\n- 服务主体数量: 5,000+\n- 应用场景覆盖: 200+\n\n**趋势分析**:\n1. 人工智能技术增长最快 (+45%)\n2. 大数据应用场景扩展迅速 (+38%)\n3. 产学研合作比例提升 (+32%)\n\n**热点领域**:\n- 智能制造\n- 医疗健康\n- 智慧城市\n- 金融科技\n\n**预测建议**:\n- 建议重点关注AI与实体经济融合\n- 加强数字化转型服务\n- 拓展国际科技合作`
    }

    return responses[task] || responses.general
  }

  const handleQuickQuestion = (question) => {
    setInputValue(question)
    handleSend()
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: 1,
        role: 'assistant',
        content: '您好！我是科技服务智能体TechAgent，基于DeepSeek等AI大模型构建。我可以帮助您：\n\n- **成果对接**：企业产业链与学校科技成果智能匹配\n- 技术成果PPT生成\n- 产业链汇报PPT生成\n- 科技成果评估\n- 技术咨询\n- 知识图谱查询\n\n请问有什么可以帮助您的？'
      }
    ])
  }

  return (
    <div className="tech-agent">
      <div className="ta-header">
        <h2>科技服务智能体</h2>
        <p>基于DeepSeek等AI大模型，支持多轮对话、任务分解与动态规划</p>
      </div>

      <div className="ta-content">
        <div className="ta-chat-area">
          <div className="ta-chat">
            <div className="ta-messages">
              {showKnowledgeGraph ? (
                <KnowledgeGraphView onClose={() => setShowKnowledgeGraph(false)} />
              ) : showEnterpriseDemand ? (
                <EnterpriseDemand onClose={() => setShowEnterpriseDemand(false)} />
              ) : (
                messages.map(message => (
                  <div
                    key={message.id}
                    className={`message ${message.role}`}
                  >
                    <div className="message-content">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  </div>
                ))
              )}
              {isLoading && !showKnowledgeGraph && !showEnterpriseDemand && (
                <div className="message assistant">
                  <div className="message-content loading">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {!showKnowledgeGraph && !showEnterpriseDemand && (
              <div className="ta-input-area">
                <div className="input-actions">
                  <button className="btn btn-secondary" onClick={clearChat}>
                    清空对话
                  </button>
                </div>
                <textarea
                  className="textarea"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="请输入您的问题..."
                  rows={3}
                />
                <div className="input-buttons">
                  <div className="task-buttons">
                    {tasks.map(task => (
                      <button
                        key={task.id}
                        className={`task-btn-small ${selectedTask === task.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedTask(task.id)
                          if (task.onClick) {
                            task.onClick()
                          }
                        }}
                        title={task.name}
                      >
                        <span className="task-icon">{task.icon}</span>
                        <span className="task-name">{task.name}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn btn-primary send-btn"
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                  >
                    {isLoading ? '发送中...' : '发送'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TechAgent
