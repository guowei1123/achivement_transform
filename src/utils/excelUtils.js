import * as XLSX from 'xlsx'

export function generateNodeTemplate() {
  const data = [
    {
      '节点ID': 'S001',
      '节点名称': '清华大学',
      '节点类型': 'subject',
      '节点分类': '高校',
      '描述': '人工智能领域领先高校'
    },
    {
      '节点ID': 'S002',
      '节点名称': '北京大学',
      '节点类型': 'subject',
      '节点分类': '高校',
      '描述': '综合性研究型大学'
    },
    {
      '节点ID': 'S003',
      '节点名称': '中远海运集团',
      '节点类型': 'subject',
      '节点分类': '航运企业',
      '描述': '全球领先的航运企业'
    },
    {
      '节点ID': 'R001',
      '节点名称': '人工智能专利',
      '节点类型': 'resource',
      '节点分类': '专利',
      '描述': '深度学习相关技术专利'
    },
    {
      '节点ID': 'R002',
      '节点名称': '深度学习论文',
      '节点类型': 'resource',
      '节点分类': '论文',
      '描述': '自然语言处理研究论文'
    },
    {
      '节点ID': 'SC001',
      '节点名称': '智能客服',
      '节点类型': 'scenario',
      '节点分类': '应用场景',
      '描述': '基于AI的客服系统'
    },
    {
      '节点ID': 'SC002',
      '节点名称': '智能推荐',
      '节点类型': 'scenario',
      '节点分类': '应用场景',
      '描述': '个性化推荐算法'
    }
  ]

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '节点数据')
  XLSX.writeFile(workbook, '节点导入模板.xlsx')
}

export function generateRelationTemplate() {
  const data = [
    {
      '源节点ID': 'S001',
      '目标节点ID': 'R001',
      '关系标签': '研发',
      '关系类型': '直接关系'
    },
    {
      '源节点ID': 'S002',
      '目标节点ID': 'R002',
      '关系标签': '发表',
      '关系类型': '直接关系'
    },
    {
      '源节点ID': 'S003',
      '目标节点ID': 'SC001',
      '关系标签': '应用',
      '关系类型': '直接关系'
    },
    {
      '源节点ID': 'R001',
      '目标节点ID': 'SC002',
      '关系标签': '应用',
      '关系类型': '直接关系'
    },
    {
      '源节点ID': 'S001',
      '目标节点ID': 'S002',
      '关系标签': '合作',
      '关系类型': '直接关系'
    },
    {
      '源节点ID': 'R001',
      '目标节点ID': 'R002',
      '关系标签': '关联',
      '关系类型': '间接关系'
    }
  ]

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '关系数据')
  XLSX.writeFile(workbook, '关系导入模板.xlsx')
}

export function parseNodeExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        console.log('开始解析节点文件:', file.name, file.type, file.size)
        
        const data = new Uint8Array(e.target.result)
        console.log('文件数据长度:', data.length)
        
        if (data.length === 0) {
          reject(new Error('文件为空'))
          return
        }
        
        const workbook = XLSX.read(data, { type: 'array' })
        console.log('工作簿:', workbook.SheetNames)
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          reject(new Error('文件中没有工作表'))
          return
        }
        
        const firstSheetName = workbook.SheetNames[0]
        console.log('使用工作表:', firstSheetName)
        
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        console.log('解析到的节点数据:', jsonData)
        
        if (!jsonData || jsonData.length === 0) {
          reject(new Error('工作表为空或没有数据'))
          return
        }
        
        resolve(jsonData)
      } catch (error) {
        console.error('解析节点文件失败:', error)
        reject(error)
      }
    }
    reader.onerror = (error) => {
      console.error('读取节点文件失败:', error)
      reject(error)
    }
    reader.readAsArrayBuffer(file)
  })
}

export function parseRelationExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        console.log('开始解析关系文件:', file.name, file.type, file.size)
        
        const data = new Uint8Array(e.target.result)
        console.log('文件数据长度:', data.length)
        
        if (data.length === 0) {
          reject(new Error('文件为空'))
          return
        }
        
        const workbook = XLSX.read(data, { type: 'array' })
        console.log('工作簿:', workbook.SheetNames)
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          reject(new Error('文件中没有工作表'))
          return
        }
        
        const firstSheetName = workbook.SheetNames[0]
        console.log('使用工作表:', firstSheetName)
        
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        console.log('解析到的关系数据:', jsonData)
        
        if (!jsonData || jsonData.length === 0) {
          reject(new Error('工作表为空或没有数据'))
          return
        }
        
        resolve(jsonData)
      } catch (error) {
        console.error('解析关系文件失败:', error)
        reject(error)
      }
    }
    reader.onerror = (error) => {
      console.error('读取关系文件失败:', error)
      reject(error)
    }
    reader.readAsArrayBuffer(file)
  })
}

export function validateNodeData(data) {
  const errors = []
  const validTypes = ['subject', 'resource', 'scenario', 'link']
  const ids = new Set()

  data.forEach((row, index) => {
    const rowNum = index + 2

    if (!row['节点名称'] || !row['节点名称'].trim()) {
      errors.push(`第${rowNum}行：节点名称不能为空`)
    }

    if (!row['节点类型'] || !validTypes.includes(row['节点类型'])) {
      errors.push(`第${rowNum}行：节点类型无效，必须是subject、resource、scenario或link之一`)
    }

    if (row['节点ID']) {
      if (ids.has(row['节点ID'])) {
        errors.push(`第${rowNum}行：节点ID重复`)
      }
      ids.add(row['节点ID'])
    }
  })

  return errors
}

export function validateRelationData(data, existingNodeIds) {
  const errors = []
  const relationKeys = new Set()

  data.forEach((row, index) => {
    const rowNum = index + 2

    if (!row['源节点ID'] || !row['源节点ID'].trim()) {
      errors.push(`第${rowNum}行：源节点ID不能为空`)
    } else if (!existingNodeIds.includes(row['源节点ID'])) {
      errors.push(`第${rowNum}行：源节点ID ${row['源节点ID']} 不存在于图谱中`)
    }

    if (!row['目标节点ID'] || !row['目标节点ID'].trim()) {
      errors.push(`第${rowNum}行：目标节点ID不能为空`)
    } else if (!existingNodeIds.includes(row['目标节点ID'])) {
      errors.push(`第${rowNum}行：目标节点ID ${row['目标节点ID']} 不存在于图谱中`)
    }

    if (row['源节点ID'] && row['目标节点ID'] && row['源节点ID'] === row['目标节点ID']) {
      errors.push(`第${rowNum}行：源节点ID和目标节点ID不能相同`)
    }

    if (!row['关系标签'] || !row['关系标签'].trim()) {
      errors.push(`第${rowNum}行：关系标签不能为空`)
    }

    const relationKey = `${row['源节点ID']}-${row['目标节点ID']}`
    if (relationKeys.has(relationKey)) {
      errors.push(`第${rowNum}行：该关系已存在`)
    }
    relationKeys.add(relationKey)
  })

  return errors
}

export function transformNodeData(data) {
  return data.map(row => ({
    id: row['节点ID'] || `n${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    label: row['节点名称'],
    type: row['节点类型'],
    category: row['节点分类'] || '自定义',
    description: row['描述'] || ''
  }))
}

export function transformRelationData(data) {
  return data.map(row => ({
    id: `${row['源节点ID']}-${row['目标节点ID']}`,
    source: row['源节点ID'],
    target: row['目标节点ID'],
    label: row['关系标签'],
    type: row['关系类型'] || '直接关系'
  }))
}
