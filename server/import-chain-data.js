const neo4j = require('neo4j-driver');
const config = require('./config');

const driver = neo4j.driver(config.neo4j.uri, neo4j.auth.basic(config.neo4j.user, config.neo4j.password));

async function clearAndImportChainData() {
  const session = driver.session();
  try {
    console.log('开始清除现有产业链数据...');
    
    await session.run('MATCH (n:Node) WHERE n.type IN ["Enterprise", "Vessel", "Port", "Cargo", "Route"] DETACH DELETE n');
    
    console.log('现有数据已清除');
    
    console.log('开始导入新的产业链数据...');
    
    const chainData = [
      {
        id: 'enterprise-1',
        label: '宝钢股份',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-2',
        label: '鞍钢股份',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-3',
        label: '湘南华菱湘潭钢铁',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-4',
        label: '宝钛股份',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-5',
        label: '西南铝业',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-6',
        label: '中国动力',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-7',
        label: '双瑞股份',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-8',
        label: '武汉船机',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-9',
        label: '中集集团',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-10',
        label: '中远海发',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-11',
        label: '中国船舶',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-12',
        label: '某南造船',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-13',
        label: '大连船舶重工',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-14',
        label: '上海外高桥造船',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-15',
        label: '中远海运',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-16',
        label: '某南造船',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-17',
        label: '大连船舶重工',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-18',
        label: '上海外高桥造船',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-19',
        label: '中远海运特运',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-20',
        label: '广船国际',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-21',
        label: '中船黄埔文冲',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-22',
        label: '中远海控',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-23',
        label: '上港集团',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-24',
        label: '中远海控',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-25',
        label: '宁波港',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-26',
        label: '宁波远洋',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-27',
        label: '上港集团',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-28',
        label: '宁波港',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-29',
        label: '华贸物流',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-30',
        label: '青岛港',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-31',
        label: '中国外运',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-32',
        label: '海尔集团',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-33',
        label: '中国外运',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-34',
        label: '唯亚迪',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-35',
        label: '华贸物流',
        type: 'Enterprise',
        category: '企业'
      },
      {
        id: 'enterprise-36',
        label: '中远海运物流',
        type: 'Enterprise',
        category: '企业'
      }
    ];

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
      { source: 'enterprise-1', target: 'enterprise-11', label: '上游' },
      { source: 'enterprise-2', target: 'enterprise-11', label: '上游' },
      { source: 'enterprise-3', target: 'enterprise-11', label: '上游' },
      { source: 'enterprise-4', target: 'enterprise-11', label: '上游' },
      { source: 'enterprise-5', target: 'enterprise-11', label: '上游' },
      { source: 'enterprise-6', target: 'enterprise-11', label: '上游' },
      { source: 'enterprise-7', target: 'enterprise-11', label: '上游' },
      { source: 'enterprise-8', target: 'enterprise-11', label: '上游' },
      { source: 'enterprise-9', target: 'enterprise-15', label: '上游' },
      { source: 'enterprise-10', target: 'enterprise-15', label: '上游' },
      { source: 'enterprise-11', target: 'enterprise-15', label: '下游' },
      { source: 'enterprise-11', target: 'enterprise-15', label: '下游' },
      { source: 'enterprise-12', target: 'enterprise-15', label: '下游' },
      { source: 'enterprise-13', target: 'enterprise-17', label: '下游' },
      { source: 'enterprise-14', target: 'enterprise-18', label: '下游' },
      { source: 'enterprise-15', target: 'enterprise-19', label: '下游' },
      { source: 'enterprise-16', target: 'enterprise-19', label: '下游' },
      { source: 'enterprise-17', target: 'enterprise-20', label: '下游' },
      { source: 'enterprise-18', target: 'enterprise-20', label: '下游' },
      { source: 'enterprise-19', target: 'enterprise-21', label: '下游' },
      { source: 'enterprise-20', target: 'enterprise-22', label: '下游' },
      { source: 'enterprise-21', target: 'enterprise-23', label: '下游' },
      { source: 'enterprise-22', target: 'enterprise-24', label: '下游' },
      { source: 'enterprise-23', target: 'enterprise-25', label: '下游' },
      { source: 'enterprise-24', target: 'enterprise-26', label: '下游' },
      { source: 'enterprise-25', target: 'enterprise-27', label: '下游' },
      { source: 'enterprise-26', target: 'enterprise-28', label: '下游' },
      { source: 'enterprise-27', target: 'enterprise-29', label: '下游' },
      { source: 'enterprise-28', target: 'enterprise-30', label: '下游' },
      { source: 'enterprise-29', target: 'enterprise-31', label: '下游' },
      { source: 'enterprise-30', target: 'enterprise-32', label: '下游' },
      { source: 'enterprise-31', target: 'enterprise-33', label: '下游' },
      { source: 'enterprise-32', target: 'enterprise-34', label: '下游' },
      { source: 'enterprise-33', target: 'enterprise-35', label: '下游' },
      { source: 'enterprise-34', target: 'enterprise-36', label: '下游' },
      { source: 'enterprise-35', target: 'enterprise-36', label: '下游' }
    ];

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

    console.log('产业链数据导入完成！');
    console.log(`导入了 ${chainData.length} 个企业节点`);
    console.log(`导入了 ${relationships.length} 个关系`);

  } catch (error) {
    console.error('导入产业链数据失败:', error);
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
