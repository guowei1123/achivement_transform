const neo4j = require('neo4j-driver');
const config = require('./server/config');

const driver = neo4j.driver(config.neo4j.uri, neo4j.auth.basic(config.neo4j.user, config.neo4j.password));

const achievementsData = [
  { name: '多功能履带式高效水翼登陆艇', person: '郑元洲' },
  { name: '一种节能型可升降式漂浮设备', person: '陈蜀喆' },
  { name: '一次性便携纸质烤炉及其制作方法', person: '陈蜀喆' },
  { name: '一种抗风浪的海上石油钻井平台', person: '江福才' },
  { name: '一种船舶用设备固定装置', person: '江福才' },
  { name: '一种新型船舶轴支架', person: '江福才' },
  { name: '一种船用风力压差增速发电设备', person: '马勇' },
  { name: '一种节能航标', person: '牟军敏' },
  { name: '客船应急逃生门', person: '马全党' },
  { name: '内河船舶失事快速判定与确定失事区域及搜救系统及方法', person: '周春辉' },
  { name: '一种客船应急逃生系统', person: '马全党' },
  { name: '一种无人水面艇折线路径跟踪控制系统及方法', person: '马勇' },
  { name: '一种船舶防倾覆装置', person: '肖进丽' },
  { name: '一种节能型充电装置', person: '陈蜀喆' },
  { name: '一种海员防溺水装置', person: '郭志新' },
  { name: '一种水上收油机及其收油方法', person: '文元桥' },
  { name: '一种海空自主协同搜救M3U平台', person: '马勇' },
  { name: '一种无人机、艇无线联合巡航搜救方法', person: '张磊' },
  { name: '一种用于群水面无人艇的自主避碰系统及方法', person: '马勇' },
  { name: '用于内河船载高流速水域的围油栏', person: '陈蜀喆' },
  { name: '一种基于数据采集的自主智能按摩器及操作方法', person: '文元桥' },
  { name: '一种用于内河客船防沉的机械装置', person: '马全党' },
  { name: '水工建筑物对海事交管雷达遮蔽区域计算和影响评价方法', person: '周春辉' },
  { name: '一种航标机群系统和对海洋污染物进行机群监测的方法', person: '张磊' },
  { name: '一种码头系泊用缆绳抗拉强度测设装置', person: '刘敬贤' },
  { name: '一种码头富裕水深指示浮标', person: '刘敬贤' },
  { name: '一种基于码头富裕水深的离靠泊装置', person: '刘敬贤' },
  { name: '一种船舶轨迹数据分析实用展示板', person: '刘敬贤' },
  { name: '一种基于分支定界技术的船舶避台航线动态优化方法', person: '张进峰' },
  { name: '基于AIS/GPRS的施工船舶作业区虚拟警戒标系统及方法', person: '周春辉' },
  { name: '多功能无人机泊稳充电平台及方法', person: '周春辉' },
  { name: '一种水面救援机器人用救生网释放装置及其释放方法', person: '文元桥' },
  { name: '一种航海用浮标灯桩', person: '姜菲菲' },
  { name: '一种水上搜救无人机搭载的救生圈支架', person: '刘文' },
  { name: '救生手环', person: '徐言民' },
  { name: '海上拖带系统AIS虚拟警戒标标示系统及方法', person: '周春辉' },
  { name: '一种船舶应急防碰撞系统', person: '马全党' },
  { name: '一种无人救援水面艇的救援物料存储柜', person: '刘文' },
  { name: '一种应用于船舶防撞气囊的主动泄压装置', person: '马全党' },
  { name: '一种水面救援用等角三轴悬挂式机身骨架', person: '文元桥' },
  { name: '一种废旧电池回收系统及方法', person: '张磊' },
  { name: '一种新型汽车滚装船用安全装置', person: '周春辉' },
  { name: '基于热气球的海上自主救援装置', person: '付耀方' },
  { name: '一种基于CSI指纹特征迁移的船载环境室内定位方法', person: '刘克中' },
  { name: '一套设置于海上风力发电机上的船舶助航装置', person: '袁志涛' },
  { name: '一种桥区水域船舶通航预警系统', person: '袁志涛' },
  { name: '一种超大型船舶安全富裕水深的确定方法和系统', person: '马勇' },
  { name: '基于WiFi的船舶驾驶室人员值班行为识别方法及系统', person: '刘克中' },
  { name: '一种用于内河桥区的船舶自动检测方法', person: '刘文' },
  { name: '航标、航标防撞预警装置及方法', person: '周春辉' },
  { name: '一种基于边缘计算的客轮人员定位导航系统', person: '刘克中' },
  { name: '船舶防碰装置', person: '肖进丽' },
  { name: '一种多船会遇避碰方法', person: '刘克中' },
  { name: '基于船用雷达的船舶自动定位方法及装置', person: '吴建华' },
  { name: 'DoS攻击下基于切换T-S模糊系统的无人船艇控制方法', person: '马勇' },
  { name: '一种基于深度学习的海事无人机视频图像去雾方法', person: '刘文' },
  { name: '一种基于深度强化学习的群无人艇智能避碰方法', person: '马勇' },
  { name: '一种内河小型客渡船的安全监测方法', person: '邓健' },
  { name: '一种内河锚地水下地质探测装置', person: '谭志荣' },
  { name: '一种海量船舶AIS轨迹数据在线压缩方法及装置', person: '刘钊' },
  { name: '一种基于深度强化学习的无人船艇编队路径跟踪方法', person: '马勇' },
  { name: '一种可自动排缆的多级分隔式卷筒', person: '马全党' },
  { name: '无人机基站', person: '周春辉' },
  { name: '水上落水人员救援集结装置', person: '李必胜' },
  { name: '一种用于海事无人机的低照度视频图像增强方法', person: '刘文' },
  { name: '航标', person: '张帆' },
  { name: '水上大规模人命快速救援方法', person: '周春辉' },
  { name: '一种基于圆形轨迹单元的无人艇避障方法', person: '文元桥' },
  { name: '面向无人船舶的自动驾驶集成系统', person: '马勇' },
  { name: '一种基于事件触发方案和T-S模糊系统的欠驱动无人艇控制方法', person: '马勇' },
  { name: '一种基于光污染评价的航标亮度调节方法、装置及系统', person: '周春辉' },
  { name: '一种航海警示灯', person: '曾旭明' },
  { name: '一种无人船辅助靠离泊及充电方法、装置及系统', person: '吴博' },
  { name: '一种方便调节浮力的新型航海浮标', person: '郑元洲' },
  { name: '一种船舶碰撞风险评估与预警方法及系统', person: '刘文' },
  { name: '一种船舶会遇助航预警方法', person: '马杰' },
  { name: '一种面向单艘无人测量船艇覆盖路径规划方法', person: '马勇' },
  { name: '一种基于轨迹单元的障碍物情况下无人艇避碰路径规划方法', person: '周春辉' },
  { name: '一种多艘无人测量船艇覆盖路径规划方法', person: '马勇' },
  { name: '一种海陆两用自供能无人机航保基站', person: '周春辉' },
  { name: '一种自平衡式水上救生艇座椅', person: '郝国柱' },
  { name: '一种桥区水域船舶通航预警方法及预警系统', person: '袁志涛' },
  { name: '一种船舶生活污水处理装置', person: '郝国柱' },
  { name: '水下航行器粘液减阻装置', person: '周春辉' },
  { name: '一种基于菲涅尔区的船载环境多目标室内定位方法', person: '刘克中' },
  { name: 'LNG燃料动力船过闸燃料泄漏危害后果评估方法及系统', person: '谢澄' },
  { name: 'LNG燃料动力船泄漏事故概率计算方法、装置及存储介质', person: '谢澄' },
  { name: '一种海上应急救援过驳系统', person: '周春辉' },
  { name: '一种面向运输船舶的智能航行眼系统', person: '马勇' },
  { name: '一种基于塑料分离技术的新型垃圾箱', person: '谭志荣' },
  { name: '一种便于收展的风帆助航张合结构', person: '马全党' },
  { name: '面向海上风电工程的雷达遮蔽区域模型构建方法', person: '袁志涛' },
  { name: 'ROV与母船协同水下目标搜寻路径规划及动态更新方法', person: '马杰' },
  { name: '一种航空器航运实绩信息的采集装置', person: '郑凯' },
  { name: '一种用于水上红外图像增强装置', person: '刘文' },
  { name: '洗衣晾衣一体机', person: '柯勇' },
  { name: '一种基于室内外位置信息的船舶应急疏散方法', person: '陈默子' },
  { name: '一种船舶航运用船底清洁装置', person: '郑凯' },
  { name: '一种动态危险船载环境自适应应急导航方法', person: '刘克中' },
  { name: '一种自动保护式风帆', person: '马全党' },
  { name: '开阔水域船舶自主避碰方法、系统、设备及存储介质', person: '黄立文' },
  { name: '一种船舶会遇意图辨识方法', person: '马杰' },
  { name: '一种基于拓扑地图的无人艇路径搜索系统及方法', person: '周春辉' },
  { name: '一种基于航运路线信息的搁浅预警装置及其预警方法', person: '郑凯' },
  { name: '一种无人水下航行器应急抛载示位装置及方法', person: '周春辉' },
  { name: '一种融合几何解析与数据挖掘的船舶碰撞风险预警方法', person: '刘钊' },
  { name: '一种插拔式水上应急救生舱', person: '马全党' },
  { name: '一种风帆收卷装置', person: '马全党' },
  { name: '一种桥区水域船舶防撞预警方法及装置', person: '黄立文' },
  { name: '一种预警方法、预警装置及电子设备', person: '刘敬贤' },
  { name: '一种LNG燃料动力船过闸风险的评估方法、装置及存储介质', person: '谢澄' },
  { name: '一种受限水域智能航行方法及装置', person: '黄立文' },
  { name: '一种基于AIS数据的船舶碰撞风险分析方法', person: '刘文' },
  { name: '基于CSI的双循环神经网络的船载环境室内定位方法', person: '刘克中' },
  { name: '一种船舶内河航行预警与辅助避碰方法及装置', person: '贺益雄' },
  { name: '一种内河桥梁净空高度测量装置', person: '黄立文' },
  { name: '一种基于轨迹单元的无人艇运动规划方法', person: '文元桥' },
  { name: '一种基于深度学习框架的船舶名称识别系统及方法', person: '马勇' },
  { name: '基于船舶AIS大数据的通航水域水流信息的提取方法及系统', person: '何正伟' },
  { name: '一种异相轮轴开合截断涡环装置及三通涡环激励景观装置', person: '胡清波' },
  { name: '一种多模块协同的折叠浮桥', person: '张帆' },
  { name: '一种适用于VTS系统的船舶预警方法、设备及存储介质', person: '郝国柱' },
  { name: '基于非欧保形变换的船舶避碰模型的建立方法', person: '陈蜀喆' },
  { name: '一种基于前景理论的船舶避碰决策优化方法', person: '刘克中' },
  { name: '基于多船运动不确定性的冲突侦测方法、存储器及处理器', person: '刘克中' },
  { name: '海上无人机基站', person: '周春辉' },
  { name: '基于船舶轨迹特征点提取的时空DP方法', person: '马勇' },
  { name: '一种基于数字化船舶领域模型的船舶碰撞风险确定方法', person: '徐言民' },
  { name: '一种顾及多路径和同态误差的GNSS地震地表位移监测方法', person: '郑凯' },
  { name: '一种引航员登离轮便携式辅助装置', person: '袁志涛' },
  { name: '一种基于双毫米波雷达的船载环境入侵检测方法及系统', person: '刘克中' },
  { name: '一种值班提醒毯', person: '谭志荣' },
  { name: '一种船舶行驶防撞报警装置', person: '唐成港' },
  { name: '一种VTS雷达配置信号覆盖优化方法', person: '黄立文' },
  { name: '一种水上桥梁施工用安全警示装置', person: '唐成港' },
  { name: '一种基于非差非组合PPP模型的相位多路径提取改正方法', person: '郑凯' },
  { name: '面向三维船舶场景的可扩展性实时快速应急路径规划方法', person: '刘克中' },
  { name: '一种桥区水域船舶碰撞风险检测方法和装置', person: '陈鹏飞' },
  { name: '面向港区的UWB/INS/GNSS的无缝定位方法', person: '马杰' },
  { name: '一种基于WiFi信号的速度无关步态识别方法', person: '刘克中' },
  { name: '一种磁吸式连接结构及浮桥', person: '张帆' },
  { name: '一种智能防撞应急航标', person: '牟军敏' },
  { name: '一种多船避碰决策方法及装置', person: '黄立文' },
  { name: '一种智能航行感知及增强现实可视化系统', person: '马勇' },
  { name: '一种基于边缘计算的客轮人员定位导航方法', person: '曾旭明' },
  { name: '智能浮标、海上巡航的无人机集群化控制管理系统和方法', person: '周春辉' },
  { name: '互见情况下船舶拖曳系统的外部碰撞风险预警系统', person: '张磊' },
  { name: '一种基于改进蚁群算法的船舶路径规划方法及系统', person: '文元桥' },
  { name: '一种布置有电池舱结构的教学用开敞式救助艇', person: '郝国柱' },
  { name: '一种智能船舶节能航行编队方法、电子设备和存储介质', person: '陈琳瑛' },
  { name: '一种意图驱动的船舶轨迹预测方法', person: '马杰' },
  { name: '一种面向内河溢油事故应急处理的浮标及其控制方法', person: '邓健' },
  { name: '一种用于确定船舶油舱液面传感器安装位置的方法及装置', person: '熊勇' },
  { name: '船舶吃水预测方法、系统、电子设备及可读存储介质', person: '余红楚' },
  { name: '水上垃圾清洁船', person: '张进峰' },
  { name: '一种用于港口船舶监控的红外视频图像增强方法', person: '刘文' },
  { name: '一种船舶运动模型参数辨识系统', person: '陈立家' },
  { name: '一种背扣式救生衣', person: '马全党' },
  { name: '一种水空两栖立体式搜救系统及方法', person: '马勇' },
  { name: '一种适用于燃油救生艇艇体的电动力驱动系统', person: '郝国柱' },
  { name: '一种船载危险品事故应急搜救知识共享方法及装置', person: '周春辉' },
  { name: '一种海量AIS数据驱动的船舶偏离航道智能预警系统', person: '刘文' },
  { name: '一种基于人机协同的港口拖轮作业智能调度方法', person: '陈琳瑛' },
  { name: '一种基于智能吸口的溢油回收变体船', person: '周春辉' },
  { name: '一种船舶两翼测距装置', person: '郑元洲' },
  { name: '一种内河船舶识别与测距方法、系统、介质、设备及终端', person: '郑元洲' },
  { name: '一种船舶锚泊面积计算方法及装置', person: '周春辉' },
  { name: '一种基于光强补偿的船舶舱室可见光定位方法', person: '曾旭明' },
  { name: '一种救生衣辅助穿着装置', person: '马全党' },
  { name: '一种基于大数据的数据筛选方法、装置及电子设备', person: '吴博' },
  { name: '一种基于超短基线和航位推算的水下导航定位方法', person: '马杰' },
  { name: '多船舶目标的跟踪识别方法、装置、电子设备及存储介质', person: '刘文' },
  { name: '船舶人员隐藏威胁性物品携带检测方法、装置及电子设备', person: '曾旭明' },
  { name: '一种浮绳联接的双无人船艇协同拖曳控制方法及装置', person: '马勇' },
  { name: '一种多模组出票装置', person: '束亚清' },
  { name: '一种基于虚拟力的船舶导航方法', person: '黄立文' },
  { name: '一种多功能绿色水上清洁机器人充电仓', person: '张进峰' },
  { name: '一种浮标沉石移位识别方法及装置', person: '周春辉' },
  { name: '一种基于物理信道的船舶驾驶员活跃状态监测方法及装置', person: '陈默子' },
  { name: '客船应急逃生预警指示系统', person: '马全党' },
  { name: '一种周期性DoS攻击下的网络化船舶弹性触发控制方法', person: '马勇' },
  { name: '一种基于无线信号的船舶值班人员警觉性表征评估方法', person: '陈默子' },
  { name: '一种利用VRS的高精度船舶差分定位方法、系统及设备', person: '甘浪雄' },
  { name: '一种面向水上搜救的无人机自动取放装置', person: '马勇' },
  { name: '一种基于模糊控制的抓斗防摇方法', person: '熊勇' },
  { name: '一种船舶进港航迹控制装置', person: '黄立文' },
  { name: '一种LNG船舶航行安全领域确定方法', person: '刘钊' },
  { name: '船舶吃水深度的自动检测方法和装置', person: '刘文' },
  { name: '一种混合交通场景下的多船分布式协同控制方法', person: '陈琳瑛' },
  { name: '一种救生衣辅助穿着装置', person: '马全党' },
  { name: '一种基于双毫米波雷达的船舶环境下步态识别方法', person: '杨星' },
  { name: '一种船舶防撞蓄能回弹滑动缓冲消能装置', person: '郝国柱' },
  { name: '面向特定区域的电子海图显示与应用平台', person: '马勇' },
  { name: '一种锚地时空利用效率评价方法和装置', person: '余红楚' }
];

async function importAchievements() {
  const session = driver.session();
  try {
    console.log('开始导入学校科技成果...');
    
    console.log('删除原有的科技成果节点...');
    await session.run(
      `MATCH (n:Node) WHERE n.type IN ['Patent', 'Paper', 'Project'] DETACH DELETE n`
    );
    
    console.log('原有的科技成果节点已删除');
    
    let totalAchievements = 0;
    let totalPersons = 0;
    let totalEdges = 0;
    
    const personMap = new Map();
    
    for (const achievement of achievementsData) {
      const personName = achievement.person;
      const achievementName = achievement.name;
      
      let personId;
      if (personMap.has(personName)) {
        personId = personMap.get(personName);
      } else {
        personId = `person-${personName}`;
        
        await session.run(
          `MERGE (p:Node {
            id: $id,
            label: $label,
            type: 'Person',
            category: '负责人'
          })`,
          {
            id: personId,
            label: personName,
            type: 'Person',
            category: '负责人'
          }
        );
        
        personMap.set(personName, personId);
        totalPersons++;
      }
      
      const achievementId = `achievement-${achievementName}`;
      
      await session.run(
        `CREATE (a:Node {
          id: $id,
          label: $label,
          type: 'Patent',
          category: '科技成果'
        })`,
        {
          id: achievementId,
          label: achievementName,
          type: 'Patent',
          category: '科技成果'
        }
      );
      
      await session.run(
        `MATCH (p:Node {id: $personId}), (a:Node {id: $achievementId})
         CREATE (p)-[r:RELATIONSHIP {label: $label}]->(a)`,
        {
          personId,
          achievementId,
          label: '负责'
        }
      );
      
      totalAchievements++;
      totalEdges++;
    }
    
    console.log('学校科技成果导入完成！');
    console.log(`导入了 ${totalPersons} 个负责人节点`);
    console.log(`导入了 ${totalAchievements} 个科技成果节点`);
    console.log(`导入了 ${totalEdges} 个关系`);
    
  } catch (error) {
    console.error('导入学校科技成果失败:', error);
  } finally {
    await session.close();
  }
}

importAchievements()
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