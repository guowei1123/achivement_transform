import axios from 'axios'

const API_BASE = 'http://localhost:3002/api'

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
  }
}

