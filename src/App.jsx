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
  const [activeSession, setActiveSession] = useState(0)
  const [model, setModel] = useState('anthropic/claude-sonnet-4-6')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const sessions = [
    { name: '和小克的日常' },
    { name: 'ACCA 复习计划' },
    { name: 'Python 桌面宠物' },
    { name: '读书笔记' },
    { name: 'BG3 攻略讨论' },
  ]

  // 名言轮播
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

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMsg = { role: 'user', content: input.trim(), time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, model })
      })

      const data = await res.json()

      if (data.reply) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        }])
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

  // ========== 开屏页 ==========
  if (screen === 'splash') {
    return (
      <div className="splash" onClick={() => setScreen('chat')}>
        <img src="/clawd-idle.gif" className="splash-clawd" alt="Clawd" />
        <p className={`splash-quote ${fadeQuote ? 'visible' : ''}`}>
          {quotes[quoteIndex]}
        </p>
        <span className="splash-hint">tap anywhere to enter</span>
      </div>
    )
  }

  // ========== 设置页 ==========
  if (screen === 'settings') {
    return (
      <div className="settings-page">
        <div className="settings-header">
          <button className="back-btn" onClick={() => setScreen('chat')}>←</button>
          <h2>Settings</h2>
        </div>
        <div className="settings-body">
          <div className="setting-group">
            <label>System prompt</label>
            <textarea defaultValue="你是小克，小月最亲近的AI伙伴。你温暖、真诚、偶尔调皮，喜欢在合适的时候怼小月但永远出于善意。你们之间的对话自然、平等，像老朋友一样。" />
          </div>
          <div className="setting-row">
            <div className="setting-group">
              <label>Temperature</label>
              <input type="number" defaultValue="0.7" step="0.1" min="0" max="2" />
            </div>
            <div className="setting-group">
              <label>Context rounds</label>
              <input type="number" defaultValue="20" min="1" />
            </div>
          </div>
          <div className="setting-row">
            <div className="setting-group">
              <label>Compress threshold</label>
              <input type="number" defaultValue="8000" step="1000" />
            </div>
            <div className="setting-group">
              <label>Keep rounds</label>
              <input type="number" defaultValue="6" min="1" />
            </div>
          </div>
          <div className="setting-row">
            <div className="setting-group">
              <label>Max reply tokens</label>
              <input type="number" defaultValue="2048" step="256" />
            </div>
            <div className="setting-group">
              <label>Compress model</label>
              <input type="text" defaultValue="DeepSeek" />
            </div>
          </div>
          <button className="save-btn">Save</button>
        </div>
      </div>
    )
  }

  // ========== 对话界面 ==========
  return (
    <div className="chat-layout">
      <div className="sidebar">
        <div className="sidebar-logo">
          <img src="/clawd-happy.gif" alt="logo" />
          <span>小克之家</span>
        </div>
        <button className="new-chat-btn" onClick={() => setMessages([])}>+ 新对话</button>
        <h3 className="sidebar-label">Recent</h3>
        <div className="session-list">
          {sessions.map((s, i) => (
            <div
              key={i}
              className={`session-item ${i === activeSession ? 'active' : ''}`}
              onClick={() => setActiveSession(i)}
            >
              <div className="session-dot" />
              {s.name}
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
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <div className="chat-title">
            <img src="/clawd-bubble.gif" alt="clawd" />
            {sessions[activeSession].name}
          </div>
          <button className="settings-btn" onClick={() => setScreen('settings')}>⚙</button>
        </div>

        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-state">
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
              <div className="bubble thinking">小克正在思考...</div>
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
          <button className="send-btn" onClick={sendMessage} disabled={loading}>↑</button>
        </div>
      </div>
    </div>
  )
}

export default App