const express = require('express');
const neo4j = require('neo4j-driver');
const cors = require('cors');
const config = require('./config');
const axios = require('axios');
const path = require('path');
const PPTService = require('./pptService');

const app = express();
const driver = neo4j.driver(config.neo4j.uri, neo4j.auth.basic(config.neo4j.user, config.neo4j.password));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-06e15520d27646db905aa4783118eff0';
const MATCHING_ENGINE_URL = process.env.MATCHING_ENGINE_URL || 'http://localhost:5001';

async function analyzeChainLevelWithAI(nodes, edges, enterpriseName) {
  try {
    const chainText = edges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      return `${sourceNode.label} -> ${targetNode.label} (${edge.label})`;
    }).join('\n');

    const prompt = `请分析以下产业链关系，判断每个企业的层级。

产业链关系：
${chainText}
请按照以下案例判断层级：
上游 下游

采矿公司 铁矿石冶炼

煤炭公司 铁矿石冶炼

铁矿石冶炼 钢铁公司

钢铁公司 建筑公司

水泥公司 建筑公司

采矿公司和煤炭公司处于一层级，位于最上层，级别为0，铁矿石冶炼属于一层级，位于第二层，级别为1，钢铁公司和水泥公司属于一层级，位于第三层，级别为2，建筑公司属于一层级，位于第四层，级别为3

请以JSON格式返回结果，格式如下：
{
  "levels": {
    "企业名称": 层级数字,
    ...
  }
}

注意：
- 只返回JSON，不要返回其他文字
- 确保JSON格式正确`;

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个产业链分析专家，擅长分析企业间的上下游关系并判断层级。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('AI响应格式错误:', aiResponse);
      throw new Error('AI响应格式错误');
    }

    const levelData = JSON.parse(jsonMatch[0]);
    console.log('AI分析结果:', levelData);
    
    return levelData.levels;
  } catch (error) {
    console.error('AI分析失败:', error);
    throw error;
  }
}

app.get('/api/nodes', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (n:Node) RETURN n');
    const nodes = result.records.map(record => record.get('n').properties);
    res.json({ success: true, data: nodes });
  } catch (error) {
    console.error('查询节点失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

app.get('/api/nodes/:type', async (req, res) => {
  const session = driver.session();
  const { type } = req.params;
  try {
    const result = await session.run(
      'MATCH (n:Node {type: $type}) RETURN n',
      { type }
    );
    const nodes = result.records.map(record => record.get('n').properties);
    res.json({ success: true, data: nodes });
  } catch (error) {
    console.error('查询节点失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

app.get('/api/edges', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (a:Node)-[r:RELATIONSHIP]->(b:Node) RETURN a.id as source, b.id as target, r.label as label'
    );
    const edges = result.records.map(record => ({
      source: record.get('source'),
      target: record.get('target'),
      label: record.get('label')
    }));
    res.json({ success: true, data: edges });
  } catch (error) {
    console.error('查询关系失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

app.get('/api/graph/:type', async (req, res) => {
  const session = driver.session();
  const { type } = req.params;
  try {
    let nodeTypes = [];
    if (type === 'shipping') {
      nodeTypes = ['Enterprise', 'Vessel', 'Port', 'Cargo', 'Route', 'Authority'];
    } else if (type === 'school') {
      nodeTypes = ['TechField', 'Patent', 'Paper', 'Project', 'Researcher', 'Department', 'AcademicTitle', 'Award'];
    } else {
      return res.status(400).json({ success: false, error: '无效的图谱类型' });
    }
    
    const nodeResult = await session.run(
      'MATCH (n:Node) WHERE n.type IN $nodeTypes RETURN n',
      { nodeTypes }
    );
    const nodes = nodeResult.records.map(record => record.get('n').properties);
    
    const edgeResult = await session.run(
      `MATCH (a:Node)-[r:RELATIONSHIP]->(b:Node)
       WHERE a.type IN $nodeTypes AND b.type IN $nodeTypes
       RETURN a.id as source, b.id as target, r.label as label`,
      { nodeTypes }
    );
    const edges = edgeResult.records.map(record => ({
      source: record.get('source'),
      target: record.get('target'),
      label: record.get('label')
    }));
    
    res.json({ success: true, data: { nodes, edges } });
  } catch (error) {
    console.error('查询图谱失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

app.get('/api/node/:id', async (req, res) => {
  const session = driver.session();
  const { id } = req.params;
  try {
    const result = await session.run(
      'MATCH (n:Node {id: $id}) RETURN n',
      { id }
    );
    if (result.records.length === 0) {
      return res.status(404).json({ success: false, error: '节点不存在' });
    }
    const node = result.records[0].get('n').properties;
    
    const relationResult = await session.run(
      `MATCH (n:Node {id: $id})-[r]-(related)
       RETURN type(r) as type, related.id as relatedId, related.label as relatedLabel`,
      { id }
    );
    const relations = relationResult.records.map(record => ({
      type: record.get('type'),
      relatedId: record.get('relatedId'),
      relatedLabel: record.get('relatedLabel')
    }));
    
    res.json({ success: true, data: { ...node, relations } });
  } catch (error) {
    console.error('查询节点详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

app.get('/api/search', async (req, res) => {
  const session = driver.session();
  const { q } = req.query;
  try {
    const result = await session.run(
      `MATCH (n:Node)
       WHERE n.label CONTAINS $q OR n.category CONTAINS $q OR n.type CONTAINS $q
       RETURN n LIMIT 20`,
      { q }
    );
    const nodes = result.records.map(record => record.get('n').properties);
    res.json({ success: true, data: nodes });
  } catch (error) {
    console.error('搜索失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

app.post('/api/node', async (req, res) => {
  const session = driver.session();
  try {
    const node = req.body;
    const result = await session.run(
      'CREATE (n:Node $props) RETURN n',
      { props: node }
    );
    const createdNode = result.records[0].get('n').properties;
    res.json({ success: true, data: createdNode });
  } catch (error) {
    console.error('创建节点失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

app.post('/api/nodes', async (req, res) => {
  const session = driver.session();
  try {
    const { nodes } = req.body;
    const createdNodes = [];
    
    for (const node of nodes) {
      const result = await session.run(
        'CREATE (n:Node $props) RETURN n',
        { props: node }
      );
      createdNodes.push(result.records[0].get('n').properties);
    }
    
    res.json({ success: true, data: createdNodes });
  } catch (error) {
    console.error('批量创建节点失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

app.post('/api/edge', async (req, res) => {
  const session = driver.session();
  try {
    const { source, target, label } = req.body;
    const result = await session.run(
      `MATCH (a:Node {id: $source}), (b:Node {id: $target})
       CREATE (a)-[r:RELATIONSHIP {label: $label}]->(b)
       RETURN r`,
      { source, target, label }
    );
    const createdEdge = result.records[0].get('r').properties;
    res.json({ success: true, data: createdEdge });
  } catch (error) {
    console.error('创建关系失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

app.post('/api/edges', async (req, res) => {
  const session = driver.session();
  try {
    const { edges } = req.body;
    const createdEdges = [];
    
    for (const edge of edges) {
      const result = await session.run(
        `MATCH (a:Node {id: $source}), (b:Node {id: $target})
         CREATE (a)-[r:RELATIONSHIP {label: $label}]->(b)
         RETURN r`,
        { source: edge.source, target: edge.target, label: edge.label }
      );
      createdEdges.push(result.records[0].get('r').properties);
    }
    
    res.json({ success: true, data: createdEdges });
  } catch (error) {
    console.error('批量创建关系失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

app.get('/api/enterprise/:name/supply-chain', async (req, res) => {
  const session = driver.session();
  const { name } = req.params;
  try {
    const nodeResult = await session.run(
      `MATCH (e:Node {type: 'Enterprise', label: $name})
       RETURN e`,
      { name }
    );
    
    if (nodeResult.records.length === 0) {
      return res.status(404).json({ success: false, error: '企业不存在' });
    }
    
    const enterprise = nodeResult.records[0].get('e').properties;
    
    const chainResult = await session.run(
      `MATCH (e:Node {type: 'Enterprise', label: $name})-[r*1..3]-(related)
       WHERE related.type IN ['Enterprise', 'Vessel', 'Port', 'Cargo', 'Route']
       RETURN DISTINCT related`,
      { name }
    );
    
    const nodes = chainResult.records.map(record => record.get('related').properties);
    
    const edgeResult = await session.run(
      `MATCH (e:Node {type: 'Enterprise', label: $name})-[r*1..3]-(related)
       WHERE related.type IN ['Enterprise', 'Vessel', 'Port', 'Cargo', 'Route']
       MATCH (a:Node)-[rel:RELATIONSHIP]->(b:Node)
       WHERE a.id IN $nodeIds AND b.id IN $nodeIds
       RETURN a.id as source, b.id as target, rel.label as label`,
      { 
        name,
        nodeIds: nodes.map(n => n.id)
      }
    );
    
    const edges = edgeResult.records.map(record => ({
      source: record.get('source'),
      target: record.get('target'),
      label: record.get('label')
    }));
    
    res.json({ success: true, data: { nodes, edges, enterprise } });
  } catch (error) {
    console.error('获取企业产业链失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

app.get('/api/tech-needs/:needId/match-achievements', async (req, res) => {
  const session = driver.session();
  const { needId } = req.params;
  try {
    const needResult = await session.run(
      `MATCH (n:Node {id: $needId}) RETURN n`,
      { needId }
    );
    
    if (needResult.records.length === 0) {
      return res.status(404).json({ success: false, error: '技术需求不存在' });
    }
    
    const techNeed = needResult.records[0].get('n').properties;
    const keywords = techNeed.label.split(/[，,、\s]+/);
    
    const matchResult = await session.run(
      `MATCH (n:Node)
       WHERE n.type IN ['Patent', 'Paper', 'Project']
       AND ($keywords IS NULL OR ANY(keyword IN $keywords WHERE n.label CONTAINS keyword OR n.category CONTAINS keyword))
       RETURN n LIMIT 10`,
      { keywords: keywords.length > 0 ? keywords : null }
    );
    
    const achievements = matchResult.records.map(record => record.get('n').properties);
    
    res.json({ success: true, data: { techNeed, achievements } });
  } catch (error) {
    console.error('匹配科技成果失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

async function getChainEnterprises(enterpriseName) {
  const session = driver.session();
  try {
    const enterpriseResult = await session.run(
      `MATCH (e:Node {type: 'Enterprise', label: $enterpriseName}) RETURN e`,
      { enterpriseName }
    );
    
    if (enterpriseResult.records.length === 0) {
      return { success: false, error: '企业不存在' };
    }
    
    const enterprise = enterpriseResult.records[0].get('e').properties;
    
    const directDownstreamResult = await session.run(
      `MATCH (e:Node {type: 'Enterprise', label: $enterpriseName})-[r:RELATIONSHIP]->(downstream)
       WHERE downstream.type = 'Enterprise'
       RETURN DISTINCT downstream`,
      { enterpriseName }
    );
    
    const directUpstreamResult = await session.run(
      `MATCH (e:Node {type: 'Enterprise', label: $enterpriseName})<-[r:RELATIONSHIP]-(upstream)
       WHERE upstream.type = 'Enterprise'
       RETURN DISTINCT upstream`,
      { enterpriseName }
    );
    
    const multiLevelDownstreamResult = await session.run(
      `MATCH path = (e:Node {type: 'Enterprise', label: $enterpriseName})-[r*2..4]->(downstream)
       WHERE downstream.type = 'Enterprise'
       RETURN DISTINCT downstream`,
      { enterpriseName }
    );
    
    const multiLevelUpstreamResult = await session.run(
      `MATCH path = (upstream:Node)-[r*2..4]->(e:Node {type: 'Enterprise', label: $enterpriseName})
       WHERE upstream.type = 'Enterprise'
       RETURN DISTINCT upstream`,
      { enterpriseName }
    );
    
    const seenIds = new Set([enterprise.id]);
    const enterprises = [enterprise];
    
    const addEnterprise = (node) => {
      if (!seenIds.has(node.id)) {
        seenIds.add(node.id);
        enterprises.push(node);
      }
    };
    
    directDownstreamResult.records.forEach(record => addEnterprise(record.get('downstream').properties));
    directUpstreamResult.records.forEach(record => addEnterprise(record.get('upstream').properties));
    multiLevelDownstreamResult.records.forEach(record => addEnterprise(record.get('downstream').properties));
    multiLevelUpstreamResult.records.forEach(record => addEnterprise(record.get('upstream').properties));
    
    console.log(`产业链中共有 ${enterprises.length} 个企业`);
    
    return { success: true, data: { enterprise, enterprises } };
  } catch (error) {
    console.error('获取产业链企业失败:', error);
    return { success: false, error: error.message };
  } finally {
    await session.close();
  }
}

app.get('/api/integrated-graph/:enterpriseName', async (req, res) => {
  const session = driver.session();
  const { enterpriseName } = req.params;
  try {
    const enterpriseResult = await session.run(
      `MATCH (e:Node {type: 'Enterprise', label: $enterpriseName}) RETURN e`,
      { enterpriseName }
    );
    
    if (enterpriseResult.records.length === 0) {
      return res.status(404).json({ success: false, error: '企业不存在' });
    }
    
    const enterprise = enterpriseResult.records[0].get('e').properties;
    enterprise.level = 0;
    
    const directDownstreamResult = await session.run(
      `MATCH (e:Node {type: 'Enterprise', label: $enterpriseName})-[r:RELATIONSHIP]->(downstream)
       WHERE downstream.type IN ['Enterprise', 'Vessel', 'Port', 'Cargo', 'Route']
       RETURN DISTINCT downstream, r.label as relationLabel`,
      { enterpriseName }
    );
    
    const directDownstreamNodes = directDownstreamResult.records.map(record => {
      const node = record.get('downstream').properties;
      node.level = 1;
      node.relationLabel = record.get('relationLabel');
      node.direction = 'downstream';
      return node;
    });
    
    const directUpstreamResult = await session.run(
      `MATCH (e:Node {type: 'Enterprise', label: $enterpriseName})<-[r:RELATIONSHIP]-(upstream)
       WHERE upstream.type IN ['Enterprise', 'Vessel', 'Port', 'Cargo', 'Route']
       RETURN DISTINCT upstream, r.label as relationLabel`,
      { enterpriseName }
    );
    
    const directUpstreamNodes = directUpstreamResult.records.map(record => {
      const node = record.get('upstream').properties;
      node.level = -1;
      node.relationLabel = record.get('relationLabel');
      node.direction = 'upstream';
      return node;
    });
    
    const multiLevelResult = await session.run(
      `MATCH path = (e:Node {type: 'Enterprise', label: $enterpriseName})-[r*2..4]->(downstream)
       WHERE downstream.type IN ['Enterprise', 'Vessel', 'Port', 'Cargo', 'Route']
       RETURN DISTINCT downstream, length(path) as distance`,
      { enterpriseName }
    );
    
    const multiLevelNodes = multiLevelResult.records.map(record => {
      const node = record.get('downstream').properties;
      const distance = record.get('distance');
      node.level = distance;
      node.direction = 'downstream';
      return node;
    });
    
    const multiLevelUpstreamResult = await session.run(
      `MATCH path = (upstream:Node)-[r*2..4]->(e:Node {type: 'Enterprise', label: $enterpriseName})
       WHERE upstream.type IN ['Enterprise', 'Vessel', 'Port', 'Cargo', 'Route']
       RETURN DISTINCT upstream, length(path) as distance`,
      { enterpriseName }
    );
    
    const multiLevelUpstreamNodes = multiLevelUpstreamResult.records.map(record => {
      const node = record.get('upstream').properties;
      const distance = record.get('distance');
      node.level = -distance;
      node.direction = 'upstream';
      return node;
    });
    
    const allChainNodeIds = [
      enterprise.id,
      ...directDownstreamNodes.map(n => n.id),
      ...directUpstreamNodes.map(n => n.id),
      ...multiLevelNodes.map(n => n.id),
      ...multiLevelUpstreamNodes.map(n => n.id)
    ];
    
    const chainEdgeResult = await session.run(
      `MATCH (a:Node)-[rel:RELATIONSHIP]->(b:Node)
       WHERE a.id IN $nodeIds AND b.id IN $nodeIds
       RETURN a.id as source, b.id as target, rel.label as label`,
      { nodeIds: allChainNodeIds }
    );
    
    const chainEdges = chainEdgeResult.records.map(record => ({
      source: record.get('source'),
      target: record.get('target'),
      label: record.get('label')
    }));
    
    const allChainNodes = [enterprise, ...directDownstreamNodes, ...directUpstreamNodes, ...multiLevelNodes, ...multiLevelUpstreamNodes];
    
    const aiLevels = await analyzeChainLevelWithAI(allChainNodes, chainEdges, enterpriseName);
    
    allChainNodes.forEach(node => {
      if (aiLevels[node.label] !== undefined) {
        node.level = aiLevels[node.label];
      }
    });
    
    const allNodes = [enterprise, ...allChainNodes];
    const allEdges = [...chainEdges];
    
    res.json({ 
      success: true, 
      data: { 
        nodes: allNodes, 
        edges: allEdges,
        enterprise,
        chainNodes: allChainNodes
      } 
    });
  } catch (error) {
    console.error('获取融合图谱失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

async function filterAchievementsWithAI(techNeed, achievements) {
  try {
    const achievementsText = achievements.map((a, index) => 
      `${index + 1}. ${a.label}`
    ).join('\n');

    const prompt = `请根据企业技术需求，筛选出最相关的科技成果。

技术需求：${techNeed.label}

科技成果列表：
${achievementsText}

请按照以下标准筛选：
1. 学校成果与技术需求的相关程度是否高（30%）
2. 技术领域是否匹配（30%）
3. 技术方向是否一致（20%）
4. 应用场景是否相关（20%）

请以JSON格式返回结果，只保留相关性评分大于等于80的科技成果（满分100分），格式如下：
{
  "filtered": [
    {
      "index": 数字,
      "score": 评分,
      "reason": "筛选理由"
    }
  ]
}

注意：
- 只返回相关性评分>=7的科技成果
- index对应科技成果列表中的序号（从1开始）
- score是相关性评分（0-10分）
- reason是筛选理由`;

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的技术匹配专家，擅长评估科技成果与技术需求的相关性。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiContent = response.data.choices[0].message.content;
    console.log(`AI筛选结果 for ${techNeed.label}:`, aiContent);
    
    let filteredResult;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        filteredResult = JSON.parse(jsonMatch[0]);
      } else {
        console.error('AI返回内容无法解析为JSON:', aiContent);
        return achievements;
      }
    } catch (parseError) {
      console.error('解析AI返回内容失败:', parseError);
      return achievements;
    }

    if (filteredResult && filteredResult.filtered) {
      const filteredIndices = filteredResult.filtered.map(f => f.index - 1);
      const filteredAchievements = achievements.filter((_, index) => 
        filteredIndices.includes(index)
      ).map((achievement, index) => {
        const filteredInfo = filteredResult.filtered.find(f => f.index === index + 1);
        const score = filteredInfo ? filteredInfo.score : 7.5;
        return {
          ...achievement,
          structural_score: (score / 10) * 0.7,
          semantic_score: (score / 10) * 0.8,
          fused_score: score / 10,
          recommendation_reason: filteredInfo ? filteredInfo.reason : 'AI智能匹配推荐',
          matching_path: [techNeed.label, 'AI匹配', achievement.label]
        };
      });
      console.log(`技术需求 "${techNeed.label}" AI筛选后保留 ${filteredAchievements.length}/${achievements.length} 个科技成果`);
      return filteredAchievements;
    }

    return achievements.map(achievement => ({
      ...achievement,
      structural_score: 0.7,
      semantic_score: 0.8,
      fused_score: 0.75,
      recommendation_reason: 'AI智能匹配推荐',
      matching_path: [techNeed.label, 'AI匹配', achievement.label]
    }));
  } catch (error) {
    console.error('AI筛选科技成果失败:', error);
    return achievements;
  }
}

async function matchAchievementsForNode(nodeLabel) {
  const session = driver.session();
  try {
    console.log('匹配节点技术需求:', nodeLabel);
    
    const nodeResult = await session.run(
      `MATCH (n:Node {label: $nodeLabel}) RETURN n`,
      { nodeLabel }
    );
    
    if (nodeResult.records.length === 0) {
      return { success: false, error: '节点不存在' };
    }
    
    const node = nodeResult.records[0].get('n').properties;
    
    const techNeedsResult = await session.run(
      `MATCH (e:Node {label: $nodeLabel})-[r:RELATIONSHIP]->(tn:Node {type: 'technical requirements'})
       RETURN tn, r.label as relationLabel`,
      { nodeLabel }
    );
    
    const techNeeds = techNeedsResult.records.map(record => {
      const tn = record.get('tn').properties;
      return {
        id: tn.id,
        label: tn.label,
        type: tn.type,
        category: tn.category
      };
    });
    
    console.log(`找到 ${techNeeds.length} 个技术需求`);
    
    if (techNeeds.length === 0) {
      return { success: true, data: { node, techNeeds: [], achievements: [], nodes: [node], edges: [], matchResults: [] } };
    }
    
    const achievementsResult = await session.run(
      `MATCH (n:Node)
       WHERE n.type IN ['Patent', 'Paper', 'Project']
       RETURN n LIMIT 100`
    );
    
    const allAchievements = achievementsResult.records.map(record => {
      const a = record.get('n').properties;
      return {
        id: a.id,
        label: a.label,
        type: a.type,
        category: a.category,
        patent_number: a.patent_number || '',
        team: a.team || '',
        university: a.university || '',
        transferable: a.transferable !== false,
        cooperation_modes: a.cooperation_modes || ['技术转让'],
        keywords: a.keywords || []
      };
    });
    
    const nodes = [node, ...techNeeds, ...allAchievements];
    const edges = [];
    
    techNeeds.forEach(need => {
      edges.push({
        source: node.id,
        target: need.id,
        label: '需要技术'
      });
    });
    
    try {
      const matchingEngineResponse = await axios.post(`${MATCHING_ENGINE_URL}/initialize`, {
        nodes: nodes,
        edges: edges,
        config: {
          device: 'cpu',
          structural_weight: 0.6,
          semantic_weight: 0.4
        }
      });
      
      console.log('匹配引擎初始化成功');
      
      const matchResults = [];
      
      for (const techNeed of techNeeds) {
        const matchResponse = await axios.post(`${MATCHING_ENGINE_URL}/match`, {
          demand: techNeed,
          top_k: 10
        });
        
        if (matchResponse.data.success) {
          const recommendations = matchResponse.data.recommendations;
          
          recommendations.forEach(rec => {
            matchResults.push({
              demand_id: techNeed.id,
              achievement_id: rec.achievement.id,
              structural_score: rec.matching_scores.structural_score,
              semantic_score: rec.matching_scores.semantic_score,
              fused_score: rec.matching_scores.fused_score,
              recommendation_reason: rec.recommendation_reason,
              matching_path: rec.matching_path
            });
            
            edges.push({
              source: techNeed.id,
              target: rec.achievement.id,
              label: '技术匹配'
            });
          });
        }
      }
      
      console.log(`匹配引擎返回 ${matchResults.length} 个匹配结果`);
      
      const matchedAchievements = [];
      matchResults.forEach(match => {
        const achievement = allAchievements.find(a => a.id === match.achievement_id);
        if (achievement && !matchedAchievements.find(a => a.id === achievement.id)) {
          matchedAchievements.push({
            ...achievement,
            structural_score: match.structural_score,
            semantic_score: match.semantic_score,
            fused_score: match.fused_score,
            recommendation_reason: match.recommendation_reason,
            matching_path: match.matching_path
          });
        }
      });
      
      return {
        success: true,
        data: {
          node,
          techNeeds,
          achievements: matchedAchievements,
          nodes: [node, ...techNeeds, ...matchedAchievements],
          edges: edges,
          matchResults: matchResults
        }
      };
      
    } catch (matchingError) {
      console.error('匹配引擎调用失败，使用AI智能匹配:', matchingError.message);
      
      const achievements = [];
      const matchEdges = [];
      const matchResults = [];
      
      for (const techNeed of techNeeds) {
        console.log(`正在为技术需求 "${techNeed.label}" 进行AI智能匹配...`);
        
        const filteredAchievements = await filterAchievementsWithAI(techNeed, allAchievements);
        
        console.log(`技术需求 "${techNeed.label}" AI匹配到 ${filteredAchievements.length} 个科技成果`);
        
        filteredAchievements.forEach(achievement => {
          achievements.push(achievement);
          matchEdges.push({
            source: techNeed.id,
            target: achievement.id,
            label: '技术匹配'
          });
          
          matchResults.push({
            demand_id: techNeed.id,
            achievement_id: achievement.id,
            structural_score: achievement.structural_score || 0.7,
            semantic_score: achievement.semantic_score || 0.8,
            fused_score: achievement.fused_score || 0.75,
            recommendation_reason: achievement.recommendation_reason || 'AI智能匹配推荐',
            matching_path: achievement.matching_path || [techNeed.label, 'AI匹配', achievement.label]
          });
        });
      }
      
      console.log(`AI智能匹配后找到 ${achievements.length} 个科技成果，${matchResults.length} 个匹配关系`);
      
      const techNeedEdges = techNeeds.map(need => ({
        source: node.id,
        target: need.id,
        label: '需要技术'
      }));
      
      const allNodes = [node, ...techNeeds, ...achievements];
      const allEdges = [...techNeedEdges, ...matchEdges];
      
      return {
        success: true,
        data: {
          node,
          techNeeds,
          achievements,
          nodes: allNodes,
          edges: allEdges,
          matchResults: matchResults
        }
      };
    }
  } catch (error) {
    console.error('匹配节点技术需求失败:', error);
    return { success: false, error: error.message };
  } finally {
    await session.close();
  }
}

app.get('/api/node-tech-needs/:nodeLabel', async (req, res) => {
  const result = await matchAchievementsForNode(req.params.nodeLabel);
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

app.post('/api/analyze-demand', async (req, res) => {
  const session = driver.session();
  const { demand } = req.body;
  
  try {
    console.log('开始分析企业需求:', demand);
    
    const deepseekResponse = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的技术需求分析师。请将用户输入的企业需求分解为3-5个精准的技术需求。每个需求应该简洁明确，便于后续的技术匹配。请以JSON数组格式返回，例如：["需求1", "需求2", "需求3"]'
          },
          {
            role: 'user',
            content: `请分析以下企业需求并分解为精准的技术需求：${demand}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiContent = deepseekResponse.data.choices[0].message.content;
    console.log('DeepSeek返回内容:', aiContent);
    
    let preciseNeeds = [];
    try {
      const jsonMatch = aiContent.match(/\[.*\]/s);
      if (jsonMatch) {
        preciseNeeds = JSON.parse(jsonMatch[0]);
      } else {
        preciseNeeds = aiContent.split('\n').filter(line => line.trim()).map(line => line.replace(/^\d+[\.\、]\s*/, '').trim());
      }
    } catch (parseError) {
      console.error('解析AI返回内容失败:', parseError);
      preciseNeeds = aiContent.split('\n').filter(line => line.trim()).map(line => line.replace(/^\d+[\.\、]\s*/, '').trim());
    }

    console.log('分解后的精准需求:', preciseNeeds);

    const achievementResult = await session.run(
      `MATCH (n:Node)
       WHERE n.type IN ['Patent', 'Paper', 'Project']
       RETURN n LIMIT 20`
    );

    const allAchievements = achievementResult.records.map(record => record.get('n').properties);

    const achievements = [];

    preciseNeeds.forEach((need, needIndex) => {
      const needKeywords = need.split(/[\s，,、]+/);
      
      allAchievements.forEach((achievement, achievementIndex) => {
        const matchScore = needKeywords.filter(keyword => 
          achievement.keywords.some(achKeyword => 
            achKeyword.includes(keyword) || keyword.includes(achKeyword)
          )
        ).length;

        if (matchScore > 0) {
          const existingAchievement = achievements.find(a => a.id === achievement.id);
          if (existingAchievement) {
            if (!existingAchievement.matchedNeeds.includes(needIndex)) {
              existingAchievement.matchedNeeds.push(needIndex);
            }
          } else {
            achievements.push({
              ...achievement,
              matchedNeeds: [needIndex]
            });
          }
        }
      });
    });

    console.log('匹配的科技成果:', achievements);

    res.json({
      success: true,
      data: {
        preciseNeeds,
        achievements
      }
    });
  } catch (error) {
    console.error('分析需求失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

app.post('/api/matching-feedback', async (req, res) => {
  const { demand_id, achievement_id, feedback_type, scores } = req.body;
  
  try {
    console.log('记录匹配反馈:', { demand_id, achievement_id, feedback_type });
    
    const feedbackResponse = await axios.post(`${MATCHING_ENGINE_URL}/feedback`, {
      demand_id,
      achievement_id,
      feedback_type,
      scores: scores || {}
    });
    
    res.json({
      success: true,
      message: '反馈记录成功'
    });
  } catch (error) {
    console.error('记录反馈失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/matching-performance', async (req, res) => {
  try {
    const performanceResponse = await axios.get(`${MATCHING_ENGINE_URL}/performance`);
    
    res.json({
      success: true,
      performance: performanceResponse.data.report
    });
  } catch (error) {
    console.error('获取性能报告失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/matching-stats', async (req, res) => {
  try {
    const statsResponse = await axios.get(`${MATCHING_ENGINE_URL}/stats`);
    
    res.json({
      success: true,
      stats: statsResponse.data.stats
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/export-matching-results', async (req, res) => {
  const { recommendations, format } = req.body;
  
  try {
    const exportResponse = await axios.post(`${MATCHING_ENGINE_URL}/export`, {
      recommendations,
      format: format || 'json'
    });
    
    res.json({
      success: true,
      content: exportResponse.data.content,
      format: exportResponse.data.format
    });
  } catch (error) {
    console.error('导出匹配结果失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/node-ppt/:nodeLabel', async (req, res) => {
  const { nodeLabel } = req.params;
  const result = await PPTService.getNodePPTContent(driver, nodeLabel);
  
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

app.post('/api/generate-ppt-from-template', async (req, res) => {
  const { templateName, data } = req.body;
  
  if (!templateName) {
    return res.json({
      success: false,
      error: '缺少模板名称参数'
    });
  }
  
  if (!data) {
    return res.json({
      success: false,
      error: '缺少替换数据参数'
    });
  }
  
  const result = await PPTService.generatePPTFromTemplate(templateName, data);
  
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

app.post('/api/export-chain-ppt', async (req, res) => {
  const { enterpriseName } = req.body;
  
  if (!enterpriseName) {
    return res.json({
      success: false,
      error: '缺少企业名称参数'
    });
  }
  
  const result = await PPTService.exportChainPPT(driver, enterpriseName);
  
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});



const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Neo4j API服务器运行在端口 ${PORT}`);
  console.log(`匹配引擎服务地址: ${MATCHING_ENGINE_URL}`);
});

module.exports = { matchAchievementsForNode, getChainEnterprises };

process.on('SIGINT', async () => {
  await driver.close();
  process.exit(0);
});