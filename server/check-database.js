const neo4j = require('neo4j-driver');
const config = require('./config');

async function checkDatabase() {
  const driver = neo4j.driver(config.neo4j.uri, neo4j.auth.basic(config.neo4j.user, config.neo4j.password));
  const session = driver.session();

  try {
    console.log('=== 检查数据库数据 ===\n');

    // 检查所有节点类型
    const typeResult = await session.run(
      'MATCH (n:Node) RETURN DISTINCT n.type as type, count(n) as count ORDER BY type'
    );
    console.log('节点类型统计:');
    typeResult.records.forEach(record => {
      console.log(`  ${record.get('type')}: ${record.get('count')} 个`);
    });

    // 检查技术需求节点
    const techNeedResult = await session.run(
      "MATCH (n:Node {type: 'technical requirements'}) RETURN n LIMIT 5"
    );
    console.log('\n技术需求节点示例:');
    techNeedResult.records.forEach((record, index) => {
      const node = record.get('n').properties;
      console.log(`  ${index + 1}. ${node.label} (ID: ${node.id})`);
    });

    // 检查科技成果节点
    const achievementResult = await session.run(
      "MATCH (n:Node) WHERE n.type IN ['Patent', 'Paper', 'Project'] RETURN n LIMIT 5"
    );
    console.log('\n科技成果节点示例:');
    if (achievementResult.records.length === 0) {
      console.log('  没有找到科技成果节点！');
    } else {
      achievementResult.records.forEach((record, index) => {
        const node = record.get('n').properties;
        console.log(`  ${index + 1}. ${node.label} (类型: ${node.type}, ID: ${node.id})`);
      });
    }

    // 检查企业节点
    const enterpriseResult = await session.run(
      "MATCH (n:Node {type: 'Enterprise'}) RETURN n LIMIT 5"
    );
    console.log('\n企业节点示例:');
    enterpriseResult.records.forEach((record, index) => {
      const node = record.get('n').properties;
      console.log(`  ${index + 1}. ${node.label} (ID: ${node.id})`);
    });

    // 检查技术需求与科技成果的关系
    const matchResult = await session.run(
      `MATCH (tn:Node {type: 'technical requirements'})-[r:RELATIONSHIP]->(a:Node)
       WHERE a.type IN ['Patent', 'Paper', 'Project']
       RETURN tn.label as techNeed, a.label as achievement, a.type as type
       LIMIT 5`
    );
    console.log('\n技术需求与科技成果匹配关系:');
    if (matchResult.records.length === 0) {
      console.log('  没有找到技术需求与科技成果的匹配关系！');
    } else {
      matchResult.records.forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.get('techNeed')} -> ${record.get('achievement')} (${record.get('type')})`);
      });
    }

    // 检查企业与技术需求的关系
    const enterpriseTechNeedResult = await session.run(
      `MATCH (e:Node {type: 'Enterprise'})-[r:RELATIONSHIP]->(tn:Node {type: 'technical requirements'})
       RETURN e.label as enterprise, tn.label as techNeed
       LIMIT 5`
    );
    console.log('\n企业与技术需求关系:');
    if (enterpriseTechNeedResult.records.length === 0) {
      console.log('  没有找到企业与技术需求的关系！');
    } else {
      enterpriseTechNeedResult.records.forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.get('enterprise')} -> ${record.get('techNeed')}`);
      });
    }

  } catch (error) {
    console.error('检查数据库失败:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

checkDatabase();
