import React, { useState, useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import { graphData } from './graphData'
import { api } from '../../utils/api'
import {
  generateNodeTemplate,
  generateRelationTemplate,
  parseNodeExcel,
  parseRelationExcel,
  validateNodeData,
  validateRelationData,
  transformNodeData,
  transformRelationData
} from '../../utils/excelUtils'
import './KnowledgeGraph.css'

function KnowledgeGraph() {
  const cyRef = useRef(null)
  const cyInstanceRef = useRef(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentGraph, setCurrentGraph] = useState('shipping')
  const [showImportNodeModal, setShowImportNodeModal] = useState(false)
  const [showImportRelationModal, setShowImportRelationModal] = useState(false)
  const [nodeFile, setNodeFile] = useState(null)
  const [relationFile, setRelationFile] = useState(null)
  const [importErrors, setImportErrors] = useState([])
  const [importSuccess, setImportSuccess] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [stats, setStats] = useState({
    nodes: 0,
    edges: 0,
    subjects: 0,
    resources: 0,
    scenarios: 0
  })
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const initialData = graphData

  useEffect(() => {
    const loadGraphData = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await api.getGraph(currentGraph)
        setGraphData(data)
        
        if (!cyRef.current) return

        const elements = {
          nodes: data.nodes.map(node => ({
            data: {
              id: node.id,
              label: node.label,
              type: node.type,
              category: node.category,
              business: node.business
            }
          })),
          edges: data.edges.map(edge => ({
            data: {
              id: `${edge.source}-${edge.target}`,
              source: edge.source,
              target: edge.target,
              label: edge.label
            }
          }))
        }

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
              selector: 'node[type="Enterprise "]',
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
              selector: 'node[type="Cargo"]',
              style: {
                'background-color': '#f5222d',
                'border-color': '#ff4d4f',
                'text-outline-color': '#f5222d'
              }
            },
            {
              selector: 'node[type="Route"]',
              style: {
                'background-color': '#1a23c4ff',
                'border-color': '#1a23c4ff',
                'text-outline-color': '#1a23c4ff'
              }
            },
            {
              selector: 'node[type="Authority"]',
              style: {
                'background-color': '#abc41aff',
                'border-color': '#abc41aff',
                'text-outline-color': '#abc41aff'
              }
            },
                    {
              selector: 'node[type="TechField"]',
              style: {
                'background-color': '#c41a25ff',
                'border-color': '#c41a25ff',
                'text-outline-color': '#c41a25ff'
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
                'border-color': '#26de81',
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
              selector: 'node[type="Researcher"]',
              style: {
                'background-color': '#e83e8c',
                'border-color': '#f5a623',
                'text-outline-color': '#e83e8c'
              }
            },
            {
              selector: 'node[type="Department"]',
              style: {
                'background-color': '#a855f7',
                'border-color': '#d97706',
                'text-outline-color': '#a855f7'
              }
            },
            {
              selector: 'node[type="AcademicTitle"]',
              style: {
                'background-color': '#00d2d3',
                'border-color': '#33d9ff',
                'text-outline-color': '#00d2d3'
              }
            },
            {
              selector: 'node[type="Award"]',
              style: {
                'background-color': '#ffc107',
                'border-color': '#ffca28',
                'text-outline-color': '#ffc107'
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
              selector: 'edge.highlighted',
              style: {
                'line-color': '#667eea',
                'width': 3
              }
            },
            {
              selector: 'node.highlighted',
              style: {
                'border-width': 4,
                'border-color': '#667eea',
                'background-color': '#667eea'
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

        setStats({
          nodes: data.nodes.length,
          edges: data.edges.length,
          subjects: data.nodes.filter(n => n.type === 'subject').length,
          resources: data.nodes.filter(n => n.type === 'resource').length,
          scenarios: data.nodes.filter(n => n.type === 'scenario').length
        })

        setLoading(false)
      } catch (err) {
        console.error('加载图谱数据失败:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    loadGraphData()

    return () => {
      if (cyInstanceRef.current) {
        cyInstanceRef.current.destroy()
      }
    }
  }, [currentGraph])

  const handleFilterChange = (type) => {
    setFilterType(type)
    if (cyInstanceRef.current) {
      const cy = cyInstanceRef.current
      if (type === 'all') {
        cy.elements().show()
      } else {
        cy.elements().hide()
        cy.$(`node[type="${type}"]`).show()
        cy.$(`node[type="${type}"]`).connectedEdges().show()
        cy.$(`node[type="${type}"]`).neighborhood().show()
      }
    }
  }

  const handleSearch = async (term) => {
    setSearchTerm(term)
    if (cyInstanceRef.current) {
      const cy = cyInstanceRef.current
      
      if (term.trim()) {
        try {
          const results = await api.searchNodes(term)
          setSearchResults(results)
          setShowSearchResults(true)

          cy.elements().removeClass('highlighted').hide()
          
          results.forEach(result => {
            const node = cy.$(`#${result.id}`)
            if (node.length > 0) {
              node.show()
              node.connectedEdges().show()
              node.neighborhood().show()
              node.addClass('highlighted')
            }
          })

          if (results.length > 0) {
            const firstMatch = cy.$(`#${results[0].id}`)
            if (firstMatch.length > 0) {
              cy.animate({
                fit: {
                  eles: firstMatch.add(firstMatch.neighborhood()),
                  padding: 50
                },
                duration: 500
              })
            }
          }
        } catch (error) {
          console.error('搜索失败:', error)
          setSearchResults([])
          setShowSearchResults(false)
        }
      } else {
        setShowSearchResults(false)
        setSearchResults([])
        cy.elements().show().removeClass('highlighted')
      }
    }
  }

  const handleSearchResultClick = (nodeId) => {
    if (cyInstanceRef.current) {
      const cy = cyInstanceRef.current
      const node = cy.$(`#${nodeId}`)
      if (node.length > 0) {
        cy.animate({
          fit: {
            eles: node.add(node.neighborhood()),
            padding: 50
          },
          duration: 500
        })
        setSelectedNode(node.data())
        node.neighborhood().add(node).addClass('highlighted')
      }
      setShowSearchResults(false)
    }
  }

  const handleDeleteNode = (nodeId) => {
    if (window.confirm('确定要删除这个节点吗？')) {
      graphData[currentGraph].nodes = graphData[currentGraph].nodes.filter(n => n.id !== nodeId)
      graphData[currentGraph].edges = graphData[currentGraph].edges.filter(e => 
        e.source !== nodeId && e.target !== nodeId
      )

      if (cyInstanceRef.current) {
        const cy = cyInstanceRef.current
        cy.$(`#${nodeId}`).remove()
        
        setStats({
          nodes: graphData[currentGraph].nodes.length,
          edges: graphData[currentGraph].edges.length,
          subjects: graphData[currentGraph].nodes.filter(n => n.type === 'subject').length,
          resources: graphData[currentGraph].nodes.filter(n => n.type === 'resource').length,
          scenarios: graphData[currentGraph].nodes.filter(n => n.type === 'scenario').length
        })
      }

      setSelectedNode(null)
    }
  }

  const handleDownloadNodeTemplate = () => {
    generateNodeTemplate()
  }

  const handleDownloadRelationTemplate = () => {
    generateRelationTemplate()
  }

  const handleImportNodeFile = (e) => {
    const file = e.target.files[0]
    if (file) {
      setNodeFile(file)
      setImportErrors([])
      setImportSuccess(false)
    }
  }

  const handleImportRelationFile = (e) => {
    const file = e.target.files[0]
    if (file) {
      setRelationFile(file)
      setImportErrors([])
      setImportSuccess(false)
    }
  }

  const handleImportNodes = async () => {
    if (!nodeFile) {
      alert('请选择要导入的Excel文件')
      return
    }

    try {
      console.log('开始导入节点文件:', nodeFile.name, nodeFile.type, nodeFile.size)
      
      const jsonData = await parseNodeExcel(nodeFile)
      console.log('解析到的数据:', jsonData)
      
      if (!jsonData || jsonData.length === 0) {
        setImportErrors(['文件为空或没有数据'])
        return
      }
      
      const errors = validateNodeData(jsonData)
      
      if (errors.length > 0) {
        console.log('验证错误:', errors)
        setImportErrors(errors)
        return
      }

      const nodes = transformNodeData(jsonData)
      console.log('转换后的节点数据:', nodes)
      
      nodes.forEach(node => {
        const existingNode = graphData[currentGraph].nodes.find(n => n.id === node.id)
        if (!existingNode) {
          graphData[currentGraph].nodes.push(node)
        }
      })

      if (cyInstanceRef.current) {
        const cy = cyInstanceRef.current
        
        nodes.forEach(node => {
          const existingNode = cy.$(`#${node.id}`)
          if (existingNode.length === 0) {
            cy.add({
              data: {
                id: node.id,
                label: node.label,
                type: node.type,
                category: node.category
              }
            })
          }
        })

        cy.layout({
          name: 'cose',
          animate: true,
          animationDuration: 500
        }).run()
      }

      try {
        await api.createNodes(nodes)
        console.log('节点已保存到数据库')
      } catch (error) {
        console.error('保存节点到数据库失败:', error)
        alert('节点已在前端显示，但保存到数据库失败，请检查服务器连接')
      }

      setStats({
        nodes: graphData[currentGraph].nodes.length,
        edges: graphData[currentGraph].edges.length,
        subjects: graphData[currentGraph].nodes.filter(n => n.type === 'subject').length,
        resources: graphData[currentGraph].nodes.filter(n => n.type === 'resource').length,
        scenarios: graphData[currentGraph].nodes.filter(n => n.type === 'scenario').length
      })

      setImportSuccess(true)
      setNodeFile(null)
      alert(`成功导入 ${nodes.length} 个节点`)
    } catch (error) {
      console.error('导入节点失败:', error)
      console.error('错误详情:', error.message, error.stack)
      
      const errorMessage = error.message || '未知错误'
      if (errorMessage.includes('Invalid file') || errorMessage.includes('Unsupported file')) {
        setImportErrors(['文件格式不支持，请确保文件为.xlsx或.xls格式'])
      } else if (errorMessage.includes('Empty') || errorMessage.includes('empty')) {
        setImportErrors(['文件为空，请检查文件内容'])
      } else if (errorMessage.includes('Parse') || errorMessage.includes('parse')) {
        setImportErrors(['文件解析失败，请检查文件格式和内容是否正确'])
      } else {
        setImportErrors([`导入失败：${errorMessage}`])
      }
    }
  }

  const handleImportRelations = async () => {
    if (!relationFile) {
      alert('请选择要导入的Excel文件')
      return
    }

    try {
      console.log('开始导入关系文件:', relationFile.name, relationFile.type, relationFile.size)
      
      const jsonData = await parseRelationExcel(relationFile)
      console.log('解析到的数据:', jsonData)
      
      if (!jsonData || jsonData.length === 0) {
        setImportErrors(['文件为空或没有数据'])
        return
      }
      
      const existingNodeIds = graphData[currentGraph].nodes.map(n => n.id)
      console.log('现有节点ID:', existingNodeIds)
      
      const errors = validateRelationData(jsonData, existingNodeIds)
      
      if (errors.length > 0) {
        console.log('验证错误:', errors)
        setImportErrors(errors)
        return
      }

      const relations = transformRelationData(jsonData)
      console.log('转换后的关系数据:', relations)
      
      relations.forEach(relation => {
        const existingRelation = graphData[currentGraph].edges.find(e => e.id === relation.id)
        if (!existingRelation) {
          graphData[currentGraph].edges.push(relation)
        }
      })

      if (cyInstanceRef.current) {
        const cy = cyInstanceRef.current
        
        relations.forEach(relation => {
          const existingEdge = cy.$(`#${relation.id}`)
          if (existingEdge.length === 0) {
            cy.add({
              data: {
                id: relation.id,
                source: relation.source,
                target: relation.target,
                label: relation.label
              }
            })
          }
        })

        cy.layout({
          name: 'cose',
          animate: true,
          animationDuration: 500
        }).run()
      }

      try {
        await api.createEdges(relations)
        console.log('关系已保存到数据库')
      } catch (error) {
        console.error('保存关系到数据库失败:', error)
        alert('关系已在前端显示，但保存到数据库失败，请检查服务器连接')
      }

      setStats({
        nodes: graphData[currentGraph].nodes.length,
        edges: graphData[currentGraph].edges.length,
        subjects: graphData[currentGraph].nodes.filter(n => n.type === 'subject').length,
        resources: graphData[currentGraph].nodes.filter(n => n.type === 'resource').length,
        scenarios: graphData[currentGraph].nodes.filter(n => n.type === 'scenario').length
      })

      setImportSuccess(true)
      setRelationFile(null)
      alert(`成功导入 ${relations.length} 个关系`)
    } catch (error) {
      console.error('导入关系失败:', error)
      console.error('错误详情:', error.message, error.stack)
      
      const errorMessage = error.message || '未知错误'
      if (errorMessage.includes('Invalid file') || errorMessage.includes('Unsupported file')) {
        setImportErrors(['文件格式不支持，请确保文件为.xlsx或.xls格式'])
      } else if (errorMessage.includes('Empty') || errorMessage.includes('empty')) {
        setImportErrors(['文件为空，请检查文件内容'])
      } else if (errorMessage.includes('Parse') || errorMessage.includes('parse')) {
        setImportErrors(['文件解析失败，请检查文件格式和内容是否正确'])
      } else {
        setImportErrors([`导入失败：${errorMessage}`])
      }
    }
  }

  const handleExport = () => {
    const data = JSON.stringify(initialData, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentGraph === 'shipping' ? 'shipping' : 'school'}-knowledge-graph.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleGraphSwitch = (graphType) => {
    setCurrentGraph(graphType)
    setSelectedNode(null)
    setSearchTerm('')
    setFilterType('all')
    setShowSearchResults(false)
    setSearchResults([])
  }

  return (
    <div className="knowledge-graph">
      <div className="kg-header">
        <h2>科技服务知识图谱</h2>
        <div className="kg-switcher">
          <button
            className={`graph-switch-btn ${currentGraph === 'shipping' ? 'active' : ''}`}
            onClick={() => handleGraphSwitch('shipping')}
          >
            🚢 航运产业链知识图谱
          </button>
          <button
            className={`graph-switch-btn ${currentGraph === 'school' ? 'active' : ''}`}
            onClick={() => handleGraphSwitch('school')}
          >
            🎓 学校科技成果知识图谱
          </button>
        </div>
      </div>

      <div className="kg-controls">
        <div className="kg-search">
          <div className="search-container">
            <input
              type="text"
              placeholder="搜索节点..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="input"
            />
            {showSearchResults && searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((result, index) => (
                  <div
                    key={result.id}
                    className="search-result-item"
                    onClick={() => handleSearchResultClick(result.id)}
                  >
                    <span className="result-label">{result.label}</span>
                    <span className="result-category">{result.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="kg-actions">
          <button className="btn btn-primary" onClick={() => setShowImportNodeModal(true)}>
            导入节点
          </button>
          <button className="btn btn-secondary" onClick={() => setShowImportRelationModal(true)}>
            导入关系
          </button>
          <button className="btn btn-secondary" onClick={handleExport}>
            导出数据
          </button>
        </div>
      </div>

      <div className="kg-content">
        <div className="kg-graph">
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <div className="loading-text">加载中...</div>
            </div>
          )}
          {error && (
            <div className="error-overlay">
              <div className="error-icon">⚠️</div>
              <div className="error-message">
                <div className="error-title">加载失败</div>
                <div className="error-text">{error}</div>
                <button className="btn btn-primary" onClick={() => window.location.reload()}>
                  重新加载
                </button>
              </div>
            </div>
          )}
          <div ref={cyRef} className="kg-canvas"></div>
        </div>
        <div className="kg-sidebar">
          <div className="kg-stats card">
            <h3>图谱统计</h3>
            <div className="stat-item">
              <span className="stat-label">节点总数</span>
              <span className="stat-value">{stats.nodes}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">关系总数</span>
              <span className="stat-value">{stats.edges}</span>
            </div>
          </div>

          {selectedNode && (
            <div className="kg-details card">
              <h3>节点详情</h3>
              <div className="detail-item">
                <span className="detail-label">名称</span>
                <span className="detail-value">{selectedNode.label}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">类型</span>
                <span className="detail-value">{selectedNode.type}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">分类</span>
                <span className="detail-value">{selectedNode.category}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">ID</span>
                <span className="detail-value">{selectedNode.id}</span>
              </div>
              <div className="detail-actions">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteNode(selectedNode.id)}
                >
                  删除节点
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {showImportNodeModal && (
        <div className="modal-overlay" onClick={() => setShowImportNodeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>导入节点数据</h3>
              <button
                className="modal-close"
                onClick={() => setShowImportNodeModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="import-instructions">
                <h4>导入步骤：</h4>
                <ol>
                  <li>点击"下载模板"按钮获取Excel模板</li>
                  <li>按照模板格式填写节点数据</li>
                  <li>选择填写好的Excel文件</li>
                  <li>点击"导入"按钮完成导入</li>
                </ol>
              </div>
              <div className="form-group">
                <button className="btn btn-secondary" onClick={handleDownloadNodeTemplate}>
                  📥 下载节点导入模板
                </button>
              </div>
              <div className="form-group">
                <label>选择Excel文件 *</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportNodeFile}
                  className="input"
                />
              </div>
              {importErrors.length > 0 && (
                <div className="import-errors">
                  <h4>导入错误：</h4>
                  <ul>
                    {importErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importSuccess && (
                <div className="import-success">
                  ✓ 导入成功！
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowImportNodeModal(false)}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImportNodes}
              >
                导入
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportRelationModal && (
        <div className="modal-overlay" onClick={() => setShowImportRelationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>导入关系数据</h3>
              <button
                className="modal-close"
                onClick={() => setShowImportRelationModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="import-instructions">
                <h4>导入步骤：</h4>
                <ol>
                  <li>确保所有相关节点已导入到图谱中</li>
                  <li>点击"下载模板"按钮获取Excel模板</li>
                  <li>按照模板格式填写关系数据</li>
                  <li>选择填写好的Excel文件</li>
                  <li>点击"导入"按钮完成导入</li>
                </ol>
              </div>
              <div className="form-group">
                <button className="btn btn-secondary" onClick={handleDownloadRelationTemplate}>
                  📥 下载关系导入模板
                </button>
              </div>
              <div className="form-group">
                <label>选择Excel文件 *</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportRelationFile}
                  className="input"
                />
              </div>
              {importErrors.length > 0 && (
                <div className="import-errors">
                  <h4>导入错误：</h4>
                  <ul>
                    {importErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importSuccess && (
                <div className="import-success">
                  ✓ 导入成功！
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowImportRelationModal(false)}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImportRelations}
              >
                导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgeGraph
