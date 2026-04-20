const neo4j = require('neo4j-driver');
const config = require('./server/config');

const driver = neo4j.driver(config.neo4j.uri, neo4j.auth.basic(config.neo4j.user, config.neo4j.password));

async function clearAndImportChainData() {
  const session = driver.session();
  try {
    console.log('开始清除现有航运产业链数据...');
    
    await session.run('MATCH (n:Node) WHERE n.type = "Enterprise" DETACH DELETE n');
    
    console.log('现有数据已清除');
    
    console.log('开始导入新的航运产业链数据...');
    
    const chainData = [
      {
        id: 'enterprise-1',
        label: '宝山钢铁',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-2',
        label: '沪东重机',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-3',
        label: '中信重工',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-4',
        label: '江南造船机械',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-5',
        label: '大连船用阀门',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-6',
        label: '中国船舶集团',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-7',
        label: '中集海洋工程',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-8',
        label: '万华化学',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-9',
        label: '中远船务舾装',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-10',
        label: '中国铝业',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-11',
        label: '上海起帆电缆',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-12',
        label: '中船动力',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-13',
        label: '中船电子',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-14',
        label: '无锡振华',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-15',
        label: '上海电气',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-16',
        label: '中远海运集团',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-17',
        label: '中船重工船舶维修',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-18',
        label: '中外运物流',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-19',
        label: '上海船舶环保',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-20',
        label: '中远海运租赁',
        type: 'Enterprise',
        category: '企业'
      }
    ];

    console.log('导入企业节点...');
    for (const enterprise of chainData) {
      await session.run(
        `CREATE (n:Node {id: $id, label: $label, type: $type, category: $category})`,
        {
          id: enterprise.id,
          label: enterprise.label,
          type: enterprise.type,
          category: enterprise.category
        }
      );
    }

    const relationships = [
      { source: 'enterprise-1', target: 'enterprise-2', label: '船用曲轴锻件用钢' },
      { source: 'enterprise-1', target: 'enterprise-3', label: '船用大型铸件、锻件用钢' },
      { source: 'enterprise-1', target: 'enterprise-4', label: '船用起货机结构用钢' },
      { source: 'enterprise-1', target: 'enterprise-5', label: '阀门铸件用钢' },
      { source: 'enterprise-1', target: 'enterprise-6', label: '船体结构用宽厚板' },
      { source: 'enterprise-1', target: 'enterprise-7', label: '海工平台用高强度钢板' },
      { source: 'enterprise-8', target: 'enterprise-9', label: '舱室密封材料、防腐涂料' },
      { source: 'enterprise-8', target: 'enterprise-6', label: '船体防腐涂料' },
      { source: 'enterprise-10', target: 'enterprise-6', label: '船用铝合金板材' },
      { source: 'enterprise-10', target: 'enterprise-7', label: '海工平台铝合金型材' },
      { source: 'enterprise-11', target: 'enterprise-6', label: '船用电力电缆、控制电缆' },
      { source: 'enterprise-11', target: 'enterprise-7', label: '海工平台专用电缆' },
      { source: 'enterprise-12', target: 'enterprise-6', label: '船用低速柴油机、动力系统' },
      { source: 'enterprise-2', target: 'enterprise-6', label: '船用曲轴、柴油机配件' },
      { source: 'enterprise-13', target: 'enterprise-6', label: '船舶导航、通信及控制系统' },
      { source: 'enterprise-13', target: 'enterprise-7', label: '海工平台控制系统' },
      { source: 'enterprise-4', target: 'enterprise-6', label: '船用起货机、锚机、绞车' },
      { source: 'enterprise-9', target: 'enterprise-6', label: '舱室设备、管路系统、门窗' },
      { source: 'enterprise-14', target: 'enterprise-6', label: '甲板机械、舱室设备配件' },
      { source: 'enterprise-14', target: 'enterprise-7', label: '海工平台甲板配件' },
      { source: 'enterprise-3', target: 'enterprise-6', label: '船用大型铸件、锻件' },
      { source: 'enterprise-3', target: 'enterprise-7', label: '海工平台大型结构件' },
      { source: 'enterprise-15', target: 'enterprise-6', label: '船用推进电机、辅助电机' },
      { source: 'enterprise-15', target: 'enterprise-7', label: '海工平台电力推进系统' },
      { source: 'enterprise-5', target: 'enterprise-6', label: '船用截止阀、闸阀、止回阀' },
      { source: 'enterprise-6', target: 'enterprise-16', label: '集装箱船、散货船、油轮交付' },
      { source: 'enterprise-7', target: 'enterprise-16', label: '海上钻井平台、海工船舶' },
      { source: 'enterprise-6', target: 'enterprise-17', label: '新船交付后的保修服务委托' },
      { source: 'enterprise-7', target: 'enterprise-18', label: '海工装备运输服务需求' },
      { source: 'enterprise-16', target: 'enterprise-18', label: '船舶物资运输业务委托' },
      { source: 'enterprise-16', target: 'enterprise-19', label: '船舶尾气处理、油污回收服务' },
      { source: 'enterprise-16', target: 'enterprise-17', label: '船舶维修保养服务委托' },
      { source: 'enterprise-17', target: 'enterprise-16', label: '船舶故障维修、设备保养服务' },
      { source: 'enterprise-18', target: 'enterprise-6', label: '船厂物资仓储配送' },
      { source: 'enterprise-19', target: 'enterprise-16', label: '船舶环保合规服务' },
      { source: 'enterprise-20', target: 'enterprise-16', label: '集装箱船、散货船租赁' },
      { source: 'enterprise-20', target: 'enterprise-6', label: '新造船融资租赁服务' }
    ];

    console.log('导入企业关系...');
    for (const rel of relationships) {
      await session.run(
        `MATCH (a:Node {id: $source}), (b:Node {id: $target})
         CREATE (a)-[r:RELATIONSHIP {label: $label}]->(b)`,
        {
          source: rel.source,
          target: rel.target,
          label: rel.label
        }
      );
    }

    console.log('航运产业链数据导入完成！');
    console.log(`导入了 ${chainData.length} 个企业节点`);
    console.log(`导入了 ${relationships.length} 个关系`);

  } catch (error) {
    console.error('导入航运产业链数据失败:', error);
  } finally {
    await session.close();
  }
}

clearAndImportChainData()
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