import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import './IntelligentMatching.css'

function IntelligentMatching() {
  const [selectedDimension, setSelectedDimension] = useState('all')
  const [matchingResults, setMatchingResults] = useState([])
  const [userPreferences, setUserPreferences] = useState({
    technologyMaturity: 70,
    marketUrgency: 80,
    policySupport: 75,
    innovationLevel: 85,
    commercializationPotential: 65
  })

  const matchingData = [
    {
      id: 1,
      name: '清华大学人工智能研究院',
      technologyMaturity: 92,
      marketUrgency: 88,
      policySupport: 95,
      innovationLevel: 90,
      commercializationPotential: 85,
      overallScore: 90,
      category: '高校',
      tags: ['人工智能', '深度学习', '自然语言处理']
    },
    {
      id: 2,
      name: '中科院计算技术研究所',
      technologyMaturity: 88,
      marketUrgency: 85,
      policySupport: 90,
      innovationLevel: 88,
      commercializationPotential: 82,
      overallScore: 87,
      category: '科研院所',
      tags: ['计算机视觉', '大数据', '云计算']
    },
    {
      id: 3,
      name: '华为技术有限公司',
      technologyMaturity: 95,
      marketUrgency: 90,
      policySupport: 88,
      innovationLevel: 92,
      commercializationPotential: 95,
      overallScore: 92,
      category: '企业',
      tags: ['5G', '芯片', '物联网']
    },
    {
      id: 4,
      name: '腾讯科技有限公司',
      technologyMaturity: 90,
      marketUrgency: 92,
      policySupport: 85,
      innovationLevel: 88,
      commercializationPotential: 90,
      overallScore: 89,
      category: '企业',
      tags: ['社交网络', '游戏', '金融科技']
    },
    {
      id: 5,
      name: '北京大学计算机学院',
      technologyMaturity: 85,
      marketUrgency: 80,
      policySupport: 92,
      innovationLevel: 90,
      commercializationPotential: 78,
      overallScore: 85,
      category: '高校',
      tags: ['机器学习', '数据挖掘', '知识图谱']
    }
  ]

  const trendData = [
    { month: '1月', accuracy: 82, recall: 78, f1: 80 },
    { month: '2月', accuracy: 84, recall: 80, f1: 82 },
    { month: '3月', accuracy: 86, recall: 82, f1: 84 },
    { month: '4月', accuracy: 88, recall: 84, f1: 86 },
    { month: '5月', accuracy: 90, recall: 86, f1: 88 },
    { month: '6月', accuracy: 92, recall: 88, f1: 90 }
  ]

  const radarData = [
    { subject: '技术成熟度', A: 70, B: 92, fullMark: 100 },
    { subject: '市场需求', A: 80, B: 88, fullMark: 100 },
    { subject: '政策支持', A: 75, B: 95, fullMark: 100 },
    { subject: '创新水平', A: 85, B: 90, fullMark: 100 },
    { subject: '转化潜力', A: 65, B: 85, fullMark: 100 }
  ]

  const categoryData = [
    { name: '高校', value: 35, color: '#52c41a' },
    { name: '科研院所', value: 25, color: '#1890ff' },
    { name: '企业', value: 30, color: '#faad14' },
    { name: '其他', value: 10, color: '#f5222d' }
  ]

  useEffect(() => {
    setMatchingResults(matchingData)
  }, [])

  const handlePreferenceChange = (key, value) => {
    setUserPreferences(prev => ({
      ...prev,
      [key]: parseInt(value)
    }))
  }

  const handleMatch = () => {
    const results = matchingData.map(item => {
      const weightedScore = (
        (item.technologyMaturity * userPreferences.technologyMaturity +
         item.marketUrgency * userPreferences.marketUrgency +
         item.policySupport * userPreferences.policySupport +
         item.innovationLevel * userPreferences.innovationLevel +
         item.commercializationPotential * userPreferences.commercializationPotential) /
        (userPreferences.technologyMaturity +
         userPreferences.marketUrgency +
         userPreferences.policySupport +
         userPreferences.innovationLevel +
         userPreferences.commercializationPotential)
      )
      return {
        ...item,
        personalizedScore: Math.round(weightedScore)
      }
    }).sort((a, b) => b.personalizedScore - a.personalizedScore)

    setMatchingResults(results)
  }

  const handleDimensionFilter = (dimension) => {
    setSelectedDimension(dimension)
  }

  const getScoreColor = (score) => {
    if (score >= 90) return '#52c41a'
    if (score >= 80) return '#1890ff'
    if (score >= 70) return '#faad14'
    return '#f5222d'
  }

  return (
    <div className="intelligent-matching">
      <div className="im-header">
        <h2>智能匹配与推荐系统</h2>
        <p>基于图神经网络与排序学习的多维匹配网络，实现精准推荐</p>
      </div>

      <div className="im-content">
        <div className="im-sidebar">
          <div className="im-preferences card">
            <h3>匹配偏好设置</h3>
            <div className="preference-item">
              <label>技术成熟度权重</label>
              <input
                type="range"
                min="0"
                max="100"
                value={userPreferences.technologyMaturity}
                onChange={(e) => handlePreferenceChange('technologyMaturity', e.target.value)}
                className="range-input"
              />
              <span>{userPreferences.technologyMaturity}%</span>
            </div>
            <div className="preference-item">
              <label>市场需求紧迫性</label>
              <input
                type="range"
                min="0"
                max="100"
                value={userPreferences.marketUrgency}
                onChange={(e) => handlePreferenceChange('marketUrgency', e.target.value)}
                className="range-input"
              />
              <span>{userPreferences.marketUrgency}%</span>
            </div>
            <div className="preference-item">
              <label>政策支持力度</label>
              <input
                type="range"
                min="0"
                max="100"
                value={userPreferences.policySupport}
                onChange={(e) => handlePreferenceChange('policySupport', e.target.value)}
                className="range-input"
              />
              <span>{userPreferences.policySupport}%</span>
            </div>
            <div className="preference-item">
              <label>创新水平</label>
              <input
                type="range"
                min="0"
                max="100"
                value={userPreferences.innovationLevel}
                onChange={(e) => handlePreferenceChange('innovationLevel', e.target.value)}
                className="range-input"
              />
              <span>{userPreferences.innovationLevel}%</span>
            </div>
            <div className="preference-item">
              <label>转化潜力</label>
              <input
                type="range"
                min="0"
                max="100"
                value={userPreferences.commercializationPotential}
                onChange={(e) => handlePreferenceChange('commercializationPotential', e.target.value)}
                className="range-input"
              />
              <span>{userPreferences.commercializationPotential}%</span>
            </div>
            <button className="btn btn-primary mt-4" onClick={handleMatch}>
              开始智能匹配
            </button>
          </div>

          <div className="im-stats card">
            <h3>匹配统计</h3>
            <div className="stat-grid">
              <div className="stat-box">
                <div className="stat-value">5,234</div>
                <div className="stat-label">总匹配次数</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">92.5%</div>
                <div className="stat-label">匹配准确率</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">1,856</div>
                <div className="stat-label">成功转化</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">35.4%</div>
                <div className="stat-label">转化成功率</div>
              </div>
            </div>
          </div>
        </div>

        <div className="im-main">
          <div className="im-filters">
            <button
              className={`btn ${selectedDimension === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleDimensionFilter('all')}
            >
              全部维度
            </button>
            <button
              className={`btn ${selectedDimension === 'technology' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleDimensionFilter('technology')}
            >
              技术维度
            </button>
            <button
              className={`btn ${selectedDimension === 'market' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleDimensionFilter('market')}
            >
              市场维度
            </button>
            <button
              className={`btn ${selectedDimension === 'policy' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleDimensionFilter('policy')}
            >
              政策维度
            </button>
          </div>

          <div className="im-results">
            <div className="results-header">
              <h3>匹配结果</h3>
              <span className="results-count">共 {matchingResults.length} 条结果</span>
            </div>
            <div className="results-list">
              {matchingResults.map((item, index) => (
                <div key={item.id} className="result-card card">
                  <div className="result-rank">
                    <span className="rank-number">{index + 1}</span>
                  </div>
                  <div className="result-content">
                    <div className="result-header">
                      <h4>{item.name}</h4>
                      <span className="result-category">{item.category}</span>
                    </div>
                    <div className="result-tags">
                      {item.tags.map((tag, idx) => (
                        <span key={idx} className="tag">{tag}</span>
                      ))}
                    </div>
                    <div className="result-scores">
                      <div className="score-item">
                        <span className="score-label">技术成熟度</span>
                        <div className="score-bar">
                          <div
                            className="score-fill"
                            style={{
                              width: `${item.technologyMaturity}%`,
                              background: getScoreColor(item.technologyMaturity)
                            }}
                          ></div>
                        </div>
                        <span className="score-value">{item.technologyMaturity}</span>
                      </div>
                      <div className="score-item">
                        <span className="score-label">市场需求</span>
                        <div className="score-bar">
                          <div
                            className="score-fill"
                            style={{
                              width: `${item.marketUrgency}%`,
                              background: getScoreColor(item.marketUrgency)
                            }}
                          ></div>
                        </div>
                        <span className="score-value">{item.marketUrgency}</span>
                      </div>
                      <div className="score-item">
                        <span className="score-label">政策支持</span>
                        <div className="score-bar">
                          <div
                            className="score-fill"
                            style={{
                              width: `${item.policySupport}%`,
                              background: getScoreColor(item.policySupport)
                            }}
                          ></div>
                        </div>
                        <span className="score-value">{item.policySupport}</span>
                      </div>
                    </div>
                    <div className="result-actions">
                      <button className="btn btn-primary btn-sm">查看详情</button>
                      <button className="btn btn-secondary btn-sm">联系对接</button>
                    </div>
                  </div>
                  <div className="result-score">
                    <div className="score-circle">
                      <span className="score-number">{item.personalizedScore || item.overallScore}</span>
                      <span className="score-text">匹配度</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="im-charts grid grid-2">
            <div className="chart-card card">
              <h3>匹配算法性能趋势</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="accuracy" stroke="#52c41a" name="准确率" />
                  <Line type="monotone" dataKey="recall" stroke="#1890ff" name="召回率" />
                  <Line type="monotone" dataKey="f1" stroke="#faad14" name="F1分数" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card card">
              <h3>用户偏好 vs 最佳匹配</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar name="用户偏好" dataKey="A" stroke="#667eea" fill="#667eea" fillOpacity={0.3} />
                  <Radar name="最佳匹配" dataKey="B" stroke="#52c41a" fill="#52c41a" fillOpacity={0.3} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card card">
              <h3>服务主体分布</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card card">
              <h3>各维度评分对比</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={matchingResults.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="technologyMaturity" name="技术成熟度" fill="#52c41a" />
                  <Bar dataKey="marketUrgency" name="市场需求" fill="#1890ff" />
                  <Bar dataKey="policySupport" name="政策支持" fill="#faad14" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IntelligentMatching
