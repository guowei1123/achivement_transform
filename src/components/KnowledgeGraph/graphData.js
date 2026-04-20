export const shippingData = {
  nodes: [
  { id: "e1", label: "中远海运集团", type: "Enterprise", category: "航运公司" ,business:'集装箱班轮运输'},
    { id: "e2", label: "中国船舶集团", type: "Enterprise", category: "造船厂", business: "船舶建造" },
{ id: "e3", label: "BP石油", type: "Enterprise", category: "燃油供应商", business: "船用燃油供应" },
{ id: "e4", label: "马士基物流", type: "Enterprise", category: "货代公司", business: "揽货/订舱" },
{ id: "e5", label: "必和必拓", type: "Enterprise", category: "大宗商品贸易商", business: "铁矿石出口" },
{ id: "e6", label: "上海国际港务集团", type: "Enterprise", category: "港口集团", business: "集装箱码头运营" },
{ id: "e7", label: "宁波舟山港", type: "Enterprise", category: "港口集团", business: "干散货码头运营" },
{ id: "e8", label: "中外运物流", type: "Enterprise", category: "3PL", business: "多式联运/配送" },
{ id: "e9", label: "顺丰速运", type: "Enterprise", category: "末端物流", business: "跨境电商配送" },
{ id: "e10", label: "中国船级社(CCS)", type: "Enterprise", category: "船级社", business: "船舶检验" },
{ id: "e11", label: "人保财险", type: "Enterprise", category: "保险公司", business: "货运险/船壳险" },
  { id: "e12", label: "中国银行", type: "Enterprise", category: "银行", business: "船舶融资/外汇结算"  },
   { id: "v1", label: "中远海运宇宙轮", type: "Vessel", category: "集装箱船", tonnage: "24000TEU", owner_id: "ENT001" },
{ id: "v2", label: "远卓海轮", type: "Vessel", category: "干散货船", tonnage: "18万吨", owner_id: "ENT001" },
{ id: "p1", label: "上海洋山港", type: "Port", category: "集装箱码头", operator_id: "ENT006", location: "上海" },
{ id: "p2", label: "宁波舟山港北仑港区", type: "Port", category: "干散货码头", operator_id: "ENT007", location: "宁波" },
{ id: "c1", label: "电子产品", type: "Cargo", category: "集装箱货", shipper_id: "ENT005", consignee_id: "ENT009" },
{ id: "c2", label: "铁矿石", type: "Cargo", category: "干散货", shipper_id: "ENT005", consignee_id: "ENT008" },
{ id: "r1", label: "中欧航线(上海-鹿特丹)", type: "Route", category: "航线", carrier_id: "ENT001", port_ids: ["POR001", "POR002"] },
{ id: "a1", label: "上海海事局", type: "Authority", category: "海事监管", jurisdiction: "上海港" },
{ id: "a2", label: "上海海关", type: "Authority", category: "海关监管", jurisdiction: "上海港" }
  ],
  edges: [

{ source: 'e5', target: 'e4', label: '委托' },
{ source: 'e4', target: 'e1', label: '订舱' },
{ source: 'e2', target: 'v1', label: '建造' },
{ source: 'e1', target: 'v1', label: '拥有' },
{ source: 'e3', target: 'v1', label: '供给燃油' },
{ source: 'e1', target: 'r1', label: '运营' },
{ source: 'r1', target: 'p1', label: '挂靠' },
{ source: 'v1', target: 'c1', label: '装载' },
{ source: 'p1', target: 'c1', label: '装卸' },
{ source: 'p1', target: 'e8', label: '衔接集疏运' },
{ source: 'e8', target: 'e9', label: '配送' },
{ source: 'e10', target: 'v1', label: '检验发证' },
{ source: 'e11', target: 'v1', label: '承保' },
{ source: 'a1', target: 'v1', label: '监管' },
{ source: 'a2', target: 'c1', label: '通关监管' }

  ]
}

export const schoolData = {
  nodes: [
{ id: "patent_1", label: "专利", type: "Patent", category: "专利", description: "技术专利" },
{ id: "paper_1", label: "论文", type: "Paper", category: "论文", description: "学术论文" },
{ id: "project_1", label: "项目", type: "Project", category: "项目", description: "科研项目" },
{ id: "researcher_1", label: "科研人员", type: "Researcher", category: "科研人员", description: "科研工作者" },
{ id: "dept_1", label: "部门", type: "Department", category: "部门", description: "科研部门" },
{ id: "title_1", label: "学术头衔", type: "AcademicTitle", category: "学术头衔", description: "学术荣誉称号" },
{ id: "award_1", label: "奖项", type: "Award", category: "奖项", description: "科研奖项" },
{ id: "tech_1", label: "技术领域", type: "TechField", category: "技术领域", description: "技术研究方向" }

  ],
  edges: [
{ source: 'researcher_1', target: 'patent_1', label: '发明' },
{ source: 'researcher_1', target: 'paper_1', label: '发表' },
{ source: 'researcher_1', target: 'project_1', label: '承担' },
{ source: 'patent_1', target: 'tech_1', label: '属于' },
{ source: 'paper_1', target: 'tech_1', label: '属于' },
{ source: 'researcher_1', target: 'dept_1', label: '隶属' },
{ source: 'project_1', target: 'tech_1', label: '属于' },
{ source: 'researcher_1', target: 'title_1', label: '拥有' },
{ source: 'researcher_1', target: 'award_1', label: '获得' },
  ]
}

export const graphData = {
  shipping: shippingData,
  school: schoolData
}
