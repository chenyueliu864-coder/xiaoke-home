import { useState, useEffect, useRef } from 'react'
import Memories from './Memories.jsx'
import Library from './Library.jsx'
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

const THEMES = [
  { id: 'warmnight', label: '暖夜风' },
  { id: 'pearl', label: '珍珠' },
  { id: 'harbor', label: '海港' },
]

// 提取 <think>...</think> 思考块，返回 { think, body }
function splitThink(content) {
  const m = content.match(/^<think>([\s\S]*?)<\/think>\s*/)
  if (m) return { think: m[1].trim(), body: content.slice(m[0].length) }
  return { think: null, body: content }
}

// 逐字渲染动画（前端打字机兜底，后端 SSE 后续再加）
function Typewriter({ text, onDone }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (shown >= text.length) { onDone?.(); return }
    const step = Math.max(1, Math.floor(text.length / 120))
    const t = setTimeout(() => setShown(s => Math.min(text.length, s + step)), 16)
    return () => clearTimeout(t)
  }, [shown, text, onDone])
  return <>{text.slice(0, shown)}</>
}

// 把 [sticker:N] 渲染成表情图片
function renderWithStickers(text, stickerMap) {
  if (!text.includes('[sticker:')) return text
  const parts = text.split(/(\[sticker:\d+\])/)
  return parts.map((p, i) => {
    const m = p.match(/^\[sticker:(\d+)\]$/)
    if (m && stickerMap[m[1]]) {
      return <img key={i} className="sticker-inline" src={stickerMap[m[1]]} alt="表情" />
    }
    return m ? '' : p
  })
}

function MessageBubble({ msg, animate, onAnimDone, stickerMap }) {
  const { think, body } = splitThink(msg.content)
  return (
    <div className="bubble">
      {think && (
        <details className="think-fold">
          <summary>思考过程</summary>
          <div className="think-fold-body">{think}</div>
        </details>
      )}
      {animate
        ? <Typewriter text={body} onDone={onAnimDone} />
        : renderWithStickers(body, stickerMap || {})}
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState('splash')
  const [quoteIndex, setQuoteIndex] = useState(Math.floor(Math.random() * quotes.length))
  const [fadeQuote, setFadeQuote] = useState(true)

  const [theme, setTheme] = useState(() => localStorage.getItem('xiaoke-theme') || 'warmnight')

  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState('anthropic/claude-sonnet-4-6')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [animatingIdx, setAnimatingIdx] = useState(-1)

  const [settings, setSettings] = useState({
    system_prompt: '',
    temperature: 0.7,
    max_context_rounds: 20,
    compress_threshold: 6000,
    compress_keep_rounds: 6,
    max_reply_tokens: 2048,
  })
  const [settingsSaved, setSettingsSaved] = useState(false)

  const [usageStats, setUsageStats] = useState(null)
  const [usageError, setUsageError] = useState(null)

  const [stickers, setStickers] = useState([])
  const [stickerFile, setStickerFile] = useState('')
  const [stickerLabel, setStickerLabel] = useState('')
  const [stickerBusy, setStickerBusy] = useState(false)

  const [renamingId, setRenamingId] = useState(null)
  const [renameText, setRenameText] = useState('')

  const messagesEndRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('xiaoke-theme', theme)
  }, [theme])

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
      loadStickers()
    }
    if (screen === 'console') {
      loadUsageStats()
    }
  }, [screen])

  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId)
    }
  }, [activeSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, animatingIdx])

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
        setAnimatingIdx(-1)
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

  const loadStickers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stickers`)
      const data = await res.json()
      if (Array.isArray(data)) setStickers(data)
    } catch (err) {
      console.error('加载表情包失败:', err)
    }
  }

  const addSticker = async (filename, label) => {
    setStickerBusy(true)
    try {
      const res = await fetch(`${API_URL}/api/stickers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, label: label || undefined })
      })
      const data = await res.json()
      if (data.id) {
        setStickers(prev => [...prev, data])
        setStickerFile('')
        setStickerLabel('')
      }
    } catch (err) {
      console.error('添加表情失败:', err)
    } finally {
      setStickerBusy(false)
    }
  }

  const deleteSticker = async (id) => {
    await fetch(`${API_URL}/api/stickers/${id}`, { method: 'DELETE' })
    setStickers(prev => prev.filter(s => s.id !== id))
  }

  const importClawdStickers = async () => {
    setStickerBusy(true)
    const builtins = [
      ['/clawd-happy.gif', '开心撒花'],
      ['/clawd-bubble.gif', '冒泡打招呼'],
      ['/clawd-juggling.gif', '手忙脚乱'],
      ['/clawd-error.gif', '出错崩溃'],
      ['/clawd-idle-reading.gif', '安静看书'],
      ['/clawd-headphones-groove.gif', '戴耳机摇摆'],
      ['/clawd-conducting.gif', '指挥家模式'],
      ['/clawd-carrying.gif', '努力搬砖'],
    ]
    const existing = new Set(stickers.map(s => s.filename))
    for (const [f, l] of builtins) {
      if (!existing.has(f)) await addSticker(f, l)
    }
    setStickerBusy(false)
  }

  const stickerMap = Object.fromEntries(stickers.map(s => [String(s.id), s.filename]))

  const loadUsageStats = async () => {
    setUsageError(null)
    try {
      const res = await fetch(`${API_URL}/api/usage/stats`)
      const data = await res.json()
      if (data.error) {
        setUsageError(data.detail || data.error)
      } else {
        setUsageStats(data)
      }
    } catch (err) {
      setUsageError(err.message)
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

      const pushReply = (content) => {
        setMessages(prev => {
          setAnimatingIdx(prev.length)
          return [...prev, {
            role: 'assistant',
            content,
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
          }]
        })
      }

      if (data.reply) {
        pushReply(data.reply)
        loadSessions()
      } else {
        pushReply('抱歉，我暂时无法回复。请稍后再试。')
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

  // ========== 回忆 ==========
  if (screen === 'memories') {
    return <Memories apiUrl={API_URL} onBack={() => setScreen('chat')} />
  }

  // ========== 书斋 ==========
  if (screen === 'library') {
    return <Library apiUrl={API_URL} onBack={() => setScreen('chat')} />
  }

  // ========== Console ==========
  if (screen === 'console') {
    const fmt = (n) => n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(n)
    const money = (n) => `$${Number(n).toFixed(4)}`
    const maxCost = usageStats?.sessions?.[0]?.cost_usd || 0
    return (
      <div className="settings-page">
        <div className="settings-header">
          <button className="back-btn" onClick={() => setScreen('chat')}>←</button>
          <h2>Console · 用量统计</h2>
        </div>
        <div className="settings-body">
          {usageError && (
            <div className="settings-card">
              <p className="console-empty">加载失败：{usageError}</p>
            </div>
          )}
          {usageStats && (
            <>
              <div className="console-cards">
                <div className="console-card">
                  <div className="console-card-label">今日花费</div>
                  <div className="console-card-value">{money(usageStats.today.cost_usd)}</div>
                  <div className="console-card-sub">
                    ↑ {fmt(usageStats.today.input_tokens)} tokens · ↓ {fmt(usageStats.today.output_tokens)} tokens<br />
                    {usageStats.today.rounds} 回合
                  </div>
                </div>
                <div className="console-card">
                  <div className="console-card-label">累计花费</div>
                  <div className="console-card-value">{money(usageStats.total.cost_usd)}</div>
                  <div className="console-card-sub">
                    ↑ {fmt(usageStats.total.input_tokens)} tokens · ↓ {fmt(usageStats.total.output_tokens)} tokens<br />
                    {usageStats.total.rounds} 回合
                  </div>
                </div>
              </div>
              <div className="settings-card">
                <div className="settings-card-title">按会话排行</div>
                {usageStats.sessions.length === 0 && (
                  <p className="console-empty">还没有用量记录，去聊两句再来看~</p>
                )}
                {usageStats.sessions.map(s => (
                  <div className="usage-bar-row" key={s.session_id}>
                    <div className="usage-bar-head">
                      <span>{s.name}</span>
                      <span className="cost">{money(s.cost_usd)} · {s.rounds} 回合</span>
                    </div>
                    <div className="usage-bar-track">
                      <div
                        className="usage-bar-fill"
                        style={{ width: maxCost > 0 ? `${(s.cost_usd / maxCost) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {!usageStats && !usageError && <p className="console-empty">加载中...</p>}
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
            <div className="settings-card-title">主题</div>
            <div className="theme-options">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={`theme-option ${theme === t.id ? 'active' : ''}`}
                  onClick={() => setTheme(t.id)}
                >
                  <div className={`theme-swatch ${t.id}`} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
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
          <div className="settings-card">
            <div className="settings-card-title">表情包</div>
            {stickers.length === 0 && (
              <button className="save-btn" onClick={importClawdStickers} disabled={stickerBusy}>
                {stickerBusy ? '导入中…' : '一键导入内置 Clawd 表情'}
              </button>
            )}
            <div className="sticker-grid">
              {stickers.map(s => (
                <div className="sticker-item" key={s.id}>
                  <img src={s.filename} alt={s.label} />
                  <span>{s.label}</span>
                  <button onClick={() => deleteSticker(s.id)}>×</button>
                </div>
              ))}
            </div>
            <div className="sticker-add">
              <input
                placeholder="图片地址（/xx.gif 或 https://…）"
                value={stickerFile}
                onChange={e => setStickerFile(e.target.value)}
              />
              <input
                placeholder="标签（留空自动生成）"
                value={stickerLabel}
                onChange={e => setStickerLabel(e.target.value)}
              />
              <button
                disabled={stickerBusy || !stickerFile.trim()}
                onClick={() => addSticker(stickerFile.trim(), stickerLabel.trim())}
              >{stickerBusy ? '…' : '添加'}</button>
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
        <div className="sidebar-footer">
          <button className="console-link" onClick={() => { setScreen('memories'); setSidebarOpen(false) }}>
            🌙 回忆
          </button>
          <button className="console-link" onClick={() => { setScreen('library'); setSidebarOpen(false) }}>
            📚 书斋
          </button>
          <button className="console-link" onClick={() => { setScreen('console'); setSidebarOpen(false) }}>
            📊 Console 用量
          </button>
          <div className="model-select">
            <label>Model</label>
            <select value={model} onChange={e => setModel(e.target.value)}>
              <option value="anthropic/claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="anthropic/claude-opus-4-6">Claude Opus 4.6</option>
              <option value="deepseek/deepseek-chat">DeepSeek</option>
            </select>
          </div>
        </div>
        <img src="/decor-cloud.png" alt="" className="sidebar-cloud" />
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <div className="chat-title">
            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>☰</button>
            <img src="/clawd-bubble.gif" alt="clawd" />
            {activeSession ? activeSession.name : 'Hearthstone'}
            {loading && <span className="typing-hint">小克正在输入…</span>}
          </div>
          <button className="settings-btn" onClick={() => setScreen('settings')}>⚙</button>
        </div>

        <div className="messages">
          <img src="/decor-moon.png" alt="" className="messages-moon" />
          {messages.length === 0 && !loading && (
            <div className="empty-state">
              <img src="/decor-crystal.png" alt="" className="empty-crystal" />
              <img src="/clawd-idle.gif" alt="clawd" className="empty-clawd" />
              <p>今天想聊什么，小月？</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`msg ${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="ai-avatar">
                  <img src="/clawd-bubble.gif" alt="小克" />
                </div>
              )}
              <MessageBubble
                msg={msg}
                animate={i === animatingIdx}
                onAnimDone={() => setAnimatingIdx(-1)}
                stickerMap={stickerMap}
              />
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
                  <img src="/decor-star.png" alt="" className="thinking-star" />
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
