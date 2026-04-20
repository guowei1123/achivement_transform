import React, { useState } from 'react'
import { api } from '../../utils/api'
import './PPTGenerator.css'

const PPTGenerator = ({ onClose }) => {
  const isModal = !!onClose
  const [templateName, setTemplateName] = useState('模板')
  const [loading, setLoading] = useState(false)
  const [pptUrl, setPptUrl] = useState('')
  const [formData, setFormData] = useState({
    technical_name: '',
    technical_type: '',
    technical_principle_title: '',
    technical_principle_content: '',
    technical_feature_title: '',
    technical_feature_content: '',
    technical_application_title: '',
    technical_application_content: ''
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleGeneratePPT = async () => {
    if (!templateName.trim()) {
      alert('请输入模板名称')
      return
    }

    try {
      setLoading(true)
      const data = await api.generatePPTFromTemplate(templateName, formData)
      
      if (data.success) {
        setPptUrl(data.data.ppt_url)
        alert('PPT生成成功！')
      } else {
        alert('生成PPT失败：' + (data.error || '未知错误'))
      }
    } catch (error) {
      console.error('生成PPT失败:', error)
      alert('生成PPT失败：' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPPT = () => {
    if (!pptUrl) {
      alert('PPT文件URL不存在')
      return
    }
    
    const link = document.createElement('a')
    link.href = pptUrl
    link.download = `生成PPT-${templateName}-${Date.now()}.pptx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="ppt-generator">
      <div className="ppt-generator-header">
        <h2>PPT模板生成器</h2>
        {isModal && (
          <button className="btn btn-secondary" onClick={onClose}>
            关闭
          </button>
        )}
      </div>

      <div className="ppt-generator-content">
        <div className="form-section">
          <h3>模板信息</h3>
          <div className="form-group">
            <label>模板名称：</label>
            <input
              type="text"
              name="templateName"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="请输入模板名称（如：模板）"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>替换数据</h3>
          
          <div className="slide-section">
            <h4>技术名称</h4>
            <div className="form-group">
              <label>技术名称：</label>
              <input
                type="text"
                name="technical_name"
                value={formData.technical_name}
                onChange={handleInputChange}
                placeholder="请输入技术名称"
              />
            </div>
          </div>
                    <div className="slide-section">
            <h4>技术类型</h4>
            <div className="form-group">
              <label>技术类型：</label>
              <input
                type="text"
                name="technical_type"
                value={formData.technical_type}
                onChange={handleInputChange}
                placeholder="请输入技术类型"
              />
            </div>
          </div>
          <div className="slide-section">
            <h4>第一页：技术原理</h4>
            <div className="form-group">
              <label>标题：</label>
              <input
                type="text"
                name="technical_principle_title"
                value={formData.technical_principle_title}
                onChange={handleInputChange}
                placeholder="请输入技术原理标题"
              />
            </div>

            <div className="form-group">
              <label>内容：</label>
              <textarea
                name="technical_principle_content"
                value={formData.technical_principle_content}
                onChange={handleInputChange}
                placeholder="请输入技术原理内容"
                rows="4"
              />
            </div>
          </div>

          <div className="slide-section">
            <h4>第二页：技术特点</h4>
            <div className="form-group">
              <label>标题：</label>
              <input
                type="text"
                name="technical_feature_title"
                value={formData.technical_feature_title}
                onChange={handleInputChange}
                placeholder="请输入技术特点标题"
              />
            </div>

            <div className="form-group">
              <label>内容：</label>
              <textarea
                name="technical_feature_content"
                value={formData.technical_feature_content}
                onChange={handleInputChange}
                placeholder="请输入技术特点内容"
                rows="4"
              />
            </div>
          </div>

          <div className="slide-section">
            <h4>第三页：前期成果与应用</h4>
            <div className="form-group">
              <label>标题：</label>
              <input
                type="text"
                name="technical_application_title"
                value={formData.technical_application_title}
                onChange={handleInputChange}
                placeholder="请输入前期成果与应用标题"
              />
            </div>

            <div className="form-group">
              <label>内容：</label>
              <textarea
                name="technical_application_content"
                value={formData.technical_application_content}
                onChange={handleInputChange}
                placeholder="请输入前期成果与应用内容"
                rows="4"
              />
            </div>
          </div>
        </div>

        <div className="ppt-generator-actions">
          <button
            className="btn btn-primary"
            onClick={handleGeneratePPT}
            disabled={loading}
          >
            {loading ? '生成中...' : '生成PPT'}
          </button>
          
          {pptUrl && (
            <button
              className="btn btn-success"
              onClick={handleDownloadPPT}
            >
              下载PPT
            </button>
          )}
        </div>

        {pptUrl && (
          <div className="ppt-success-message">
            <div className="ppt-success-icon">✓</div>
            <div className="ppt-success-text">PPT生成成功！</div>
            <div className="ppt-success-description">
              基于模板"{templateName}"生成的PPT已准备就绪，您可以下载查看。
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PPTGenerator
