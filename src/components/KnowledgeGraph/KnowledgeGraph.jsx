import React, { useState, useEffect, useRef, useCallback } from 'react'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import dagre from 'cytoscape-dagre'
cytoscape.use(fcose)
cytoscape.use(dagre)
import { api } from '../../utils/api'
import * as XLSX from 'xlsx'
import './KnowledgeGraph.css'

const NODE_STYLES = {
  Input: { color: '#2f6fed', border: '#76a1ff', outline: '#2f6fed', size: 68 },
  Industry: { color: '#0f9d7a', border: '#4cc9a8', outline: '#0f9d7a', size: 92 },
  MidProduct: { color: '#f08c2e', border: '#f5b45e', outline: '#f08c2e', size: 72 },
  FinalProduct: { color: '#d94f4f', border: '#ee8585', outline: '#d94f4f', size: 76 },
  TechRoot: { color: '#7c3aed', border: '#a78bfa', outline: '#7c3aed', size: 104 },
  TechField: { color: '#3657c8', border: '#7f93eb', outline: '#3657c8', size: 84 },
  Tech: { color: '#1c9ab0', border: '#63c7d7', outline: '#1c9ab0', size: 64 },
  Layer2: { color: '#2f6fed', border: '#76a1ff', outline: '#2f6fed', size: 68 },
  Layer3: { color: '#f08c2e', border: '#f5b45e', outline: '#f08c2e', size: 72 },
  Layer4: { color: '#0f9d7a', border: '#4cc9a8', outline: '#0f9d7a', size: 76 },
  Value: { color: '#d94f4f', border: '#ee8585', outline: '#d94f4f', size: 82 },
}
const defaultStyle = { color: '#3657c8', border: '#7f93eb', outline: '#3657c8', size: 62 }

const CHAIN_NODE_TYPES = ['Layer2', 'Layer3', 'Layer4', 'Value']
const TECH_NODE_TYPES = ['TechRoot', 'TechField', 'Tech']
const FUSION_TECH_NODE_TYPES = ['Tech']
const FUSION_NODE_TYPES = ['Tech', 'Industry']
const FUSION_CHAIN_NODE_TYPES = ['Input', 'Industry', 'MidProduct', 'FinalProduct', 'Layer2', 'Layer3', 'Layer4', 'Value']
const FUSION_LAYOUT_ORDER = {
  Input: 0,
  Layer2: 0,
  Industry: 1,
  Layer3: 1,
  MidProduct: 2,
  Layer4: 2,
  FinalProduct: 3,
  Value: 3,
}

const NODE_TYPE_LABELS = {
  Input: '中间投入品', Industry: '产业主体', MidProduct: '中间产品',
  FinalProduct: '最终产品', TechRoot: '技术成果', TechField: '一级分类', Tech: '二级分类',
  Layer2: '装备与材料供应', Layer3: '设计与建造', Layer4: '运营与后服务', Value: '最终价值',
}

const UI_NODE_LABELS = {
  Input: '中间投入品',
  Industry: '产业主体',
  MidProduct: '中间产品',
  FinalProduct: '最终产品',
  TechRoot: '技术成果',
  TechField: '一级分类',
  Tech: '二级分类',
  Layer2: '装备与材料供应',
  Layer3: '设计与建造',
  Layer4: '运营与后服务',
  Value: '最终价值',
}

const NODE_TYPE_OPTIONS = [
  'Input',
  'Industry',
  'MidProduct',
  'FinalProduct',
  'TechField',
  'Tech',
  'Layer2',
  'Layer3',
  'Layer4',
  'Value',
]

const INTERNAL_NODE_DETAIL_KEYS = new Set([
  'id',
  'nodeId',
  'label',
  'fullName',
  'type',
  'nodeType',
  'name',
  'isFusionTech',
  'isFusionChain',
  'textOutlineColor',
  'allProperties',
])

const NODE_DETAIL_LABELS = {
  field: '所属领域',
  source: '数据来源',
  category: '分类',
  description: '描述',
  desc: '描述',
  summary: '摘要',
  content: '内容',
  file_name: '文件名称',
  ppt_url: 'PPT链接',
  file_path: '文件路径',
}

function getFirstNonEmpty(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '') || ''
}

function formatDetailValue(value) {
  if (Array.isArray(value)) {
    return value.join('、')
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value)
  }
  return String(value)
}

function KnowledgeGraph() {
  const cyRef = useRef(null)
  const cyInstanceRef = useRef(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedEdge, setSelectedEdge] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentGraph, setCurrentGraph] = useState('chain')
  const [selectedIndustry, setSelectedIndustry] = useState('waterway')
  const [chainIndustries, setChainIndustries] = useState([
    { value: 'waterway', label: '三峡水运新通道产业链' },
    { value: 'automotive', label: '汽车产业链' },
  ])
  const [graphDataState, setGraphDataState] = useState({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({ nodes: 0, edges: 0 })
  const [nodeTypes, setNodeTypes] = useState([])
  const [relTypes, setRelTypes] = useState([])
  const [toast, setToast] = useState(null)

  const [showAddNodeModal, setShowAddNodeModal] = useState(false)
  const [showAddEdgeModal, setShowAddEdgeModal] = useState(false)
  const [showEditNodeModal, setShowEditNodeModal] = useState(false)
  const [showEditEdgeModal, setShowEditEdgeModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showSnapshotModal, setShowSnapshotModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  const [addNodeForm, setAddNodeForm] = useState({ name: '', nodeType: 'Input', properties: {}, autoSource: '' })
  const [addEdgeForm, setAddEdgeForm] = useState({ source: '', target: '', relType: '' })
  const [editNodeForm, setEditNodeForm] = useState({ name: '', nodeType: '', properties: {} })
  const [editEdgeForm, setEditEdgeForm] = useState({ source: '', target: '', oldRelType: '', newRelType: '' })
  const [importFile, setImportFile] = useState(null)
  const [importFormat, setImportFormat] = useState('json')
  const [importText, setImportText] = useState('')
  const [importErrors, setImportErrors] = useState([])
  const [importSuccess, setImportSuccess] = useState(false)
  const [snapshots, setSnapshots] = useState([])
  const [snapshotDesc, setSnapshotDesc] = useState('')

  const selectedNodeRecord = selectedNode
    ? graphDataState.nodes.find((node) => {
        const keys = [
          selectedNode.nodeId,
          selectedNode.fullName,
          selectedNode.name,
          selectedNode.label,
          selectedNode.id,
        ].filter(Boolean)
        return keys.some((key) => node.name === key || node.label === key || node.id === key)
      }) || null
    : null
  const selectedNodeDetailSource = {
    ...(selectedNode?.allProperties || {}),
    ...(selectedNodeRecord || {}),
    ...(selectedNode || {}),
  }
  const selectedNodeName = getFirstNonEmpty(
    selectedNode?.fullName,
    selectedNode?.name,
    selectedNode?.allProperties?.name,
    selectedNodeRecord?.name,
    selectedNodeRecord?.label,
    selectedNode?.label,
    selectedNode?.id
  )
  const selectedNodeType = getFirstNonEmpty(selectedNodeRecord?.nodeType, selectedNodeRecord?.type, selectedNode?.type)
  const selectedNodeProperties = Object.entries(selectedNodeDetailSource)
    .filter(([key, value]) => !INTERNAL_NODE_DETAIL_KEYS.has(key) && value !== null && value !== undefined && value !== '')
  const selectedEdgeLabel = selectedEdge?.label || selectedEdge?.relType || ''

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const isTechNodeType = useCallback((type) => TECH_NODE_TYPES.includes(type), [])
  const isFusionTechNodeType = useCallback((type) => FUSION_TECH_NODE_TYPES.includes(type), [])
  const isFusionChainNodeType = useCallback((type) => FUSION_CHAIN_NODE_TYPES.includes(type), [])

  const buildCytoscape = useCallback((data, graphType) => {
    if (!cyRef.current) return

    const nodeStyleEntries = Object.entries(NODE_STYLES).map(([type, style]) => ({
      selector: `node[type="${type}"]`,
      style: {
        'background-color': style.color,
        'border-color': style.border,
        'width': `${style.size}px`,
        'height': `${style.size}px`,
      }
    }))

    if (cyInstanceRef.current) {
      cyInstanceRef.current.destroy()
    }

    const nodeTypeByName = new Map(data.nodes.map((node) => [node.name, node.nodeType]))
    const elements = {
      nodes: data.nodes.map(node => {
        const nodeStyle = NODE_STYLES[node.nodeType] || defaultStyle
        const props = { ...node }
        const isFusionNode = graphType === 'fusion'
        const isFusionTechNode = isFusionNode && isFusionTechNodeType(node.nodeType)
        const displayName = node.name || node.label || node.id || ''
        return {
          data: {
            id: displayName,
            nodeId: node.id || '',
            label: isFusionNode ? displayName : (displayName.length > 8 ? displayName.substring(0, 8) + '...' : displayName),
            fullName: displayName,
            name: displayName,
            type: node.nodeType,
            isFusionTech: isFusionTechNode ? 'true' : 'false',
            isFusionChain: isFusionNode && isFusionChainNodeType(node.nodeType) ? 'true' : 'false',
            textOutlineColor: nodeStyle.color,
            allProperties: props,
          }
        }
      }),
      edges: data.edges.map(edge => {
        let source = edge.source
        let target = edge.target

        if (graphType === 'fusion') {
          const sourceType = nodeTypeByName.get(edge.source)
          const targetType = nodeTypeByName.get(edge.target)
          const sourceIsTech = isFusionTechNodeType(sourceType)
          const targetIsTech = isFusionTechNodeType(targetType)
          const targetIsChain = isFusionChainNodeType(targetType)

          if (!sourceIsTech && targetIsTech) {
            source = edge.target
            target = edge.source
          } else if (sourceIsTech && !targetIsChain && targetIsTech === false) {
            source = edge.source
            target = edge.target
          }
        }

        return {
          data: {
            id: `edge-${source}-${target}-${edge.relType || edge.label}`,
            source,
            target,
            label: edge.relType || edge.label,
            isTechMatch: String(edge.relType || edge.label || '').includes('技术匹配') ? 'true' : 'false',
          }
        }
      })
    }

    const cy = cytoscape({
      container: cyRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#3657c8',
            'label': 'data(label)',
            'font-size': '13px',
            'font-weight': 700,
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 12,
            'width': '60px',
            'height': '60px',
            'border-width': 3,
            'border-color': 'rgba(255,255,255,0.92)',
            'color': '#17324d',
            'text-outline-width': 0,
            'text-wrap': 'ellipsis',
            'text-max-width': '120px',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.92,
            'text-background-padding': '4px',
            'text-border-opacity': 0,
            'shape': 'ellipse',
            'background-opacity': 0.96,
            'min-zoomed-font-size': 9,
            'transition-property': 'border-width, border-color, background-color, width, height, color',
            'transition-duration': '0.3s',
            'transition-timing-function': 'ease-out',
          }
        },
        {
          selector: 'node[isFusionChain = "true"]',
          style: {
            'label': 'data(fullName)',
            'font-size': '12px',
            'text-wrap': 'wrap',
            'text-max-width': '118px',
            'text-background-opacity': 0.96,
            'text-background-padding': '5px',
            'text-margin-y': 10,
          }
        },
        ...nodeStyleEntries,
        {
          selector: 'node[type="TechRoot"]',
          style: {
            'label': 'data(label)',
          }
        },
        {
          selector: 'node[isFusionTech = "true"]',
          style: {
            'shape': 'ellipse',
            'label': 'data(fullName)',
            'width': '86px',
            'height': '86px',
            'font-size': '12px',
            'font-weight': 700,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-margin-y': 0,
            'text-wrap': 'wrap',
            'text-max-width': '78px',
            'color': '#10233f',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.88,
            'text-background-padding': '3px',
            'border-width': 2,
            'border-color': 'rgba(23,50,77,0.22)',
          }
        },
        {
          selector: 'node.highlighted',
          style: {
            'border-width': 4,
            'border-color': '#17324d',
            'z-index': 20,
            'text-background-color': '#fefefe',
            'text-background-opacity': 1,
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#c8d6e5',
            'target-arrow-color': '#a4b0be',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1,
            'font-size': '11px',
            'label': 'data(label)',
            'text-rotation': 'autorotate',
            'text-margin-y': -10,
            'color': '#fff',
            'line-opacity': 0.6,
            'transition-property': 'line-color, width, line-opacity',
            'transition-duration': '0.3s',
          }
        },
        {
          selector: 'node:active',
          style: {
            'overlay-opacity': 0,
          }
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#667eea',
            'width': 2,
            'line-opacity': 1,
            'target-arrow-color': '#667eea',
          }
        },
        {
          selector: 'edge[isTechMatch = "true"]',
          style: {
            'line-color': '#1c9ab0',
            'target-arrow-color': '#1c9ab0',
            'line-style': 'dashed',
            'width': 2.5,
            'line-opacity': 0.9,
          }
        },
        {
          selector: 'node.dimmed',
          style: {
            'opacity': 0.25,
          }
        },
        {
          selector: 'edge.dimmed',
          style: {
            'opacity': 0.1,
          }
        },
      ],
      layout: graphType === 'chain' || graphType === 'tech' || graphType === 'fusion' ? {
        name: 'preset',
      } : {
        name: 'fcose',
        animate: true,
        animationDuration: 800,
        animationEasingFunction: 'ease-out',
        fit: true,
        padding: 60,
        nodeDimensionsIncludeLabels: true,
        nodeRepulsion: 45000,
        idealEdgeLength: 120,
        gravity: 0.25,
        gravityRange: 1.8,
        spacingFactor: 1.3,
        randomize: false,
        tile: true,
        quality: 'proof',
        nodeSeparation: 80,
      }
    })

    cyInstanceRef.current = cy

    function applyTechRingLayout() {
      const rootNode = cy.nodes().filter((node) => node.data('type') === 'TechRoot')[0]
      const fieldNodes = cy.nodes().filter((node) => node.data('type') === 'TechField')
      const techNodes = cy.nodes().filter((node) => node.data('type') === 'Tech')

      if (fieldNodes.length === 0) {
        cy.layout({
          name: 'circle',
          fit: true,
          padding: 80,
          animate: true,
          animationDuration: 600,
        }).run()
        return
      }

      const width = cy.width() || 1200
      const height = cy.height() || 760
      const centerX = width / 2
      const centerY = height / 2
      const baseRadius = Math.min(width, height)
      const innerRadius = Math.max(150, Math.round(baseRadius * 0.22))
      const outerRadius = Math.max(innerRadius + 150, Math.round(baseRadius * 0.38))

      const sortedFields = [...fieldNodes].sort((a, b) => a.data('name').localeCompare(b.data('name')))
      const fieldAngles = new Map()

      if (rootNode) {
        rootNode.position({ x: centerX, y: centerY })
      }

      sortedFields.forEach((node, index) => {
        const angle = (-Math.PI / 2) + (index / sortedFields.length) * Math.PI * 2
        fieldAngles.set(node.id(), angle)
        node.position({
          x: centerX + innerRadius * Math.cos(angle),
          y: centerY + innerRadius * Math.sin(angle),
        })
      })

      const sortedTechs = [...techNodes].sort((a, b) => {
        const aField = a
          .connectedEdges()
          .connectedNodes()
          .filter((node) => node.id() !== a.id() && node.data('type') === 'TechField')[0]
        const bField = b
          .connectedEdges()
          .connectedNodes()
          .filter((node) => node.id() !== b.id() && node.data('type') === 'TechField')[0]

        const aFieldName = aField?.data('name') || ''
        const bFieldName = bField?.data('name') || ''
        if (aFieldName !== bFieldName) {
          return aFieldName.localeCompare(bFieldName)
        }
        return a.data('name').localeCompare(b.data('name'))
      })

      if (sortedTechs.length === 1) {
        sortedTechs[0].position({
          x: centerX,
          y: centerY - outerRadius,
        })
      } else {
        sortedTechs.forEach((techNode, index) => {
          const angle = (-Math.PI / 2) + (index / sortedTechs.length) * Math.PI * 2
          techNode.position({
            x: centerX + outerRadius * Math.cos(angle),
            y: centerY + outerRadius * Math.sin(angle),
          })
        })
      }

      cy.fit(undefined, 90)
    }

    function applyFusionColumnLayout() {
      const width = cy.width() || 1400
      const centerY = 400
      const colSpacing = 320
      const rowSpacing = 95
      const leftPadding = 180

      const chainGroups = {}
      const techNodes = []

      cy.nodes().forEach((node) => {
        const type = node.data('type')
        if (isFusionTechNodeType(type)) {
          techNodes.push(node)
          return
        }
        if (!isFusionChainNodeType(type)) {
          return
        }
        if (!chainGroups[type]) {
          chainGroups[type] = []
        }
        chainGroups[type].push(node)
      })

      Object.entries(chainGroups).forEach(([type, nodes]) => {
        const col = FUSION_LAYOUT_ORDER[type] ?? 0
        const x = leftPadding + col * colSpacing
        const sortedNodes = [...nodes].sort((a, b) => a.data('name').localeCompare(b.data('name')))
        const totalHeight = (sortedNodes.length - 1) * rowSpacing
        sortedNodes.forEach((node, index) => {
          const y = centerY - totalHeight / 2 + index * rowSpacing
          node.position({ x, y })
        })
      })

      if (techNodes.length > 0) {
        const rightMostChainColumn = Math.max(...Object.values(FUSION_LAYOUT_ORDER), 3)
        const detailTechX = leftPadding + (rightMostChainColumn + 1) * colSpacing
        const minTechX = detailTechX
        const availableRight = Math.max(width - 240, minTechX)
        const techXByType = {
          Tech: Math.min(availableRight, detailTechX),
        }

        const anchorCache = new Map()
        const getChainAnchorY = (techNode) => {
          const nodeId = techNode.id()
          if (anchorCache.has(nodeId)) {
            return anchorCache.get(nodeId)
          }

          const chainNeighbors = techNode.neighborhood('node').filter((n) => isFusionChainNodeType(n.data('type')))
          if (chainNeighbors.length === 0) {
            anchorCache.set(nodeId, centerY)
            return centerY
          }
          const anchorY = chainNeighbors
            .toArray()
            .reduce((sum, node) => sum + node.position('y'), 0) / chainNeighbors.length
          anchorCache.set(nodeId, anchorY)
          return anchorY
        }

        const sortedTechNodes = [...techNodes].sort((a, b) => {
          const aAvgY = getChainAnchorY(a)
          const bAvgY = getChainAnchorY(b)

          if (aAvgY !== bAvgY) {
            return aAvgY - bAvgY
          }

          if (a.data('type') !== b.data('type')) {
            return a.data('type').localeCompare(b.data('type'))
          }

          return a.data('name').localeCompare(b.data('name'))
        })

        const occupiedSlotsByType = {}
        const usedAnchorSlots = {}
        const minGap = 62
        sortedTechNodes.forEach((node) => {
          const type = node.data('type')
          const x = techXByType[type] || techXByType.Tech
          const slots = occupiedSlotsByType[type] || []
          const anchorY = getChainAnchorY(node)
          const anchorKey = `${type}:${Math.round(anchorY / minGap)}`
          const baseSlot = usedAnchorSlots[anchorKey] || 0
          let y = anchorY

          for (let attempt = 0; attempt < 200; attempt += 1) {
            const slotIndex = baseSlot + attempt
            const direction = slotIndex % 2 === 0 ? 1 : -1
            const step = Math.ceil(slotIndex / 2) * minGap
            y = anchorY + direction * step

            if (!slots.some((slotY) => Math.abs(slotY - y) < minGap)) {
              usedAnchorSlots[anchorKey] = slotIndex + 1
              break
            }
          }

          if (slots.some((slotY) => Math.abs(slotY - y) < minGap)) {
            y = centerY + slots.length * minGap
          }

          slots.push(y)
          occupiedSlotsByType[type] = slots
          node.position({ x, y })
        })
      }

      applyFusionRepulsion()
      cy.fit(undefined, 90)
    }

    function applyFusionRepulsion() {
      const nodes = cy.nodes().filter((node) =>
        isFusionChainNodeType(node.data('type')) || isFusionTechNodeType(node.data('type'))
      ).toArray()

      if (nodes.length < 2) {
        return
      }

      const anchors = new Map(nodes.map((node) => [node.id(), { ...node.position() }]))
      const positions = new Map(nodes.map((node) => [node.id(), { ...node.position() }]))
      const iterations = 70
      const repulsionStrength = 0.28
      const anchorStrength = 0.055
      const maxStep = 10

      const getRadius = (node) => {
        if (isFusionTechNodeType(node.data('type'))) {
          return 78
        }
        return 60
      }

      for (let iteration = 0; iteration < iterations; iteration += 1) {
        const shifts = new Map(nodes.map((node) => [node.id(), { x: 0, y: 0 }]))

        for (let i = 0; i < nodes.length; i += 1) {
          for (let j = i + 1; j < nodes.length; j += 1) {
            const a = nodes[i]
            const b = nodes[j]
            const posA = positions.get(a.id())
            const posB = positions.get(b.id())
            let dx = posB.x - posA.x
            let dy = posB.y - posA.y
            let distance = Math.sqrt(dx * dx + dy * dy)

            if (distance < 1) {
              dx = 1
              dy = 0
              distance = 1
            }

            const sameColumn = Math.abs(anchors.get(a.id()).x - anchors.get(b.id()).x) < 80
            const desiredDistance = sameColumn
              ? getRadius(a) + getRadius(b) + 20
              : getRadius(a) + getRadius(b) + 6

            if (distance >= desiredDistance) {
              continue
            }

            const force = Math.min((desiredDistance - distance) * repulsionStrength, maxStep)
            const ux = dx / distance
            const uy = dy / distance
            const shiftA = shifts.get(a.id())
            const shiftB = shifts.get(b.id())

            shiftA.x -= ux * force
            shiftA.y -= uy * force
            shiftB.x += ux * force
            shiftB.y += uy * force
          }
        }

        nodes.forEach((node) => {
          const pos = positions.get(node.id())
          const anchor = anchors.get(node.id())
          const shift = shifts.get(node.id())
          const isTech = isFusionTechNodeType(node.data('type'))
          const xAnchorStrength = isTech ? anchorStrength * 0.7 : anchorStrength
          const yAnchorStrength = isTech ? anchorStrength * 0.35 : anchorStrength * 0.55

          positions.set(node.id(), {
            x: pos.x + shift.x + (anchor.x - pos.x) * xAnchorStrength,
            y: pos.y + shift.y + (anchor.y - pos.y) * yAnchorStrength,
          })
        })
      }

      nodes.forEach((node) => {
        node.position(positions.get(node.id()))
      })
    }

    if (graphType === 'chain') {
      const LAYER_ORDER = { Layer2: 0, Layer3: 1, Layer4: 2, Value: 3 }
      const layerGroups = {}
      cy.nodes().forEach(node => {
        const t = node.data('type')
        if (!layerGroups[t]) layerGroups[t] = []
        layerGroups[t].push(node)
      })
      const colSpacing = 340
      const rowSpacing = 95
      Object.entries(layerGroups).forEach(([type, nodes]) => {
        const col = LAYER_ORDER[type] ?? 0
        const x = 200 + col * colSpacing
        const totalHeight = (nodes.length - 1) * rowSpacing
        nodes.forEach((node, i) => {
          const y = -totalHeight / 2 + i * rowSpacing + 400
          node.position({ x, y })
        })
      })
      cy.fit(undefined, 60)
    }

    if (graphType === 'tech') {
      applyTechRingLayout()
    }

    if (graphType === 'fusion') {
      applyFusionColumnLayout()
    }

    let physicsRAF = null
    let velocities = {}
    let activeDraggedNodeId = null
    const enableInteractivePhysics = cy.nodes().length <= 180
    const isFusionPhysics = graphType === 'fusion'
    const SPRING_STRENGTH = isFusionPhysics ? 0.032 : 0.04
    const REPULSION_STRENGTH = isFusionPhysics ? 4200 : 3000
    const DAMPING = isFusionPhysics ? 0.82 : 0.75
    const MIN_DISTANCE = isFusionPhysics ? 78 : 60
    const NEIGHBOR_INFLUENCE = isFusionPhysics ? 0.45 : 0.6
    const SECOND_DEGREE_INFLUENCE = isFusionPhysics ? 0.1 : 0.15
    const GLOBAL_REPULSION = isFusionPhysics ? 3200 : 2000
    const DRAG_REPULSION = isFusionPhysics ? 7600 : 3600
    const MAX_SPEED = isFusionPhysics ? 11 : 8

    function startPhysics(draggedNode) {
      if (!enableInteractivePhysics) {
        return
      }

      if (physicsRAF && activeDraggedNodeId === draggedNode.id()) {
        return
      }

      stopPhysics()
      activeDraggedNodeId = draggedNode.id()
      velocities = {}
      const allNodeIds = []
      cy.nodes().forEach(n => {
        if (n.id() !== draggedNode.id()) allNodeIds.push(n.id())
      })
      allNodeIds.forEach(id => {
        velocities[id] = { vx: 0, vy: 0 }
      })

      function physicsTick() {
        const forces = {}
        allNodeIds.forEach(id => { forces[id] = { fx: 0, fy: 0 } })

        const draggedPos = draggedNode.position()

        allNodeIds.forEach(id => {
          const node = cy.getElementById(id)
          if (!node || node.grabbed()) return
          const pos = node.position()

          const dx = draggedPos.x - pos.x
          const dy = draggedPos.y - pos.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1

          const isDirectNeighbor = draggedNode.neighborhood('node').filter(n => n.id() === id).length > 0
          const isSecondDegree = !isDirectNeighbor && draggedNode.neighborhood('node').filter(n => n.neighborhood('node').filter(n2 => n2.id() === id).length > 0).length > 0

          if (isDirectNeighbor) {
            const springK = SPRING_STRENGTH * NEIGHBOR_INFLUENCE
            const idealLen = 120
            const displacement = dist - idealLen
            const springForce = springK * displacement
            forces[id].fx += springForce * (dx / dist)
            forces[id].fy += springForce * (dy / dist)
          } else if (isSecondDegree) {
            const springK = SPRING_STRENGTH * SECOND_DEGREE_INFLUENCE
            const idealLen = 200
            const displacement = dist - idealLen
            const springForce = springK * displacement
            forces[id].fx += springForce * (dx / dist)
            forces[id].fy += springForce * (dy / dist)
          }

          const dragRepulsionThreshold = isFusionPhysics ? MIN_DISTANCE * 3.2 : MIN_DISTANCE * 2.6
          if (dist < dragRepulsionThreshold) {
            const repForce = DRAG_REPULSION / (dist * dist)
            const clampedForce = Math.min(repForce, isFusionPhysics ? 8 : 5)
            forces[id].fx -= clampedForce * (dx / dist)
            forces[id].fy -= clampedForce * (dy / dist)
          }
        })

        for (let i = 0; i < allNodeIds.length; i++) {
          for (let j = i + 1; j < allNodeIds.length; j++) {
            const n1 = cy.getElementById(allNodeIds[i])
            const n2 = cy.getElementById(allNodeIds[j])
            if (!n1 || !n2) continue
            const p1 = n1.position()
            const p2 = n2.position()
            const dx = p2.x - p1.x
            const dy = p2.y - p1.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1

            const isEdgeConnected = n1.edgesWith(n2).length > 0
            const repulsionK = isEdgeConnected ? REPULSION_STRENGTH : GLOBAL_REPULSION
            const threshold = isEdgeConnected ? MIN_DISTANCE * 3 : MIN_DISTANCE * 5

            if (dist < threshold) {
              const repForce = repulsionK / (dist * dist)
              const clampedForce = Math.min(repForce, 5)
              forces[allNodeIds[i]].fx -= clampedForce * (dx / dist)
              forces[allNodeIds[i]].fy -= clampedForce * (dy / dist)
              forces[allNodeIds[j]].fx += clampedForce * (dx / dist)
              forces[allNodeIds[j]].fy += clampedForce * (dy / dist)
            }
          }
        }

        allNodeIds.forEach(id => {
          const node = cy.getElementById(id)
          if (!node || node.grabbed()) return

          if (!velocities[id]) velocities[id] = { vx: 0, vy: 0 }
          velocities[id].vx = (velocities[id].vx + forces[id].fx) * DAMPING
          velocities[id].vy = (velocities[id].vy + forces[id].fy) * DAMPING

          const speed = Math.sqrt(velocities[id].vx ** 2 + velocities[id].vy ** 2)
          if (speed > MAX_SPEED) {
            velocities[id].vx = (velocities[id].vx / speed) * MAX_SPEED
            velocities[id].vy = (velocities[id].vy / speed) * MAX_SPEED
          }

          node.position({
            x: node.position('x') + velocities[id].vx,
            y: node.position('y') + velocities[id].vy
          })
        })

        physicsRAF = requestAnimationFrame(physicsTick)
      }

      physicsTick()
    }

    function stopPhysics() {
      if (!enableInteractivePhysics) {
        return
      }

      if (physicsRAF) {
        cancelAnimationFrame(physicsRAF)
        physicsRAF = null
      }
      activeDraggedNodeId = null
      velocities = {}
    }

    cy.on('tap', 'node', (evt) => {
      const nodeData = { ...evt.target.data() }
      setSelectedNode(nodeData)
      setSelectedEdge(null)
      cy.elements().removeClass('highlighted dimmed')
      cy.elements().addClass('dimmed')
      evt.target.removeClass('dimmed')
      evt.target.neighborhood().removeClass('dimmed')
      evt.target.neighborhood().add(evt.target).addClass('highlighted')
    })

    cy.on('tap', 'edge', (evt) => {
      const edgeData = { ...evt.target.data() }
      setSelectedEdge(edgeData)
      setSelectedNode(null)
      cy.elements().removeClass('highlighted dimmed')
      cy.elements().addClass('dimmed')
      evt.target.removeClass('dimmed')
      evt.target.addClass('highlighted')
      evt.target.connectedNodes().removeClass('dimmed')
    })

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null)
        setSelectedEdge(null)
        cy.elements().removeClass('highlighted dimmed')
      }
    })

    cy.on('mouseover', 'node', (evt) => {
      cy.container().style.cursor = 'pointer'
    })

    cy.on('mouseout', 'node', () => {
      cy.container().style.cursor = 'default'
    })

    cy.on('grab', 'node', (evt) => {
      cy.container().style.cursor = 'grabbing'
    })

    cy.on('drag', 'node', (evt) => {
      startPhysics(evt.target)
      cy.container().style.cursor = 'grabbing'
    })

    cy.on('free', 'node', () => {
      stopPhysics()
      cy.container().style.cursor = 'default'
    })
  }, [isTechNodeType, isFusionTechNodeType, isFusionChainNodeType])

  const loadGraphData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let data
      if (currentGraph === 'chain') {
        data = await api.getChainGraphNew({ industry: selectedIndustry })
      } else if (currentGraph === 'tech') {
        data = await api.getTechGraphNew()
      } else {
        data = await api.getFusionGraphNew({ techLimit: 120, industry: selectedIndustry })
      }

      setGraphDataState(data)
      buildCytoscape(data, currentGraph)

      const typeCounts = {}
      data.nodes.forEach(n => {
        typeCounts[n.nodeType] = (typeCounts[n.nodeType] || 0) + 1
      })
      setStats({ nodes: data.nodes.length, edges: data.edges.length, ...typeCounts })
      setLoading(false)
    } catch (err) {
      console.error('加载图谱数据失败:', err)
      setError(err.message)
      setLoading(false)
    }
  }, [currentGraph, selectedIndustry, buildCytoscape])

  useEffect(() => {
    loadGraphData()
    return () => {
      if (cyInstanceRef.current) {
        cyInstanceRef.current.destroy()
      }
    }
  }, [loadGraphData])

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [nt, rt, industries] = await Promise.all([
          api.getNodeTypes(),
          api.getRelTypes(),
          api.getChainIndustries(),
        ])
        setNodeTypes(nt || [])
        setRelTypes(rt || [])
        if (Array.isArray(industries) && industries.length > 0) {
          setChainIndustries(industries)
        }
      } catch (e) {
        console.warn('加载元数据失败:', e)
      }
    }
    loadMeta()
  }, [])

  const handleGraphSwitch = (graphType) => {
    setCurrentGraph(graphType)
    setSelectedNode(null)
    setSelectedEdge(null)
    setSearchTerm('')
    setFilterType('all')
  }

  const handleIndustrySwitch = (industry) => {
    setSelectedIndustry(industry)
    setSelectedNode(null)
    setSelectedEdge(null)
    setSearchTerm('')
    setFilterType('all')
  }

  const handleFilterChange = (type) => {
    setFilterType(type)
    if (cyInstanceRef.current) {
      const cy = cyInstanceRef.current
      if (type === 'all') {
        cy.elements().show()
      } else {
        const selectedNodes = cy.nodes().filter(node => node.data('type') === type)
        const selectedNodeIds = new Set(selectedNodes.map(node => node.id()))
        const selectedEdges = cy.edges().filter(edge => (
          selectedNodeIds.has(edge.source().id()) && selectedNodeIds.has(edge.target().id())
        ))

        cy.elements().hide()
        selectedNodes.show()
        selectedEdges.show()
      }
    }
  }

  const handleSearch = (term) => {
    setSearchTerm(term)
    if (!cyInstanceRef.current) return
    const cy = cyInstanceRef.current
    if (!term.trim()) {
      cy.elements().show().removeClass('highlighted')
      return
    }
    const lower = term.toLowerCase()
    cy.elements().removeClass('highlighted').hide()
    cy.nodes().forEach(node => {
      const name = node.data('fullName') || node.data('label') || ''
      const type = node.data('type') || ''
      if (name.toLowerCase().includes(lower) || type.toLowerCase().includes(lower)) {
        node.show()
        node.connectedEdges().show()
        node.neighborhood('node').show()
        node.neighborhood('node').connectedEdges().show()
        node.addClass('highlighted')
      }
    })
  }

  const handleAddNode = async () => {
    if (!addNodeForm.name.trim() || !addNodeForm.nodeType) {
      showToast('节点名称和类型不能为空', 'error')
      return
    }
    try {
      const result = await api.createGraphNode({
        name: addNodeForm.name.trim(),
        nodeType: addNodeForm.nodeType,
        properties: addNodeForm.properties
      })
      if (result.success) {
        if (addNodeForm.autoSource) {
          try {
            const edgeRelType = addNodeForm.autoRelType || relTypes[0] || '技术支撑'
            await api.createGraphEdge({
              source: addNodeForm.autoSource,
              target: addNodeForm.name.trim(),
              relType: edgeRelType
            })
            showToast(`节点添加成功，已自动创建关系：${addNodeForm.autoSource} → ${addNodeForm.name.trim()}`)
          } catch (edgeErr) {
            showToast('节点添加成功，但自动创建关系失败: ' + edgeErr.message, 'error')
          }
        } else {
          showToast('节点添加成功')
        }
        setShowAddNodeModal(false)
        setAddNodeForm({ name: '', nodeType: 'Input', properties: {}, autoSource: '' })
        await loadGraphData()
      } else {
        showToast(result.error || '添加失败', 'error')
      }
    } catch (e) {
      showToast('添加节点失败: ' + e.message, 'error')
    }
  }

  const handleAddEdge = async () => {
    if (!addEdgeForm.source.trim() || !addEdgeForm.target.trim() || !addEdgeForm.relType.trim()) {
      showToast('起点、终点和关系类型不能为空', 'error')
      return
    }
    try {
      const result = await api.createGraphEdge({
        source: addEdgeForm.source.trim(),
        target: addEdgeForm.target.trim(),
        relType: addEdgeForm.relType.trim()
      })
      if (result.success) {
        showToast('关系添加成功')
        setShowAddEdgeModal(false)
        setAddEdgeForm({ source: '', target: '', relType: '' })
        await loadGraphData()
      } else {
        showToast(result.error || '添加失败', 'error')
      }
    } catch (e) {
      showToast('添加关系失败: ' + e.message, 'error')
    }
  }

  const handleEditNode = async () => {
    const nextName = editNodeForm.name.trim()
    if (!nextName) {
      showToast('节点名称不能为空', 'error')
      return
    }
    try {
      const result = await api.updateGraphNode(editNodeForm.originalName || editNodeForm.name, {
        newName: nextName,
        nodeType: editNodeForm.nodeType,
        properties: editNodeForm.properties
      })
      if (result.success) {
        showToast('节点修改成功')
        setShowEditNodeModal(false)
        const updatedNode = result.data || {
          name: nextName,
          nodeType: editNodeForm.nodeType,
          ...(editNodeForm.properties || {})
        }
        setSelectedNode({
          ...updatedNode,
          label: updatedNode.label || updatedNode.name || nextName,
          fullName: updatedNode.name || updatedNode.label || nextName,
          type: updatedNode.nodeType || updatedNode.type || editNodeForm.nodeType,
          allProperties: updatedNode,
        })
        await loadGraphData()
      } else {
        showToast(result.error || '修改失败', 'error')
      }
    } catch (e) {
      showToast('修改节点失败: ' + e.message, 'error')
    }
  }

  const handleEditEdge = async () => {
    if (!editEdgeForm.newRelType.trim()) {
      showToast('关系类型不能为空', 'error')
      return
    }
    try {
      const result = await api.updateGraphEdge({
        source: editEdgeForm.source,
        target: editEdgeForm.target,
        oldRelType: editEdgeForm.oldRelType,
        newRelType: editEdgeForm.newRelType.trim()
      })
      if (result.success) {
        showToast('关系修改成功')
        setShowEditEdgeModal(false)
        setSelectedEdge(null)
        await loadGraphData()
      } else {
        showToast(result.error || '修改失败', 'error')
      }
    } catch (e) {
      showToast('修改关系失败: ' + e.message, 'error')
    }
  }

  const handleDeleteNode = async (name) => {
    try {
      const result = await api.deleteGraphNode(name)
      if (result.success) {
        showToast('节点删除成功')
        setSelectedNode(null)
        setShowDeleteConfirm(null)
        await loadGraphData()
      } else {
        showToast(result.error || '删除失败', 'error')
      }
    } catch (e) {
      showToast('删除节点失败: ' + e.message, 'error')
    }
  }

  const handleDeleteEdge = async (source, target, label) => {
    try {
      const result = await api.deleteGraphEdge({ source, target, relType: label })
      if (result.success) {
        showToast('关系删除成功')
        setSelectedEdge(null)
        setShowDeleteConfirm(null)
        await loadGraphData()
      } else {
        showToast(result.error || '删除失败', 'error')
      }
    } catch (e) {
      showToast('删除关系失败: ' + e.message, 'error')
    }
  }

  const handleFileImport = async () => {
    if (importFormat !== 'text' && !importFile) {
      showToast('请选择要导入的文件', 'error')
      return
    }
    try {
      setImportErrors([])
      setImportSuccess(false)

      if (importFormat === 'text') {
        const textFromFile = importFile ? await importFile.text() : ''
        const text = (textFromFile || importText).trim()
        if (!text) {
          showToast('请输入文本或上传 .txt 文件', 'error')
          return
        }

        const result = await api.importGraphFromText({
          text,
          graphType: currentGraph
        })

        if (result.success) {
          setImportSuccess(true)
          showToast(`AI抽取导入成功：${result.data.nodeCount}个节点，${result.data.edgeCount}条关系`)
          if (result.data.errors && result.data.errors.length > 0) {
            setImportErrors(result.data.errors)
          }
          await loadGraphData()
        } else {
          setImportErrors([result.error || '文本导入失败'])
        }
        return
      }

      let importData = { nodes: [], edges: [] }

      if (importFormat === 'json') {
        const text = await importFile.text()
        const parsed = JSON.parse(text)
        if (parsed.nodes) {
          importData.nodes = parsed.nodes.map(n => ({
            name: n.name,
            nodeType: n.nodeType || n.type,
            properties: Object.fromEntries(
              Object.entries(n).filter(([k]) => !['name', 'nodeType', 'type'].includes(k))
            )
          }))
        }
        if (parsed.edges) {
          importData.edges = parsed.edges.map(e => ({
            source: e.source,
            target: e.target,
            relType: e.relType || e.label || e.type
          }))
        }
      } else {
        const arrayBuffer = await importFile.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })

        if (workbook.SheetNames.includes('节点')) {
          const sheet = workbook.Sheets['节点']
          const rows = XLSX.utils.sheet_to_json(sheet)
          importData.nodes = rows.map(r => {
            const { name, nodeType, type, ...rest } = r
            return { name: name || '', nodeType: nodeType || type || '', properties: rest }
          })
        }
        if (workbook.SheetNames.includes('关系')) {
          const sheet = workbook.Sheets['关系']
          const rows = XLSX.utils.sheet_to_json(sheet)
          importData.edges = rows.map(r => ({
            source: r.source || r.起点 || '',
            target: r.target || r.终点 || '',
            relType: r.relType || r.label || r.type || r.关系类型 || ''
          }))
        }

        if (!workbook.SheetNames.includes('节点') && !workbook.SheetNames.includes('关系')) {
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(sheet)
          if (rows.length > 0 && rows[0].source !== undefined) {
            importData.edges = rows.map(r => ({
              source: r.source || '',
              target: r.target || '',
              relType: r.relType || r.label || ''
            }))
          } else {
            importData.nodes = rows.map(r => {
              const { name, nodeType, type, ...rest } = r
              return { name: name || '', nodeType: nodeType || type || '', properties: rest }
            })
          }
        }
      }

      const validationErrors = []
      importData.nodes.forEach((n, i) => {
        if (!n.name) validationErrors.push(`第${i + 1}个节点缺少name`)
        if (!n.nodeType) validationErrors.push(`第${i + 1}个节点缺少nodeType`)
      })
      importData.edges.forEach((e, i) => {
        if (!e.source) validationErrors.push(`第${i + 1}条边缺少source`)
        if (!e.target) validationErrors.push(`第${i + 1}条边缺少target`)
        if (!e.relType) validationErrors.push(`第${i + 1}条边缺少relType`)
      })

      if (validationErrors.length > 0) {
        setImportErrors(validationErrors)
        return
      }

      const result = await api.batchImportGraph(importData)
      if (result.success) {
        setImportSuccess(true)
        showToast(`导入成功：${result.data.nodeCount}个节点，${result.data.edgeCount}条关系`)
        if (result.data.errors && result.data.errors.length > 0) {
          setImportErrors(result.data.errors)
        }
        await loadGraphData()
      }
    } catch (e) {
      setImportErrors(['导入失败: ' + e.message])
    }
  }

  const handleExport = async (format) => {
    try {
      if (format === 'png') {
        if (cyInstanceRef.current) {
          const pngData = cyInstanceRef.current.png({ output: 'blob', scale: 2, bg: '#ffffff' })
          const url = URL.createObjectURL(pngData)
          const a = document.createElement('a')
          a.href = url
          a.download = `knowledge-graph-${currentGraph}-${selectedIndustry}.png`
          a.click()
          URL.revokeObjectURL(url)
          showToast('PNG图片导出成功')
        }
        return
      }

      if (format === 'pdf') {
        if (cyInstanceRef.current) {
          const pngData = cyInstanceRef.current.png({ output: 'base64', scale: 2, bg: '#ffffff' })
          const printWindow = window.open('', '_blank')
          printWindow.document.write(`
            <html><head><title>知识图谱导出</title><style>
              body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh}
              img{max-width:100%;max-height:100vh}
            </style></head><body>
            <img src="data:image/png;base64,${pngData}" onload="window.print();window.close();">
            </body></html>
          `)
          printWindow.document.close()
          showToast('PDF导出已打开打印对话框')
        }
        return
      }

      if (format === 'excel') {
        const wb = XLSX.utils.book_new()
        const nodeRows = graphDataState.nodes.map(n => {
          const { nodeType, ...rest } = n
          return { name: n.name, nodeType, ...Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'name' && k !== 'nodeType')) }
        })
        const nodeSheet = XLSX.utils.json_to_sheet(nodeRows)
        XLSX.utils.book_append_sheet(wb, nodeSheet, '节点')

        const edgeRows = graphDataState.edges.map(e => ({
          source: e.source,
          target: e.target,
          relType: e.relType || e.label
        }))
        const edgeSheet = XLSX.utils.json_to_sheet(edgeRows)
        XLSX.utils.book_append_sheet(wb, edgeSheet, '关系')

        XLSX.writeFile(wb, `knowledge-graph-${currentGraph}-${selectedIndustry}.xlsx`)
        showToast('Excel导出成功')
        return
      }

      const data = await api.exportGraph(format, currentGraph, { industry: selectedIndustry })
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `knowledge-graph-${currentGraph}-${selectedIndustry}-${format}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('JSON导出成功')
    } catch (e) {
      showToast('导出失败: ' + e.message, 'error')
    }
  }

  const handleCreateSnapshot = async () => {
    try {
      const result = await api.createSnapshot(snapshotDesc || '手动备份')
      if (result.success) {
        showToast('版本备份成功')
        setSnapshotDesc('')
        const list = await api.getSnapshots()
        setSnapshots(list || [])
      }
    } catch (e) {
      showToast('备份失败: ' + e.message, 'error')
    }
  }

  const handleRestoreSnapshot = async (fileName) => {
    if (!window.confirm('恢复快照将覆盖当前所有数据，确定要继续吗？')) return
    try {
      const result = await api.restoreSnapshot(fileName)
      if (result.success) {
        showToast('快照恢复成功')
        await loadGraphData()
      }
    } catch (e) {
      showToast('恢复失败: ' + e.message, 'error')
    }
  }

  const openEditNode = (nodeData) => {
    const props = {}
    const sourceProps = nodeData.allProperties || nodeData
    Object.entries(sourceProps).forEach(([k, v]) => {
      if (
        !['id', 'label', 'fullName', 'type', 'name', 'nodeType', 'textOutlineColor', 'allProperties'].includes(k) &&
        v !== null &&
        v !== undefined &&
        typeof v !== 'object'
      ) {
        props[k] = v
      }
    })
    setEditNodeForm({
      name: nodeData.fullName || nodeData.label,
      originalName: nodeData.fullName || nodeData.label,
      nodeType: nodeData.type || nodeData.nodeType,
      properties: props
    })
    setShowEditNodeModal(true)
  }

  const addPropertyField = (form, setForm) => {
    const key = prompt('请输入属性名称:')
    if (!key) return
    setForm({ ...form, properties: { ...form.properties, [key]: '' } })
  }

  const updateProperty = (form, setForm, key, value) => {
    setForm({ ...form, properties: { ...form.properties, [key]: value } })
  }

  const updatePropertyKey = (form, setForm, oldKey, newKey) => {
    const normalizedKey = newKey.trim()
    if (!normalizedKey || normalizedKey === oldKey) return

    const newProps = {}
    Object.entries(form.properties).forEach(([key, value]) => {
      newProps[key === oldKey ? normalizedKey : key] = value
    })
    setForm({ ...form, properties: newProps })
  }

  const removeProperty = (form, setForm, key) => {
    const newProps = { ...form.properties }
    delete newProps[key]
    setForm({ ...form, properties: newProps })
  }

  const openSnapshotModal = async () => {
    setShowSnapshotModal(true)
    try {
      const list = await api.getSnapshots()
      setSnapshots(list || [])
    } catch (e) {
      console.warn('加载快照列表失败:', e)
    }
  }

  const downloadImportTemplate = (format) => {
    if (format === 'excel') {
      const wb = XLSX.utils.book_new()
      const nodeSheet = XLSX.utils.json_to_sheet([
        { name: '示例节点1', nodeType: 'Input', desc: '描述信息' }
      ])
      XLSX.utils.book_append_sheet(wb, nodeSheet, '节点')
      const edgeSheet = XLSX.utils.json_to_sheet([
        { source: '示例节点1', target: '示例节点2', relType: '技术支撑' }
      ])
      XLSX.utils.book_append_sheet(wb, edgeSheet, '关系')
      XLSX.writeFile(wb, 'import-template.xlsx')
    } else {
      const template = {
        nodes: [
          { name: '示例节点1', nodeType: 'Input', desc: '描述信息' },
          { name: '示例节点2', nodeType: 'Industry', code: 'G5531' }
        ],
        edges: [
          { source: '示例节点1', target: '示例节点2', relType: '技术支撑' }
        ]
      }
      const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'import-template.json'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="knowledge-graph">
      {toast && (
        <div className={`kg-toast kg-toast-${toast.type}`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.message}
        </div>
      )}

      <div className="kg-header">
        <h2>科技服务知识图谱</h2>
        <div className="kg-switcher">
          <button className={`graph-switch-btn ${currentGraph === 'chain' ? 'active' : ''}`} onClick={() => handleGraphSwitch('chain')}>
            🔗 产业链图谱
          </button>
          <button className={`graph-switch-btn ${currentGraph === 'tech' ? 'active' : ''}`} onClick={() => handleGraphSwitch('tech')}>
            🔬 技术图谱
          </button>
          <button className={`graph-switch-btn ${currentGraph === 'fusion' ? 'active' : ''}`} onClick={() => handleGraphSwitch('fusion')}>
            🌐 产业与技术融合图谱
          </button>
        </div>
      </div>

      <div className="kg-controls">
        <div className="kg-search">
          <input
            type="text"
            placeholder="按节点名称或类型搜索..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="input"
          />
        </div>
        {(currentGraph === 'chain' || currentGraph === 'fusion') && (
          <div className="kg-industry">
            <select value={selectedIndustry} onChange={(e) => handleIndustrySwitch(e.target.value)} className="input">
              {chainIndustries.map((industry) => (
                <option key={industry.value} value={industry.value}>{industry.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="kg-filter">
          <select value={filterType} onChange={(e) => handleFilterChange(e.target.value)} className="input">
            <option value="all">全部类型</option>
            {(currentGraph === 'chain' ? CHAIN_NODE_TYPES
              : currentGraph === 'tech' ? TECH_NODE_TYPES
              : FUSION_NODE_TYPES
            ).map(t => (
              <option key={t} value={t}>{UI_NODE_LABELS[t] || t}</option>
            ))}
          </select>
        </div>
        <div className="kg-actions">
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>导入</button>
          <button className="btn btn-secondary" onClick={() => setShowExportModal(true)}>导出</button>
          <button className="btn btn-secondary" onClick={openSnapshotModal}>版本管理</button>
        </div>
      </div>

      <div className="kg-content">
        <div className="kg-graph">
          {(selectedNode || selectedEdge) && (
            <div className="kg-graph-actions">
              {selectedNode && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => openEditNode(selectedNode)}>修改节点</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm({ type: 'node', name: selectedNode.fullName || selectedNode.label })}>删除节点</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setAddNodeForm({ name: '', nodeType: 'Input', properties: {}, autoSource: selectedNode.fullName || selectedNode.label })
                    setShowAddNodeModal(true)
                  }}>添加节点</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setAddEdgeForm({ source: selectedNode.fullName || selectedNode.label, target: '', relType: '' })
                    setShowAddEdgeModal(true)
                  }}>添加边</button>
                </>
              )}
              {selectedEdge && !selectedNode && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    setEditEdgeForm({
                      source: selectedEdge.source,
                      target: selectedEdge.target,
                      oldRelType: selectedEdge.label,
                      newRelType: selectedEdge.label
                    })
                    setShowEditEdgeModal(true)
                  }}>修改边</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm({ type: 'edge', source: selectedEdge.source, target: selectedEdge.target, label: selectedEdge.label })}>删除边</button>
                </>
              )}
            </div>
          )}
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
                <button className="btn btn-primary" onClick={loadGraphData}>重新加载</button>
              </div>
            </div>
          )}
          <div ref={cyRef} className="kg-canvas"></div>
        </div>

        <div className="kg-sidebar">
          <div className="kg-details card">
              {selectedNode && (
                <>
                  <h3>{selectedNodeName || '节点详情'}</h3>
                  <div className="detail-item">
                    <span className="detail-label">节点类型</span>
                    <span className="detail-value">{UI_NODE_LABELS[selectedNodeType] || selectedNodeType || '未设置'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">节点名称</span>
                    <span className="detail-value">{selectedNodeName || '未命名节点'}</span>
                  </div>
                  {selectedNodeProperties.length > 0 ? selectedNodeProperties.map(([key, value]) => (
                    <div className={`detail-item${typeof value === 'string' && value.length > 30 ? ' detail-desc' : ''}`} key={key}>
                      <span className="detail-label">{NODE_DETAIL_LABELS[key] || key}</span>
                      <span className="detail-value">{formatDetailValue(value)}</span>
                    </div>
                  )) : (
                    <div className="detail-empty">当前节点没有更多可展示属性。</div>
                  )}
                </>
              )}
              {selectedEdge && !selectedNode && (
                <>
                  <h3>关系详情</h3>
                  <div className="detail-item">
                    <span className="detail-label">起点</span>
                    <span className="detail-value">{selectedEdge.source}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">终点</span>
                    <span className="detail-value">{selectedEdge.target}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">关系类型</span>
	                    <span className="detail-value">{selectedEdgeLabel}</span>
                  </div>
                </>
              )}
              {!selectedNode && !selectedEdge && (
                <>
                  <h3>节点详情</h3>
                  <div className="detail-empty">点击图谱中的节点或关系后，这里会显示对应的信息。</div>
                </>
              )}
            </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>确认删除</h3>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(null)}>×</button>
            </div>
            <div className="modal-body">
              {showDeleteConfirm.type === 'node' ? (
                <p>确定要删除节点 <strong>{showDeleteConfirm.name}</strong> 吗？删除后将同步移除该节点关联的所有关系。</p>
              ) : (
                <p>确定要删除关系 <strong>{showDeleteConfirm.source} → {showDeleteConfirm.target}</strong>（{showDeleteConfirm.label}）吗？删除后不会影响关联的节点数据。</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(null)}>取消</button>
              <button className="btn btn-danger" onClick={() => {
                if (showDeleteConfirm.type === 'node') {
                  handleDeleteNode(showDeleteConfirm.name)
                } else {
                  handleDeleteEdge(showDeleteConfirm.source, showDeleteConfirm.target, showDeleteConfirm.label)
                }
              }}>确认删除</button>
            </div>
          </div>
        </div>
      )}

      {showAddNodeModal && (
        <div className="modal-overlay" onClick={() => setShowAddNodeModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加节点</h3>
              <button className="modal-close" onClick={() => setShowAddNodeModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {addNodeForm.autoSource && (
                <div className="auto-source-info">
                  <span className="auto-source-label">起始节点</span>
                  <span className="auto-source-value">{addNodeForm.autoSource}</span>
                  <span className="auto-source-hint">将自动创建从该节点到新节点的边</span>
                </div>
              )}
              <div className="form-group">
                <label>节点名称 *</label>
                <input type="text" className="input" value={addNodeForm.name} onChange={e => setAddNodeForm({ ...addNodeForm, name: e.target.value })} placeholder="请输入节点名称" />
              </div>
              <div className="form-group">
                <label>节点类型 *</label>
                <select className="input" value={addNodeForm.nodeType} onChange={e => setAddNodeForm({ ...addNodeForm, nodeType: e.target.value })}>
                  {NODE_TYPE_OPTIONS.map(t => <option key={t} value={t}>{UI_NODE_LABELS[t] || t} ({t})</option>)}
                </select>
              </div>
              {addNodeForm.autoSource && (
                <div className="form-group">
                  <label>关系类型</label>
                  <input type="text" className="input" value={addNodeForm.autoRelType || relTypes[0] || '技术支撑'} onChange={e => setAddNodeForm({ ...addNodeForm, autoRelType: e.target.value })} placeholder="选择或输入关系类型" list="add-node-rel-types" />
                  <datalist id="add-node-rel-types">
                    {relTypes.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
              )}
              <div className="form-group">
                <label>属性键值对</label>
                {Object.entries(addNodeForm.properties).map(([key, value]) => (
                  <div className="prop-row" key={key}>
                    <input type="text" className="input prop-key" defaultValue={key} onBlur={e => updatePropertyKey(addNodeForm, setAddNodeForm, key, e.target.value)} />
                    <input type="text" className="input prop-val" value={value} onChange={e => updateProperty(addNodeForm, setAddNodeForm, key, e.target.value)} placeholder="属性值" />
                    <button className="btn-icon btn-remove" onClick={() => removeProperty(addNodeForm, setAddNodeForm, key)}>×</button>
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => addPropertyField(addNodeForm, setAddNodeForm)}>+ 添加属性</button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddNodeModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleAddNode}>确认添加</button>
            </div>
          </div>
        </div>
      )}

      {showAddEdgeModal && (
        <div className="modal-overlay" onClick={() => setShowAddEdgeModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加关系</h3>
              <button className="modal-close" onClick={() => setShowAddEdgeModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>起点节点 *</label>
                <input type="text" className="input" value={addEdgeForm.source} onChange={e => setAddEdgeForm({ ...addEdgeForm, source: e.target.value })} placeholder="请输入起点节点名称" list="node-list-source" />
                <datalist id="node-list-source">
                  {graphDataState.nodes.map(n => <option key={n.name} value={n.name} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label>终点节点 *</label>
                <input type="text" className="input" value={addEdgeForm.target} onChange={e => setAddEdgeForm({ ...addEdgeForm, target: e.target.value })} placeholder="请输入终点节点名称" list="node-list-target" />
                <datalist id="node-list-target">
                  {graphDataState.nodes.map(n => <option key={n.name} value={n.name} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label>关系类型 *</label>
                <input type="text" className="input" value={addEdgeForm.relType} onChange={e => setAddEdgeForm({ ...addEdgeForm, relType: e.target.value })} placeholder="请输入关系类型" list="rel-type-list" />
                <datalist id="rel-type-list">
                  {relTypes.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddEdgeModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleAddEdge}>确认添加</button>
            </div>
          </div>
        </div>
      )}

      {showEditNodeModal && (
        <div className="modal-overlay" onClick={() => setShowEditNodeModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>修改节点</h3>
              <button className="modal-close" onClick={() => setShowEditNodeModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>节点名称</label>
                <input type="text" className="input" value={editNodeForm.name} onChange={e => setEditNodeForm({ ...editNodeForm, name: e.target.value })} placeholder="请输入节点名称" />
              </div>
              <div className="form-group">
                <label>节点类型</label>
                <select className="input" value={editNodeForm.nodeType} onChange={e => setEditNodeForm({ ...editNodeForm, nodeType: e.target.value })}>
                  {NODE_TYPE_OPTIONS.map(t => <option key={t} value={t}>{UI_NODE_LABELS[t] || t} ({t})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>属性键值对</label>
                {Object.entries(editNodeForm.properties).map(([key, value]) => (
                  <div className="prop-row" key={key}>
                    <input type="text" className="input prop-key" defaultValue={key} onBlur={e => updatePropertyKey(editNodeForm, setEditNodeForm, key, e.target.value)} />
                    <input type="text" className="input prop-val" value={value || ''} onChange={e => updateProperty(editNodeForm, setEditNodeForm, key, e.target.value)} />
                    <button className="btn-icon btn-remove" onClick={() => removeProperty(editNodeForm, setEditNodeForm, key)}>×</button>
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => addPropertyField(editNodeForm, setEditNodeForm)}>+ 添加属性</button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditNodeModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleEditNode}>保存修改</button>
            </div>
          </div>
        </div>
      )}

      {showEditEdgeModal && (
        <div className="modal-overlay" onClick={() => setShowEditEdgeModal(false)}>
          <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>修改边</h3>
              <button className="modal-close" onClick={() => setShowEditEdgeModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>起点节点</label>
                <input type="text" className="input" value={editEdgeForm.source} readOnly />
              </div>
              <div className="form-group">
                <label>终点节点</label>
                <input type="text" className="input" value={editEdgeForm.target} readOnly />
              </div>
              <div className="form-group">
                <label>当前关系类型</label>
                <input type="text" className="input" value={editEdgeForm.oldRelType} readOnly />
              </div>
              <div className="form-group">
                <label>新关系类型 *</label>
                <input type="text" className="input" value={editEdgeForm.newRelType} onChange={e => setEditEdgeForm({ ...editEdgeForm, newRelType: e.target.value })} placeholder="选择或输入新关系类型" list="edit-rel-types" />
                <datalist id="edit-rel-types">
                  {relTypes.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditEdgeModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleEditEdge}>保存修改</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>导入数据</h3>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="import-instructions">
                <h4>导入说明</h4>
                <ol>
                  <li>支持 Excel (.xlsx)、JSON (.json) 和文本 AI 抽取导入</li>
                  <li>Excel 文件需包含"节点"和/或"关系"工作表</li>
                  <li>JSON 文件需包含 nodes 和 edges 数组</li>
                  <li>文本导入会调用大模型抽取节点与关系，并按当前图谱类型校验后写入</li>
                  <li>导入内容校验通过后自动保存，拓扑图实时刷新</li>
                </ol>
              </div>
              <div className="form-group">
                <label>下载导入模板</label>
                <div className="template-btns">
                  <button className="btn btn-secondary btn-sm" onClick={() => downloadImportTemplate('excel')}>📥 Excel模板</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => downloadImportTemplate('json')}>📥 JSON模板</button>
                </div>
              </div>
              <div className="form-group">
                <label>文件格式</label>
                <select className="input" value={importFormat} onChange={e => { setImportFormat(e.target.value); setImportFile(null); setImportErrors([]); setImportSuccess(false) }}>
                  <option value="json">JSON</option>
                  <option value="excel">Excel (.xlsx)</option>
                  <option value="text">文本（AI抽取）</option>
                </select>
              </div>
              <div className="form-group">
                <label>{importFormat === 'text' ? '上传文本文件（可选）' : '选择文件'}</label>
                <input type="file" accept={importFormat === 'json' ? '.json' : importFormat === 'text' ? '.txt,.md' : '.xlsx,.xls'} onChange={e => { setImportFile(e.target.files[0]); setImportErrors([]); setImportSuccess(false) }} className="input" />
              </div>
              {importFormat === 'text' && (
                <div className="form-group">
                  <label>或粘贴产业链文本</label>
                  <textarea
                    className="input"
                    rows={8}
                    value={importText}
                    onChange={e => { setImportText(e.target.value); setImportErrors([]); setImportSuccess(false) }}
                    placeholder="粘贴企业介绍、产业链说明、技术服务材料等文本，系统会抽取节点与关系并更新当前知识图谱。"
                  />
                </div>
              )}
              {importErrors.length > 0 && (
                <div className="import-errors">
                  <h4>导入错误：</h4>
                  <ul>{importErrors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                </div>
              )}
              {importSuccess && <div className="import-success">✓ 导入成功！</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowImportModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleFileImport}>导入</button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>导出数据</h3>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="export-options">
                <button className="export-option-btn" onClick={() => { handleExport('json'); setShowExportModal(false) }}>
                  <span className="export-icon">📋</span>
                  <span className="export-label">全量图谱 (JSON)</span>
                  <span className="export-desc">导出节点与关系的完整数据</span>
                </button>
                <button className="export-option-btn" onClick={() => { handleExport('nodes-json'); setShowExportModal(false) }}>
                  <span className="export-icon">🔵</span>
                  <span className="export-label">节点清单 (JSON)</span>
                  <span className="export-desc">仅导出节点数据</span>
                </button>
                <button className="export-option-btn" onClick={() => { handleExport('edges-json'); setShowExportModal(false) }}>
                  <span className="export-icon">🔗</span>
                  <span className="export-label">关系清单 (JSON)</span>
                  <span className="export-desc">仅导出关系数据</span>
                </button>
                <button className="export-option-btn" onClick={() => { handleExport('excel'); setShowExportModal(false) }}>
                  <span className="export-icon">📊</span>
                  <span className="export-label">Excel格式</span>
                  <span className="export-desc">导出为 .xlsx 文件</span>
                </button>
                <button className="export-option-btn" onClick={() => { handleExport('png'); setShowExportModal(false) }}>
                  <span className="export-icon">🖼️</span>
                  <span className="export-label">PNG图片</span>
                  <span className="export-desc">导出当前拓扑图截图</span>
                </button>
                <button className="export-option-btn" onClick={() => { handleExport('pdf'); setShowExportModal(false) }}>
                  <span className="export-icon">📄</span>
                  <span className="export-label">PDF文件</span>
                  <span className="export-desc">通过打印对话框导出PDF</span>
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {showSnapshotModal && (
        <div className="modal-overlay" onClick={() => setShowSnapshotModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>版本管理</h3>
              <button className="modal-close" onClick={() => setShowSnapshotModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="snapshot-create">
                <h4>创建备份</h4>
                <div className="form-group">
                  <input type="text" className="input" value={snapshotDesc} onChange={e => setSnapshotDesc(e.target.value)} placeholder="备份描述（可选）" />
                </div>
                <button className="btn btn-primary" onClick={handleCreateSnapshot}>一键备份当前版本</button>
              </div>
              <div className="snapshot-list">
                <h4>历史版本</h4>
                {snapshots.length === 0 ? (
                  <p className="no-data">暂无历史版本</p>
                ) : (
                  snapshots.map(s => (
                    <div className="snapshot-item" key={s.fileName}>
                      <div className="snapshot-info">
                        <div className="snapshot-desc">{s.description}</div>
                        <div className="snapshot-meta">
                          {new Date(s.timestamp).toLocaleString()} | {s.nodeCount}节点 {s.edgeCount}关系
                        </div>
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRestoreSnapshot(s.fileName)}>恢复</button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSnapshotModal(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgeGraph
