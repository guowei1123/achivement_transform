const neo4j = require('neo4j-driver');
const config = require('./server/config');

const driver = neo4j.driver(config.neo4j.uri, neo4j.auth.basic(config.neo4j.user, config.neo4j.password));

const techNeedKeywords = {
  '绿色智能船舶总体设计技术': ['智能', '船舶', '设计', '智能航行', '自动驾驶'],
  '船舶总装精密装配技术': ['装配', '总装', '精密', '船舶'],
  '船舶能效优化技术': ['节能', '能效', '优化', '航行'],
  '海洋平台模块化设计技术': ['海洋', '平台', '模块化', '设计'],
  '海洋装备抗风浪技术': ['抗风浪', '海洋', '平台', '钻井'],
  '船用低速柴油机高效燃烧技术': ['柴油机', '燃烧', '动力', '节能'],
  '动力系统集成匹配技术': ['动力', '集成', '系统', '匹配'],
  '柴油机节能减排技术': ['节能', '减排', '柴油机', '环保'],
  '船舶智能导航技术': ['导航', '智能', '定位', '船舶'],
  '船用通信抗干扰技术': ['通信', '抗干扰', '信号'],
  '船舶电子控制系统集成技术': ['电子', '控制', '系统', '集成'],
  '船用曲轴精密锻造技术': ['曲轴', '锻造', '精密', '船舶'],
  '大型零部件热处理技术': ['热处理', '零部件', '大型'],
  '零部件表面防腐技术': ['防腐', '表面', '零部件'],
  '甲板机械轻量化设计技术': ['甲板', '机械', '轻量化', '设计'],
  '液压系统可靠性优化技术': ['液压', '系统', '可靠性', '优化'],
  '舾装件模块化集成技术': ['舾装', '模块化', '集成'],
  '船舶管路防腐蚀技术': ['管路', '防腐', '船舶'],
  '船用配件轻量化设计技术': ['配件', '轻量化', '设计', '船舶'],
  '液压配件可靠性优化技术': ['液压', '配件', '可靠性', '优化'],
  '大型铸件精准浇注技术': ['铸件', '浇注', '精准', '大型'],
  '铸件缺陷检测技术': ['铸件', '检测', '缺陷'],
  '高效船用电机设计技术': ['电机', '设计', '高效', '船舶'],
  '电机绝缘性能优化技术': ['电机', '绝缘', '性能', '优化'],
  '船用阀门耐高压设计技术': ['阀门', '耐高压', '设计', '船舶'],
  '阀门耐腐蚀表面处理技术': ['阀门', '耐腐蚀', '表面', '处理'],
  '船用高强度钢板轧制技术': ['钢板', '轧制', '高强度', '船舶'],
  '钢材抗疲劳性能优化技术': ['钢材', '抗疲劳', '性能', '优化'],
  '海洋环境钢材防腐技术': ['钢材', '防腐', '海洋', '环境'],
  '环保型船用防腐涂料研发技术': ['防腐', '涂料', '环保', '船舶'],
  '涂料耐海洋环境老化技术': ['涂料', '耐老化', '海洋', '环境'],
  '船用铝合金轻量化轧制技术': ['铝合金', '轻量化', '轧制', '船舶'],
  '铝合金耐海洋腐蚀技术': ['铝合金', '耐腐蚀', '海洋'],
  '船用耐候电缆设计技术': ['电缆', '耐候', '设计', '船舶'],
  '电缆抗干扰技术': ['电缆', '抗干扰', '信号'],
  '船舶航线智能规划技术': ['航线', '规划', '智能', '船舶'],
  '船舶运营能效管理技术': ['能效', '管理', '运营', '船舶'],
  '港口船舶智能调度技术': ['调度', '智能', '港口', '船舶'],
  '船舶水下构件无损检测技术': ['检测', '水下', '无损', '船舶'],
  '船舶动力系统快速维修技术': ['维修', '动力', '快速', '船舶'],
  '船舶租赁风险评估技术': ['租赁', '风险评估', '船舶'],
  '船舶资产估值技术': ['资产', '估值', '船舶'],
  '船舶物资智能仓储技术': ['仓储', '智能', '物资', '船舶'],
  '物流运输路径优化技术': ['物流', '路径', '优化', '运输'],
  '船舶尾气净化技术': ['尾气', '净化', '环保', '船舶'],
  '船舶油污回收技术': ['油污', '回收', '环保', '船舶']
};

async function matchTechNeedsWithAchievements() {
  const session = driver.session();
  try {
    console.log('开始匹配技术需求与科技成果...');
    
    const techNeedsResult = await session.run(
      `MATCH (tn:Node {type: 'technical requirements'}) RETURN tn`
    );
    
    const achievementsResult = await session.run(
      `MATCH (a:Node {type: 'Patent'}) RETURN a`
    );
    
    const techNeeds = techNeedsResult.records.map(record => record.get('tn').properties);
    const achievements = achievementsResult.records.map(record => record.get('a').properties);
    
    console.log(`找到 ${techNeeds.length} 个技术需求`);
    console.log(`找到 ${achievements.length} 个科技成果`);
    
    let totalMatches = 0;
    
    for (const techNeed of techNeeds) {
      const keywords = techNeedKeywords[techNeed.label] || [];
      
      if (keywords.length === 0) {
        console.log(`  警告: 技术需求 "${techNeed.label}" 没有关键词映射`);
        continue;
      }
      
      console.log(`  匹配技术需求: ${techNeed.label}`);
      
      for (const achievement of achievements) {
        const achievementName = achievement.label;
        
        let matchCount = 0;
        for (const keyword of keywords) {
          if (achievementName.includes(keyword)) {
            matchCount++;
          }
        }
        
        if (matchCount > 0) {
          await session.run(
            `MATCH (tn:Node {id: $techNeedId}), (a:Node {id: $achievementId})
             MERGE (tn)-[r:RELATIONSHIP {label: $label}]->(a)`,
            {
              techNeedId: techNeed.id,
              achievementId: achievement.id,
              label: '技术匹配'
            }
          );
          
          console.log(`    匹配: ${achievementName} (匹配关键词数: ${matchCount})`);
          totalMatches++;
        }
      }
    }
    
    console.log('技术需求与科技成果匹配完成！');
    console.log(`建立了 ${totalMatches} 个匹配关系`);
    
  } catch (error) {
    console.error('匹配技术需求与科技成果失败:', error);
  } finally {
    await session.close();
  }
}

matchTechNeedsWithAchievements()
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