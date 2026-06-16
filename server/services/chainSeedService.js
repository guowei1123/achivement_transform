const CHAIN_SEED_NODES = [
  { nodeType: 'Layer2', name: '特种水泥供应' },
  { nodeType: 'Layer2', name: '高强钢材供应' },
  { nodeType: 'Layer2', name: '骨料与掺合料供应' },
  { nodeType: 'Layer2', name: '工程爆破材料供应' },
  { nodeType: 'Layer2', name: '水轮发电机组制造' },
  { nodeType: 'Layer2', name: '启闭机成套设备制造' },
  { nodeType: 'Layer2', name: '大型闸门制造' },
  { nodeType: 'Layer2', name: '施工重型机械制造' },
  { nodeType: 'Layer2', name: '疏浚与航道整治装备制造' },
  { nodeType: 'Layer2', name: '物资采购平台' },
  { nodeType: 'Layer2', name: '仓储配送' },
  { nodeType: 'Layer3', name: '导流与围堰施工' },
  { nodeType: 'Layer3', name: '大坝混凝土施工' },
  { nodeType: 'Layer3', name: '船闸开挖与衬砌施工' },
  { nodeType: 'Layer3', name: '电站厂房施工' },
  { nodeType: 'Layer3', name: '金属结构安装' },
  { nodeType: 'Layer3', name: '机电设备安装' },
  { nodeType: 'Layer3', name: '航道整治施工' },
  { nodeType: 'Layer3', name: '数字化管理平台' },
  { nodeType: 'Layer3', name: '智能施工控制' },
  { nodeType: 'Layer3', name: '安全监测系统' },
  { nodeType: 'Layer4', name: '发电运行调度' },
  { nodeType: 'Layer4', name: '梯级联合调度' },
  { nodeType: 'Layer4', name: '电力外送' },
  { nodeType: 'Layer4', name: '船闸运行管理' },
  { nodeType: 'Layer4', name: '智慧通航服务' },
  { nodeType: 'Layer4', name: '计划性检修' },
  { nodeType: 'Layer4', name: '备品备件保障' },
  { nodeType: 'Layer4', name: '应急抢修' },
  { nodeType: 'Layer4', name: '移民安置与产业扶持' },
  { nodeType: 'Layer4', name: '生态环境保护' },
  { nodeType: 'Value', name: '下游电力用户' },
  { nodeType: 'Value', name: '航运企业' },
  { nodeType: 'Value', name: '库区社会经济' },
  { nodeType: 'Value', name: '库区生态环境' },
];

const CHAIN_SEED_EDGES = [
  ['特种水泥供应', '大坝混凝土施工', '供应'],
  ['骨料与掺合料供应', '大坝混凝土施工', '供应'],
  ['高强钢材供应', '金属结构安装', '供应'],
  ['工程爆破材料供应', '船闸开挖与衬砌施工', '供应'],
  ['水轮发电机组制造', '机电设备安装', '供应'],
  ['启闭机成套设备制造', '金属结构安装', '供应'],
  ['大型闸门制造', '金属结构安装', '供应'],
  ['施工重型机械制造', '导流与围堰施工', '装备支持'],
  ['施工重型机械制造', '大坝混凝土施工', '装备支持'],
  ['疏浚与航道整治装备制造', '航道整治施工', '装备支持'],
  ['物资采购平台', '大坝混凝土施工', '统一配送'],
  ['物资采购平台', '船闸开挖与衬砌施工', '统一配送'],
  ['仓储配送', '大坝混凝土施工', '现场配送'],
  ['导流与围堰施工', '大坝混凝土施工', '提供施工条件'],
  ['大坝混凝土施工', '金属结构安装', '提供安装面'],
  ['船闸开挖与衬砌施工', '金属结构安装', '提供安装面'],
  ['电站厂房施工', '机电设备安装', '提供安装面'],
  ['数字化管理平台', '大坝混凝土施工', '数字化支撑'],
  ['数字化管理平台', '船闸开挖与衬砌施工', '数字化支撑'],
  ['智能施工控制', '大坝混凝土施工', '智能控制'],
  ['安全监测系统', '大坝混凝土施工', '安全监测'],
  ['大坝混凝土施工', '发电运行调度', '交付'],
  ['电站厂房施工', '发电运行调度', '交付'],
  ['机电设备安装', '发电运行调度', '交付'],
  ['船闸开挖与衬砌施工', '船闸运行管理', '交付'],
  ['金属结构安装', '船闸运行管理', '交付'],
  ['航道整治施工', '船闸运行管理', '交付'],
  ['数字化管理平台', '智慧通航服务', '数字模型支撑'],
  ['梯级联合调度', '发电运行调度', '联合调度'],
  ['发电运行调度', '电力外送', '输送电力'],
  ['发电运行调度', '计划性检修', '提出检修需求'],
  ['船闸运行管理', '计划性检修', '提出检修需求'],
  ['备品备件保障', '计划性检修', '提供备件'],
  ['备品备件保障', '应急抢修', '提供备件'],
  ['船闸运行管理', '智慧通航服务', '支撑'],
  ['电力外送', '下游电力用户', '服务'],
  ['智慧通航服务', '航运企业', '服务'],
  ['移民安置与产业扶持', '库区社会经济', '促进'],
  ['生态环境保护', '库区生态环境', '保护'],
];

async function seedChainDemoData(graphStore) {
  const existing = await graphStore.getNodes({
    nodeTypes: ['Input', 'Industry', 'MidProduct', 'FinalProduct', 'Layer1', 'Layer2', 'Layer3', 'Layer4', 'Value'],
  });

  for (const node of existing) {
    await graphStore.deleteNode(node.name || node.label || node.id);
  }

  for (const node of CHAIN_SEED_NODES) {
    await graphStore.createNode({
      name: node.name,
      nodeType: node.nodeType,
      properties: { name: node.name },
    });
  }

  for (const [source, target, relType] of CHAIN_SEED_EDGES) {
    await graphStore.createEdge({
      source,
      target,
      relType,
      label: relType,
    });
  }

  return {
    nodeCount: CHAIN_SEED_NODES.length,
    edgeCount: CHAIN_SEED_EDGES.length,
  };
}

module.exports = {
  seedChainDemoData,
};
