import React, { useState, useRef, useEffect } from 'react'
import './PPTGenerator.css'

const API_BASE = 'http://localhost:3002/api'

const getMdContent = (content) => {
  const regex = /```markdown([^```]*)```/
  const match = content.match(regex)
  if (match) return match[1].trim()
  return content.replace('```markdown', '').replace('```', '')
}

const PPTGenerator = ({ onClose }) => {
  const isModal = !!onClose
  const [step, setStep] = useState('upload')
  const [uploadedFile, setUploadedFile] = useState(null)
  const [extractedContent, setExtractedContent] = useState({ background: '', features: '', achievements: '', outline: '', aipptSessionId: '', structuredContent: null })
  const [extracting, setExtracting] = useState(false)
  const [pptTitle, setPptTitle] = useState('')
  const [outline, setOutline] = useState('')
  const [outlineCreating, setOutlineCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState('')
  const [generatedSlides, setGeneratedSlides] = useState([])
  const [downloadUrl, setDownloadUrl] = useState('')
  const [slideCount, setSlideCount] = useState(0)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const outlineDisplayRef = useRef(null)

  useEffect(() => {
    if (outlineDisplayRef.current && outlineCreating) {
      outlineDisplayRef.current.scrollTop = outlineDisplayRef.current.scrollHeight
    }
  }, [outline, outlineCreating])

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const ext = file.name.split('.').pop().toLowerCase()
    if (!['docx', 'doc', 'pdf', 'pptx', 'ppt', 'txt'].includes(ext)) {
      setError('只支持 .docx, .doc, .pdf, .pptx, .ppt, .txt 文件')
      return
    }

    setUploadedFile(file)
    setExtracting(true)
    setError('')
    setExtractedContent({ background: '', features: '', achievements: '', outline: '', aipptSessionId: '', structuredContent: null })

    try {
      const formData = new FormData()
      formData.append('document', file)

      const response = await fetch(`${API_BASE}/aippt/extract-content`, {
        method: 'POST',
        body: formData,
      })

      const responseText = await response.text()
      let result
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        throw new Error(response.ok ? '后端返回格式异常' : `后端请求失败：HTTP ${response.status}`)
      }

      if (result.success) {
        const generatedOutline = result.data.outline || ''
        setExtractedContent({
          background: result.data.background || '',
          features: result.data.features || '',
          achievements: result.data.achievements || '',
          outline: generatedOutline,
          aipptSessionId: result.data.aipptSessionId || '',
          structuredContent: result.data.structuredContent || null,
        })
        const titleFromName = result.data.title || file.name.replace(/\.[^.]+$/, '')
        setPptTitle(titleFromName)
        if (generatedOutline) {
          const cleaned = getMdContent(generatedOutline)
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<think[\s\S]*?<\/think>/g, '')
          setOutline(cleaned)
          setStep('outline')
        } else {
          setStep('extract')
        }
      } else {
        setError(result.error || '提取内容失败')
      }
    } catch (err) {
      setError('提取内容失败：' + (err.message || '网络错误'))
    } finally {
      setExtracting(false)
      e.target.value = ''
    }
  }

  const handleExtractUpdate = (field, value) => {
    setExtractedContent(prev => ({ ...prev, [field]: value }))
  }

  const generateOutline = async () => {
    if (!extractedContent.background && !extractedContent.features && !extractedContent.achievements) {
      setError('请至少填写一项内容')
      return
    }
    setError('')
    setOutline('')
    setOutlineCreating(true)
    setStep('outline')

    try {
      const response = await fetch(`${API_BASE}/aippt/generate-outline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          background: extractedContent.background,
          features: extractedContent.features,
          achievements: extractedContent.achievements,
          outline: extractedContent.outline,
          title: pptTitle,
        }),
      })

      const result = await response.json()

      if (result.success) {
        const cleaned = getMdContent(result.data.outline)
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<think[\s\S]*?<\/think>/g, '')
        setOutline(cleaned)
      } else {
        setError(result.error || '生成大纲失败')
        setStep('extract')
      }
    } catch (err) {
      setError('生成大纲失败：' + (err.message || '网络错误'))
      setStep('extract')
    } finally {
      setOutlineCreating(false)
    }
  }

  const createPPT = async () => {
    if (!outline.trim()) return
    setLoading(true)
    setError('')
    setGeneratedSlides([])
    setDownloadUrl('')
    setSlideCount(0)
    setGeneratingProgress('正在分析大纲并生成PPT内容...')

    try {
      const response = await fetch(`${API_BASE}/aippt/generate-ppt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outline: outline,
          templateId: 'system_default_tech',
          title: pptTitle,
          aipptSessionId: extractedContent.aipptSessionId,
          structuredContent: extractedContent.structuredContent,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setGeneratedSlides(result.data.slides || [])
        setSlideCount(result.data.slideCount || 0)
        setDownloadUrl(result.data.downloadUrl || '')
        setLoading(false)
        setGeneratingProgress('')
        setStep('result')
      } else {
        setError(result.error || '生成PPT失败')
        setLoading(false)
        setGeneratingProgress('')
      }
    } catch (err) {
      console.error('生成PPT失败:', err)
      setError('生成PPT失败：' + (err.message || '网络错误'))
      setLoading(false)
      setGeneratingProgress('')
    }
  }

  const resetToUpload = () => {
    setUploadedFile(null)
    setExtractedContent({ background: '', features: '', achievements: '', outline: '', aipptSessionId: '', structuredContent: null })
    setPptTitle('')
    setOutline('')
    setGeneratedSlides([])
    setDownloadUrl('')
    setSlideCount(0)
    setError('')
    setStep('upload')
  }

  const resetToExtract = () => {
    setOutline('')
    setGeneratedSlides([])
    setDownloadUrl('')
    setError('')
    setStep('extract')
  }

  const resetToOutline = () => {
    setGeneratedSlides([])
    setDownloadUrl('')
    setError('')
    setStep('outline')
  }

  const downloadPPTX = () => {
    if (!downloadUrl) return
    setDownloading(true)
    try {
      const fileName = decodeURIComponent(downloadUrl.split('/').pop() || '')
      if (!fileName) {
        throw new Error('下载文件名为空')
      }
      const downloadEndpoint = `${API_BASE}/aippt/download/${encodeURIComponent(fileName)}`
      const link = document.createElement('a')
      link.href = downloadEndpoint
      link.download = `${(pptTitle || '技术成果汇报').replace(/[<>:"/\\|?*]/g, '_')}.pptx`
      link.target = '_self'
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('下载PPT失败:', err)
      setError('下载PPT失败：' + (err.message || '未知错误'))
    } finally {
      setTimeout(() => setDownloading(false), 800)
    }
  }

  const renderStepIndicator = () => {
    const steps = [
      { key: 'upload', label: '上传文档', num: 1 },
      { key: 'extract', label: '提取内容', num: 2 },
      { key: 'outline', label: '生成大纲', num: 3 },
      { key: 'result', label: '生成PPT', num: 4 },
    ]
    const currentIdx = steps.findIndex(s => s.key === step)

    return (
      <div className="ppt-step-indicator">
        {steps.map((s, idx) => (
          <React.Fragment key={s.key}>
            <div className={`ppt-step-item ${idx <= currentIdx ? 'active' : ''} ${idx === currentIdx ? 'current' : ''}`}>
              <div className="ppt-step-dot">{idx < currentIdx ? '✓' : s.num}</div>
              <span className="ppt-step-label">{s.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`ppt-step-connector ${idx < currentIdx ? 'active' : ''}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }

  const renderUploadStep = () => (
    <div className="ppt-upload-section">
      <div className="ppt-section-title">上传技术成果文档</div>
      <div className="ppt-upload-desc">
        上传包含技术成果内容的文档，AI将自动提取技术需求背景、技术特点和技术前期应用成果
      </div>

      <div
        className="ppt-doc-upload-area"
        onClick={() => !extracting && document.getElementById('ppt-doc-upload').click()}
      >
        {extracting ? (
          <div className="ppt-doc-uploading">
            <div className="ppt-gen-dots">
              <span></span><span></span><span></span>
            </div>
            <span className="ppt-gen-text">AI正在提取文档内容...</span>
          </div>
        ) : (
          <>
            <div className="ppt-doc-upload-icon">📄</div>
            <div className="ppt-doc-upload-text">点击上传文档</div>
            <div className="ppt-doc-upload-hint">支持 .docx .doc .pdf .pptx .ppt .txt 格式</div>
          </>
        )}
        <input
          id="ppt-doc-upload"
          type="file"
          accept=".docx,.doc,.pdf,.pptx,.ppt,.txt"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
      </div>

      {uploadedFile && !extracting && (
        <div className="ppt-uploaded-file-info">
          <span className="ppt-file-icon">📎</span>
          <span className="ppt-file-name">{uploadedFile.name}</span>
          <button className="ppt-btn ppt-btn-sm ppt-btn-secondary" onClick={resetToUpload}>重新上传</button>
        </div>
      )}
    </div>
  )

  const renderExtractStep = () => (
    <div className="ppt-extract-section">
      <div className="ppt-section-title">AI提取内容</div>
      <div className="ppt-extract-desc">
        以下是从文档中自动提取的内容，您可以编辑修改后再生成大纲
      </div>

      <div className="ppt-title-input">
        <label>PPT标题：</label>
        <input
          type="text"
          value={pptTitle}
          onChange={(e) => setPptTitle(e.target.value)}
          placeholder="请输入PPT标题"
          className="ppt-input"
        />
      </div>

      <div className="ppt-extract-fields">
        <div className="ppt-extract-field">
          <div className="ppt-extract-field-header">
            <span className="ppt-extract-field-icon">📋</span>
            <span className="ppt-extract-field-title">技术需求背景</span>
          </div>
          <textarea
            value={extractedContent.background}
            onChange={(e) => handleExtractUpdate('background', e.target.value)}
            placeholder="该技术要解决什么问题？行业现状如何？为什么需要这项技术？"
            rows={5}
            className="ppt-textarea"
          />
        </div>

        <div className="ppt-extract-field">
          <div className="ppt-extract-field-header">
            <span className="ppt-extract-field-icon">💡</span>
            <span className="ppt-extract-field-title">技术特点</span>
          </div>
          <textarea
            value={extractedContent.features}
            onChange={(e) => handleExtractUpdate('features', e.target.value)}
            placeholder="该技术的核心创新点是什么？有哪些关键技术特征？与现有技术相比有什么优势？"
            rows={5}
            className="ppt-textarea"
          />
        </div>

        <div className="ppt-extract-field">
          <div className="ppt-extract-field-header">
            <span className="ppt-extract-field-icon">🏆</span>
            <span className="ppt-extract-field-title">技术前期应用成果</span>
          </div>
          <textarea
            value={extractedContent.achievements}
            onChange={(e) => handleExtractUpdate('achievements', e.target.value)}
            placeholder="该技术已经在哪些领域或场景中得到了应用？取得了什么效果？有哪些数据或案例支撑？"
            rows={5}
            className="ppt-textarea"
          />
        </div>
      </div>

      <div className="ppt-extract-actions">
        <button className="ppt-btn ppt-btn-secondary" onClick={resetToUpload}>
          重新上传
        </button>
        <button
          className="ppt-btn ppt-btn-primary"
          onClick={generateOutline}
          disabled={!extractedContent.background && !extractedContent.features && !extractedContent.achievements}
        >
          <span className="ppt-btn-icon">✨</span>
          生成大纲
        </button>
      </div>
    </div>
  )

  const renderOutlineStep = () => (
    <div className="ppt-outline-section">
      <div className="ppt-outline-header">
        <div className="ppt-section-title">内容大纲</div>
        {!outlineCreating && <div className="ppt-outline-hint">可编辑大纲内容</div>}
      </div>

      <div className="ppt-outline-container">
        {outlineCreating ? (
          <div className="ppt-outline-generating">
            <div className="ppt-gen-indicator">
              <div className="ppt-gen-dots">
                <span></span><span></span><span></span>
              </div>
              <span className="ppt-gen-text">AI正在生成大纲</span>
            </div>
            <pre ref={outlineDisplayRef} className="ppt-outline-display">{outline}</pre>
          </div>
        ) : (
          <textarea
            className="ppt-outline-editor"
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
          />
        )}
      </div>

      {!outlineCreating && (
        <div className="ppt-outline-actions">
          <button className="ppt-btn ppt-btn-secondary" onClick={resetToExtract}>
            返回编辑
          </button>
          <button className="ppt-btn ppt-btn-primary" onClick={createPPT}>
            生成PPT
          </button>
        </div>
      )}
    </div>
  )

  const renderResultStep = () => (
    <div className="ppt-result-section">
      <div className="ppt-result-success">
        <div className="ppt-result-icon">✓</div>
        <div className="ppt-result-title">PPT生成完成！</div>
        <div className="ppt-result-desc">
          已成功生成 {slideCount || generatedSlides.length} 页幻灯片
        </div>
      </div>

      {generatedSlides.length > 0 && (
        <div className="ppt-slides-preview">
          <div className="ppt-section-title">幻灯片预览</div>
          <div className="ppt-slides-list">
            {generatedSlides.map((slide, idx) => (
              <div key={idx} className="ppt-slide-preview-item">
                <div className="ppt-slide-num">{idx + 1}</div>
                <div className="ppt-slide-info">
                  {slide.type === 'cover' && (
                    <span>封面: {slide.title || '无标题'}</span>
                  )}
                  {slide.type === 'contents' && (
                    <span>目录 ({slide.items?.length || 0}项)</span>
                  )}
                  {slide.type === 'transition' && (
                    <span>过渡页: {slide.title || ''}</span>
                  )}
                  {slide.type === 'content' && (
                    <span>内容页: {slide.title || ''}</span>
                  )}
                  {slide.type === 'end' && (
                    <span>结束页</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ppt-result-actions">
        <button
          className="ppt-btn ppt-btn-primary"
          onClick={downloadPPTX}
          disabled={downloading || !downloadUrl}
        >
          {downloading ? '正在下载...' : '下载PPT文件'}
        </button>
        <button className="ppt-btn ppt-btn-secondary" onClick={resetToUpload}>
          重新生成
        </button>
      </div>
    </div>
  )

  return (
    <div className="ppt-generator">
      <div className="ppt-generator-header">
        <h2>技术成果PPT生成器</h2>
        {isModal && (
          <button className="ppt-btn ppt-btn-secondary" onClick={onClose}>
            关闭
          </button>
        )}
      </div>

      {renderStepIndicator()}

      {error && <div className="ppt-error-message">{error}</div>}

      {step === 'upload' && renderUploadStep()}
      {step === 'extract' && renderExtractStep()}
      {step === 'outline' && renderOutlineStep()}
      {step === 'result' && renderResultStep()}
    </div>
  )
}

export default PPTGenerator
