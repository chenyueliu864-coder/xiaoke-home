import { useState, useEffect, useRef } from 'react'
import './App.css'

const API_URL = 'https://xiaoke-server.onrender.com'

const quotes = [
  "Wherever you go, there you are.",
  "We are what we repeatedly do.",
  "The only way out is through.",
  "Not all who wander are lost.",
  "Between stimulus and response, there is a space.",
  "To understand is to perceive patterns.",
  "The mind is not a vessel to be filled, but a fire to be kindled.",
  "What we observe is not nature itself, but nature exposed to our questioning.",
  "The unexamined life is not worth living.",
  "I think, therefore I am.",
]

function App() {
  const [screen, setScreen] = useState('splash')
  const [quoteIndex, setQuoteIndex] = useState(Math.floor(Math.random() * quotes.length))
  const [fadeQuote, setFadeQuote] = useState(true)

  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState('anthropic/claude-sonnet-4-6')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [settings, setSettings] = useState({
    system_prompt: '',
    temperature: 0.7,
    max_context_rounds: 20,
    compress_threshold: 6000,
    compress_keep_rounds: 6,
    max_reply_tokens: 2048,
  })
  const [settingsSaved, setSettingsSaved] = useState(false)

  const [renamingId, setRenamingId] = useState(null)
  const [renameText, setRenameText] = useState('')

  const messagesEndRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setFadeQuote(false)
      setTimeout(() => {
        setQuoteIndex(i => (i + 1) % quotes.length)
        setFadeQuote(true)
      }, 800)
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (screen === 'chat') {
      loadSessions()
      loadSettings()
    }
  }, [screen])

  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId)
    }
  }, [activeSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const loadSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sessions`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setSessions(data)
        if (data.length > 0 && !activeSessionId) {
          setActiveSessionId(data[0].id)
        }
      }
    } catch (err) {
      console.error('加载会话失败:', err)
    }
  }

  const createSession = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '新对话' })
      })
      const data = await res.json()
      if (data.id) {
        setSessions(prev => [data, ...prev])
        setActiveSessionId(data.id)
        setMessages([])
        setSidebarOpen(false)
      }
    } catch (err) {
      console.error('创建会话失败:', err)
    }
  }

  const deleteSession = async (id) => {
    try {
      await fetch(`${API_URL}/api/sessions/${id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== id))
      if (activeSessionId === id) {
        const remaining = sessions.filter(s => s.id !== id)
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id)
        } else {
          setActiveSessionId(null)
          setMessages([])
        }
      }
    } catch (err) {
      console.error('删除会话失败:', err)
    }
  }

  const renameSession = async (id) => {
    if (!renameText.trim()) {
      setRenamingId(null)
      return
    }
    try {
      await fetch(`${API_URL}/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameText.trim() })
      })
      setSessions(prev => prev.map(s => s.id === id ? { ...s, name: renameText.trim() } : s))
      setRenamingId(null)
    } catch (err) {
      console.error('重命名失败:', err)
    }
  }

  const loadMessages = async (sessionId) => {
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}/messages`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setMessages(data.map(m => ({
          role: m.role,
          content: m.content,
          time: new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        })))
      }
    } catch (err) {
      console.error('加载消息失败:', err)
    }
  }

  const loadSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings?session_id=0`)
      const data = await res.json()
      if (data && !data.error) {
        setSettings({
          system_prompt: data.system_prompt || '',
          temperature: data.temperature ?? 0.7,
          max_context_rounds: data.max_context_rounds ?? 20,
          compress_threshold: data.compress_threshold ?? 6000,
          compress_keep_rounds: data.compress_keep_rounds ?? 6,
          max_reply_tokens: data.max_reply_tokens ?? 2048,
        })
      }
    } catch (err) {
      console.error('加载设置失败:', err)
    }
  }

  const saveSettings = async () => {
    try {
      await fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: 0, ...settings })
      })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    } catch (err) {
      console.error('保存设置失败:', err)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMsg = {
      role: 'user',
      content: input.trim(),
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    setMessages(prev => [...prev, userMsg])
    const currentInput = input.trim()
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          model,
          session_id: activeSessionId || undefined
        })
      })

      const data = await res.json()

      if (data.session_id && !activeSessionId) {
        setActiveSessionId(data.session_id)
        loadSessions()
      }

      if (data.reply) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        }])
        loadSessions()
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '抱歉，我暂时无法回复。请稍后再试。',
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        }])
      }
    } catch (err) {
      console.error('发送失败:', err)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '网络连接出现问题，请检查后重试。',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const selectSession = (id) => {
    setActiveSessionId(id)
    setSidebarOpen(false)
  }

  // ========== Splash ==========
  if (screen === 'splash') {
    return (
      <div className="splash" onClick={() => setScreen('chat')}>
        <div className="splash-card">
          <img src="/clawd-idle.gif" className="splash-clawd" alt="Clawd" />
          <p className={`splash-quote ${fadeQuote ? 'visible' : ''}`}>
            {quotes[quoteIndex]}
          </p>
          <span className="splash-hint">tap anywhere to enter</span>
        </div>
      </div>
    )
  }

  // ========== Settings ==========
  if (screen === 'settings') {
    return (
      <div className="settings-page">
        <div className="settings-header">
          <button className="back-btn" onClick={() => setScreen('chat')}>←</button>
          <h2>设置</h2>
        </div>
        <div className="settings-body">
          <div className="settings-card">
            <div className="settings-card-title">提示词</div>
            <div className="setting-group">
              <label>系统提示词</label>
              <textarea
                value={settings.system_prompt}
                onChange={e => setSettings(s => ({ ...s, system_prompt: e.target.value }))}
              />
            </div>
          </div>
          <div className="settings-card">
            <div className="settings-card-title">参数配置</div>
            <div className="setting-row">
              <div className="setting-group">
                <label>温度</label>
                <input
                  type="number"
                  value={settings.temperature}
                  step="0.1" min="0" max="2"
                  onChange={e => setSettings(s => ({ ...s, temperature: parseFloat(e.target.value) }))}
                />
              </div>
              <div className="setting-group">
                <label>上下文轮数</label>
                <input
                  type="number"
                  value={settings.max_context_rounds}
                  min="1"
                  onChange={e => setSettings(s => ({ ...s, max_context_rounds: parseInt(e.target.value) }))}
                />
              </div>
            </div>
            <div className="setting-row">
              <div className="setting-group">
                <label>压缩阈值</label>
                <input
                  type="number"
                  value={settings.compress_threshold}
                  step="1000"
                  onChange={e => setSettings(s => ({ ...s, compress_threshold: parseInt(e.target.value) }))}
                />
              </div>
              <div className="setting-group">
                <label>保留轮数</label>
                <input
                  type="number"
                  value={settings.compress_keep_rounds}
                  min="1"
                  onChange={e => setSettings(s => ({ ...s, compress_keep_rounds: parseInt(e.target.value) }))}
                />
              </div>
            </div>
            <div className="setting-row">
              <div className="setting-group">
                <label>最大回复长度</label>
                <input
                  type="number"
                  value={settings.max_reply_tokens}
                  step="256"
                  onChange={e => setSettings(s => ({ ...s, max_reply_tokens: parseInt(e.target.value) }))}
                />
              </div>
              <div className="setting-group" />
            </div>
          </div>
          <button className="save-btn" onClick={saveSettings}>
            {settingsSaved ? '✓ 已保存' : '保存'}
          </button>
        </div>
      </div>
    )
  }

  // ========== Chat ==========
  const activeSession = sessions.find(s => s.id === activeSessionId)

  return (
    <div className="chat-layout">
      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/clawd-happy.gif" alt="logo" />
          <span>Hearthstone</span>
        </div>
        <button className="new-chat-btn" onClick={createSession}>+ 新对话</button>
        <h3 className="sidebar-label">Recent</h3>
        <div className="session-list">
          {sessions.map(s => (
            <div
              key={s.id}
              className={`session-item ${s.id === activeSessionId ? 'active' : ''}`}
              onClick={() => selectSession(s.id)}
              onDoubleClick={() => { setRenamingId(s.id); setRenameText(s.name) }}
            >
              <div className="session-dot" />
              {renamingId === s.id ? (
                <input
                  className="rename-input"
                  value={renameText}
                  onChange={e => setRenameText(e.target.value)}
                  onBlur={() => renameSession(s.id)}
                  onKeyDown={e => e.key === 'Enter' && renameSession(s.id)}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="session-name">{s.name}</span>
              )}
              <button
                className="delete-btn"
                onClick={e => { e.stopPropagation(); deleteSession(s.id) }}
              >×</button>
            </div>
          ))}
        </div>
        <div className="model-select">
          <label>Model</label>
          <select value={model} onChange={e => setModel(e.target.value)}>
            <option value="anthropic/claude-sonnet-4-6">Claude Sonnet 4.6</option>
            <option value="anthropic/claude-opus-4-6">Claude Opus 4.6</option>
            <option value="deepseek/deepseek-chat">DeepSeek</option>
          </select>
        </div>
        <img src="/decor-cloud.jpg" alt="" className="sidebar-cloud" />
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <div className="chat-title">
            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>☰</button>
            <img src="/clawd-bubble.gif" alt="clawd" />
            {activeSession ? activeSession.name : 'Hearthstone'}
          </div>
          <button className="settings-btn" onClick={() => setScreen('settings')}>⚙</button>
        </div>

        <div className="messages">
          <img src="/decor-moon.jpg" alt="" className="messages-moon" />
          {messages.length === 0 && !loading && (
            <div className="empty-state">
              <img src="/decor-crystal.jpg" alt="" className="empty-crystal" />
              <img src="/clawd-idle.gif" alt="clawd" className="empty-clawd" />
              <p>说点什么吧，小月~</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`msg ${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="ai-avatar">
                  <img src="/clawd-bubble.gif" alt="小克" />
                </div>
              )}
              <div className="bubble">{msg.content}</div>
              <div className="msg-time">{msg.time}</div>
            </div>
          ))}
          {loading && (
            <div className="msg assistant">
              <div className="ai-avatar">
                <img src="/clawd-juggling.gif" alt="思考中" />
              </div>
              <div className="bubble thinking">
                <div className="thinking-wrapper">
                  <img src="/decor-star.jpg" alt="" className="thinking-star" />
                  <span>小克正在思考...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <input
            type="text"
            placeholder="说点什么..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            className={`send-btn ${input.trim() ? 'has-input' : ''}`}
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >↑</button>
        </div>
      </div>
    </div>
  )
}

export default App
