import { useEffect, useRef, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowDown, ArrowUpRight, BarChart3, Check, ChevronDown, CircleHelp, Database, FileSpreadsheet, Gauge, LayoutDashboard, LoaderCircle, MessageCircle, Moon, MoreHorizontal, Plus, Send, Settings2, Share2, Sparkles, Sun, Upload, X } from 'lucide-react';

type Column = { name: string; type: string; nulls: number; distinct: number };
type Dataset = { id: string; name: string; rows: number; columns: Column[]; size: number };
type Chart = { title: string; chart_type: string; x_key: string; y_key: string; data: Record<string, string | number>[] };
type Message = { role: 'assistant' | 'user'; content: string; chart?: Chart; loading?: boolean };
type Dashboard = { dataset: Dataset; kpis: { label: string; value: string; hint: string }[]; charts: Chart[]; generated_at: string };

const fmt = (n: number) => Intl.NumberFormat('en', { notation: n > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);
const colors = ['#4869e8', '#12a77a', '#8b67e8', '#e69a35'];

export default function App() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [active, setActive] = useState<Dataset | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: 'Welcome to DashTide. Upload a CSV and I’ll help you explore it, answer questions, and build a dashboard.' }]);
  const [question, setQuestion] = useState('');
  const [view, setView] = useState<'chat' | 'dashboard'>('chat');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [dark, setDark] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch('/api/health').then(r => r.json()).then(x => setConnected(x.ollama === 'connected')).catch(() => setConnected(false)); }, []);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setError('');
    try {
      const next: Dataset[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData(); form.append('file', file);
        const res = await fetch('/api/datasets/upload', { method: 'POST', body: form });
        const body = await res.json(); if (!res.ok) throw new Error(body.detail || 'Upload failed');
        next.push(body);
      }
      setDatasets(old => [...next, ...old]); setActive(next[0]); setDashboard(null); setView('chat');
      const rows = next.reduce((n, d) => n + d.rows, 0);
      setMessages([{ role: 'assistant', content: `I’ve profiled ${next.length} file${next.length > 1 ? 's' : ''} with ${fmt(rows)} rows. Here’s what I found. Ask a question, or create a dashboard.` }]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not upload that CSV.'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function ask(text = question) {
    const prompt = text.trim(); if (!prompt || !active || busy) return;
    setQuestion(''); setError(''); setMessages(m => [...m, { role: 'user', content: prompt }]); setBusy(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataset_id: active.id, question: prompt }) });
      const body = await res.json(); if (!res.ok) throw new Error(body.detail || 'Could not analyze this question.');
      setMessages(m => [...m, { role: 'assistant', content: body.answer, chart: body.chart }]);
    } catch (e) { setMessages(m => [...m, { role: 'assistant', content: e instanceof Error ? e.message : 'Analysis failed. Check that Ollama is running.' }]); }
    finally { setBusy(false); }
  }

  async function createDashboard() {
    if (!active || busy) return; setBusy(true); setError(''); setView('dashboard');
    try {
      const res = await fetch(`/api/dashboard/${active.id}`); const body = await res.json();
      if (!res.ok) throw new Error(body.detail || 'Dashboard generation failed.');
      setDashboard(body);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create dashboard.'); }
    finally { setBusy(false); }
  }

  function newChat() { setActive(null); setDashboard(null); setView('chat'); setMessages([{ role: 'assistant', content: 'Start by adding one or more CSV files. I’ll inspect the columns and help you find the story in your data.' }]); setError(''); }
  function chartCard(chart: Chart, index: number) {
    const isBar = chart.chart_type === 'bar';
    return <section className={`chart-card ${index === 0 ? 'wide' : ''}`} key={`${chart.title}-${index}`}><div className="card-head"><div><div className="eyebrow">{index === 0 ? 'TREND' : 'BREAKDOWN'}</div><h3>{chart.title}</h3><p>Calculated from {active?.name}</p></div><button className="icon-btn" title="Chart options"><MoreHorizontal size={18}/></button></div><div className="chart-body"><ResponsiveContainer width="100%" height="100%">{isBar ? <BarChart data={chart.data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}><CartesianGrid vertical={false} stroke="#e8edf1"/><XAxis dataKey={chart.x_key} tickLine={false} axisLine={false} tick={{ fill: '#85909e', fontSize: 11 }} interval="preserveStartEnd"/><YAxis tickLine={false} axisLine={false} tick={{ fill: '#85909e', fontSize: 11 }} tickFormatter={fmt} width={48}/><Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e8edf1' }}/><Bar dataKey={chart.y_key} fill={colors[index % colors.length]} radius={[5,5,0,0]} maxBarSize={34}>{chart.data.map((_, i) => <Cell key={i} fill={colors[index % colors.length]} opacity={i === 0 ? 1 : .82}/>)}</Bar></BarChart> : <AreaChart data={chart.data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}><defs><linearGradient id={`shade-${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors[index % colors.length]} stopOpacity={.18}/><stop offset="95%" stopColor={colors[index % colors.length]} stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e8edf1"/><XAxis dataKey={chart.x_key} tickLine={false} axisLine={false} tick={{ fill: '#85909e', fontSize: 11 }} interval="preserveStartEnd"/><YAxis tickLine={false} axisLine={false} tick={{ fill: '#85909e', fontSize: 11 }} tickFormatter={fmt} width={48}/><Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e8edf1' }}/><Area type="monotone" dataKey={chart.y_key} stroke={colors[index % colors.length]} strokeWidth={2.5} fill={`url(#shade-${index})`} activeDot={{ r: 4 }}/></AreaChart>}</ResponsiveContainer></div></section>;
  }

  return <div className={dark ? 'app dark' : 'app'}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={19}/></div><div><strong>DashTide</strong><span>Data workspace</span></div><button className="icon-btn brand-more"><MoreHorizontal size={18}/></button></div>
      <button className="new-chat" onClick={newChat}><Plus size={16}/> New chat <span>⌘ K</span></button>
      <div className="side-label">WORKSPACE</div>
      <button className={`nav-item ${view === 'dashboard' ? 'selected' : ''}`} onClick={() => dashboard && setView('dashboard')}><LayoutDashboard size={17}/> Dashboard</button>
      <button className="nav-item" onClick={() => document.getElementById('dataset-list')?.scrollIntoView({ behavior: 'smooth' })}><Database size={17}/> Your data <span className="count">{datasets.length}</span></button>
      <div className="side-label recent-label">RECENT CHATS</div>
      {datasets.slice(0, 6).map(d => <button key={d.id} onClick={() => { setActive(d); setView('chat'); setDashboard(null); setMessages([{ role: 'assistant', content: `Ready to explore ${d.name} (${fmt(d.rows)} rows). What would you like to know?` }]); }} className={`chat-link ${active?.id === d.id ? 'active' : ''}`}><MessageCircle size={15}/><span>{d.name.replace(/\.csv$/i, '')}</span></button>)}
      <div className="sidebar-spacer"/>
      <div className="local-card"><div className="local-top"><span className={`status-dot ${connected ? 'online' : ''}`}/><strong>{connected ? 'Local AI connected' : 'Local AI offline'}</strong></div><p>{connected ? 'Ollama is ready on this Mac.' : 'Start Ollama to chat with your data.'}</p><span className="model-tag">GEMMA 3 · 4B</span></div>
      <div className="profile"><div className="avatar">P</div><div className="profile-info"><strong>Local workspace</strong><span>Prototype mode</span></div><button className="icon-btn" onClick={() => setDark(v => !v)} title="Toggle theme">{dark ? <Sun size={16}/> : <Moon size={16}/>}</button></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="slash">/</span><strong>{view === 'dashboard' ? 'Dashboard' : active ? active.name : 'New conversation'}</strong></div><div className="top-actions"><div className={`connection ${connected ? '' : 'offline'}`}><span className="status-dot online"/>{connected ? 'Local model ready' : 'Connect local model'}</div><button className="top-icon" title="Help"><CircleHelp size={17}/></button><button className="top-icon" title="Settings"><Settings2 size={17}/></button></div></header>
      <div className="page-content">
        {!active ? <div className="welcome-wrap"><div className="welcome"><div className="sparkle-orb"><Sparkles size={22}/></div><div className="welcome-kicker">YOUR DATA, IN A NEW LIGHT</div><h1>What would you like<br/>to <em>understand?</em></h1><p>Bring your CSVs. Ask a question. Get a clear answer and a dashboard you can share.</p>
          <div className="upload-box" onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files); }}><input ref={fileRef} type="file" accept=".csv,text/csv" multiple hidden onChange={e => void upload(e.target.files)}/><button className="upload-icon" disabled={uploading}>{uploading ? <LoaderCircle className="spin" size={20}/> : <Upload size={20}/>}</button><div><strong>{uploading ? 'Reading your files…' : 'Drop your CSV files here'}</strong><span>or <b onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>browse files</b></span></div><span className="format-pill">CSV · UP TO 50 MB</span></div>
          {error && <div className="error-banner"><X size={15}/>{error}</div>}
          <div className="suggestions"><span>TRY ASKING</span><button onClick={() => { if (active) void ask('Which month had the highest sales?'); else fileRef.current?.click(); }}>Which month had the highest sales? <ArrowUpRight size={13}/></button><button onClick={() => fileRef.current?.click()}>Compare performance by category <ArrowUpRight size={13}/></button></div>
          <div className="trust-line"><span><Check size={13}/> Runs on your Mac</span><span><Check size={13}/> Your CSV stays local</span><span><Check size={13}/> Powered by Ollama</span></div>
        </div><div className="welcome-decoration"><div className="decor-grid"/><div className="decor-chip chip-a"><BarChart3 size={17}/> Insights</div><div className="decor-chip chip-b"><span className="tiny-dot"/> Local & private</div><div className="decor-arc"/></div></div> : view === 'chat' ? <div className="chat-layout"><div className="chat-header"><div><div className="eyebrow">DATA CONVERSATION</div><h1>{active.name.replace(/\.csv$/i, '')}</h1><div className="dataset-meta"><span><FileSpreadsheet size={14}/>{fmt(active.rows)} rows</span><span>{active.columns.length} columns</span><span className="verified"><Check size={12}/> Profiled</span></div></div><div className="chat-header-actions"><button className="secondary-btn" onClick={createDashboard}><BarChart3 size={16}/> Create dashboard</button><button className="icon-btn" title="More"><MoreHorizontal size={19}/></button></div></div>
          <div className="columns-strip"><span className="strip-label">COLUMNS</span>{active.columns.slice(0, 8).map(c => <span className="column-chip" key={c.name}><span className={`type-dot ${/int|double|float|decimal|number/i.test(c.type) ? 'numeric' : /date|time/i.test(c.type) ? 'date' : ''}`}/>{c.name}</span>)}{active.columns.length > 8 && <span className="column-chip muted">+{active.columns.length - 8} more</span>}</div>
          <div className="messages" ref={chatRef}>{messages.map((m, i) => <div className={`message-row ${m.role}`} key={i}><div className={`message-avatar ${m.role}`}>{m.role === 'assistant' ? <Sparkles size={15}/> : 'P'}</div><div className="message-content"><div className="message-name">{m.role === 'assistant' ? 'DashTide' : 'You'} <span>{m.role === 'assistant' ? '· Local analysis' : ''}</span></div><p>{m.content}</p>{m.chart && <div className="answer-chart">{chartCard(m.chart, 0)}</div>}</div></div>)}{busy && <div className="message-row assistant"><div className="message-avatar assistant"><Sparkles size={15}/></div><div className="message-content"><div className="message-name">DashTide <span>· Thinking with Gemma</span></div><div className="typing"><i/><i/><i/></div></div></div>}</div>
          <div className="composer-wrap"><div className="prompt-chips"><button onClick={() => void ask('Summarize this dataset')}>Summarize this data</button><button onClick={() => void ask('Show the trend over time')}>Show a trend</button><button onClick={createDashboard}>Build a dashboard</button></div><form className="composer" onSubmit={e => { e.preventDefault(); void ask(); }}><textarea value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(); } }} placeholder="Ask anything about your data…" rows={1}/><div className="composer-foot"><span><Sparkles size={13}/> Answers are calculated from your CSV</span><button className="send-btn" disabled={!question.trim() || busy} aria-label="Send"><Send size={16}/></button></div></form><div className="composer-note">AI can make mistakes. Check important numbers against your source data.</div></div>
        </div> : <div className="dashboard-view"><div className="dashboard-head"><div><div className="eyebrow">GENERATED FROM YOUR DATA</div><h1>{active.name.replace(/\.csv$/i, '')} dashboard</h1><p>Created just now · Every number is calculated from your file</p></div><div className="dashboard-actions"><button className="secondary-btn" onClick={() => setView('chat')}><MessageCircle size={16}/> Refine in chat</button><button className="primary-btn" title="Sharing will be enabled after cloud publishing is configured"><Share2 size={16}/> Share <span className="soon">SOON</span></button></div></div>
          {busy && <div className="loading-panel"><LoaderCircle size={20} className="spin"/>Analyzing columns and building your dashboard…</div>}
          {error && <div className="error-banner"><X size={15}/>{error}</div>}
          {dashboard && <><div className="kpi-grid">{dashboard.kpis.map((k, i) => <div className="kpi-card" key={k.label}><div className="kpi-label">{k.label}<span className={`kpi-symbol s${i}`}><Gauge size={17}/></span></div><strong>{k.value}</strong><span className="kpi-hint">{k.hint}</span></div>)}</div><div className="charts-grid">{dashboard.charts.map((c, i) => chartCard(c, i))}</div><div className="dashboard-foot"><span><Check size={14}/> Calculated locally from {active.name}</span><span>Values may reflect the columns detected in this CSV.</span></div></>}
          {!dashboard && !busy && <div className="empty-dash"><LayoutDashboard size={24}/><h3>Your dashboard is being prepared</h3><p>We’ll select charts based on the columns in this file.</p></div>}
        </div>}
        {datasets.length > 0 && <div className="dataset-drawer" id="dataset-list"><div className="drawer-head"><div><div className="eyebrow">YOUR DATA</div><strong>Recent files</strong></div><button onClick={() => fileRef.current?.click()} className="add-file"><Plus size={14}/> Add CSV</button></div><div className="dataset-list">{datasets.map(d => <button key={d.id} className={`dataset-row ${active?.id === d.id ? 'current' : ''}`} onClick={() => { setActive(d); setView('chat'); setDashboard(null); setMessages([{ role: 'assistant', content: `Ready to explore ${d.name} (${fmt(d.rows)} rows). What would you like to know?` }]); }}><FileSpreadsheet size={16}/><span>{d.name}</span><small>{fmt(d.rows)} rows</small></button>)}</div></div>}
      </div>
      <footer className="app-footer"><span>DashTide <span className="footer-dot">•</span> Local prototype</span><span>Local AI <span className={`footer-state ${connected ? '' : 'off'}`}>{connected ? '● Connected' : '● Offline'}</span></span></footer>
    </main>
  </div>;
}
