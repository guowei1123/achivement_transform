import axios from 'axios'

const API_BASE = 'http://localhost:3002/api'
const AIPPT_BASE = 'http://localhost:3002/aippt-api'

export const api = {
  async getNodes() {
    try {
      const response = await axios.get(`${API_BASE}/nodes`)
      return response.data.data
    } catch (error) {
      console.error('获取节点失败:', error)
      throw error
    }
  },

  async getNodesByType(type) {
    try {
      const response = await axios.get(`${API_BASE}/nodes/${type}`)
      return response.data.data
    } catch (error) {
      console.error('获取节点失败:', error)
      throw error
    }
  },

  async getEdges() {
    try {
      const response = await axios.get(`${API_BASE}/edges`)
      return response.data.data
    } catch (error) {
      console.error('获取关系失败:', error)
      throw error
    }
  },

  async getGraph(type) {
    try {
      const response = await axios.get(`${API_BASE}/graph/${type}`)
      return response.data.data
    } catch (error) {
      console.error('获取图谱失败:', error)
      throw error
    }
  },

  async getChainIndustries() {
    try {
      const response = await axios.get(`${API_BASE}/chain-industries`)
      return response.data.data
    } catch (error) {
      console.error('获取产业选项失败:', error)
      throw error
    }
  },

  async getChainGraphNew(params = {}) {
    try {
      const response = await axios.get(`${API_BASE}/chain-graph-new`, { params })
      return response.data.data
    } catch (error) {
      console.error('获取产业链图谱失败:', error)
      throw error
    }
  },

  async getTechGraphNew() {
    try {
      const response = await axios.get(`${API_BASE}/tech-graph-new`)
      return response.data.data
    } catch (error) {
      console.error('获取技术图谱失败:', error)
      throw error
    }
  },

  async getFusionGraphNew(params = {}) {
    try {
      const response = await axios.get(`${API_BASE}/fusion-graph-new`, { params })
      return response.data.data
    } catch (error) {
      console.error('获取融合图谱失败:', error)
      throw error
    }
  },

  async createGraphNode(data) {
    try {
      const response = await axios.post(`${API_BASE}/graph-node`, data)
      return response.data
    } catch (error) {
      console.error('创建节点失败:', error)
      throw error
    }
  },

  async updateGraphNode(name, data) {
    try {
      const response = await axios.put(`${API_BASE}/graph-node/${encodeURIComponent(name)}`, data)
      return response.data
    } catch (error) {
      console.error('更新节点失败:', error)
      throw error
    }
  },

  async deleteGraphNode(name) {
    try {
      const response = await axios.delete(`${API_BASE}/graph-node/${encodeURIComponent(name)}`)
      return response.data
    } catch (error) {
      console.error('删除节点失败:', error)
      throw error
    }
  },

  async createGraphEdge(data) {
    try {
      const response = await axios.post(`${API_BASE}/graph-edge`, data)
      return response.data
    } catch (error) {
      console.error('创建关系失败:', error)
      throw error
    }
  },

  async deleteGraphEdge(data) {
    try {
      const response = await axios.delete(`${API_BASE}/graph-edge`, { data })
      return response.data
    } catch (error) {
      console.error('删除关系失败:', error)
      throw error
    }
  },

  async updateGraphEdge(data) {
    try {
      const response = await axios.put(`${API_BASE}/graph-edge`, data)
      return response.data
    } catch (error) {
      console.error('修改关系失败:', error)
      throw error
    }
  },

  async batchImportGraph(data) {
    try {
      const response = await axios.post(`${API_BASE}/graph-batch-import`, data)
      return response.data
    } catch (error) {
      console.error('批量导入失败:', error)
      throw error
    }
  },

  async importGraphFromText(data) {
    try {
      const response = await axios.post(`${API_BASE}/graph-text-import`, data)
      return response.data
    } catch (error) {
      console.error('文本抽取导入失败:', error)
      throw error
    }
  },

  async exportGraph(format, graphType, params = {}) {
    try {
      const response = await axios.get(`${API_BASE}/graph-export/${format}`, {
        params: { graphType, ...params },
        responseType: format === 'json' || format === 'nodes-json' || format === 'edges-json' ? 'json' : 'blob'
      })
      return response.data
    } catch (error) {
      console.error('导出图谱失败:', error)
      throw error
    }
  },

  async createSnapshot(description) {
    try {
      const response = await axios.post(`${API_BASE}/graph-snapshot`, { description })
      return response.data
    } catch (error) {
      console.error('创建快照失败:', error)
      throw error
    }
  },

  async getSnapshots() {
    try {
      const response = await axios.get(`${API_BASE}/graph-snapshots`)
      return response.data.data
    } catch (error) {
      console.error('获取快照列表失败:', error)
      throw error
    }
  },

  async restoreSnapshot(fileName) {
    try {
      const response = await axios.post(`${API_BASE}/graph-snapshot-restore/${fileName}`)
      return response.data
    } catch (error) {
      console.error('恢复快照失败:', error)
      throw error
    }
  },

  async getNodeTypes() {
    try {
      const response = await axios.get(`${API_BASE}/node-types`)
      return response.data.data
    } catch (error) {
      console.error('获取节点类型失败:', error)
      throw error
    }
  },

  async getRelTypes() {
    try {
      const response = await axios.get(`${API_BASE}/rel-types`)
      return response.data.data
    } catch (error) {
      console.error('获取关系类型失败:', error)
      throw error
    }
  },

  async getNodeDetails(id) {
    try {
      const response = await axios.get(`${API_BASE}/node/${id}`)
      return response.data.data
    } catch (error) {
      console.error('获取节点详情失败:', error)
      throw error
    }
  },

  async searchNodes(keyword) {
    try {
      const response = await axios.get(`${API_BASE}/search`, {
        params: { q: keyword }
      })
      return response.data.data
    } catch (error) {
      console.error('搜索节点失败:', error)
      throw error
    }
  },

  async createNode(node) {
    try {
      const response = await axios.post(`${API_BASE}/node`, node)
      return response.data.data
    } catch (error) {
      console.error('创建节点失败:', error)
      throw error
    }
  },

  async createNodes(nodes) {
    try {
      const response = await axios.post(`${API_BASE}/nodes`, { nodes })
      return response.data.data
    } catch (error) {
      console.error('批量创建节点失败:', error)
      throw error
    }
  },

  async createEdge(edge) {
    try {
      const response = await axios.post(`${API_BASE}/edge`, edge)
      return response.data.data
    } catch (error) {
      console.error('创建关系失败:', error)
      throw error
    }
  },

  async createEdges(edges) {
    try {
      const response = await axios.post(`${API_BASE}/edges`, { edges })
      return response.data.data
    } catch (error) {
      console.error('批量创建关系失败:', error)
      throw error
    }
  },

  async getEnterpriseSupplyChain(enterpriseName) {
    try {
      const response = await axios.get(`${API_BASE}/enterprise/${encodeURIComponent(enterpriseName)}/supply-chain`)
      return response.data.data
    } catch (error) {
      console.error('获取企业产业链失败:', error)
      throw error
    }
  },

  async matchTechNeedsWithAchievements(needId) {
    try {
      const response = await axios.get(`${API_BASE}/tech-needs/${needId}/match-achievements`)
      return response.data.data
    } catch (error) {
      console.error('匹配科技成果失败:', error)
      throw error
    }
  },

  async getIntegratedGraph(enterpriseName) {
    try {
      const response = await axios.get(`${API_BASE}/integrated-graph/${encodeURIComponent(enterpriseName)}`)
      return response.data.data
    } catch (error) {
      console.error('获取融合图谱失败:', error)
      throw error
    }
  },

  async getFusionChainTech(enterpriseName) {
    try {
      const response = await axios.get(`${API_BASE}/fusion-chain-tech/${encodeURIComponent(enterpriseName)}`)
      return response.data.data
    } catch (error) {
      console.error('获取产业链技术融合图谱失败:', error)
      throw error
    }
  },

  async getNodeTechNeeds(nodeLabel) {
    try {
      const response = await axios.get(`${API_BASE}/node-tech-needs/${encodeURIComponent(nodeLabel)}`)
      return response.data.data
    } catch (error) {
      console.error('获取节点技术需求失败:', error)
      throw error
    }
  },

  async getNodePPT(nodeLabel) {
    try {
      const response = await axios.get(`${API_BASE}/node-ppt/${encodeURIComponent(nodeLabel)}`)
      return response.data
    } catch (error) {
      console.error('获取节点PPT失败:', error)
      throw error
    }
  },


  async generatePPTFromTemplate(templateName, data) {
    try {
      const response = await axios.post(`${API_BASE}/generate-ppt-from-template`, {
        templateName,
        data
      })
      return response.data
    } catch (error) {
      console.error('生成PPT失败:', error)
      throw error
    }
  }
  ,
    async exportChainPPT(enterpriseName) {
    try {
      const response = await axios.post(`${API_BASE}/export-chain-ppt`, {
        enterpriseName
      })
      return response.data
    } catch (error) {
      console.error('导出产业链PPT失败:', error)
      throw error
    }
  },

  async agentParseChainLinks(text) {
    try {
      const response = await axios.post(`${API_BASE}/agent/parse-chain-links`, { text })
      return response.data
    } catch (error) {
      console.error('解析产业环节失败:', error)
      throw error
    }
  },

  async agentSearchTech(chainLinks) {
    try {
      const response = await axios.post(`${API_BASE}/agent/search-tech`, { chainLinks })
      return response.data
    } catch (error) {
      console.error('技术搜索失败:', error)
      throw error
    }
  },

  async agentGenerateReportPPT(data) {
    try {
      const response = await axios.post(`${API_BASE}/agent/generate-report-ppt`, data)
      return response.data
    } catch (error) {
      console.error('生成汇报PPT失败:', error)
      throw error
    }
  },

  async agentChat(messages, context) {
    try {
      const response = await axios.post(`${API_BASE}/agent/chat`, { messages, context })
      return response.data
    } catch (error) {
      console.error('智能体对话失败:', error)
      throw error
    }
  },

  async saveChatHistory(data) {
    try {
      const response = await axios.post(`${API_BASE}/agent/chat-history`, data)
      return response.data
    } catch (error) {
      console.error('保存对话历史失败:', error)
      throw error
    }
  },

  async getChatHistories() {
    try {
      const response = await axios.get(`${API_BASE}/agent/chat-histories`)
      return response.data
    } catch (error) {
      console.error('获取对话历史列表失败:', error)
      throw error
    }
  },

  async getChatHistory(sessionId) {
    try {
      const response = await axios.get(`${API_BASE}/agent/chat-history/${sessionId}`)
      return response.data
    } catch (error) {
      console.error('获取对话历史详情失败:', error)
      throw error
    }
  },

  async deleteChatHistory(sessionId) {
    try {
      const response = await axios.delete(`${API_BASE}/agent/chat-history/${sessionId}`)
      return response.data
    } catch (error) {
      console.error('删除对话历史失败:', error)
      throw error
    }
  },

  async agentAutonomous(message, conversationHistory = [], sessionId = '') {
    try {
      const response = await axios.post(`${API_BASE}/agent/autonomous`, {
        message,
        conversationHistory,
        sessionId
      })
      return response.data
    } catch (error) {
      console.error('自主规划Agent调用失败:', error)
      throw error
    }
  },

  async agentAutonomousStream(message, conversationHistory = [], sessionId = '', handlers = {}) {
    const emitFallbackStream = async (payload) => {
      const content = payload?.data?.content || ''
      const chunkSize = 24

      if (typeof handlers.onEvent === 'function') {
        handlers.onEvent({
          type: 'start',
          data: {
            fallback: true
          }
        })
      }

      for (let index = 0; index < content.length; index += chunkSize) {
        if (typeof handlers.onEvent === 'function') {
          handlers.onEvent({
            type: 'content_delta',
            data: {
              chunk: content.slice(index, index + chunkSize)
            }
          })
        }
        await new Promise(resolve => setTimeout(resolve, 15))
      }

      if (typeof handlers.onEvent === 'function') {
        handlers.onEvent({
          type: 'final',
          data: {
            content,
            state: payload?.data?.state || null,
            trace: payload?.data?.trace || [],
            iterations: payload?.data?.iterations || 0,
            fallback: true
          }
        })
      }

      return {
        success: true,
        data: {
          content,
          state: payload?.data?.state || null,
          trace: payload?.data?.trace || [],
          iterations: payload?.data?.iterations || 0,
          fallback: true
        }
      }
    }
    const fallbackResult = await api.agentAutonomous(message, conversationHistory, sessionId)
    return emitFallbackStream(fallbackResult)
  },

  async agentFeedback(data) {
    try {
      const response = await axios.post(`${API_BASE}/agent/feedback`, data)
      return response.data
    } catch (error) {
      console.error('保存反馈失败:', error)
      throw error
    }
  },

  async getKnowledgeStats() {
    try {
      const response = await axios.get(`${API_BASE}/agent/knowledge-stats`)
      return response.data
    } catch (error) {
      console.error('获取知识库统计失败:', error)
      throw error
    }
  },

  AIPPT_GetTemplates() {
    return axios.get(`${AIPPT_BASE}/templates`).then(res => res.data)
  },

  AIPPT_GetTemplateData(templateId) {
    return axios.get(`${AIPPT_BASE}/data/${templateId}.json`).then(res => res.data)
  },

  AIPPT_Outline({ content, language, model }) {
    return fetch(`${AIPPT_BASE}/tools/aippt_outline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, language, model, stream: true })
    })
  },

  AIPPT_Content({ content, language, generateFromWebSearch }) {
    return fetch(`${AIPPT_BASE}/tools/aippt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify({ content, language, generateFromWebSearch, stream: true })
    })
  }
}

