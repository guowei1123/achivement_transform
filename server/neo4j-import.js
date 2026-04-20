const neo4j = require('neo4j-driver');
const { graphData } = require('../src/components/KnowledgeGraph/graphData');
const config = require('./config');

const driver = neo4j.driver(config.neo4j.uri, neo4j.auth.basic(config.neo4j.user, config.neo4j.password));

async function createNode(session, node) {
  const nodeProperties = {
    id: node.id,
    label: node.label,
    type: node.type,
    category: node.category
  };

  if (node.business) nodeProperties.business = node.business;
  if (node.tonnage) nodeProperties.tonnage = node.tonnage;
  if (node.owner_id) nodeProperties.owner_id = node.owner_id;
  if (node.operator_id) nodeProperties.operator_id = node.operator_id;
  if (node.location) nodeProperties.location = node.location;
  if (node.shipper_id) nodeProperties.shipper_id = node.shipper_id;
  if (node.consignee_id) nodeProperties.consignee_id = node.consignee_id;
  if (node.carrier_id) nodeProperties.carrier_id = node.carrier_id;
  if (node.port_ids) nodeProperties.port_ids = node.port_ids;
  if (node.jurisdiction) nodeProperties.jurisdiction = node.jurisdiction;
  if (node.description) nodeProperties.description = node.description;

  const result = await session.run(
    'CREATE (n:Node $props) RETURN n',
    { props: nodeProperties }
  );
  return result;
}

async function createRelationship(session, edge) {
  const result = await session.run(
    `MATCH (a:Node {id: $sourceId}), (b:Node {id: $targetId})
     CREATE (a)-[r:RELATIONSHIP {label: $label}]->(b)
     RETURN r`,
    {
      sourceId: edge.source,
      targetId: edge.target,
      label: edge.label
    }
  );
  return result;
}

async function clearDatabase(session) {
  await session.run('MATCH (n) DETACH DELETE n');
  console.log('数据库已清空');
}

async function importGraphData(graphType) {
  const session = driver.session();
  
  try {
    console.log(`开始导入${graphType}图谱数据...`);
    
    const data = graphData[graphType];
    if (!data) {
      throw new Error(`未找到${graphType}图谱数据`);
    }
    
    console.log(`导入${data.nodes.length}个节点...`);
    for (const node of data.nodes) {
      await createNode(session, node);
    }
    console.log('节点导入完成');
    
    console.log(`导入${data.edges.length}条关系...`);
    for (const edge of data.edges) {
      await createRelationship(session, edge);
    }
    console.log('关系导入完成');
    
    console.log(`${graphType}图谱数据导入成功！`);
  } catch (error) {
    console.error('导入数据失败:', error);
    throw error;
  } finally {
    await session.close();
  }
}

async function importAllGraphs() {
  const session = driver.session();
  
  try {
    await clearDatabase(session);
    console.log('数据库已清空，准备导入所有图谱数据...');
    
    await importGraphData('shipping');
    await importGraphData('school');
    console.log('所有图谱数据导入完成！');
  } catch (error) {
    console.error('导入失败:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

if (require.main === module) {
  const graphType = process.argv[2];
  
  if (graphType) {
    importGraphData(graphType).then(() => {
      driver.close();
      process.exit(0);
    }).catch((error) => {
      console.error(error);
      driver.close();
      process.exit(1);
    });
  } else {
    importAllGraphs();
  }
}

module.exports = {
  importGraphData,
  importAllGraphs,
  createNode,
  createRelationship
};
