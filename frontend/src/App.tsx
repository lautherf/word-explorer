import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import './App.css'

type Lang = 'zh' | 'en'

const zh: Record<string, string> = {
  'collections': '集合',
  'save-center': '+ 保存中央词',
  'no-collections': '暂无集合',
  'active-hint': '已勾选的集合会参与 LLM 种子',
  'title': '词网探索',
  'seed-placeholder': '输入一个种子词...',
  'explore': '探索',
  'manual-placeholder': '键入词后添加...',
  'add': '+ 添加',
  'generate': '✍ 生成文章',
  'generating': '写作中...',
  'thinking': '思考中...',
  'click-hint': '点击上方词卡选中',
  'selected-hint': '个已选中',
  'explore-selected': '探索选中 →',
  'article': '文章',
  'text-input': '文本输入',
  'copy': '📋 复制',
  'extract-placeholder': '粘贴或输入文本，然后点击提取关键词...',
  'extract': '🔍 提取关键词',
  'extracting': '提取中...',
  'error-api': 'API 失败，后端是否在运行？',
  'error-gen': '生成文章失败',
  'error-extract': '提取关键词失败',
  'hover-tip': '悬停 0.5 秒自动选中',
}

const en: Record<string, string> = {
  'collections': 'Collections',
  'save-center': '+ Save Center Words',
  'no-collections': 'No collections yet',
  'active-hint': 'Active collections contribute to LLM seeds',
  'title': 'Word Explorer',
  'seed-placeholder': 'Enter a seed word...',
  'explore': 'Explore',
  'manual-placeholder': 'Type a word to add...',
  'add': '+ Add',
  'generate': '✍ Generate Article',
  'generating': 'Writing...',
  'thinking': 'Thinking...',
  'click-hint': 'Click words above to select them',
  'selected-hint': 'selected',
  'explore-selected': 'Explore Selected →',
  'article': 'Article',
  'text-input': 'Text Input',
  'copy': '📋 Copy',
  'extract-placeholder': 'Paste or type text, then click Extract Keywords...',
  'extract': '🔍 Extract Keywords',
  'extracting': 'Extracting...',
  'error-api': 'Failed to explore. Is the backend running?',
  'error-gen': 'Failed to generate article',
  'error-extract': 'Failed to extract keywords',
  'hover-tip': 'Hover 0.5s to auto-select',
}

function t(lang: Lang, key: string, ...args: string[]): string {
  const map = lang === 'zh' ? zh : en
  let s = map[key] ?? key
  args.forEach((a, i) => { s = s.replace(`{${i}}`, a) })
  return s
}

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
const LANG_KEY = 'word-explorer-lang'

function loadCollections(): Collection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function loadLang(): Lang {
  const v = localStorage.getItem(LANG_KEY)
  return v === 'zh' || v === 'en' ? v : 'zh'
}

function App() {
  const [lang, setLang] = useState<Lang>(loadLang)
  useEffect(() => { localStorage.setItem(LANG_KEY, lang) }, [lang])

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
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(collections)) }, [collections])

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

  function apiLang(): string {
    const firstWord = [...centerWords, ...seedInput.split(' ')].find(Boolean)
    if (!firstWord) return lang === 'zh' ? 'zh' : 'en'
    return /[\u4e00-\u9fff]/.test(firstWord) ? 'zh' : 'en'
  }

  async function explore(words: string[]) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, lang: apiLang() }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setCurrentWords(data.words)
      setSelectedWords(new Set())
    } catch {
      setError(t(lang, 'error-api'))
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
        body: JSON.stringify({ words: seeds, lang: apiLang() }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setArticle(data.article)
    } catch {
      setError(t(lang, 'error-gen'))
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
        body: JSON.stringify({ text: txt, lang: apiLang() }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      const newWords = data.words.filter((w: string) => !centerWords.includes(w))
      setCenterWords((prev) => [...prev, ...newWords])
      setTextInput('')
    } catch {
      setError(t(lang, 'error-extract'))
    } finally {
      setExtracting(false)
    }
  }

  function saveCollection() {
    if (centerWords.length === 0) return
    const name = `${t(lang, 'collections')} ${collections.length + 1}`
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
        <div className="sidebar-top">
          <h2>{t(lang, 'collections')}</h2>
          <button className="lang-toggle" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
            {lang === 'zh' ? 'EN' : '中'}
          </button>
        </div>
        {centerWords.length > 0 && (
          <button className="save-col-btn" onClick={saveCollection}>
            {t(lang, 'save-center')}
          </button>
        )}
        <div className="collection-list">
          {collections.length === 0 && (
            <p className="empty-hint">{t(lang, 'no-collections')}</p>
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
          <p className="collect-hint">{t(lang, 'active-hint')}</p>
        )}
      </aside>

      <main className="main">
        <header className="header">
          <h1>{t(lang, 'title')}</h1>
          <div className="search-bar">
            <input
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInitialExplore()}
              placeholder={t(lang, 'seed-placeholder')}
            />
            <button onClick={handleInitialExplore} disabled={loading || !seedInput.trim()}>
              {t(lang, 'explore')}
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
              <button key={w} className="center-chip" onClick={() => removeCenterWord(w)}>
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
              placeholder={t(lang, 'manual-placeholder')}
            />
            <button onClick={handleManualAdd} disabled={!manualInput.trim()}>{t(lang, 'add')}</button>
          </div>

          {allSeedWords().length > 0 && (
            <button className="generate-btn" onClick={handleGenerate} disabled={articleLoading}>
              {articleLoading ? t(lang, 'generating') : t(lang, 'generate')}
            </button>
          )}
        </div>

        {error && <div className="error">{error}</div>}
        {loading && <div className="loading">{t(lang, 'thinking')}</div>}

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
                  ? t(lang, 'click-hint')
                  : `${selectedWords.size} ${t(lang, 'selected-hint')}`}
              </span>
              <div className="hover-hint">{t(lang, 'hover-tip')}</div>
              <button
                className="explore-btn"
                onClick={handleContinueExplore}
                disabled={selectedWords.size === 0}
              >
                {t(lang, 'explore-selected')}
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
                  {t(lang, 'article')}
                </button>
                <button
                  className={`tab ${articleMode === 'input' ? 'active' : ''}`}
                  onClick={() => setArticleMode('input')}
                >
                  {t(lang, 'text-input')}
                </button>
              </div>
              <div className="article-header-actions">
                <button className="header-btn" onClick={copyArticle}>{t(lang, 'copy')}</button>
                <button className="close-btn" onClick={() => setArticle('')}>✕</button>
              </div>
            </div>

            {articleMode === 'article' ? (
              <div className="article-content" dangerouslySetInnerHTML={{ __html: marked.parse(article) }} />
            ) : (
              <div className="article-input-area">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={t(lang, 'extract-placeholder')}
                  rows={8}
                />
                <button
                  className="extract-btn"
                  onClick={handleExtract}
                  disabled={extracting || !textInput.trim()}
                >
                  {extracting ? t(lang, 'extracting') : t(lang, 'extract')}
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
