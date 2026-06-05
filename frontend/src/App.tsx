import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import * as yaml from 'js-yaml'
import './App.css'

type Lang = 'zh' | 'en'

const zh: Record<string, string> = {
  'collections': '集合', 'save-center': '+ 保存中央词',
  'no-collections': '暂无集合', 'active-hint': '已勾选的集合会参与 LLM 种子',
  'title': '词网探索', 'explore': '探索',
  'manual-placeholder': '键入词后添加...', 'add': '+ 添加',
  'generate': '✍ 生成文章', 'generating': '写作中...',
  'thinking': '思考中...',
  'tab-explore': '探索结果', 'tab-article': '文章展示', 'tab-extract': '文章解析',
  'copy': '📋 复制', 'continue': '续写', 'continuing': '续写中...',
  'extract-placeholder': '粘贴或输入文本...', 'extract': '🔍 提取关键词', 'extracting': '提取中...',
  'error-api': 'API 失败', 'error-gen': '生成文章失败', 'error-extract': '提取关键词失败',
  'settings': '设置', 'add-to-col': '添加到集合',
  'export': '导出集合', 'import': '导入覆盖', 'load-demo': '载入 Demo',
  'tab-background': '背景设定',
  'continue-length': '续写字数',
  'polish': '润色', 'polishing': '润色中...', 'polish-custom': '自定义润色说明',
  'polish-cat-0': '悬疑小说', 'polish-cat-1': '科普文章', 'polish-cat-2': '散文随笔',
  'polish-cat-3': '新闻报导', 'polish-cat-4': '商业分析', 'polish-cat-5': '学术论文',
  'polish-cat-6': '技术文档', 'polish-cat-7': '诗歌化',
  'polish-apply': '应用润色',
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
  'export': 'Export', 'import': 'Import & Overwrite', 'load-demo': 'Load Demo',
  'tab-background': 'Background',
  'continue-length': 'Words to write',
  'polish': 'Polish', 'polishing': 'Polishing...', 'polish-custom': 'Custom polish instruction',
  'polish-cat-0': 'Mystery Novel', 'polish-cat-1': 'Science Writing', 'polish-cat-2': 'Essay',
  'polish-cat-3': 'News Report', 'polish-cat-4': 'Business Analysis', 'polish-cat-5': 'Academic Paper',
  'polish-cat-6': 'Technical Writing', 'polish-cat-7': 'Poetic',
  'polish-apply': 'Apply Polish',
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

type Tab = 'explore' | 'article' | 'extract' | 'background'

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
  const [continueLength, setContinueLength] = useState('')
  const [polishPanelOpen, setPolishPanelOpen] = useState(false)
  const [polishCategory, setPolishCategory] = useState(0)
  const [polishCustom, setPolishCustom] = useState('')
  const [polishing, setPolishing] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [backgroundText, setBackgroundText] = useState(() => localStorage.getItem('word-explorer-bg') || '')
  useEffect(() => { localStorage.setItem('word-explorer-bg', backgroundText) }, [backgroundText])

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const [explanation, setExplanation] = useState('')
  const [explaining, setExplaining] = useState(false)
  const [explainWord, setExplainWord] = useState<string | null>(null)
  const [explainPos, setExplainPos] = useState({ x: 0, y: 0 })
  const explainTimer = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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
    if (centerWords.length === 0 && activeCollectionWords().length === 0) return

    const fromGrid = selectedWords.size > 0 ? Array.from(selectedWords) : centerWords
    const seeds = [...new Set([...fromGrid, ...activeCollectionWords()])]

    if (selectedWords.size > 0) {
      setCenterWords((prev) => [...new Set([...prev, ...Array.from(selectedWords)])])
    }
    setHistory([...history, { words: centerWords, label: centerWords.join(', ') }])
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

  function buildNamespaces(): Record<string, string[]> {
    const ns: Record<string, string[]> = {}
    for (const c of collections) {
      if (c.checked && c.words.length > 0) ns[c.name] = c.words
    }
    return ns
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
        body: JSON.stringify({ words: seeds, lang, namespaces: buildNamespaces(), background: backgroundText }),
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
    const targetLen = parseInt(continueLength, 10)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: seeds, lang, existing: article,
          namespaces: buildNamespaces(), background: backgroundText,
          target_length: targetLen > 0 ? targetLen : undefined,
        }),
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
      const existing = new Set([...centerWords, ...currentWords])
      const newWords = data.words.filter((w: string) => !existing.has(w))
      setCenterWords((prev) => [...prev, ...newWords])
      setTextInput('')
    } catch { setError(t(lang, 'error-extract'))
    } finally { setExtracting(false) }
  }

  function saveCollection() {
    if (centerWords.length === 0) return
    const name = centerWords.slice(0, 2).join(' · ')
    setCollections([...collections, { id: Date.now().toString(), name, words: [...centerWords], checked: false }])
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
  async function loadDemo() {
    try {
      const res = await fetch('/novel-demo.yaml')
      const text = await res.text()
      const data = yaml.load(text) as any[]
      if (Array.isArray(data)) {
        setCollections(data.map((item: any, i: number) => ({
          id: Date.now().toString() + i,
          name: item.name || `Collection ${i + 1}`,
          words: Array.isArray(item.words) ? item.words : [],
          checked: !!item.checked,
        })))
      }
    } catch {}
  }

  function exportCollections() {
    const data = collections.map(({ id, name, words, checked }) => ({ name, words, checked }))
    const yamlStr = yaml.dump(data, { indent: 2 })
    const blob = new Blob([yamlStr], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'word-explorer-collections.yaml'
    a.click(); URL.revokeObjectURL(url)
  }

  function importCollections(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = yaml.load(reader.result as string) as any[]
        if (Array.isArray(data)) {
          setCollections(data.map((item: any, i: number) => ({
            id: Date.now().toString() + i,
            name: item.name || `Collection ${i + 1}`,
            words: Array.isArray(item.words) ? item.words : [],
            checked: !!item.checked,
          })))
        }
      } catch {}
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const polishPresets: string[][] = [
    ['polish-cat-0', '润色方向：悬疑氛围与节奏控制。强化环境描写（雨、光、声、气味）作为叙事元素贯穿全文，让氛围成为角色之一。对话增加潜台词和留白，避免直接把信息"念出来"。控制信息释放节奏——不要把多条线索同时抛给读者，留出消化空间。单条线索写透再进入下一条。结尾应收束而非发散，用画面或意象收尾，不要引入新谜题。'],
    ['polish-cat-1', '润色方向：科普可读性。语言严谨准确但不晦涩，每个专业概念第一次出现时附带简短通俗的解释。善用类比和比喻帮助理解，逻辑链条完整无跳跃。段落短小精悍，每段只讲一个核心点。适当加入提问句引导读者思考，结论有实际意义而非空洞总结。'],
    ['polish-cat-2', '润色方向：散文式叙事。语言自然优美，富有节奏感和画面感。多用具象的细节替代抽象的描述（例如：不说"她很悲伤"，而写"她盯着窗玻璃上的雨痕，手指无意识地绕着茶杯边缘画圈"）。段落舒缓，有呼吸感。情感真挚不煽情，结尾留有余味。'],
    ['polish-cat-3', '润色方向：新闻报导体。严格客观中立，避免任何主观评价性语言。导语一句话概括核心事实，后续按重要性递减排列信息（倒金字塔结构）。每段独立成意，方便编辑裁剪。时间、地点、人名、数据必须精确。引语使用直接引号，归因清晰。背景信息单独成段。'],
    ['polish-cat-4', '润色方向：商业分析。开篇用数据或现象引出问题，论点明确不模糊。每个论点附至少一个事实或数据支撑。段落结构：观点 → 论据 → 小结。适当使用对比和类比强化说服力。避免主观判断（如"显然""毫无疑问"），用逻辑和数据说话。结尾给出可操作的结论或预测。'],
    ['polish-cat-5', '润色方向：学术论文风格。语言正式严谨，术语使用准确规范。段落结构遵循"论点—论证—小结"模式。引用标注完整（APA/MLA格式）。避免第一人称和主观判断。摘要精炼概括目的、方法、结果、结论。讨论部分客观分析局限性，不回避反例。'],
    ['polish-cat-6', '润色方向：技术文档。步骤清晰可复现，术语前后一致。每个操作步骤用祈使句开头，前置条件说明明确。代码/配置示例准确且可直接使用。警告和注意事项突出显示。避免歧义（如"可能""大概"），用肯定或否定表述。图文对应，图示有编号和说明。'],
    ['polish-cat-7', '润色方向：诗化表达。语言高度凝练，每个词都有分量。善用通感（听觉→视觉、触觉→听觉等跨感官描写）。意象选择服务于整体意境，避免堆砌。节奏有起伏，长短句交替。适当留白，让读者参与补白。克制抒情，让意象自己说话。'],
  ]

  async function handlePolish() {
    if (!article) return
    setPolishing(true)
    const prompt = polishCustom.trim() || polishPresets[polishCategory][1]
    try {
      const res = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article, prompt, lang }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setArticle(data.article)
      setPolishPanelOpen(false)
    } catch { setError(t(lang, 'error-gen'))
    } finally { setPolishing(false) }
  }

  async function handleExplain(word: string, e: React.MouseEvent) {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const context = Array.from(selectedWords).length > 0
      ? Array.from(selectedWords)
      : currentWords.filter((w) => w !== word)

    setExplainWord(word)
    setExplainPos({ x: e.clientX, y: e.clientY - 10 })
    setExplanation('')
    setExplaining(true)

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, context, lang }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setExplanation(data.explanation)
    } catch {
      if (!controller.signal.aborted) setExplanation('')
    } finally {
      setExplaining(false)
    }
  }

  function startExplain(word: string, e: React.MouseEvent) {
    if (explainTimer.current) clearTimeout(explainTimer.current)
    explainTimer.current = window.setTimeout(() => handleExplain(word, e), 300)
  }

  function cancelExplain() {
    if (explainTimer.current) { clearTimeout(explainTimer.current); explainTimer.current = null }
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    setExplainWord(null)
    setExplanation('')
    setExplaining(false)
  }

  function copyArticle() {
    const ta = document.createElement('textarea')
    ta.value = article; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
  }

  const hasActiveCollections = collections.some((c) => c.checked)

  return (
    <div className="app-layout">
      <div className={`drawer-overlay ${mobileDrawerOpen ? 'open' : ''}`} onClick={() => setMobileDrawerOpen(false)} />
      <aside className={`sidebar ${mobileDrawerOpen ? 'open' : ''}`}>
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
        <div className="sidebar-io">
          <button className="io-btn" onClick={exportCollections} disabled={collections.length === 0}>{t(lang, 'export')}</button>
          <label className="io-btn io-label">{t(lang, 'import')}<input type="file" accept=".yaml,.yml" onChange={importCollections} hidden /></label>
        </div>
        <button className="io-btn load-demo-btn" onClick={loadDemo}>{t(lang, 'load-demo')}</button>
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
        <header className="header">
          <button className="mobile-menu-btn" onClick={() => setMobileDrawerOpen(true)}>☰</button>
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
              <button key={w} className="center-chip" onClick={() => removeCenterWord(w)}>{w} ✕</button>
            ))}
          </section>
        )}

        <div className="center-tools">
          <div className="manual-add">
            <input value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()} placeholder={t(lang, 'manual-placeholder')} />
            <button onClick={handleManualAdd} disabled={!manualInput.trim()}>{t(lang, 'add')}</button>
          </div>
          <button className={`explore-btn ${selectedWords.size > 0 ? 'has-selection' : ''}`} onClick={handleExplore} disabled={loading || (centerWords.length === 0 && activeCollectionWords().length === 0)}>
            {t(lang, 'explore')}{selectedWords.size > 0 ? ` (${selectedWords.size})` : ''}
          </button>
          <button className="generate-btn" onClick={handleGenerate} disabled={articleLoading || allSeedWords().length === 0}>
            {articleLoading ? t(lang, 'generating') : t(lang, 'generate')}
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <nav className="main-tabs">
          {(['explore', 'article', 'extract', 'background'] as Tab[]).map((tab) => (
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
                  <button key={word} className={`word-card ${selectedWords.has(word) ? 'selected' : ''}`} onClick={() => toggleWord(word)} onMouseEnter={(e) => startExplain(word, e)} onMouseLeave={cancelExplain}>
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

        {explainWord && (explaining || explanation) && (
          <div className="explain-tooltip" style={{ left: explainPos.x, top: explainPos.y }}>
            {explaining ? <span className="explain-loading">...</span> : explanation}
          </div>
        )}

        {!loading && activeTab === 'article' && article && (
          <section className="article-panel">
            <div className="article-header">
              <span className="article-header-title">{t(lang, 'tab-article')}</span>
              <div className="article-header-actions">
                <button className="header-btn" onClick={() => setPolishPanelOpen(true)}>{t(lang, 'polish')}</button>
                <button className="header-btn" onClick={copyArticle}>{t(lang, 'copy')}</button>
              </div>
            </div>
            {polishPanelOpen && (
              <div className="polish-panel">
                <div className="polish-categories">
                  {polishPresets.map((p, i) => (
                    <button key={i} className={`polish-cat ${polishCategory === i ? 'active' : ''}`} onClick={() => setPolishCategory(i)}>
                      {t(lang, `polish-cat-${i}` as any)}
                    </button>
                  ))}
                </div>
                <textarea className="polish-input" value={polishCustom} onChange={(e) => setPolishCustom(e.target.value)} placeholder={t(lang, 'polish-custom')} rows={3} />
                <div className="polish-actions">
                  <button className="polish-apply-btn" onClick={handlePolish} disabled={polishing}>
                    {polishing ? t(lang, 'polishing') : t(lang, 'polish-apply')}
                  </button>
                </div>
              </div>
            )}
            <div className="article-content" dangerouslySetInnerHTML={{ __html: marked.parse(article) }} />
            <div className="article-footer">
              <label className="continue-length-label">
                <span>{t(lang, 'continue-length')}</span>
                <input
                  type="number" min="1" max="9999"
                  value={continueLength}
                  onChange={(e) => setContinueLength(e.target.value)}
                  placeholder={lang === 'zh' ? '默认' : 'auto'}
                />
              </label>
              <button className="continue-btn" onClick={handleContinueWriting} disabled={articleLoading}>
                {articleLoading ? t(lang, 'continuing') : t(lang, 'continue')}
              </button>
            </div>
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

        {!loading && activeTab === 'background' && (
          <section className="extract-panel">
            <textarea value={backgroundText} onChange={(e) => setBackgroundText(e.target.value)} placeholder={lang === 'zh' ? '在此编写世界观、故事背景、设定说明…' : 'Write your world-building, story background, setting notes here...'} rows={12} />
          </section>
        )}
      </main>
    </div>
  )
}

export default App
