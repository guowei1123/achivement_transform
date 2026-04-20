# Neo4j 数据库集成指南

本项目已集成Neo4j图数据库，用于存储和查询知识图谱数据。

## 功能特性

- ✅ 自动导入图谱数据到Neo4j
- ✅ RESTful API接口查询图谱
- ✅ 支持节点、关系、图谱查询
- ✅ 支持节点搜索功能
- ✅ 支持按类型筛选

## 安装依赖

```bash
npm install
```

## 配置Neo4j

### 1. 安装Neo4j

#### Windows
1. 下载Neo4j Desktop: https://neo4j.com/download/
2. 安装并启动Neo4j Desktop
3. 创建新数据库实例
4. 记录连接信息（默认：bolt://localhost:7687）

#### Linux/Mac
```bash
# 使用Docker
docker run -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your_password \
  neo4j:latest
```

### 2. 配置数据库连接

复制示例配置文件：
```bash
cp server/config.example.js server/config.js
```

编辑 `server/config.js`，填入您的Neo4j连接信息：
```javascript
module.exports = {
  neo4j: {
    uri: 'bolt://localhost:7687',
    user: 'neo4j',
    password: 'your_password_here',
    database: 'neo4j'
  }
}
```

## 导入数据

### 导入所有图谱数据
```bash
npm run import
```

### 导入特定图谱
```bash
# 导入航运产业链图谱
node server/neo4j-import.js shipping

# 导入学校科技成果图谱
node server/neo4j-import.js school
```

## 启动API服务器

```bash
npm run server
```

服务器将在 `http://localhost:3001` 启动

## API接口

### 获取所有节点
```http
GET /api/nodes
```

### 按类型获取节点
```http
GET /api/nodes/:type
```

示例：
```http
GET /api/nodes/Enterprise
GET /api/nodes/Patent
```

### 获取所有关系
```http
GET /api/edges
```

### 获取特定图谱
```http
GET /api/graph/:type
```

示例：
```http
GET /api/graph/shipping
GET /api/graph/school
```

### 获取节点详情
```http
GET /api/node/:id
```

### 搜索节点
```http
GET /api/search?q=keyword
```

## 数据结构

### 节点属性
- `id`: 节点唯一标识
- `label`: 节点显示名称
- `type`: 节点类型
- `category`: 节点分类
- 其他业务属性（根据节点类型不同）

### 关系属性
- `source`: 源节点ID
- `target`: 目标节点ID
- `label`: 关系标签

## 图谱类型

### 航运产业链图谱 (shipping)
- 企业节点
- 船舶节点
- 港口节点
- 货物节点
- 航线节点
- 监管机构节点

### 学校科技成果图谱 (school)
- 专利节点
- 论文节点
- 项目节点
- 科研人员节点
- 部门节点
- 学术头衔节点
- 奖项节点
- 技术领域节点

## 使用示例

### 前端集成

```javascript
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

// 获取所有节点
const nodes = await axios.get(`${API_BASE}/nodes`);

// 获取航运图谱
const shippingGraph = await axios.get(`${API_BASE}/graph/shipping`);

// 搜索节点
const results = await axios.get(`${API_BASE}/search?q=中远海运`);
```

### Cypher查询示例

```cypher
// 查询所有企业节点
MATCH (n:Enterprise) RETURN n

// 查询节点关系
MATCH (a:Node)-[r]->(b:Node) WHERE a.id = 'e1' RETURN a, r, b

// 查询路径
MATCH path = (start:Node {id: 'e1'})-[*]-(end:Node {id: 'p1'})
RETURN path
```

## 故障排除

### 连接失败
- 检查Neo4j是否启动
- 验证配置文件中的连接信息
- 确认防火墙设置

### 导入失败
- 确保Neo4j有足够的内存
- 检查数据格式是否正确
- 查看错误日志获取详细信息

### API错误
- 确认API服务器正在运行
- 检查请求格式是否正确
- 查看服务器日志

## 性能优化

### 索引创建
```cypher
CREATE INDEX node_id_index FOR (n:Node) ON (n.id);
CREATE INDEX node_type_index FOR (n:Node) ON (n.type);
CREATE INDEX node_category_index FOR (n:Node) ON (n.category);
```

### 批量导入
对于大量数据，建议使用Neo4j的批量导入工具：
- neo4j-admin import
- LOAD CSV
- apoc.load.json

## 安全建议

1. **不要在代码中硬编码密码** - 使用环境变量
2. **限制API访问** - 添加认证和授权
3. **使用HTTPS** - 生产环境必须使用加密连接
4. **定期备份** - 设置数据库自动备份
5. **监控日志** - 记录所有数据库操作

## 扩展功能

可以考虑添加：
- 实时数据同步
- 图谱可视化编辑器
- 数据版本控制
- 权限管理系统
- 数据导出功能
