const CHAIN_INDUSTRIES = [
  { value: 'waterway', label: '三峡水运新通道产业链' },
  { value: 'automotive', label: '汽车产业链' },
];

const AUTOMOTIVE_INDUSTRY = 'automotive';

const AUTOMOTIVE_CHAIN_NODES = [
  { name: '钢铝与轻量化材料', nodeType: 'Layer2', industry: AUTOMOTIVE_INDUSTRY, category: '基础材料' },
  { name: '动力电池材料', nodeType: 'Layer2', industry: AUTOMOTIVE_INDUSTRY, category: '电池上游' },
  { name: '电芯与电池系统', nodeType: 'Layer2', industry: AUTOMOTIVE_INDUSTRY, category: '动力电池' },
  { name: '电机电控系统', nodeType: 'Layer2', industry: AUTOMOTIVE_INDUSTRY, category: '三电系统' },
  { name: '汽车芯片与传感器', nodeType: 'Layer2', industry: AUTOMOTIVE_INDUSTRY, category: '智能化部件' },
  { name: '车身底盘与内外饰零部件', nodeType: 'Layer2', industry: AUTOMOTIVE_INDUSTRY, category: '核心零部件' },
  { name: '热管理与充电部件', nodeType: 'Layer2', industry: AUTOMOTIVE_INDUSTRY, category: '新能源配套部件' },

  { name: '整车研发与平台架构', nodeType: 'Layer3', industry: AUTOMOTIVE_INDUSTRY, category: '研发设计' },
  { name: '三电系统集成', nodeType: 'Layer3', industry: AUTOMOTIVE_INDUSTRY, category: '新能源集成' },
  { name: '车身制造与涂装', nodeType: 'Layer3', industry: AUTOMOTIVE_INDUSTRY, category: '整车制造' },
  { name: '总装与质量检测', nodeType: 'Layer3', industry: AUTOMOTIVE_INDUSTRY, category: '整车制造' },
  { name: '智能座舱与辅助驾驶软件', nodeType: 'Layer3', industry: AUTOMOTIVE_INDUSTRY, category: '软件定义汽车' },
  { name: '供应链协同与整车物流', nodeType: 'Layer3', industry: AUTOMOTIVE_INDUSTRY, category: '供应链管理' },

  { name: '销售交付与渠道服务', nodeType: 'Layer4', industry: AUTOMOTIVE_INDUSTRY, category: '流通服务' },
  { name: '汽车金融与保险', nodeType: 'Layer4', industry: AUTOMOTIVE_INDUSTRY, category: '金融服务' },
  { name: '充换电与能源补给服务', nodeType: 'Layer4', industry: AUTOMOTIVE_INDUSTRY, category: '能源服务' },
  { name: '维修保养与备件服务', nodeType: 'Layer4', industry: AUTOMOTIVE_INDUSTRY, category: '后市场' },
  { name: '车联网与数据运营', nodeType: 'Layer4', industry: AUTOMOTIVE_INDUSTRY, category: '数字运营' },
  { name: '二手车与动力电池回收', nodeType: 'Layer4', industry: AUTOMOTIVE_INDUSTRY, category: '循环服务' },

  { name: '个人及家庭用户', nodeType: 'Value', industry: AUTOMOTIVE_INDUSTRY, category: '消费市场' },
  { name: '商用车与物流用户', nodeType: 'Value', industry: AUTOMOTIVE_INDUSTRY, category: '生产运营市场' },
  { name: '出行运营平台', nodeType: 'Value', industry: AUTOMOTIVE_INDUSTRY, category: '共享出行' },
  { name: '能源电网与储能场景', nodeType: 'Value', industry: AUTOMOTIVE_INDUSTRY, category: '能源协同' },
  { name: '循环利用与材料再生', nodeType: 'Value', industry: AUTOMOTIVE_INDUSTRY, category: '循环经济' },
];

const AUTOMOTIVE_CHAIN_EDGES = [
  ['钢铝与轻量化材料', '车身底盘与内外饰零部件', '供应'],
  ['动力电池材料', '电芯与电池系统', '供应'],
  ['电芯与电池系统', '三电系统集成', '集成'],
  ['电机电控系统', '三电系统集成', '集成'],
  ['汽车芯片与传感器', '智能座舱与辅助驾驶软件', '支撑'],
  ['车身底盘与内外饰零部件', '车身制造与涂装', '供应'],
  ['热管理与充电部件', '三电系统集成', '配套'],
  ['整车研发与平台架构', '三电系统集成', '定义平台'],
  ['整车研发与平台架构', '车身制造与涂装', '设计导入'],
  ['车身制造与涂装', '总装与质量检测', '制造'],
  ['三电系统集成', '总装与质量检测', '装配'],
  ['智能座舱与辅助驾驶软件', '总装与质量检测', '软件集成'],
  ['供应链协同与整车物流', '总装与质量检测', '保障'],
  ['总装与质量检测', '销售交付与渠道服务', '交付'],
  ['销售交付与渠道服务', '汽车金融与保险', '带动'],
  ['销售交付与渠道服务', '个人及家庭用户', '服务'],
  ['销售交付与渠道服务', '商用车与物流用户', '服务'],
  ['汽车金融与保险', '个人及家庭用户', '服务'],
  ['汽车金融与保险', '商用车与物流用户', '服务'],
  ['充换电与能源补给服务', '个人及家庭用户', '补能服务'],
  ['充换电与能源补给服务', '商用车与物流用户', '补能服务'],
  ['充换电与能源补给服务', '能源电网与储能场景', '协同'],
  ['车联网与数据运营', '出行运营平台', '服务'],
  ['车联网与数据运营', '商用车与物流用户', '运营支撑'],
  ['维修保养与备件服务', '个人及家庭用户', '售后服务'],
  ['维修保养与备件服务', '商用车与物流用户', '售后服务'],
  ['二手车与动力电池回收', '循环利用与材料再生', '回收'],
  ['二手车与动力电池回收', '能源电网与储能场景', '梯次利用'],
  ['循环利用与材料再生', '动力电池材料', '再生供应'],
];

function normalizeIndustry(value) {
  return CHAIN_INDUSTRIES.some((item) => item.value === value) ? value : 'waterway';
}

function getChainIndustries() {
  return CHAIN_INDUSTRIES;
}

function getAutomotiveChainGraph() {
  return {
    nodes: AUTOMOTIVE_CHAIN_NODES.map((node) => ({ ...node })),
    edges: AUTOMOTIVE_CHAIN_EDGES.map(([source, target, relType]) => ({
      source,
      target,
      relType,
      label: relType,
      industry: AUTOMOTIVE_INDUSTRY,
    })),
  };
}

module.exports = {
  AUTOMOTIVE_INDUSTRY,
  getAutomotiveChainGraph,
  getChainIndustries,
  normalizeIndustry,
};
