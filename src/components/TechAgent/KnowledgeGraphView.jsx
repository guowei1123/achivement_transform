import React, { useState, useRef, useEffect } from 'react'
import cytoscape from 'cytoscape'
import { api } from '../../utils/api'
import './KnowledgeGraphView.css'

function KnowledgeGraphView({ onClose }) {
  const [enterpriseName, setEnterpriseName] = useState('')
  const [selectedNode, setSelectedNode] = useState(null)
  const [showPPTModal, setShowPPTModal] = useState(false)
  const [pptContent, setPPTContent] = useState('')
  const [loadingPPT, setLoadingPPT] = useState(false)
  const [pptDownloadUrl, setPptDownloadUrl] = useState('')
  const [downloadingPPT, setDownloadingPPT] = useState(false)
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [enterprise, setEnterprise] = useState(null)
  const [viewMode, setViewMode] = useState('chain')
  const [focusedNode, setFocusedNode] = useState(null)
  const [hasChainGraph, setHasChainGraph] = useState(false)
  const [exportingChainPPT, setExportingChainPPT] = useState(false)
  const [chainPPTProgress, setChainPPTProgress] = useState(0)
  const [chainPPTStatus, setChainPPTStatus] = useState('')
  const cyRef = useRef(null)
  const cyInstanceRef = useRef(null)

  useEffect(() => {
    if (graphData.nodes.length > 0) {
      const timer = setTimeout(() => {
        if (cyRef.current) {
          renderGraph(graphData.nodes, graphData.edges)
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [graphData])

  const handleGenerateIntegratedGraph = async () => {
    console.log('handleGenerateIntegratedGraph 被调用')
    console.log('enterpriseName:', enterpriseName)
    console.log('loading:', loading)
    
    if (!enterpriseName.trim()) {
      setError('请输入企业名称')
      return
    }

    try {
      console.log('开始生成融合图谱...')
      setLoading(true)
      setError(null)
      setViewMode('chain')
      setFocusedNode(null)

      console.log('调用API获取融合图谱数据...')
      const data = await api.getIntegratedGraph(enterpriseName)
      console.log('API返回数据:', data)
      
      setGraphData(data)
      setEnterprise(data.enterprise)
      setHasChainGraph(true)

      console.log('数据已设置，等待useEffect渲染...')
      setLoading(false)
    } catch (err) {
      console.error('生成融合图谱失败:', err)
      if (err.response && err.response.status === 404) {
        setError('企业不存在，请检查企业名称是否正确。可尝试：中远海运集团、中国船舶集团等')
      } else if (err.response && err.response.status === 500) {
        setError('服务器错误，请稍后重试')
      } else {
        setError(err.message || '生成融合图谱失败，请检查企业名称是否正确')
      }
      setLoading(false)
    }
  }

  const handleNodeClick = async (nodeData) => {
    console.log('点击节点:', nodeData)
    
    try {
      setLoading(true)
      setError(null)
      
      console.log('调用API获取节点技术需求...')
      const data = await api.getNodeTechNeeds(nodeData.label)
      console.log('API返回数据:', data)
      
      setGraphData(data)
      setFocusedNode(data.node)
      setViewMode('tech-needs')
      
      console.log('技术需求数据已设置，等待useEffect渲染...')
      setLoading(false)
    } catch (err) {
      console.error('获取节点技术需求失败:', err)
      setError(err.message || '获取节点技术需求失败')
      setLoading(false)
    }
  }

  const handleBackToChain = () => {
    console.log('返回产业链图谱')
    setViewMode('chain')
    setFocusedNode(null)
    
    if (enterprise) {
      handleGenerateIntegratedGraph()
    }
  }

  const renderGraph = (nodes, edges) => {
    console.log('renderGraph 被调用')
    console.log('nodes:', nodes)
    console.log('edges:', edges)
    
    if (cyInstanceRef.current) {
      console.log('销毁旧的Cytoscape实例')
      cyInstanceRef.current.destroy()
      cyInstanceRef.current = null
    }

    const elements = {
      nodes: nodes.map(node => {
        console.log('处理节点:', node)
        return {
          data: {
            id: node.id,
            label: node.label,
            type: node.type,
            category: node.category || '',
            level: node.level || 0,
            isChainNode: node.category === '技术需求' || ['Enterprise', 'Vessel', 'Port', 'Cargo', 'Route'].includes(node.type)
          }
        }
      }),
      edges: edges.map(edge => {
        console.log('处理边:', edge)
        return {
          data: {
            id: `${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            label: edge.label,
            isMatchEdge: edge.label === '技术匹配'
          }
        }
      })
    }

    console.log('elements:', elements)
    console.log('cyRef.current:', cyRef.current)
    
    if (!cyRef.current) {
      console.error('cyRef.current 为空，无法创建Cytoscape实例')
      return
    }

    try {
      console.log('开始创建Cytoscape实例...')
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
            selector: 'node[level="0"]',
            style: {
              'background-color': '#52c41a',
              'border-color': '#73d13d',
              'text-outline-color': '#52c41a',
              'width': '80px',
              'height': '80px',
              'font-size': '14px',
              'font-weight': 'bold'
            }
          },
          {
            selector: 'node[level="1"]',
            style: {
              'background-color': '#1890ff',
              'border-color': '#40a9ff',
              'text-outline-color': '#1890ff',
              'width': '70px',
              'height': '70px',
              'font-size': '13px'
            }
          },
          {
            selector: 'node[level="2"]',
            style: {
              'background-color': '#faad14',
              'border-color': '#ffc53d',
              'text-outline-color': '#faad14',
              'width': '60px',
              'height': '60px',
              'font-size': '12px'
            }
          },
          {
            selector: 'node[level="3"]',
            style: {
              'background-color': '#ff6b6b',
              'border-color': '#ff8787',
              'text-outline-color': '#ff6b6b',
              'width': '50px',
              'height': '50px',
              'font-size': '11px'
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
            selector: 'node[type="Vessel"]',
            style: {
              'background-color': '#1890ff',
              'border-color': '#40a9ff',
              'text-outline-color': '#1890ff'
            }
          },
          {
            selector: 'node[type="Port"]',
            style: {
              'background-color': '#faad14',
              'border-color': '#ffc53d',
              'text-outline-color': '#faad14'
            }
          },
          {
            selector: 'node[type="Patent"]',
            style: {
              'background-color': '#1890ff',
              'border-color': '#40a9ff',
              'text-outline-color': '#1890ff'
            }
          },
          {
            selector: 'node[type="Paper"]',
            style: {
              'background-color': '#1890ff',
              'border-color': '#40a9ff',
              'text-outline-color': '#1890ff'
            }
          },
          {
            selector: 'node[type="Project"]',
            style: {
              'background-color': '#1890ff',
              'border-color': '#40a9ff',
              'text-outline-color': '#1890ff'
            }
          },
          {
            selector: 'node[category="技术需求"]',
            style: {
              'background-color': '#ff4757',
              'border-color': '#ff6b81',
              'text-outline-color': '#ff4757',
              'border-width': '3px',
              'width': '70px',
              'height': '70px',
              'font-size': '13px'
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
              'text-background-color': '#ffffff',
              'text-background-opacity': 0.8,
              'text-background-padding': '3px'
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
          name: 'preset'
        }
      })

      console.log('Cytoscape实例创建成功')
      cyInstanceRef.current = cy

      const applyHierarchicalLayout = () => {
        const levelGroups = {}
        cy.nodes().forEach(node => {
          const level = node.data('level') || 0
          if (!levelGroups[level]) {
            levelGroups[level] = []
          }
          levelGroups[level].push(node)
        })

        const levels = Object.keys(levelGroups).map(Number).sort((a, b) => a - b)
        const levelWidth = 300
        const nodeHeight = 100
        const nodeWidth = 100

        levels.forEach((level, index) => {
          const nodesInLevel = levelGroups[level]
          const x = 100 + index * levelWidth
          const totalHeight = nodesInLevel.length * nodeHeight
          const startY = -totalHeight / 2

          nodesInLevel.forEach((node, nodeIndex) => {
            node.position({
              x: x,
              y: startY + nodeIndex * nodeHeight
            })
          })
        })

        cy.fit(undefined, 50)
      }

      const applyTechNeedsLayout = () => {
        const enterpriseNode = cy.nodes('[type="Enterprise"]')
        const techNeedNodes = cy.nodes('[type="technical requirements"]')
        const achievementNodes = cy.nodes('[type="Patent"]')

        if (enterpriseNode.length === 0) {
          cy.layout({
            name: 'cose',
            animate: true,
            animationDuration: 500,
            fit: true,
            padding: 50
          }).run()
          return
        }

        const centerX = 0
        const centerY = 0
        const enterpriseRadius = 0

        enterpriseNode.position({ x: centerX, y: centerY })

        const techNeedRadius = 250
        const achievementRadius = 450

        techNeedNodes.forEach((node, index) => {
          const angle = (index / techNeedNodes.length) * 2 * Math.PI
          const x = centerX + techNeedRadius * Math.cos(angle)
          const y = centerY + techNeedRadius * Math.sin(angle)
          node.position({ x, y })
        })

        achievementNodes.forEach((node, index) => {
          const angle = (index / achievementNodes.length) * 2 * Math.PI
          const x = centerX + achievementRadius * Math.cos(angle)
          const y = centerY + achievementRadius * Math.sin(angle)
          node.position({ x, y })
        })

        cy.fit(undefined, 50)
      }

      const currentViewMode = viewMode
      setTimeout(() => {
        if (currentViewMode === 'tech-needs') {
          applyTechNeedsLayout()
        } else {
          applyHierarchicalLayout()
        }
      }, 100)

      cy.on('tap', 'node', (evt) => {
        const node = evt.target
        const nodeData = node.data()
        
        if (viewMode === 'chain') {
          setFocusedNode(nodeData)
          handleNodeClick(nodeData)
        } else {
          setSelectedNode(nodeData)
          cy.elements().removeClass('highlighted')
          node.neighborhood().add(node).addClass('highlighted')
        }
      })

      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          setSelectedNode(null)
          cy.elements().removeClass('highlighted')
        }
      })
      
      console.log('renderGraph 完成')
    } catch (err) {
      console.error('renderGraph 出错:', err)
      setError('渲染图谱失败: ' + err.message)
    }
  }

  const handleExport = () => {
    const cy = cyInstanceRef.current
    if (cy) {
      const png = cy.png({ full: true, scale: 2 })
      const link = document.createElement('a')
      link.href = png
      link.download = `knowledge-graph-${viewMode}-${Date.now()}.png`
      link.click()
    }
  }

  const handleGeneratePPT = async () => {
    if (!selectedNode) return
    
    try {
      setDownloadingPPT(true)
      const data = await api.generateNodePPT(selectedNode.label)
      
      if (data.success) {
        setPptDownloadUrl(data.data.ppt_url)
      } else {
        alert('生成PPT失败：' + (data.error || '未知错误'))
      }
    } catch (error) {
      console.error('生成PPT失败:', error)
      alert('生成PPT失败：' + error.message)
    } finally {
      setDownloadingPPT(false)
    }
  }

  const handleDownloadPPT = () => {
    if (!pptDownloadUrl) {
      alert('PPT尚未生成，请先生成PPT')
      return
    }
    
    const link = document.createElement('a')
    link.href = pptDownloadUrl
    link.download = `${selectedNode.label}.pptx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleViewPPT = async () => {
    if (!selectedNode) return
    
    try {
      setLoadingPPT(true)
      setPptDownloadUrl('')
      
      const data = await api.getNodePPT(selectedNode.label)
      
      if (data.success) {
        const hasPPTContent = data.data.ppt_content && data.data.ppt_content !== '暂无PPT描述'
        const content = hasPPTContent ? data.data.ppt_content : '暂无PPT描述'
        setPPTContent(content)
        setShowPPTModal(true)
        
        // 如果没有PPT描述，自动生成PPT
        if (!hasPPTContent) {
          await handleGeneratePPT()
        }
      } else {
        alert('获取PPT内容失败：' + (data.error || '未知错误'))
      }
    } catch (error) {
      console.error('获取PPT内容失败:', error)
      alert('获取PPT内容失败：' + error.message)
    } finally {
      setLoadingPPT(false)
    }
  }

  const handleClosePPTModal = () => {
    setShowPPTModal(false)
    setPPTContent('')
  }

  const handleExportChainPPT = async () => {
    if (!enterprise || !enterprise.label) {
      alert('请先生成产业链知识图谱')
      return
    }

    try {
      setExportingChainPPT(true)
      setChainPPTProgress(0)
      setChainPPTStatus('正在查询产业链企业...')
      console.log('开始导出产业链PPT，企业:', enterprise.label)

      setChainPPTProgress(10)
      setChainPPTStatus('正在匹配技术成果...')
      
      const data = await api.exportChainPPT(enterprise.label)
      console.log('导出API返回:', data)
      
      setChainPPTProgress(70)
      setChainPPTStatus('正在生成PPT文件...')
      
      if (data.success) {
        const pptUrl = data.data?.ppt_url || data.filePath
        const fileName = data.data?.file_name || data.fileName || `${enterprise.label}_产业链汇报PPT.pptx`
        
        setChainPPTProgress(85)
        setChainPPTStatus('正在下载PPT文件...')
        
        if (pptUrl) {
          const fullUrl = `http://localhost:3002${pptUrl}`
          
          try {
            const response = await fetch(fullUrl)
            if (!response.ok) throw new Error('下载失败')
            
            const contentLength = response.headers.get('content-length')
            const total = contentLength ? parseInt(contentLength, 10) : 0
            let loaded = 0
            
            const reader = response.body.getReader()
            const chunks = []
            
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              
              chunks.push(value)
              loaded += value.length
              
              if (total > 0) {
                const downloadProgress = Math.round((loaded / total) * 15)
                setChainPPTProgress(85 + downloadProgress)
                setChainPPTStatus(`正在下载PPT文件... ${Math.round((loaded / total) * 100)}%`)
              } else {
                setChainPPTProgress(90)
                setChainPPTStatus('正在下载PPT文件...')
              }
            }
            
            const blob = new Blob(chunks, { 
              type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
            })
            const blobUrl = URL.createObjectURL(blob)
            
            setChainPPTProgress(100)
            setChainPPTStatus('PPT生成完成！')
            
            window.open(blobUrl, '_blank')
            
            const link = document.createElement('a')
            link.href = blobUrl
            link.download = fileName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
            console.log('PPT下载成功:', fileName)
          } catch (downloadError) {
            console.error('下载PPT失败，尝试直接打开:', downloadError)
            window.open(fullUrl, '_blank')
            setChainPPTProgress(100)
            setChainPPTStatus('PPT已生成！')
          }
        } else {
          alert('PPT生成成功但未获取到下载地址')
        }
      } else {
        console.error('导出失败:', data.error)
        alert('导出产业链PPT失败：' + (data.error || '未知错误'))
      }
    } catch (error) {
      console.error('导出产业链PPT失败:', error)
      alert('导出产业链PPT失败：' + error.message)
    } finally {
      setTimeout(() => {
        setExportingChainPPT(false)
        setChainPPTProgress(0)
        setChainPPTStatus('')
      }, 2000)
    }
  }



  return (
    <div className="kg-view">
      <div className="kg-header">
        <h3>知识图谱 - 成果对接系统</h3>
        <div className="kg-controls">
          <button className="btn btn-secondary" onClick={onClose}>
            返回对话
          </button>
          <button className="btn btn-primary" onClick={handleExport}>
            导出图谱
          </button>
        </div>
      </div>

      <div className="kg-toolbar">
        {viewMode === 'chain' ? (
          <div className="kg-integrated-mode">
            <div className="kg-integrated-info">
              <span className="enterprise-label">当前企业：</span>
              <span className="enterprise-name">{enterprise?.label || enterpriseName}</span>
            </div>
            <div className="kg-enterprise-input">
              <input
                type="text"
                className="input"
                placeholder="请输入企业名称（如：中国船舶集团）..."
                value={enterpriseName}
                onChange={(e) => setEnterpriseName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleGenerateIntegratedGraph()
                  }
                }}
              />
              <button 
                className="btn btn-primary" 
                onClick={handleGenerateIntegratedGraph}
                disabled={loading}
              >
                生成产业链图谱
              </button>
              <button 
                className="btn btn-success" 
                onClick={handleExportChainPPT}
                disabled={!hasChainGraph || exportingChainPPT}
              >
                {exportingChainPPT ? (
                  <span className="chain-ppt-progress-wrapper">
                    <span className="chain-ppt-progress-text">{chainPPTStatus || '生成中...'}</span>
                    <span className="chain-ppt-progress-bar">
                      <span className="chain-ppt-progress-fill" style={{ width: `${chainPPTProgress}%` }}></span>
                    </span>
                  </span>
                ) : '生成产业链汇总PPT'}
              </button>
            </div>
          </div>
        ) : (
          <div className="kg-tech-needs-mode">
            <div className="kg-tech-needs-info">
              <span className="enterprise-label">当前节点：</span>
              <span className="enterprise-name">{focusedNode?.label}</span>
            </div>
            <div className="kg-tech-needs-actions">
              <button 
                className="btn btn-secondary" 
                onClick={handleBackToChain}
                disabled={loading}
              >
                返回产业链图谱
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="kg-content">
        <div className="kg-graph-container">
          {loading ? (
            <div className="kg-loading">
              <div className="spinner"></div>
              <p>正在加载知识图谱...</p>
            </div>
          ) : error ? (
            <div className="kg-error">
              <p>加载失败：{error}</p>
              <button className="btn btn-primary" onClick={handleGenerateIntegratedGraph}>
                重试
              </button>
            </div>
          ) : (
            <div 
              ref={cyRef} 
              className="kg-canvas"
              style={{ width: '100%', height: '100%' }}
            />
          )}
        </div>

        <div className="kg-sidebar">
          <div className="kg-integrated-stats card">
            <h4>融合图谱统计</h4>
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-label">产业链节点</span>
                <span className="stat-value">{graphData.nodes.filter(n => 
                    n.category === '技术需求' || ['Enterprise', 'Vessel', 'Port', 'Cargo', 'Route'].includes(n.type)
                  ).length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">科技成果节点</span>
                  <span className="stat-value">{graphData.nodes.filter(n => 
                    ['Patent', 'Paper', 'Project'].includes(n.type)
                  ).length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">技术匹配关系</span>
                  <span className="stat-value">{graphData.edges.filter(e => e.label === '技术匹配').length}</span>
                </div>
              </div>
            </div>


          <div className="kg-stats card">
            <h4>图谱统计</h4>
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-label">节点总数</span>
                <span className="stat-value">{graphData.nodes.length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">关系总数</span>
                <span className="stat-value">{graphData.edges.length}</span>
              </div>
            </div>
          </div>

          {selectedNode && (
            <div className="kg-node-details card">
              <h4>节点详情</h4>
              <div className="node-detail-item">
                <span className="detail-label">名称：</span>
                <span className="detail-value">{selectedNode.label}</span>
              </div>
              <div className="node-detail-item">
                <span className="detail-label">类型：</span>
                <span className="detail-value">{selectedNode.type}</span>
              </div>
              <div className="node-detail-item">
                <span className="detail-label">分类：</span>
                <span className="detail-value">{selectedNode.category}</span>
              </div>
              <div className="node-detail-item">
                <span className="detail-label">ID：</span>
                <span className="detail-value">{selectedNode.id}</span>
              </div>
              {selectedNode.structural_score !== undefined && (
                <div className="node-detail-item">
                  <span className="detail-label">结构得分：</span>
                  <span className="detail-value">{(selectedNode.structural_score * 100).toFixed(1)}%</span>
                </div>
              )}
              {selectedNode.semantic_score !== undefined && (
                <div className="node-detail-item">
                  <span className="detail-label">语义得分：</span>
                  <span className="detail-value">{(selectedNode.semantic_score * 100).toFixed(1)}%</span>
                </div>
              )}
              {selectedNode.fused_score !== undefined && (
                <div className="node-detail-item">
                  <span className="detail-label">综合得分：</span>
                  <span className="detail-value" style={{ fontWeight: 'bold', color: '#52c41a' }}>
                    {(selectedNode.fused_score * 100).toFixed(1)}%
                  </span>
                </div>
              )}
              {selectedNode.recommendation_reason && (
                <div className="node-detail-item">
                  <span className="detail-label">推荐理由：</span>
                  <span className="detail-value" style={{ fontSize: '12px' }}>
                    {selectedNode.recommendation_reason}
                  </span>
                </div>
              )}
              {selectedNode.matching_path && selectedNode.matching_path.length > 0 && (
                <div className="node-detail-item">
                  <span className="detail-label">匹配路径：</span>
                  <div className="detail-value" style={{ fontSize: '11px' }}>
                    {selectedNode.matching_path.map((item, index) => (
                      <div key={index} style={{ marginLeft: index * 10 }}>
                        {index === 0 ? '→ ' : '  → '}{item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedNode.patent_number && (
                <div className="node-detail-item">
                  <span className="detail-label">专利号：</span>
                  <span className="detail-value">{selectedNode.patent_number}</span>
                </div>
              )}
              {selectedNode.team && (
                <div className="node-detail-item">
                  <span className="detail-label">团队：</span>
                  <span className="detail-value">{selectedNode.team}</span>
                </div>
              )}
              {selectedNode.category === '科技成果' && (
                <div className="node-detail-item">
                  <button 
                    className="btn btn-primary" 
                    onClick={handleViewPPT}
                    disabled={loadingPPT}
                    style={{ width: '100%', marginTop: '10px' }}
                  >
                    {loadingPPT ? '加载中...' : '查看技术PPT'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="kg-legend card">
            <h4>图例</h4>
            <div className="legend-items">
              <div className="legend-section">
                <div className="legend-section-title">产业链节点</div>
                <div className="legend-item">
                  <div className="legend-color" style={{ background: '#52c41a' }}></div>
                  <span>企业/船舶/港口</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color" style={{ background: '#ff4757' }}></div>
                  <span>技术需求</span>
                </div>
              </div>
              <div className="legend-section">
                <div className="legend-section-title">创新链节点</div>
                <div className="legend-item">
                  <div className="legend-color" style={{ background: '#ff6b6b' }}></div>
                  <span>专利</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color" style={{ background: '#4ecdc4' }}></div>
                  <span>论文</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color" style={{ background: '#f39c12' }}></div>
                  <span>项目</span>
                </div>
              </div>
              <div className="legend-section">
                <div className="legend-section-title">关系类型</div>
                <div className="legend-item">
                  <div className="legend-line" style={{ background: '#bdc3c7' }}></div>
                  <span>产业链关系</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line" style={{ background: '#ff4757', borderStyle: 'dashed' }}></div>
                  <span>技术匹配</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPPTModal && (
        <div className="ppt-modal-overlay" onClick={handleClosePPTModal}>
          <div className="ppt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ppt-modal-header">
              <h3>技术PPT描述</h3>
              <button className="ppt-modal-close" onClick={handleClosePPTModal}>
                ×
              </button>
            </div>
            <div className="ppt-modal-body">
              <div className="ppt-node-info">
                <div className="ppt-node-title">{selectedNode?.label}</div>
                <div className="ppt-node-type">{selectedNode?.type}</div>
              </div>
              <div className="ppt-content">
                {pptContent.split('\n').map((line, index) => (
                  <div key={index} className="ppt-line">
                    {line}
                  </div>
                ))}
              </div>
            </div>
            <div className="ppt-modal-footer">
              <button 
                className="btn btn-success" 
                onClick={handleDownloadPPT}
                disabled={downloadingPPT || !pptDownloadUrl}
              >
                {downloadingPPT ? '生成中...' : pptDownloadUrl ? '下载PPT' : '生成PPT'}
              </button>
              <button className="btn btn-secondary" onClick={handleClosePPTModal}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgeGraphView
