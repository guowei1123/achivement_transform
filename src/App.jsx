import React from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import KnowledgeGraph from './components/KnowledgeGraph/KnowledgeGraph'
import TechAgent from './components/TechAgent/TechAgent'
import IntelligentMatching from './components/IntelligentMatching/IntelligentMatching'
import PPTGenerator from './components/ppt_generate/PPTGenerator'
import './App.css'

function App() {
  const location = useLocation()

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <h1>科技服务知识图谱系统</h1>
              <p className="subtitle">Technology Service Knowledge Graph System</p>
            </div>
            <nav className="nav">
              <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
                首页
              </Link>
              <Link to="/knowledge-graph" className={`nav-link ${location.pathname === '/knowledge-graph' ? 'active' : ''}`}>
                知识图谱
              </Link>
              <Link to="/tech-agent" className={`nav-link ${location.pathname === '/tech-agent' ? 'active' : ''}`}>
                AI智能体
              </Link>
              <Link to="/intelligent-matching" className={`nav-link ${location.pathname === '/intelligent-matching' ? 'active' : ''}`}>
                智能匹配
              </Link>
              <Link to="/ppt_generate" className={`nav-link ${location.pathname === '/ppt_generate' ? 'active' : ''}`}>
                PPT生成
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/knowledge-graph" element={<KnowledgeGraph />} />
            <Route path="/tech-agent" element={<TechAgent />} />
            <Route path="/intelligent-matching" element={<IntelligentMatching />} />
            <Route path="/ppt_generate" element={<PPTGenerator />} />
          </Routes>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>&copy; 2024 科技服务知识图谱系统. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

function Home() {
  return (
    <div className="home">
      <div className="hero">
        <h2>科技服务知识图谱动态构建与智能匹配系统</h2>
        <p>基于AI大模型和知识图谱的科技服务智能平台</p>
        <div className="hero-buttons">
          <Link to="/knowledge-graph" className="btn btn-primary">开始使用</Link>
          <Link to="/tech-agent" className="btn btn-secondary">体验AI智能体</Link>
        </div>
      </div>

      <div className="features grid grid-3">
        <div className="feature-card card">
          <div className="feature-icon">📊</div>
          <h3>知识图谱构建</h3>
          <p>多模态知识抽取，构建"主体-资源-场景"三元组关系，实现科技服务要素的自动化提取</p>
        </div>
        <div className="feature-card card">
          <div className="feature-icon">🤖</div>
          <h3>AI智能体</h3>
          <p>基于DeepSeek等大模型，支持多轮对话、任务分解与动态规划，实现科技服务智能问答</p>
        </div>
        <div className="feature-card card">
          <div className="feature-icon">🎯</div>
          <h3>智能匹配推荐</h3>
          <p>图神经网络与排序学习融合，构建技术-产业-市场多维匹配网络，实现精准推荐</p>
        </div>
      </div>

      <div className="stats grid grid-4">
        <div className="stat-card card text-center">
          <div className="stat-number">10,000+</div>
          <div className="stat-label">科技资源</div>
        </div>
        <div className="stat-card card text-center">
          <div className="stat-number">5,000+</div>
          <div className="stat-label">服务主体</div>
        </div>
        <div className="stat-card card text-center">
          <div className="stat-number">95%</div>
          <div className="stat-label">匹配准确率</div>
        </div>
        <div className="stat-card card text-center">
          <div className="stat-number">24/7</div>
          <div className="stat-label">智能服务</div>
        </div>
      </div>
    </div>
  )
}

export default App
