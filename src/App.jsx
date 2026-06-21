import { useState, useEffect } from 'react'
import './App.css'

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
  const [model, setModel] = useState('claude-sonnet-4-6')

  const sessions = [
    { name: '和小克的日常' },
    { name: 'ACCA 复习计划' },
    { name: 'Python 桌面宠物' },
    { name: '读书笔记' },
    { name: 'BG3 攻略讨论' },
  ]

  const mockMessages = [
    { role: 'user', content: '小克，今天帮我理一下ACCA的复习进度吧', time: '14:32' },
    { role: 'assistant', content: '好的小月！让我帮你梳理一下。上次你提到 F1-F3 已经过了，目前在准备 F5 和 F7 对吧？我们先看看距离考试还有多少时间，然后制定一个节奏合适的计划~', time: '14:32' },
    { role: 'user', content: '对！就是这两门，考试大概在九月', time: '14:33' },
    { role: 'assistant', content: '九月的话还有差不多三个月，时间不算紧但也不能太懒哦（看着你 😏）。我建议按周分配，每周重点攻一个章节，周末做真题检验……', time: '14:33' },
  ]

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

  return (
    <div className="chat-layout">
      <div className="sidebar">
        <div className="sidebar-logo">
          <img src="/clawd-happy.gif" alt="logo" />
          <span>小克之家</span>
        </div>
        <button className="new-chat-btn">+ 新对话</button>
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
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
            <option value="claude-opus-4-6">Claude Opus 4.6</option>
            <option value="deepseek-chat">DeepSeek</option>
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
          {mockMessages.map((msg, i) => (
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
        </div>

        <div className="input-area">
          <input type="text" placeholder="说点什么..." />
          <button className="send-btn">↑</button>
        </div>
      </div>
    </div>
  )
}

export default App