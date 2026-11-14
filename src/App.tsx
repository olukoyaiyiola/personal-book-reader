import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { BookOpen, Upload, Play, Pause, Square, ChevronLeft, ChevronRight, Settings2, Headphones, Trash2 } from 'lucide-react'
import './App.css'

GlobalWorkerOptions.workerSrc = workerUrl
type Book = { id: string; name: string; pages: string[]; page: number; added: number }
const KEY = 'clearvoice-reader-books-v1'
function loadBooks(): Book[] { try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Book[] } catch { return [] } }
function App() {
  const [books, setBooks] = useState<Book[]>(loadBooks)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [size, setSize] = useState(19)
  const [rate, setRate] = useState(1)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voice, setVoice] = useState('')
  const [playing, setPlaying] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const current = books.find(b => b.id === activeId)
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(books)) }, [books])
  useEffect(() => {
    const refresh = () => setVoices(window.speechSynthesis?.getVoices() || [])
    refresh()
    window.speechSynthesis?.addEventListener('voiceschanged', refresh)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', refresh)
  }, [])
  const stop = () => { window.speechSynthesis?.cancel(); setPlaying(false) }
  useEffect(() => () => window.speechSynthesis?.cancel(), [])
  async function importPdf(file: File) {
    setError(''); setBusy(true)
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      const pdf = await getDocument({ data }).promise
      const pages: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const p = await pdf.getPage(i)
        const content = await p.getTextContent()
        pages.push(content.items.map(item => 'str' in item ? String(item.str) : '').join(' ').trim())
      }
      if (!pages.some(p => p.length)) throw new Error('This PDF has no selectable text. Scanned PDFs need OCR, which is not yet supported.')
      const book: Book = { id: crypto.randomUUID(), name: file.name.replace(/\.pdf$/i, ''), pages, page: 0, added: Date.now() }
      setBooks(prev => [book, ...prev]); setActiveId(book.id)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read this PDF.') }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  function setPage(page: number) {
    if (!current) return
    stop()
    setBooks(prev => prev.map(b => b.id === current.id ? { ...b, page: Math.max(0, Math.min(page, b.pages.length - 1)) } : b))
  }
  function speak() {
    if (!current || !('speechSynthesis' in window)) { setError('Speech playback is unavailable in this browser.'); return }
    if (playing) { window.speechSynthesis.pause(); setPlaying(false); return }
    if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); setPlaying(true); return }
    const utterance = new SpeechSynthesisUtterance(current.pages[current.page] || 'This page contains no readable text.')
    utterance.rate = rate
    const selected = voices.find(v => v.voiceURI === voice)
    if (selected) utterance.voice = selected
    utterance.onend = () => setPlaying(false)
    utterance.onerror = () => setPlaying(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setPlaying(true)
  }
  return <div className="app">
    <header className="topbar"><button className="brand" onClick={() => { stop(); setActiveId(null) }}><BookOpen size={23}/> <span>Clearvoice<span className="brand-light"> Reader</span></span></button><span className="tag">YOUR READING SPACE</span></header>
    {error && <div className="error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
    {!current ? <main className="home">
      <div className="eyebrow">A LITTLE SPACE FOR BIG STORIES</div>
      <h1>Read at your <em>own pace.</em></h1>
      <p className="lead">Bring your books along. Read comfortably, or let your device read aloud to you.</p>
      <button className="primary" disabled={busy} onClick={() => input.current?.click()}><Upload size={18}/>{busy ? 'Importing PDF…' : 'Add a PDF book'}</button>
      <input ref={input} hidden type="file" accept=".pdf,application/pdf" onChange={e => { const f=e.target.files?.[0]; if(f) void importPdf(f) }}/>
      <div className="section-title"><h2>Your library</h2><span>{books.length} {books.length === 1 ? 'book' : 'books'}</span></div>
      {books.length === 0 ? <div className="empty"><BookOpen size={35}/><h3>Every library starts somewhere.</h3><p>Import a text-based PDF to begin. Your books stay in this browser on this device.</p></div> :
        <div className="book-grid">{books.map((b, i) => <article className="book" key={b.id}>
          <button className={'cover cover-' + (i % 4)} onClick={() => setActiveId(b.id)}><BookOpen size={33}/><span>{b.name}</span></button>
          <div className="book-meta"><button className="book-name" onClick={() => setActiveId(b.id)}>{b.name}</button><span>Page {b.page + 1} of {b.pages.length}</span></div>
          <button className="delete" aria-label={'Remove ' + b.name} onClick={() => { if(confirm('Remove this book from your library?')) setBooks(prev => prev.filter(x => x.id !== b.id)) }}><Trash2 size={16}/></button>
        </article>)}</div>}
      <p className="footnote">Personal reading only · PDF support in this first release · No account needed</p>
    </main> : <main className="reader">
      <button className="back" onClick={() => { stop(); setActiveId(null) }}><ChevronLeft size={18}/> Library</button>
      <div className="reader-heading"><div><span className="eyebrow">NOW READING</span><h1>{current.name}</h1></div><span className="page-count">{current.page + 1} / {current.pages.length}</span></div>
      <div className="reading-controls"><label><Settings2 size={16}/> Text size <input aria-label="Text size" type="range" min="15" max="30" value={size} onChange={e => setSize(Number(e.target.value))}/></label><span>{size}px</span></div>
      <article className="paper" style={{ fontSize: size }}>{current.pages[current.page] || 'No selectable text on this page.'}</article>
      <div className="pagination"><button disabled={current.page === 0} onClick={() => setPage(current.page - 1)}><ChevronLeft size={18}/> Previous</button><span>Page {current.page + 1}</span><button disabled={current.page >= current.pages.length - 1} onClick={() => setPage(current.page + 1)}>Next <ChevronRight size={18}/></button></div>
      <div className="player"><div className="player-title"><Headphones size={19}/><strong>Listen to this page</strong></div><div className="player-options"><label>Voice <select value={voice} onChange={e => { stop(); setVoice(e.target.value) }}><option value="">Device default</option>{voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</select></label><label>Speed <select value={rate} onChange={e => { stop(); setRate(Number(e.target.value)) }}>{[0.75,1,1.25,1.5,1.75,2].map(n => <option key={n} value={n}>{n}×</option>)}</select></label></div><div className="player-actions"><button className="primary" onClick={speak}>{playing ? <Pause size={18}/> : <Play size={18}/>} {playing ? 'Pause' : 'Play page'}</button><button className="secondary" onClick={stop}><Square size={16}/> Stop</button></div><p className="hint">Speech uses voices installed in your browser or phone. Background playback varies by device.</p></div>
    </main>}
  </div>
}
export default App
