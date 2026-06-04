import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import './App.css'

interface Collection {
  id: string
  name: string
  words: string[]
  checked: boolean
}

interface HistoryEntry {
  words: string[]
  label: string
}

const STORAGE_KEY = 'word-explorer-collections'

function loadCollections(): Collection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function App() {
  const [seedInput, setSeedInput] = useState('')
  const [currentWords, setCurrentWords] = useState<string[]>([])
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set())
  const [centerWords, setCenterWords] = useState<string[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hoverTimers = useRef<Map<string, number>>(new Map())

  const [manualInput, setManualInput] = useState('')

  const [collections, setCollections] = useState<Collection[]>(loadCollections)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections))
  }, [collections])

  const [article, setArticle] = useState('')
  const [articleLoading, setArticleLoading] = useState(false)
  const [articleMode, setArticleMode] = useState<'article' | 'input'>('article')
  const [textInput, setTextInput] = useState('')
  const [extracting, setExtracting] = useState(false)

  function activeCollectionWords(): string[] {
    return collections.filter((c) => c.checked).flatMap((c) => c.words)
  }

  function allSeedWords(): string[] {
    return [...new Set([...centerWords, ...activeCollectionWords()])]
  }

  async function explore(words: string[]) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setCurrentWords(data.words)
      setSelectedWords(new Set())
    } catch {
      setError('Failed to explore. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  function handleInitialExplore() {
    const trimmed = seedInput.trim()
    if (!trimmed) return
    setCenterWords([trimmed])
    setHistory([])
    setArticle('')
    explore([trimmed])
  }

  function handleContinueExplore() {
    const selected = Array.from(selectedWords)
    if (selected.length === 0) return

    const deduped = [...new Set([...centerWords, ...selected])]
    setHistory([...history, { words: centerWords, label: centerWords.join(', ') }])
    setCenterWords(deduped)
    setArticle('')
    explore(selected)
  }

  function removeCenterWord(word: string) {
    setCenterWords((prev) => prev.filter((w) => w !== word))
  }

  function handleBack(index: number) {
    const entry = history[index]
    setHistory(history.slice(0, index))
    setCenterWords(entry.words)
    setCurrentWords([])
    setSelectedWords(new Set())
    setArticle('')
  }

  function toggleWord(word: string) {
    setSelectedWords((prev) => {
      const next = new Set(prev)
      if (next.has(word)) next.delete(word)
      else next.add(word)
      return next
    })
  }

  function startHoverTimer(word: string) {
    const id = window.setTimeout(() => toggleWord(word), 500)
    hoverTimers.current.set(word, id)
  }

  function clearHoverTimer(word: string) {
    const id = hoverTimers.current.get(word)
    if (id !== undefined) {
      clearTimeout(id)
      hoverTimers.current.delete(word)
    }
  }

  function handleManualAdd() {
    const trimmed = manualInput.trim()
    if (!trimmed) return
    setCenterWords((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
    setManualInput('')
  }

  async function handleGenerate() {
    const seeds = allSeedWords()
    if (seeds.length === 0) return
    setArticleLoading(true)
    setArticle('')
    setArticleMode('article')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: seeds }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setArticle(data.article)
    } catch {
      setError('Failed to generate article')
    } finally {
      setArticleLoading(false)
    }
  }

  async function handleExtract() {
    const txt = textInput.trim()
    if (!txt) return
    setExtracting(true)
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: txt }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      const newWords = data.words.filter((w: string) => !centerWords.includes(w))
      setCenterWords((prev) => [...prev, ...newWords])
      setTextInput('')
    } catch {
      setError('Failed to extract keywords')
    } finally {
      setExtracting(false)
    }
  }

  function saveCollection() {
    if (centerWords.length === 0) return
    const name = `Collection ${collections.length + 1}`
    setCollections([
      ...collections,
      { id: Date.now().toString(), name, words: [...centerWords], checked: false },
    ])
    setCenterWords([])
  }

  function toggleCollection(id: string) {
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
    )
  }

  function deleteCollection(id: string) {
    setCollections((prev) => prev.filter((c) => c.id !== id))
  }

  function renameCollection(id: string, name: string) {
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c))
    )
  }

  function copyArticle() {
    const ta = document.createElement('textarea')
    ta.value = article
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }

  const hasActiveCollections = collections.some((c) => c.checked)

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h2>Collections</h2>
        {centerWords.length > 0 && (
          <button className="save-col-btn" onClick={saveCollection}>
            + Save Center Words
          </button>
        )}
        <div className="collection-list">
          {collections.length === 0 && (
            <p className="empty-hint">No collections yet</p>
          )}
          {collections.map((c) => (
            <div key={c.id} className={`collection-item ${c.checked ? 'active' : ''}`}>
              <label className="collect-label">
                <input
                  type="checkbox"
                  checked={c.checked}
                  onChange={() => toggleCollection(c.id)}
                />
                <input
                  className="collect-name"
                  value={c.name}
                  onChange={(e) => renameCollection(c.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </label>
              <span className="collect-count">{c.words.length}</span>
              <button className="collect-del" onClick={() => deleteCollection(c.id)}>✕</button>
            </div>
          ))}
        </div>
        {hasActiveCollections && (
          <p className="collect-hint">
            Active collections contribute to LLM seeds
          </p>
        )}
      </aside>

      <main className="main">
        <header className="header">
          <h1>Word Explorer</h1>
          <div className="search-bar">
            <input
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInitialExplore()}
              placeholder="Enter a seed word..."
            />
            <button onClick={handleInitialExplore} disabled={loading || !seedInput.trim()}>
              Explore
            </button>
          </div>
        </header>

        {history.length > 0 && (
          <nav className="breadcrumb">
            {history.map((entry, i) => (
              <span key={i}>
                <button className="link" onClick={() => handleBack(i)}>
                  {entry.label}
                </button>
                {i < history.length - 1 && <span className="sep"> → </span>}
              </span>
            ))}
          </nav>
        )}

        {centerWords.length > 0 && (
          <section className="center-zone">
            {centerWords.map((w) => (
              <button key={w} className="center-chip" title="Click to remove" onClick={() => removeCenterWord(w)}>
                {w} ✕
              </button>
            ))}
          </section>
        )}

        <div className="center-tools">
          <div className="manual-add">
            <input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
              placeholder="Type a word to add..."
            />
            <button onClick={handleManualAdd} disabled={!manualInput.trim()}>+ Add</button>
          </div>

          {allSeedWords().length > 0 && (
            <button className="generate-btn" onClick={handleGenerate} disabled={articleLoading}>
              {articleLoading ? 'Writing...' : '✍ Generate Article'}
            </button>
          )}
        </div>

        {error && <div className="error">{error}</div>}
        {loading && <div className="loading">Thinking...</div>}

        {currentWords.length > 0 && !loading && (
          <>
            <section className="word-grid">
              {currentWords.map((word) => (
                <button
                  key={word}
                  className={`word-card ${selectedWords.has(word) ? 'selected' : ''}`}
                  onClick={() => toggleWord(word)}
                  onMouseEnter={() => startHoverTimer(word)}
                  onMouseLeave={() => clearHoverTimer(word)}
                >
                  {word}
                </button>
              ))}
            </section>

            <div className="actions">
              <span className="hint">
                {selectedWords.size === 0
                  ? 'Click words above to select them'
                  : `${selectedWords.size} word${selectedWords.size > 1 ? 's' : ''} selected`}
              </span>
              <button
                className="explore-btn"
                onClick={handleContinueExplore}
                disabled={selectedWords.size === 0}
              >
                Explore Selected →
              </button>
            </div>
          </>
        )}

        {article && (
          <section className="article-panel">
            <div className="article-header">
              <div className="article-tabs">
                <button
                  className={`tab ${articleMode === 'article' ? 'active' : ''}`}
                  onClick={() => setArticleMode('article')}
                >
                  Article
                </button>
                <button
                  className={`tab ${articleMode === 'input' ? 'active' : ''}`}
                  onClick={() => setArticleMode('input')}
                >
                  Text Input
                </button>
              </div>
              <div className="article-header-actions">
                <button className="header-btn" onClick={copyArticle} title="Copy markdown">📋 Copy</button>
                <button className="close-btn" onClick={() => setArticle('')}>✕</button>
              </div>
            </div>

            {articleMode === 'article' ? (
              <div className="article-content markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(article) }} />
            ) : (
              <div className="article-input-area">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste or type any text here, then click Extract Keywords..."
                  rows={8}
                />
                <button
                  className="extract-btn"
                  onClick={handleExtract}
                  disabled={extracting || !textInput.trim()}
                >
                  {extracting ? 'Extracting...' : '🔍 Extract Keywords'}
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default App
