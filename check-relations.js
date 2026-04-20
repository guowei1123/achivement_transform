const neo4j = require('neo4j-driver');

const driver = neo4j.driver('neo4j://localhost:7687', neo4j.auth.basic('neo4j', 'guowei64605'));
const session = driver.session();

async function checkRelations() {
  try {
    console.log('查询中远海发的所有关系...\n');
    
    const result = await session.run(
      `MATCH (n:Node {label: "中远海发"})-[r]-(related)
       RETURN n.label as source, r.label as relation, related.label as target, type(r) as direction`
    );
    
    if (result.records.length === 0) {
      console.log('没有找到关系');
    } else {
      console.log('找到', result.records.length, '条关系:\n');
      
      result.records.forEach((record, index) => {
        const source = record.get('source');
        const relation = record.get('relation');
        const target = record.get('target');
        const direction = record.get('direction');
        
        console.log(`关系 ${index + 1}:`);
        console.log(`  方向: ${direction}`);
        console.log(`  ${source} --[${relation}]--> ${target}`);
        console.log('');
      });
    }
    
    console.log('\n查询中国船舶 -> 中远海运 -> 中远海发的完整路径...\n');
    
    const pathResult = await session.run(
      `MATCH path = (a:Node {label: "中国船舶"})-[r1]->(b:Node)-[r2]->(c:Node {label: "中远海发"})
       RETURN a.label as a, r1.label as r1, b.label as b, r2.label as r2, c.label as c`
    );
    
    if (pathResult.records.length === 0) {
      console.log('没有找到3节点路径');
    } else {
      console.log('找到', pathResult.records.length, '条3节点路径:\n');
      
      pathResult.records.forEach((record, index) => {
        const a = record.get('a');
        const r1 = record.get('r1');
        const b = record.get('b');
        const r2 = record.get('r2');
        const c = record.get('c');
        
        console.log(`路径 ${index + 1}:`);
        console.log(`  ${a} --[${r1}]--> ${b} --[${r2}]--> ${c}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

checkRelations();