import { useEffect, useState } from 'react'
import { marked } from 'marked'
import './App.css'

type Lang = 'zh' | 'en'

const zh: Record<string, string> = {
  'collections': '集合',
  'save-center': '+ 保存中央词',
  'no-collections': '暂无集合',
  'active-hint': '已勾选的集合会参与 LLM 种子',
  'title': '词网探索',
  'explore': '探索',
  'manual-placeholder': '键入词后添加...',
  'add': '+ 添加',
  'generate': '✍ 生成文章',
  'generating': '写作中...',
  'thinking': '思考中...',
  'explore-hint': '点击词卡探索更深关联',
  'article': '文章',
  'text-input': '文本输入',
  'copy': '📋 复制',
  'extract-placeholder': '粘贴或输入文本...',
  'extract': '🔍 提取关键词',
  'extracting': '提取中...',
  'error-api': 'API 失败，后端是否在运行？',
  'error-gen': '生成文章失败',
  'error-extract': '提取关键词失败',
  'settings': '设置',
  'continue': '续写',
  'continuing': '续写中...',
  'add-to-col': '添加到集合',
}

const en: Record<string, string> = {
  'collections': 'Collections',
  'save-center': '+ Save Center Words',
  'no-collections': 'No collections yet',
  'active-hint': 'Active collections contribute to LLM seeds',
  'title': 'Word Explorer',
  'explore': 'Explore',
  'manual-placeholder': 'Type a word to add...',
  'add': '+ Add',
  'generate': '✍ Generate Article',
  'generating': 'Writing...',
  'thinking': 'Thinking...',
  'explore-hint': 'Click a word to explore deeper',
  'article': 'Article',
  'text-input': 'Text Input',
  'copy': '📋 Copy',
  'extract-placeholder': 'Paste or type text...',
  'extract': '🔍 Extract Keywords',
  'extracting': 'Extracting...',
  'error-api': 'Failed to explore. Is the backend running?',
  'error-gen': 'Failed to generate article',
  'error-extract': 'Failed to extract keywords',
  'settings': 'Settings',
  'continue': 'Continue',
  'continuing': 'Continuing...',
  'add-to-col': 'Add to collection',
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

  const [currentWords, setCurrentWords] = useState<string[]>([])
  const [centerWords, setCenterWords] = useState<string[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showSettings, setShowSettings] = useState(false)

  const [manualInput, setManualInput] = useState('')

  const [collections, setCollections] = useState<Collection[]>(loadCollections)
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(collections)) }, [collections])

  const [article, setArticle] = useState('')
  const [articleLoading, setArticleLoading] = useState(false)
  const [articleMode, setArticleMode] = useState<'article' | 'input'>('article')
  const [textInput, setTextInput] = useState('')
  const [extracting, setExtracting] = useState(false)

  const [expandedCol, setExpandedCol] = useState<string | null>(null)
  const [colWordInput, setColWordInput] = useState('')

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
        body: JSON.stringify({ words, lang }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setCurrentWords(data.words)
    } catch {
      setError(t(lang, 'error-api'))
    } finally {
      setLoading(false)
    }
  }

  function handleExplore() {
    if (centerWords.length === 0) return
    setHistory([...history, { words: centerWords, label: centerWords.join(', ') }])
    setArticle('')
    explore(centerWords)
  }

  function handleWordClick(word: string) {
    const deduped = [...new Set([...centerWords, word])]
    setHistory([...history, { words: centerWords, label: centerWords.join(', ') }])
    setCenterWords(deduped)
    setArticle('')
    explore([word])
  }

  function removeCenterWord(word: string) {
    setCenterWords((prev) => prev.filter((w) => w !== word))
  }

  function handleBack(index: number) {
    const entry = history[index]
    setHistory(history.slice(0, index))
    setCenterWords(entry.words)
    setCurrentWords([])
    setArticle('')
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
        body: JSON.stringify({ words: seeds, lang }),
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

  async function handleContinueWriting() {
    const seeds = allSeedWords()
    if (seeds.length === 0 || !article) return
    setArticleLoading(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: seeds, lang, existing: article }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setArticle((prev) => prev + '\n\n' + data.article)
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
        body: JSON.stringify({ text: txt, lang }),
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

  function removeCollectionWord(colId: string, word: string) {
    setCollections((prev) =>
      prev.map((c) => c.id === colId ? { ...c, words: c.words.filter((w) => w !== word) } : c)
    )
  }

  function addCollectionWord(colId: string) {
    const w = colWordInput.trim()
    if (!w) return
    setCollections((prev) =>
      prev.map((c) => c.id === colId && !c.words.includes(w) ? { ...c, words: [...c.words, w] } : c)
    )
    setColWordInput('')
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

  function sidebarContent() {
    return (
      <>
        <div className="sidebar-top">
          <h2>{t(lang, 'collections')}</h2>
          <div className="sidebar-top-actions">
            <button className="settings-toggle" onClick={() => setShowSettings(!showSettings)} title={t(lang, 'settings')}>⚙</button>
            <button className="lang-toggle" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
              {lang === 'zh' ? 'EN' : '中'}
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="settings-panel">
            <label className="setting-row">
              <span>{t(lang, 'settings')}</span>
            </label>
          </div>
        )}

        {centerWords.length > 0 && (
          <button className="save-col-btn" onClick={saveCollection}>{t(lang, 'save-center')}</button>
        )}
        <div className="collection-list">
          {collections.length === 0 && <p className="empty-hint">{t(lang, 'no-collections')}</p>}
          {collections.map((c) => {
            const isExpanded = expandedCol === c.id
            return (
              <div key={c.id}>
                <div className={`collection-item ${c.checked ? 'active' : ''}`}>
                  <label className="collect-label">
                    <input type="checkbox" checked={c.checked} onChange={() => toggleCollection(c.id)} />
                    <input className="collect-name" value={c.name} onChange={(e) => renameCollection(c.id, e.target.value)} onClick={(e) => e.stopPropagation()} />
                  </label>
                  <span className="collect-count">{c.words.length}</span>
                  <button className="collect-expand" onClick={() => setExpandedCol(isExpanded ? null : c.id)}>
                    {isExpanded ? '▾' : '▸'}
                  </button>
                  <button className="collect-del" onClick={() => deleteCollection(c.id)}>✕</button>
                </div>
                {isExpanded && (
                  <div className="collection-words">
                    {c.words.map((w) => (
                      <div key={w} className="collection-word-row">
                        <span>{w}</span>
                        <button onClick={() => removeCollectionWord(c.id, w)}>✕</button>
                      </div>
                    ))}
                    <div className="collection-word-add">
                      <input value={colWordInput} onChange={(e) => setColWordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCollectionWord(c.id)} placeholder={t(lang, 'add-to-col')} />
                      <button onClick={() => addCollectionWord(c.id)} disabled={!colWordInput.trim()}>+</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {hasActiveCollections && <p className="collect-hint">{t(lang, 'active-hint')}</p>}
      </>
    )
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">{sidebarContent()}</aside>

      <main className="main">
        <header className="header">
          <h1>{t(lang, 'title')}</h1>
        </header>

        {history.length > 0 && (
          <nav className="breadcrumb">
            {history.map((entry, i) => (
              <span key={i}>
                <button className="link" onClick={() => handleBack(i)}>{entry.label}</button>
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
            <input value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()} placeholder={t(lang, 'manual-placeholder')} />
            <button onClick={handleManualAdd} disabled={!manualInput.trim()}>{t(lang, 'add')}</button>
          </div>
          <button className="explore-btn" onClick={handleExplore} disabled={loading || centerWords.length === 0}>
            {t(lang, 'explore')}
          </button>
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
                <button key={word} className="word-card" onClick={() => handleWordClick(word)}>
                  {word}
                </button>
              ))}
            </section>

            <div className="actions">
              <span className="hint">{t(lang, 'explore-hint')}</span>
            </div>
          </>
        )}

        {article && (
          <section className="article-panel">
            <div className="article-header">
              <div className="article-tabs">
                <button className={`tab ${articleMode === 'article' ? 'active' : ''}`} onClick={() => setArticleMode('article')}>{t(lang, 'article')}</button>
                <button className={`tab ${articleMode === 'input' ? 'active' : ''}`} onClick={() => setArticleMode('input')}>{t(lang, 'text-input')}</button>
              </div>
              <div className="article-header-actions">
                <button className="header-btn" onClick={handleContinueWriting} disabled={articleLoading}>
                  {articleLoading ? t(lang, 'continuing') : t(lang, 'continue')}
                </button>
                <button className="header-btn" onClick={copyArticle}>{t(lang, 'copy')}</button>
                <button className="close-btn" onClick={() => setArticle('')}>✕</button>
              </div>
            </div>

            {articleMode === 'article' ? (
              <div className="article-content" dangerouslySetInnerHTML={{ __html: marked.parse(article) }} />
            ) : (
              <div className="article-input-area">
                <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder={t(lang, 'extract-placeholder')} rows={8} />
                <button className="extract-btn" onClick={handleExtract} disabled={extracting || !textInput.trim()}>
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
