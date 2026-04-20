# 学校成果匹配系统 - 使用说明

## 系统概述

本系统实现了基于多模态融合的智能学校成果匹配算法，包含以下核心模块：

1. **数据预处理与图谱对齐** - 术语标准化和实体对齐
2. **GNN对齐引擎** - 基于RGCN的结构相似度计算
3. **文本语义编码器** - 基于Sentence-BERT的语义向量提取
4. **向量检索引擎** - 基于FAISS的高效语义检索
5. **匹配得分融合** - 结构与语义得分的加权融合
6. **规则约束模块** - 多维度规则过滤和重排序
7. **在线学习模块** - 基于用户反馈的闭环优化
8. **Top-10推荐输出** - 结构化的匹配建议

## 系统架构

```
┌─────────────────┐
│  Node.js API   │ (端口 3002)
│   (server.js)  │
└────────┬────────┘
         │ HTTP调用
         ▼
┌─────────────────┐
│  Python匹配引擎 │ (端口 5001)
│  (Flask API)  │
└─────────────────┘
         │
         ├── 数据预处理
         ├── GNN对齐引擎
         ├── 语义编码器
         ├── 向量检索
         ├── 得分融合
         ├── 规则约束
         └── 在线学习
```

## 安装步骤

### 1. 安装Python依赖

```bash
cd server
pip install -r requirements.txt
```

### 2. 启动匹配引擎服务

**Windows:**
```bash
start_matching_engine.bat
```

**Linux/Mac:**
```bash
python matching_engine_service.py
```

匹配引擎将在 `http://localhost:5001` 启动

### 3. 启动主服务器

```bash
npm run server
```

主服务器将在 `http://localhost:3002` 启动

## API接口说明

### 1. 初始化匹配引擎

```http
POST /initialize
Content-Type: application/json

{
  "nodes": [
    {
      "id": "node1",
      "label": "节点名称",
      "type": "Patent",
      "category": "科技成果",
      "keywords": ["关键词1", "关键词2"],
      "tech_field": "人工智能",
      "trl_level": 5,
      "patent_number": "专利号",
      "team": "团队名称",
      "transferable": true,
      "cooperation_modes": ["技术转让", "联合开发"]
    }
  ],
  "edges": [
    {
      "source": "node1",
      "target": "node2",
      "label": "关系类型"
    }
  ],
  "config": {
    "device": "cpu",
    "structural_weight": 0.6,
    "semantic_weight": 0.4
  }
}
```

### 2. 匹配技术需求

```http
POST /match
Content-Type: application/json

{
  "demand": {
    "id": "demand1",
    "label": "高精度视觉检测算法",
    "type": "technical requirements",
    "category": "技术需求",
    "trl_level": 5,
    "region": "华东",
    "cooperation_modes": ["技术转让", "联合开发"]
  },
  "top_k": 10
}
```

**响应示例：**
```json
{
  "success": true,
  "recommendations": [
    {
      "rank": 1,
      "achievement": {
        "id": "achievement1",
        "name": "基于YOLOv8的工业缺陷检测模型",
        "type": "Patent",
        "university": "某大学",
        "patent_number": "CN123456789",
        "tech_field": "人工智能",
        "trl_level": 6
      },
      "matching_scores": {
        "structural_score": 0.87,
        "semantic_score": 0.92,
        "fused_score": 0.89,
        "constraint_score": 0.85
      },
      "matching_path": [
        "需求: 高精度视觉检测算法",
        "技术领域: 人工智能",
        "技术关键词: 视觉检测, 深度学习",
        "成果: 基于YOLOv8的工业缺陷检测模型"
      ],
      "recommendation_reason": "该成果与技术需求高度匹配; 图谱结构关联性强; 文本语义相似度高; TRL成熟度匹配(需求TRL5, 成果TRL6); 拥有专利保护; 支持技术转让,联合开发等合作模式",
      "contact_info": {
        "team": "智能视觉实验室",
        "contact_person": "张教授",
        "email": "zhang@university.edu.cn",
        "phone": "13800000000",
        "university": "某大学"
      }
    }
  ],
  "count": 10
}
```

### 3. 记录用户反馈

```http
POST /api/matching-feedback
Content-Type: application/json

{
  "demand_id": "demand1",
  "achievement_id": "achievement1",
  "feedback_type": "click",
  "scores": {
    "structural_score": 0.87,
    "semantic_score": 0.92,
    "fused_score": 0.89
  }
}
```

**反馈类型：**
- `click` - 用户点击查看
- `contact` - 用户联系
- `contract` - 签约转化
- `positive` - 正面评价
- `negative` - 负面评价
- `skip` - 跳过
- `reject` - 拒绝

### 4. 获取性能报告

```http
GET /api/matching-performance
```

**响应示例：**
```json
{
  "success": true,
  "performance": {
    "overall_performance": {
      "accuracy": 0.85,
      "precision": 0.82,
      "recall": 0.88,
      "f1_score": 0.85
    },
    "recent_feedback": {
      "total": 50,
      "positive": 42,
      "negative": 8,
      "positive_rate": 0.84
    },
    "model_parameters": {
      "structural_weight": 0.62,
      "semantic_weight": 0.38,
      "tech_field_importance": 1.05,
      "trl_importance": 0.98,
      "region_importance": 0.52,
      "cooperation_importance": 0.48
    }
  }
}
```

### 5. 导出匹配结果

```http
POST /api/export-matching-results
Content-Type: application/json

{
  "recommendations": [...],
  "format": "csv"
}
```

## 前端集成

### 节点点击事件处理

```javascript
const handleNodeClick = async (nodeData) => {
  try {
    setLoading(true);
    
    const response = await api.getNodeTechNeeds(nodeData.label);
    
    if (response.data.matchResults) {
      setMatchResults(response.data.matchResults);
    }
    
    setGraphData(response.data);
    setViewMode('tech-needs');
    setFocusedNode(response.data.node);
    
    setLoading(false);
  } catch (error) {
    console.error('获取匹配结果失败:', error);
    setError(error.message);
    setLoading(false);
  }
};
```

### 显示匹配详情

```jsx
{selectedNode && selectedNode.fused_score !== undefined && (
  <div className="matching-details">
    <h4>匹配得分</h4>
    <div>结构得分: {(selectedNode.structural_score * 100).toFixed(1)}%</div>
    <div>语义得分: {(selectedNode.semantic_score * 100).toFixed(1)}%</div>
    <div>综合得分: {(selectedNode.fused_score * 100).toFixed(1)}%</div>
    
    {selectedNode.recommendation_reason && (
      <div>
        <h4>推荐理由</h4>
        <p>{selectedNode.recommendation_reason}</p>
      </div>
    )}
    
    {selectedNode.matching_path && (
      <div>
        <h4>匹配路径</h4>
        {selectedNode.matching_path.map((item, index) => (
          <div key={index}>
            {index === 0 ? '→ ' : '  → '}{item}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

## 算法流程

### 完整匹配流程

1. **数据预处理**
   - 术语标准化（GB/T 13745）
   - 关键词提取
   - 技术领域分类
   - TRL成熟度评估
   - 地域和合作模式识别

2. **GNN结构匹配**
   - 构建异构图
   - RGCN节点嵌入学习
   - 对比学习优化
   - 计算结构相似度

3. **语义向量匹配**
   - Sentence-BERT编码
   - FAISS向量检索
   - KNN近邻搜索
   - 计算语义相似度

4. **得分融合**
   - 加权融合（0.6结构 + 0.4语义）
   - 动态权重调整
   - 综合得分计算

5. **规则过滤**
   - 技术领域约束
   - TRL成熟度约束
   - 知识产权约束
   - 地域协同约束
   - 合作模式约束

6. **重排序**
   - 约束得分计算
   - 综合排序
   - 多样性优化

7. **推荐输出**
   - Top-10推荐
   - 匹配路径生成
   - 推荐理由生成
   - 联系信息提供

## 性能优化建议

1. **GPU加速**
   - 安装CUDA版本的PyTorch
   - 配置`device: 'cuda'`
   - 使用GPU加速向量检索

2. **批量处理**
   - 使用批量匹配接口
   - 减少API调用次数
   - 提高处理效率

3. **缓存优化**
   - 缓存常用查询结果
   - 定期更新向量数据库
   - 减少重复计算

4. **模型调优**
   - 根据业务数据调整权重
   - 收集更多用户反馈
   - 定期重训练模型

## 故障排查

### 匹配引擎启动失败

**问题：** 端口被占用
```bash
# 更改端口
set PORT=5002
python matching_engine_service.py
```

**问题：** 依赖缺失
```bash
pip install -r requirements.txt --upgrade
```

### 匹配结果不准确

**检查：**
1. 数据质量是否完整
2. 关键词是否准确
3. TRL等级是否合理
4. 用户反馈是否充足

**优化：**
1. 收集更多反馈数据
2. 调整融合权重
3. 更新规则约束
4. 重训练模型

## 维护和更新

### 定期维护任务

1. **每周**
   - 检查性能指标
   - 分析用户反馈
   - 调整模型参数

2. **每月**
   - 更新科技成果数据
   - 优化向量数据库
   - 重训练GNN模型

3. **每季度**
   - 评估算法效果
   - 更新术语库
   - 优化系统架构

## 技术支持

如遇到问题，请检查：
1. 服务是否正常运行
2. 端口配置是否正确
3. 数据库连接是否正常
4. 日志文件中的错误信息

---

**版本：** 1.0.0  
**更新日期：** 2024-03-25  
**维护团队：** 科技成果转化项目组
