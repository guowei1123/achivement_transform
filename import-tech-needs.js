const neo4j = require('neo4j-driver');
const config = require('./server/config');

const driver = neo4j.driver(config.neo4j.uri, neo4j.auth.basic(config.neo4j.user, config.neo4j.password));

const techNeedsData = {
  '中国船舶集团有限公司': '绿色智能船舶总体设计技术、船舶总装精密装配技术、船舶能效优化技术',
  '中集海洋工程有限公司': '海洋平台模块化设计技术、海洋装备抗风浪技术',
  '中船动力集团有限公司': '船用低速柴油机高效燃烧技术、动力系统集成匹配技术、柴油机节能减排技术',
  '中船电子科技有限公司': '船舶智能导航技术、船用通信抗干扰技术、船舶电子控制系统集成技术',
  '沪东重机股份有限公司': '船用曲轴精密锻造技术、大型零部件热处理技术、零部件表面防腐技术',
  '江南造船机械有限公司': '甲板机械轻量化设计技术、液压系统可靠性优化技术',
  '中远船务舾装有限公司': '舾装件模块化集成技术、船舶管路防腐蚀技术',
  '无锡振华船舶配件有限公司': '船用配件轻量化设计技术、液压配件可靠性优化技术',
  '中信重工机械股份有限公司': '大型铸件精准浇注技术、铸件缺陷检测技术',
  '上海电气船用电机有限公司': '高效船用电机设计技术、电机绝缘性能优化技术',
  '大连船用阀门有限公司': '船用阀门耐高压设计技术、阀门耐腐蚀表面处理技术',
  '宝山钢铁股份有限公司': '船用高强度钢板轧制技术、钢材抗疲劳性能优化技术、海洋环境钢材防腐技术',
  '万华化学集团股份有限公司': '环保型船用防腐涂料研发技术、涂料耐海洋环境老化技术',
  '中国铝业股份有限公司': '船用铝合金轻量化轧制技术、铝合金耐海洋腐蚀技术',
  '上海起帆电缆股份有限公司': '船用耐候电缆设计技术、电缆抗干扰技术',
  '中远海运集团有限公司': '船舶航线智能规划技术、船舶运营能效管理技术、港口船舶智能调度技术',
  '中船重工船舶维修有限公司': '船舶水下构件无损检测技术、船舶动力系统快速维修技术',
  '中远海运租赁有限公司': '船舶租赁风险评估技术、船舶资产估值技术',
  '中外运物流有限公司': '船舶物资智能仓储技术、物流运输路径优化技术',
  '上海船舶环保工程有限公司': '船舶尾气净化技术、船舶油污回收技术'
};

const enterpriseNameMapping = {
  '中国船舶集团有限公司': '中国船舶集团',
  '中集海洋工程有限公司': '中集海洋工程',
  '中船动力集团有限公司': '中船动力',
  '中船电子科技有限公司': '中船电子',
  '沪东重机股份有限公司': '沪东重机',
  '江南造船机械有限公司': '江南造船机械',
  '中远船务舾装有限公司': '中远船务舾装',
  '无锡振华船舶配件有限公司': '无锡振华',
  '中信重工机械股份有限公司': '中信重工',
  '上海电气船用电机有限公司': '上海电气',
  '大连船用阀门有限公司': '大连船用阀门',
  '宝山钢铁股份有限公司': '宝山钢铁',
  '万华化学集团股份有限公司': '万华化学',
  '中国铝业股份有限公司': '中国铝业',
  '上海起帆电缆股份有限公司': '上海起帆电缆',
  '中远海运集团有限公司': '中远海运集团',
  '中船重工船舶维修有限公司': '中船重工船舶维修',
  '中远海运租赁有限公司': '中远海运租赁',
  '中外运物流有限公司': '中外运物流',
  '上海船舶环保工程有限公司': '上海船舶环保'
};

async function importTechNeeds() {
  const session = driver.session();
  try {
    console.log('开始导入技术需求节点...');
    
    let totalNodes = 0;
    let totalEdges = 0;
    
    for (const [enterpriseName, techNeedsText] of Object.entries(techNeedsData)) {
      console.log(`处理企业: ${enterpriseName}`);
      
      const mappedEnterpriseName = enterpriseNameMapping[enterpriseName];
      if (!mappedEnterpriseName) {
        console.log(`  警告: 企业 "${enterpriseName}" 没有映射，跳过`);
        continue;
      }
      
      const enterpriseResult = await session.run(
        `MATCH (e:Node {label: $enterpriseName}) RETURN e`,
        { enterpriseName: mappedEnterpriseName }
      );
      
      if (enterpriseResult.records.length === 0) {
        console.log(`  警告: 企业 "${mappedEnterpriseName}" 不存在，跳过`);
        continue;
      }
      
      const enterprise = enterpriseResult.records[0].get('e').properties;
      const enterpriseId = enterprise.id;
      
      const techNeedsList = techNeedsText.split('、').filter(need => need.trim());
      console.log(`  技术需求数量: ${techNeedsList.length}`);
      
      for (let i = 0; i < techNeedsList.length; i++) {
        const techNeedLabel = techNeedsList[i];
        const techNeedId = `tech-need-${enterpriseId}-${i + 1}`;
        
        await session.run(
          `CREATE (n:Node {
            id: $id,
            label: $label,
            type: $type,
            category: $category
          })`,
          {
            id: techNeedId,
            label: techNeedLabel,
            type: 'technical requirements',
            category: '技术需求'
          }
        );
        
        await session.run(
          `MATCH (e:Node {id: $enterpriseId}), (n:Node {id: $techNeedId})
           CREATE (e)-[r:RELATIONSHIP {label: $label}]->(n)`,
          {
            enterpriseId,
            techNeedId,
            label: '需要技术'
          }
        );
        
        totalNodes++;
        totalEdges++;
      }
    }
    
    console.log('技术需求节点导入完成！');
    console.log(`导入了 ${totalNodes} 个技术需求节点`);
    console.log(`导入了 ${totalEdges} 个关系`);
    
  } catch (error) {
    console.error('导入技术需求节点失败:', error);
  } finally {
    await session.close();
  }
}

importTechNeeds()
  .then(() => {
    console.log('操作完成');
    driver.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error('发生错误:', error);
    driver.close();
    process.exit(1);
  });