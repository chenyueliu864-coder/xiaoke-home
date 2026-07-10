import { useState, useEffect, useRef } from 'react'

// 书斋：独立暗色文艺风，不随聊天主题切换
export default function Library({ apiUrl, onBack }) {
  const [view, setView] = useState('shelf') // shelf | reader
  const [books, setBooks] = useState([])
  const [uploading, setUploading] = useState(false)
  const [showPaste, setShowPaste] = useState(false)
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteAuthor, setPasteAuthor] = useState('')
  const [pasteContent, setPasteContent] = useState('')

  // reader state
  const [book, setBook] = useState(null)
  const [chapters, setChapters] = useState([])
  const [chapterIdx, setChapterIdx] = useState(0)
  const [chapterContent, setChapterContent] = useState(null)
  const [showToc, setShowToc] = useState(false)
  const [annotations, setAnnotations] = useState([])
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [selText, setSelText] = useState('')
  const [noteText, setNoteText] = useState('')
  const [annBusy, setAnnBusy] = useState(false)

  // in-book chat
  const [showChat, setShowChat] = useState(false)
  const [chatMsgs, setChatMsgs] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const fileRef = useRef(null)
  const contentRef = useRef(null)

  useEffect(() => { loadBooks() }, [])

  const loadBooks = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/books`)
      const data = await res.json()
      if (Array.isArray(data)) setBooks(data)
    } catch (err) {
      console.error('加载书架失败:', err)
    }
  }

  const uploadEpub = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('epub', file)
      const res = await fetch(`${apiUrl}/api/books/upload`, { method: 'POST', body: form })
      const data = await res.json()
      if (data.id) {
        loadBooks()
      } else {
        alert('上传失败：' + (data.detail || data.error))
      }
    } catch (err) {
      alert('上传失败：' + err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const createText = async () => {
    if (!pasteTitle.trim() || !pasteContent.trim()) return
    try {
      const res = await fetch(`${apiUrl}/api/books/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: pasteTitle.trim(), author: pasteAuthor.trim(), content: pasteContent })
      })
      const data = await res.json()
      if (data.id) {
        setShowPaste(false)
        setPasteTitle(''); setPasteAuthor(''); setPasteContent('')
        loadBooks()
      }
    } catch (err) {
      console.error('创建短篇失败:', err)
    }
  }

  const deleteBook = async (id) => {
    if (!confirm('确定删除这本书吗？')) return
    await fetch(`${apiUrl}/api/books/${id}`, { method: 'DELETE' })
    loadBooks()
  }

  const openBook = async (b) => {
    setBook(b)
    setView('reader')
    setChatMsgs([])
    setShowChat(false)
    try {
      const [tocRes, progRes, annRes] = await Promise.all([
        fetch(`${apiUrl}/api/books/${b.id}/chapters`),
        fetch(`${apiUrl}/api/books/${b.id}/progress`),
        fetch(`${apiUrl}/api/books/${b.id}/annotations`),
      ])
      const toc = await tocRes.json()
      const prog = await progRes.json()
      const anns = await annRes.json()
      setChapters(Array.isArray(toc) ? toc : [])
      setAnnotations(Array.isArray(anns) ? anns : [])
      const idx = prog?.chapter_idx || 0
      setChapterIdx(idx)
      loadChapter(b.id, idx)
    } catch (err) {
      console.error('打开书失败:', err)
    }
  }

  const loadChapter = async (bookId, idx) => {
    setChapterContent(null)
    try {
      const res = await fetch(`${apiUrl}/api/books/${bookId}/chapters/${idx}`)
      const data = await res.json()
      setChapterContent(data.content || '(本章为空)')
      contentRef.current?.scrollTo(0, 0)
    } catch (err) {
      setChapterContent('章节加载失败')
    }
  }

  const goChapter = (idx) => {
    if (idx < 0 || idx >= chapters.length) return
    setChapterIdx(idx)
    setShowToc(false)
    loadChapter(book.id, idx)
    // 保存进度
    fetch(`${apiUrl}/api/books/${book.id}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapter_idx: idx, scroll_pct: 0 })
    }).catch(() => {})
  }

  const onSelect = () => {
    const t = window.getSelection()?.toString().trim() || ''
    setSelText(t.slice(0, 500))
  }

  // fast=true: 立即让小克回（API）；fast=false: 存着等订阅端慢慢回
  const saveAnnotation = async (fast) => {
    if (!selText || annBusy) return
    setAnnBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/books/${book.id}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter_idx: chapterIdx, quote: selText, note: noteText.trim() || null })
      })
      const data = await res.json()
      if (data.id) {
        setAnnotations(prev => [data, ...prev])
        setSelText('')
        setNoteText('')
        window.getSelection()?.removeAllRanges()
        if (fast) {
          setShowAnnotations(true)
          const replyRes = await fetch(`${apiUrl}/api/annotations/${data.id}/reply`, { method: 'POST' })
          const replied = await replyRes.json()
          if (replied.id) {
            setAnnotations(prev => prev.map(a => a.id === replied.id ? replied : a))
          }
        }
      }
    } catch (err) {
      console.error('标注失败:', err)
    } finally {
      setAnnBusy(false)
    }
  }

  // 正文渲染：把本章已划线的句子高亮，点击打开批注面板
  const renderHighlighted = (text) => {
    const quotes = annotations
      .filter(a => a.chapter_idx === chapterIdx && a.quote)
      .map(a => a.quote)
      .sort((a, b) => b.length - a.length)
      .slice(0, 50)
    if (quotes.length === 0) return text
    let segments = [text]
    for (const q of quotes) {
      const next = []
      for (const seg of segments) {
        if (typeof seg !== 'string' || !seg.includes(q)) { next.push(seg); continue }
        const parts = seg.split(q)
        parts.forEach((p, i) => {
          if (p) next.push(p)
          if (i < parts.length - 1) next.push(
            <mark key={`${q.slice(0, 12)}-${i}-${next.length}`} className="ann-mark" onClick={() => setShowAnnotations(true)}>{q}</mark>
          )
        })
      }
      segments = next
    }
    return segments
  }

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const text = chatInput.trim()
    setChatMsgs(prev => [...prev, { role: 'user', content: text }])
    setChatInput('')
    setChatLoading(true)
    try {
      const storageKey = `xiaoke-book-chat-${book.id}`
      const savedSession = localStorage.getItem(storageKey)
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          session_id: savedSession ? Number(savedSession) : undefined,
          context: `《${book.title}》${chapters[chapterIdx]?.title || ''}\n\n${(chapterContent || '').slice(0, 5000)}`
        })
      })
      const data = await res.json()
      if (data.session_id) localStorage.setItem(storageKey, data.session_id)
      setChatMsgs(prev => [...prev, { role: 'assistant', content: data.reply || '……' }])
    } catch (err) {
      setChatMsgs(prev => [...prev, { role: 'assistant', content: '网络出问题了，稍后再试~' }])
    } finally {
      setChatLoading(false)
    }
  }

  // ========== 书架 ==========
  if (view === 'shelf') {
    return (
      <div className="library-page">
        <div className="library-header">
          <button className="library-back" onClick={onBack}>←</button>
          <h2>书 斋</h2>
          <div className="library-actions">
            <button onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? '解析中…' : '上传 epub'}
            </button>
            <button onClick={() => setShowPaste(v => !v)}>粘贴短篇</button>
            <input
              ref={fileRef}
              type="file"
              accept=".epub"
              style={{ display: 'none' }}
              onChange={e => uploadEpub(e.target.files?.[0])}
            />
          </div>
        </div>

        {showPaste && (
          <div className="library-paste">
            <input placeholder="标题" value={pasteTitle} onChange={e => setPasteTitle(e.target.value)} />
            <input placeholder="作者（可空）" value={pasteAuthor} onChange={e => setPasteAuthor(e.target.value)} />
            <textarea placeholder="把文字贴进来……" value={pasteContent} onChange={e => setPasteContent(e.target.value)} />
            <button onClick={createText}>存入书斋</button>
          </div>
        )}

        <div className="bookshelf">
          {books.length === 0 && (
            <div className="library-empty">
              <img src="/decor-cat-books.png" alt="" />
              <p>书架还空着，上传一本 epub 或贴一段文字吧</p>
            </div>
          )}
          {books.map(b => (
            <div
              className="book-spine"
              key={b.id}
              style={{ background: b.cover_color }}
              onClick={() => openBook(b)}
            >
              <span className="book-spine-title">{b.title}</span>
              <span className="book-spine-author">{b.author}</span>
              <button
                className="book-delete"
                onClick={e => { e.stopPropagation(); deleteBook(b.id) }}
              >×</button>
            </div>
          ))}
        </div>
        <img src="/decor-cat-books.png" alt="" className="library-corner" />
      </div>
    )
  }

  // ========== 阅读器 ==========
  return (
    <div className="library-page reader">
      <div className="library-header">
        <button className="library-back" onClick={() => { setView('shelf'); loadBooks() }}>←</button>
        <h2 className="reader-title">{book.title}</h2>
        <div className="library-actions">
          <button onClick={() => setShowToc(v => !v)}>目录</button>
          <button onClick={() => setShowAnnotations(v => !v)}>标注 {annotations.length > 0 && `(${annotations.length})`}</button>
          <button onClick={() => setShowChat(v => !v)}>和小克聊</button>
        </div>
      </div>

      {showToc && (
        <div className="reader-toc">
          {chapters.map(c => (
            <div
              key={c.idx}
              className={`toc-item ${c.idx === chapterIdx ? 'active' : ''}`}
              onClick={() => goChapter(c.idx)}
            >{c.title}</div>
          ))}
        </div>
      )}

      {showAnnotations && (
        <div className="reader-annotations">
          {annotations.length === 0 && <p className="library-muted">选中正文文字即可划线写想法</p>}
          {annotations.map(a => (
            <div className="ann-thread" key={a.id}>
              <blockquote onClick={() => goChapter(a.chapter_idx)}>
                {a.quote}
                <span>· 第 {a.chapter_idx + 1} 章</span>
              </blockquote>
              {a.note && <div className="ann-bubble mine">{a.note}</div>}
              {a.ai_reply
                ? <div className="ann-bubble ai">{a.ai_reply}</div>
                : <div className="ann-pending">🌙 小克还没读到这里</div>}
            </div>
          ))}
        </div>
      )}

      <div className="reader-content" ref={contentRef} onMouseUp={onSelect} onTouchEnd={onSelect}>
        <h3>{chapters[chapterIdx]?.title}</h3>
        {chapterContent === null ? <p className="library-muted">加载中…</p> : <div className="reader-text">{renderHighlighted(chapterContent)}</div>}
        <div className="reader-nav">
          <button disabled={chapterIdx <= 0} onClick={() => goChapter(chapterIdx - 1)}>上一章</button>
          <span>{chapterIdx + 1} / {chapters.length}</span>
          <button disabled={chapterIdx >= chapters.length - 1} onClick={() => goChapter(chapterIdx + 1)}>下一章</button>
        </div>
      </div>

      {selText && (
        <div className="annotate-bar annotate-dialog">
          <span>「{selText.slice(0, 40)}{selText.length > 40 ? '…' : ''}」</span>
          <textarea
            className="annotate-note"
            placeholder="写下你的想法（可空）…"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={2}
          />
          <div className="annotate-actions">
            <button onClick={() => saveAnnotation(true)} disabled={annBusy}>
              {annBusy ? '小克回应中…' : '让小克回 ⚡'}
            </button>
            <button className="slow" onClick={() => saveAnnotation(false)} disabled={annBusy}>
              留给小克 🌙
            </button>
            <button className="cancel" onClick={() => { setSelText(''); setNoteText(''); window.getSelection()?.removeAllRanges() }}>取消</button>
          </div>
        </div>
      )}

      {showChat && (
        <div className="book-chat">
          <div className="book-chat-msgs">
            {chatMsgs.length === 0 && <p className="library-muted">跟小克聊聊这一章吧~</p>}
            {chatMsgs.map((m, i) => (
              <div key={i} className={`book-chat-msg ${m.role}`}>{m.content}</div>
            ))}
            {chatLoading && <div className="book-chat-msg assistant">小克正在思考…</div>}
          </div>
          <div className="book-chat-input">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="聊聊这一章…"
              disabled={chatLoading}
            />
            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>↑</button>
          </div>
        </div>
      )}
    </div>
  )
}
