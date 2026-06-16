const neo4j = require('neo4j-driver');
const config = require('./config');

const driver = neo4j.driver(config.neo4j.uri, neo4j.auth.basic(config.neo4j.user, config.neo4j.password));

async function initDatabase() {
  const session = driver.session();
  try {
    console.log('清空数据库...');
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('数据库已清空');

    console.log('创建节点...');

    await session.run(`CREATE (i1:Input {name:"工程建材类中间投入"})`);
    await session.run(`CREATE (i2:Input {name:"工程装备与机电中间投入"})`);
    await session.run(`CREATE (i3:Input {name:"智能航行与感知设备中间投入"})`);
    await session.run(`CREATE (i4:Input {name:"能源类中间投入"})`);
    await session.run(`CREATE (i5:Input {name:"清洁能源与岸电系统中间投入"})`);
    await session.run(`CREATE (i6:Input {name:"生产性服务中间投入"})`);
    await session.run(`CREATE (i7:Input {name:"数字孪生与仿真系统中间投入"})`);
    await session.run(`CREATE (i8:Input {name:"生态环保中间投入"})`);
    await session.run(`CREATE (i9:Input {name:"集运鱼系统与生态修复组件中间投入"})`);

    await session.run(`CREATE (ind:Industry {
      name:"内河航运基础设施建设与运营产业",
      code:"G5531-G5532",
      desc:"水上运输辅助活动（港口及航运设施工程建筑+管理）"
    })`);

    await session.run(`CREATE (mp1:MidProduct {name:"航道通航基础服务中间品"})`);
    await session.run(`CREATE (mp2:MidProduct {name:"工程建设中间产品"})`);
    await session.run(`CREATE (mp3:MidProduct {name:"航运配套中间服务"})`);
    await session.run(`CREATE (mp4:MidProduct {name:"生态航运中间产品"})`);
    await session.run(`CREATE (mp5:MidProduct {name:"智慧航道数据底座与数字孪生服务"})`);
    await session.run(`CREATE (mp6:MidProduct {name:"BIM+GIS数字工程建设管理服务"})`);
    await session.run(`CREATE (mp7:MidProduct {name:"过鱼设施运维与生态补偿成果"})`);
    await session.run(`CREATE (mp8:MidProduct {name:"绿色能源供给网络中间成果"})`);

    await session.run(`CREATE (fp1:FinalProduct {name:"基础设施资本形成最终品"})`);
    await session.run(`CREATE (fp2:FinalProduct {name:"公共服务型最终服务"})`);
    await session.run(`CREATE (fp3:FinalProduct {name:"生态最终产品服务"})`);
    await session.run(`CREATE (fp4:FinalProduct {name:"多式联运枢纽与综合物流保障服务"})`);

    await session.run(`CREATE (t1:TechField {name:"建筑材料与绿色施工技术", source:"武汉理工大学三峡新通道PDF"})`);
    await session.run(`CREATE (t2:TechField {name:"智能监控与数字孪生运维技术", source:"武汉理工大学三峡新通道PDF"})`);
    await session.run(`CREATE (t3:TechField {name:"水动力与航道整治工程技术", source:"三峡PDF原第3类拆分"})`);
    await session.run(`CREATE (t4:TechField {name:"生态保护与生物多样性恢复技术", source:"三峡PDF原第3类拆分"})`);
    await session.run(`CREATE (t5:TechField {name:"能源系统与储能微电网技术", source:"武汉理工大学三峡新通道PDF"})`);
    await session.run(`CREATE (t6:TechField {name:"消防安全与工程风险防护技术", source:"武汉理工大学三峡新通道PDF"})`);

    await session.run(`CREATE (s1:Tech {name:"水运工程大体积混凝土控裂技术", field:"建筑材料与绿色施工技术"})`);
    await session.run(`CREATE (s2:Tech {name:"混凝土纳米自清洁涂层技术", field:"建筑材料与绿色施工技术"})`);
    await session.run(`CREATE (s3:Tech {name:"高陡边坡控制爆破与安全控制技术", field:"建筑材料与绿色施工技术"})`);
    await session.run(`CREATE (s4:Tech {name:"工程废弃物就地资源化利用技术", field:"建筑材料与绿色施工技术"})`);

    await session.run(`CREATE (s5:Tech {name:"通航枢纽数字孪生智能调度技术", field:"智能监控与数字孪生运维技术"})`);
    await session.run(`CREATE (s6:Tech {name:"船闸设备故障预警和诊断系统", field:"智能监控与数字孪生运维技术"})`);
    await session.run(`CREATE (s7:Tech {name:"船舶智能助航与过闸控制技术", field:"智能监控与数字孪生运维技术"})`);
    await session.run(`CREATE (s8:Tech {name:"大坝三维数字化探测技术", field:"智能监控与数字孪生运维技术"})`);
    await session.run(`CREATE (s9:Tech {name:"智能疏浚决策支持系统", field:"智能监控与数字孪生运维技术"})`);

    await session.run(`CREATE (s10:Tech {name:"船组耦合水动力预报技术", field:"水动力与航道整治工程技术"})`);
    await session.run(`CREATE (s11:Tech {name:"内河标准船型研发与适配技术", field:"水动力与航道整治工程技术"})`);

    await session.run(`CREATE (s12:Tech {name:"鱼道过鱼评估与生态仿真技术", field:"生态保护与生物多样性恢复技术"})`);
    await session.run(`CREATE (s13:Tech {name:"鱼类监测与栖息地修复技术", field:"生态保护与生物多样性恢复技术"})`);

    await session.run(`CREATE (s14:Tech {name:"光-波浪-储自洽能源系统技术", field:"能源系统与储能微电网技术"})`);
    await session.run(`CREATE (s15:Tech {name:"水风光氢一体化零碳微电网技术", field:"能源系统与储能微电网技术"})`);

    await session.run(`CREATE (s16:Tech {name:"船舶航道智慧消防技术", field:"消防安全与工程风险防护技术"})`);
    await session.run(`CREATE (s17:Tech {name:"结构安全诊断与病害检测技术", field:"消防安全与工程风险防护技术"})`);
    await session.run(`CREATE (s18:Tech {name:"枢纽断航风险评估技术", field:"消防安全与工程风险防护技术"})`);

    console.log('节点创建完成，开始创建关系...');

    await session.run(`MATCH (ind:Industry),(i:Input) MERGE (ind)-[:消耗中间投入]->(i)`);
    await session.run(`MATCH (ind:Industry),(mp:MidProduct) MERGE (ind)-[:生产中间产品]->(mp)`);
    await session.run(`MATCH (ind:Industry),(fp:FinalProduct) MERGE (ind)-[:提供最终产品]->(fp)`);
    await session.run(`MATCH (t:TechField),(i:Input) MERGE (t)-[:技术支撑]->(i)`);
    await session.run(`MATCH (t:TechField),(ind:Industry) MERGE (t)-[:技术赋能]->(ind)`);
    await session.run(`MATCH (t:TechField),(mp:MidProduct) MERGE (t)-[:技术保障]->(mp)`);
    await session.run(`MATCH (t:TechField),(fp:FinalProduct) MERGE (t)-[:技术落地]->(fp)`);
    await session.run(`MATCH (t:TechField),(s:Tech) WHERE t.name = s.field MERGE (t)-[:包含细分技术]->(s)`);

    console.log('关系创建完成');

    const nodeCount = await session.run('MATCH (n) RETURN count(n) as count');
    const edgeCount = await session.run('MATCH ()-[r]->() RETURN count(r) as count');
    console.log(`总计: ${nodeCount.records[0].get('count').toNumber()} 个节点, ${edgeCount.records[0].get('count').toNumber()} 条关系`);

  } catch (error) {
    console.error('初始化数据库失败:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

initDatabase();
