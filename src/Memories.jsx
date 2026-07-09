import { useState, useEffect } from 'react'

// 回忆页：Supabase 压缩摘要瀑布流 + Ombre Brain 记忆桶 + 评论
export default function Memories({ apiUrl, onBack }) {
  const [memories, setMemories] = useState([])
  const [buckets, setBuckets] = useState(null)
  const [dateFilter, setDateFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [comments, setComments] = useState({})
  const [commentInput, setCommentInput] = useState('')
  const [aiCommenting, setAiCommenting] = useState(false)

  useEffect(() => { loadMemories() }, [dateFilter])
  useEffect(() => { loadBuckets() }, [])

  const loadMemories = async () => {
    setLoading(true)
    try {
      const url = dateFilter
        ? `${apiUrl}/api/memories?date=${dateFilter}`
        : `${apiUrl}/api/memories`
      const res = await fetch(url)
      const data = await res.json()
      if (Array.isArray(data)) setMemories(data)
    } catch (err) {
      console.error('加载记忆失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadBuckets = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/memories/buckets`)
      const data = await res.json()
      setBuckets(data)
    } catch (err) {
      console.error('加载记忆桶失败:', err)
    }
  }

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setCommentInput('')
    if (!comments[id]) {
      try {
        const res = await fetch(`${apiUrl}/api/memories/${id}/comments`)
        const data = await res.json()
        setComments(prev => ({ ...prev, [id]: Array.isArray(data) ? data : [] }))
      } catch (err) {
        console.error('加载评论失败:', err)
      }
    }
  }

  const addComment = async (id, ai = false) => {
    if (!ai && !commentInput.trim()) return
    if (ai) setAiCommenting(true)
    try {
      const res = await fetch(`${apiUrl}/api/memories/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ai ? { ai: true } : { content: commentInput.trim() })
      })
      const data = await res.json()
      if (data.id) {
        setComments(prev => ({ ...prev, [id]: [...(prev[id] || []), data] }))
        setCommentInput('')
      }
    } catch (err) {
      console.error('评论失败:', err)
    } finally {
      setAiCommenting(false)
    }
  }

  const fmtDate = (ts) => new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>回忆</h2>
      </div>
      <div className="settings-body memories-body">
        <div className="memories-hero">
          <img src="/decor-moon-wreath.png" alt="" />
          <p>唯有抓住一瞬，如同永恒</p>
        </div>

        <div className="memories-filter">
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          />
          {dateFilter && <button onClick={() => setDateFilter('')}>清除筛选</button>}
        </div>

        {loading && <p className="console-empty">回忆加载中...</p>}
        {!loading && memories.length === 0 && (
          <p className="console-empty">还没有沉淀下来的回忆，多聊聊天就有了~</p>
        )}

        {memories.map(m => (
          <div className="memory-card" key={m.id} onClick={() => toggleExpand(m.id)}>
            <div className="memory-time">{fmtDate(m.timestamp)}</div>
            <div className="memory-summary">{m.summary}</div>
            {expandedId === m.id && (
              <div className="memory-comments" onClick={e => e.stopPropagation()}>
                {(comments[m.id] || []).map(c => (
                  <div className="memory-comment" key={c.id}>
                    <span className={`comment-author ${c.author === '小克' ? 'ai' : ''}`}>{c.author}</span>
                    <span>{c.content}</span>
                  </div>
                ))}
                <div className="memory-comment-input">
                  <input
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    placeholder="写一句留言..."
                    onKeyDown={e => e.key === 'Enter' && addComment(m.id)}
                  />
                  <button onClick={() => addComment(m.id)}>留言</button>
                  <button onClick={() => addComment(m.id, true)} disabled={aiCommenting}>
                    {aiCommenting ? '小克思考中…' : '让小克评论'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="settings-card">
          <div className="settings-card-title">Ombre Brain 深层记忆桶</div>
          {buckets?.raw
            ? <pre className="buckets-raw">{buckets.raw}</pre>
            : <p className="console-empty">{buckets ? '暂时取不到记忆桶数据' : '加载中...'}</p>}
        </div>
      </div>
    </div>
  )
}
