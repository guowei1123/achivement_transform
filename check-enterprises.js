const neo4j = require('neo4j-driver');
const config = require('./server/config');

const driver = neo4j.driver(config.neo4j.uri, neo4j.auth.basic(config.neo4j.user, config.neo4j.password));

async function checkEnterprises() {
  const session = driver.session();
  try {
    console.log('查询所有企业节点...');
    
    const result = await session.run(
      `MATCH (n:Node {type: 'Enterprise'}) RETURN n.label as label ORDER BY n.label`
    );
    
    console.log('企业列表:');
    result.records.forEach((record, index) => {
      console.log(`${index + 1}. ${record.get('label')}`);
    });
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await session.close();
  }
}

checkEnterprises()
  .then(() => {
    console.log('查询完成');
    driver.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error('发生错误:', error);
    driver.close();
    process.exit(1);
  });