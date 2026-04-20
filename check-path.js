const neo4j = require('neo4j-driver');

const driver = neo4j.driver('neo4j://localhost:7687', neo4j.auth.basic('neo4j', 'guowei64605'));
const session = driver.session();

async function checkPath() {
  try {
    console.log('查询中国船舶到中远海发的路径...\n');
    
    const result = await session.run(
      `MATCH path = (e:Node {label: "中国船舶"})-[*1..4]-(n) 
       WHERE n.label = "中远海发" 
       RETURN path, length(path) as distance`
    );
    
    if (result.records.length === 0) {
      console.log('没有找到路径');
    } else {
      console.log('找到', result.records.length, '条路径:\n');
      
      result.records.forEach((record, index) => {
        const path = record.get('path');
        const distance = record.get('distance');
        
        console.log(`路径 ${index + 1} (距离: ${distance}):`);
        
        path.segments.forEach((seg, i) => {
          console.log(`  ${i + 1}. ${seg.start.properties.label} --[${seg.relationship.properties.label}]--> ${seg.end.properties.label}`);
        });
        
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

checkPath();