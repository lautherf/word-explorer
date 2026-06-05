import { useEffect, useState } from 'react'
import { marked } from 'marked'
import './App.css'

type Lang = 'zh' | 'en'

const zh: Record<string, string> = {
  'collections': '集合', 'save-center': '+ 保存中央词',
  'no-collections': '暂无集合', 'active-hint': '已勾选的集合会参与 LLM 种子',
  'title': '词网探索', 'explore': '探索',
  'manual-placeholder': '键入词后添加...', 'add': '+ 添加',
  'generate': '✍ 生成文章', 'generating': '写作中...',
  'thinking': '思考中...',
  'tab-explore': '探索结果', 'tab-article': '生成文章', 'tab-extract': '文章解析',
  'copy': '📋 复制', 'continue': '续写', 'continuing': '续写中...',
  'extract-placeholder': '粘贴或输入文本...', 'extract': '🔍 提取关键词', 'extracting': '提取中...',
  'error-api': 'API 失败', 'error-gen': '生成文章失败', 'error-extract': '提取关键词失败',
  'settings': '设置', 'add-to-col': '添加到集合',
  'click-hint': '点击词卡选中，多个选中后点"探索"',
}

const en: Record<string, string> = {
  'collections': 'Collections', 'save-center': '+ Save Center Words',
  'no-collections': 'No collections yet', 'active-hint': 'Active collections contribute to LLM seeds',
  'title': 'Word Explorer', 'explore': 'Explore',
  'manual-placeholder': 'Type a word to add...', 'add': '+ Add',
  'generate': '✍ Generate Article', 'generating': 'Writing...',
  'thinking': 'Thinking...',
  'tab-explore': 'Results', 'tab-article': 'Article', 'tab-extract': 'Extract',
  'copy': '📋 Copy', 'continue': 'Continue', 'continuing': 'Continuing...',
  'extract-placeholder': 'Paste or type text...', 'extract': '🔍 Extract Keywords', 'extracting': 'Extracting...',
  'error-api': 'API error', 'error-gen': 'Failed to generate article', 'error-extract': 'Failed to extract keywords',
  'settings': 'Settings', 'add-to-col': 'Add to collection',
  'click-hint': 'Click words to select, then click "Explore"',
}

function t(lang: Lang, key: string): string {
  const map = lang === 'zh' ? zh : en
  return map[key] ?? key
}

interface Collection { id: string; name: string; words: string[]; checked: boolean }
interface HistoryEntry { words: string[]; label: string }

const STORAGE_KEY = 'word-explorer-collections'
const LANG_KEY = 'word-explorer-lang'

function loadCollections(): Collection[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function loadLang(): Lang {
  const v = localStorage.getItem(LANG_KEY)
  return v === 'zh' || v === 'en' ? v : 'zh'
}

type Tab = 'explore' | 'article' | 'extract'

function App() {
  const [lang, setLang] = useState<Lang>(loadLang)
  useEffect(() => { localStorage.setItem(LANG_KEY, lang) }, [lang])

  const [currentWords, setCurrentWords] = useState<string[]>([])
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set())
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
  const [textInput, setTextInput] = useState('')
  const [extracting, setExtracting] = useState(false)

  const [expandedCol, setExpandedCol] = useState<string | null>(null)
  const [colWordInput, setColWordInput] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('explore')

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
      setSelectedWords(new Set())
      setActiveTab('explore')
    } catch {
      setError(t(lang, 'error-api'))
    } finally { setLoading(false) }
  }

  function handleExplore() {
    if (centerWords.length === 0) return
    const seeds = selectedWords.size > 0 ? Array.from(selectedWords) : centerWords
    const deduped = [...new Set([...centerWords, ...seeds])]
    setHistory([...history, { words: centerWords, label: centerWords.join(', ') }])
    setCenterWords(deduped)
    setArticle('')
    explore(seeds)
  }

  function toggleWord(word: string) {
    setSelectedWords((prev) => {
      const next = new Set(prev)
      if (next.has(word)) next.delete(word); else next.add(word)
      return next
    })
    setCenterWords((prev) => prev.includes(word) ? prev : [...prev, word])
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
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: seeds, lang }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setArticle(data.article)
      setActiveTab('article')
    } catch { setError(t(lang, 'error-gen'))
    } finally { setArticleLoading(false) }
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
    } catch { setError(t(lang, 'error-gen'))
    } finally { setArticleLoading(false) }
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
    } catch { setError(t(lang, 'error-extract'))
    } finally { setExtracting(false) }
  }

  function saveCollection() {
    if (centerWords.length === 0) return
    setCollections([...collections, { id: Date.now().toString(), name: `${t(lang, 'collections')} ${collections.length + 1}`, words: [...centerWords], checked: false }])
    setCenterWords([])
  }
  function toggleCollection(id: string) { setCollections((prev) => prev.map((c) => c.id === id ? { ...c, checked: !c.checked } : c)) }
  function deleteCollection(id: string) { setCollections((prev) => prev.filter((c) => c.id !== id)) }
  function renameCollection(id: string, name: string) { setCollections((prev) => prev.map((c) => c.id === id ? { ...c, name } : c)) }
  function removeCollectionWord(colId: string, word: string) { setCollections((prev) => prev.map((c) => c.id === colId ? { ...c, words: c.words.filter((w) => w !== word) } : c)) }
  function addCollectionWord(colId: string) {
    const w = colWordInput.trim()
    if (!w) return
    setCollections((prev) => prev.map((c) => c.id === colId && !c.words.includes(w) ? { ...c, words: [...c.words, w] } : c))
    setColWordInput('')
  }
  function copyArticle() {
    const ta = document.createElement('textarea')
    ta.value = article; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
  }

  const hasActiveCollections = collections.some((c) => c.checked)

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <h2>{t(lang, 'collections')}</h2>
          <div className="sidebar-top-actions">
            <button className="settings-toggle" onClick={() => setShowSettings(!showSettings)} title={t(lang, 'settings')}>⚙</button>
            <button className="lang-toggle" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>{lang === 'zh' ? 'EN' : '中'}</button>
          </div>
        </div>
        {showSettings && (
          <div className="settings-panel">
            <label className="setting-row"><span>{t(lang, 'settings')}</span></label>
          </div>
        )}
        {centerWords.length > 0 && <button className="save-col-btn" onClick={saveCollection}>{t(lang, 'save-center')}</button>}
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
                  <button className="collect-expand" onClick={() => setExpandedCol(isExpanded ? null : c.id)}>{isExpanded ? '▾' : '▸'}</button>
                  <button className="collect-del" onClick={() => deleteCollection(c.id)}>✕</button>
                </div>
                {isExpanded && (
                  <div className="collection-words">
                    {c.words.map((w) => (
                      <div key={w} className="collection-word-row"><span>{w}</span><button onClick={() => removeCollectionWord(c.id, w)}>✕</button></div>
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
      </aside>

      <main className="main">
        <header className="header"><h1>{t(lang, 'title')}</h1></header>

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
              <button key={w} className="center-chip" onClick={() => removeCenterWord(w)}>{w} ✕</button>
            ))}
          </section>
        )}

        <div className="center-tools">
          <div className="manual-add">
            <input value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()} placeholder={t(lang, 'manual-placeholder')} />
            <button onClick={handleManualAdd} disabled={!manualInput.trim()}>{t(lang, 'add')}</button>
          </div>
          <button className={`explore-btn ${selectedWords.size > 0 ? 'has-selection' : ''}`} onClick={handleExplore} disabled={loading || centerWords.length === 0}>
            {t(lang, 'explore')}{selectedWords.size > 0 ? ` (${selectedWords.size})` : ''}
          </button>
          <button className="generate-btn" onClick={handleGenerate} disabled={articleLoading || allSeedWords().length === 0}>
            {articleLoading ? t(lang, 'generating') : t(lang, 'generate')}
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <nav className="main-tabs">
          {(['explore', 'article', 'extract'] as Tab[]).map((tab) => (
            <button key={tab} className={`main-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {t(lang, `tab-${tab}` as any)}
            </button>
          ))}
        </nav>

        {loading && <div className="loading">{t(lang, 'thinking')}</div>}

        {!loading && activeTab === 'explore' && (
          currentWords.length > 0 ? (
            <>
              <section className="word-grid">
                {currentWords.map((word) => (
                  <button key={word} className={`word-card ${selectedWords.has(word) ? 'selected' : ''}`} onClick={() => toggleWord(word)}>
                    {word}
                  </button>
                ))}
              </section>
              <div className="actions">
                <span className="hint">{t(lang, 'click-hint')}</span>
              </div>
            </>
          ) : (
            <div className="empty-state">{t(lang, 'explore')}</div>
          )
        )}

        {!loading && activeTab === 'article' && article && (
          <section className="article-panel">
            <div className="article-header">
              <span className="article-header-title">{t(lang, 'tab-article')}</span>
              <div className="article-header-actions">
                <button className="header-btn" onClick={handleContinueWriting} disabled={articleLoading}>
                  {articleLoading ? t(lang, 'continuing') : t(lang, 'continue')}
                </button>
                <button className="header-btn" onClick={copyArticle}>{t(lang, 'copy')}</button>
              </div>
            </div>
            <div className="article-content" dangerouslySetInnerHTML={{ __html: marked.parse(article) }} />
          </section>
        )}

        {!loading && activeTab === 'extract' && (
          <section className="extract-panel">
            <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder={t(lang, 'extract-placeholder')} rows={8} />
            <button className="extract-btn" onClick={handleExtract} disabled={extracting || !textInput.trim()}>
              {extracting ? t(lang, 'extracting') : t(lang, 'extract')}
            </button>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
