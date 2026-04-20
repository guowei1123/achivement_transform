import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import cytoscape from 'cytoscape'
import './EnterpriseDemand.css'

const EnterpriseDemand = () => {
  const [demand, setDemand] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] })
  const [selectedNode, setSelectedNode] = useState(null)
  const [preciseNeeds, setPreciseNeeds] = useState([])
  const [matchedAchievements, setMatchedAchievements] = useState([])
  const cyRef = useRef(null)
  const cyInstanceRef = useRef(null)

  const API_BASE = 'http://localhost:3002/api'

  const analyzeDemand = async () => {
    if (!demand.trim()) {
      setError('请输入企业需求')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await axios.post(`${API_BASE}/analyze-demand`, {
        demand
      })

      const { preciseNeeds, achievements } = response.data.data
      setPreciseNeeds(preciseNeeds)
      setMatchedAchievements(achievements)

      const nodes = [
        {
          id: 'enterprise',
          label: '企业需求',
          type: 'Enterprise',
          category: '企业'
        },
        ...preciseNeeds.map((need, index) => ({
          id: `need-${index}`,
          label: need,
          type: 'TechNeed',
          category: '技术需求'
        })),
        ...achievements.map((achievement, index) => ({
          id: `achievement-${index}`,
          label: achievement.title,
          type: achievement.type,
          category: '科技成果',
          description: achievement.description
        }))
      ]

      const edges = [
        ...preciseNeeds.map((_, index) => ({
          source: 'enterprise',
          target: `need-${index}`,
          label: '包含需求'
        })),
        ...achievements.flatMap((achievement, index) => 
          achievement.matchedNeeds.map(needIndex => ({
            source: `need-${needIndex}`,
            target: `achievement-${index}`,
            label: '技术匹配'
          }))
        )
      ]

      setGraphData({ nodes, edges })

      setTimeout(() => {
        renderGraph(nodes, edges)
      }, 100)

      setLoading(false)
    } catch (err) {
      console.error('分析需求失败:', err)
      setError(err.response?.data?.error || err.message || '分析需求失败')
      setLoading(false)
    }
  }

  const renderGraph = (nodes, edges) => {
    if (cyInstanceRef.current) {
      cyInstanceRef.current.destroy()
      cyInstanceRef.current = null
    }

    const elements = {
      nodes: nodes.map(node => ({
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          category: node.category,
          description: node.description
        }
      })),
      edges: edges.map(edge => ({
        data: {
          id: `${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          isMatchEdge: edge.label === '技术匹配'
        }
      }))
    }

    if (!cyRef.current) {
      console.error('cyRef.current 为空，无法渲染图谱')
      return
    }

    try {
      const cy = cytoscape({
        container: cyRef.current,
        elements,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#667eea',
              'label': 'data(label)',
              'font-size': '12px',
              'text-valign': 'center',
              'text-halign': 'center',
              'width': '60px',
              'height': '60px',
              'border-width': '2px',
              'border-color': '#764ba2',
              'color': 'white',
              'text-outline-color': '#667eea',
              'text-outline-width': '2px'
            }
          },
          {
            selector: 'node[type="Enterprise"]',
            style: {
              'background-color': '#52c41a',
              'border-color': '#73d13d',
              'text-outline-color': '#52c41a'
            }
          },
          {
            selector: 'node[category="技术需求"]',
            style: {
              'background-color': '#ff4757',
              'border-color': '#ff6b81',
              'text-outline-color': '#ff4757',
              'border-width': '3px'
            }
          },
          {
            selector: 'node[type="Patent"]',
            style: {
              'background-color': '#ff6b6b',
              'border-color': '#ff8787',
              'text-outline-color': '#ff6b6b'
            }
          },
          {
            selector: 'node[type="Paper"]',
            style: {
              'background-color': '#4ecdc4',
              'border-color': '#7ed3d3',
              'text-outline-color': '#4ecdc4'
            }
          },
          {
            selector: 'node[type="Project"]',
            style: {
              'background-color': '#f39c12',
              'border-color': '#ffad33',
              'text-outline-color': '#f39c12'
            }
          },
          {
            selector: 'node.highlighted',
            style: {
              'border-width': '4px',
              'border-color': '#ff4757',
              'background-color': '#ff6b81'
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#bdc3c7',
              'target-arrow-color': '#bdc3c7',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'arrow-scale': 1.5,
              'font-size': '10px',
              'text-rotation': 'autorotate',
              'text-margin-y': -10,
              'color': '#666'
            }
          },
          {
            selector: 'edge[isMatchEdge="true"]',
            style: {
              'width': 3,
              'line-color': '#ff4757',
              'target-arrow-color': '#ff4757',
              'line-style': 'dashed'
            }
          },
          {
            selector: 'edge.highlighted',
            style: {
              'width': 3,
              'line-color': '#ff4757',
              'target-arrow-color': '#ff4757'
            }
          }
        ],
        layout: {
          name: 'cose',
          animate: true,
          animationDuration: 1000,
          fit: true,
          padding: 50,
          nodeDimensionsIncludeLabels: true
        }
      })

      cyInstanceRef.current = cy

      cy.on('tap', 'node', (evt) => {
        const node = evt.target
        setSelectedNode(node.data())
        cy.elements().removeClass('highlighted')
        node.neighborhood().add(node).addClass('highlighted')
      })

      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          setSelectedNode(null)
          cy.elements().removeClass('highlighted')
        }
      })
    } catch (err) {
      console.error('渲染图谱失败:', err)
      setError('渲染图谱失败: ' + err.message)
    }
  }

  const exportGraph = () => {
    if (cyInstanceRef.current) {
      const png = cyInstanceRef.current.png({ full: true, scale: 2 })
      const link = document.createElement('a')
      link.href = png
      link.download = '企业需求对接图谱.png'
      link.click()
    }
  }

  return (
    <div className="enterprise-demand">
      <div className="ed-header">
        <h3>企业需求对接</h3>
        <p>输入企业需求，AI将自动分解需求并匹配学校科技成果</p>
      </div>

      <div className="ed-input-section">
        <div className="ed-input-group">
          <textarea
            className="ed-textarea"
            placeholder="请详细描述您的企业需求，例如：我们公司需要提升船舶的智能化水平，希望找到相关的技术解决方案..."
            value={demand}
            onChange={(e) => setDemand(e.target.value)}
            rows={4}
          />
          <button
            className="btn btn-primary"
            onClick={analyzeDemand}
            disabled={loading}
          >
            {loading ? '分析中...' : '分析需求并匹配'}
          </button>
        </div>
      </div>

      {error && (
        <div className="ed-error">
          {error}
        </div>
      )}

      {preciseNeeds.length > 0 && (
        <div className="ed-needs-section">
          <h4>精准需求分解</h4>
          <div className="ed-needs-list">
            {preciseNeeds.map((need, index) => (
              <div key={index} className="ed-need-item">
                <span className="ed-need-number">{index + 1}</span>
                <span className="ed-need-text">{need}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {matchedAchievements.length > 0 && (
        <div className="ed-achievements-section">
          <h4>匹配的科技成果</h4>
          <div className="ed-achievements-list">
            {matchedAchievements.map((achievement, index) => (
              <div key={index} className="ed-achievement-item">
                <div className="ed-achievement-header">
                  <span className={`ed-achievement-type ed-type-${achievement.type.toLowerCase()}`}>
                    {achievement.type === 'Patent' ? '专利' : achievement.type === 'Paper' ? '论文' : '项目'}
                  </span>
                  <h5 className="ed-achievement-title">{achievement.title}</h5>
                </div>
                <p className="ed-achievement-description">{achievement.description}</p>
                {achievement.matchedNeeds && achievement.matchedNeeds.length > 0 && (
                  <div className="ed-achievement-matches">
                    <span className="ed-match-label">匹配需求：</span>
                    {achievement.matchedNeeds.map((needIndex, i) => (
                      <span key={i} className="ed-match-tag">
                        {preciseNeeds[needIndex]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {graphData.nodes.length > 0 && (
        <div className="ed-graph-section">
          <div className="ed-graph-header">
            <h4>需求对接知识图谱</h4>
            <button className="btn btn-secondary" onClick={exportGraph}>
              导出图谱
            </button>
          </div>
          <div className="ed-graph-container" ref={cyRef}></div>
        </div>
      )}

      {selectedNode && (
        <div className="ed-node-info">
          <h5>节点详情</h5>
          <p><strong>名称：</strong>{selectedNode.label}</p>
          <p><strong>类型：</strong>{selectedNode.category}</p>
          {selectedNode.description && (
            <p><strong>描述：</strong>{selectedNode.description}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default EnterpriseDemand
