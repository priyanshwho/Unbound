import { useState, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { Activity, ArrowRight, BarChart3, Database, FileSpreadsheet, LockKeyhole, Menu, MousePointer2, Sparkles, X } from 'lucide-react'
import Workspace from './Workspace'

function Brand({ light = false }: { light?: boolean }) {
  return <Link to="/" className={`flex items-center gap-2.5 font-display text-[17px] font-extrabold tracking-[-.7px] ${light ? 'text-paper' : 'text-forest'}`}>
    <span className={`grid size-8 place-items-center rounded-lg ${light ? 'bg-white/10' : 'bg-forest text-paper'}`}><Activity size={17}/></span>unbound
  </Link>
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <header className="relative z-20 mx-auto flex h-[72px] max-w-[1240px] items-center justify-between border-b border-[#e5e5dc] px-5 md:px-10">
    <Brand/>
    <button className="grid size-9 place-items-center rounded-md border border-[#e1e2d9] md:hidden" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X size={18}/> : <Menu size={18}/>}</button>
    <nav className={`${menuOpen ? 'flex' : 'hidden'} absolute left-0 right-0 top-[71px] flex-col gap-1 border-b border-[#e5e5dc] bg-paper p-5 text-xs text-[#627067] shadow-lg md:static md:flex md:flex-row md:items-center md:gap-8 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}>
      <Link to="/product" onClick={() => setMenuOpen(false)} className="py-2 hover:text-forest">Product</Link>
      <a href="/#how-it-works" onClick={() => setMenuOpen(false)} className="py-2 hover:text-forest">How it works</a>
      <a href="/#privacy" onClick={() => setMenuOpen(false)} className="py-2 hover:text-forest">Privacy</a>
      <Link to="/analytics" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded bg-forest px-4 font-semibold text-white md:hidden">Analytics <ArrowRight size={14}/></Link>
    </nav>
    <div className="hidden items-center gap-5 text-[11px] md:flex"><Link to="/analytics" className="inline-flex h-10 items-center gap-2 rounded bg-forest px-4 font-semibold text-white transition hover:bg-forest-soft">Analytics <ArrowRight size={14}/></Link></div>
  </header>
}

function Footer() {
  return <footer className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-6 text-[10px] text-[#879188] md:px-10"><Brand/><span>Local-first analytics, made understandable.</span><div className="ml-auto flex gap-5"><Link to="/product">Product</Link><a href="/#privacy">Privacy</a><Link to="/analytics">Analytics</Link></div><small className="basis-full text-right font-mono md:basis-auto">© 2026 Unbound</small></footer>
}

function Eyebrow({ children }: { children: ReactNode }) { return <div className="font-mono text-[10px] tracking-[1.2px] text-[#77857b]">{children}</div> }

function App() {
  return <Routes>
    <Route path="/" element={<LandingPage/>}/>
    <Route path="/product" element={<ProductPage/>}/>
    <Route path="/analytics" element={<Workspace/>}/>
    <Route path="/workspace" element={<Navigate to="/analytics" replace/>}/>
    <Route path="*" element={<LandingPage/>}/>
  </Routes>
}

function LandingPage() {
  const features = [
    { icon: FileSpreadsheet, title: 'Bring your own data', text: 'Start with the CSVs you already have. See columns, gaps, and sample values before you ask a question.' },
    { icon: Sparkles, title: 'Ask in plain language', text: 'Ask about the numbers. Unbound turns your question into a checked calculation you can inspect.' },
    { icon: BarChart3, title: 'Make a dashboard', text: 'Turn useful answers into a clear dashboard, then share a snapshot with your team.' },
  ]
  return <><Header/><main>
    <section className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 py-14 md:grid-cols-[.9fr_1.1fr] md:px-[68px] md:py-[68px]">
      <div><Eyebrow><span className="mr-2 inline-block size-[7px] rounded-full bg-clay align-[1px]"/>YOUR DATA, WITHOUT THE BUSYWORK</Eyebrow><h1 className="mt-5 font-display text-[50px] font-bold leading-[1.06] tracking-[-3.4px] text-forest md:text-[68px]">Get to the<br/><i className="not-italic text-[#597262]">good question.</i></h1><p className="mt-5 max-w-[410px] text-[13px] leading-7 text-[#6b776f] md:text-sm">Your spreadsheets have answers. Unbound helps you find them, check the math, and turn the useful bits into a dashboard.</p><div className="mt-6 flex flex-wrap items-center gap-5"><Link to="/analytics" className="inline-flex h-12 items-center gap-3 rounded bg-forest px-5 text-xs font-semibold text-white hover:bg-forest-soft">Start with your data <ArrowRight size={15}/></Link><Link to="/product" className="inline-flex items-center gap-2 text-xs font-semibold text-forest-soft">See how it works <ArrowRight size={15}/></Link></div><p className="mt-6 flex items-center gap-2.5 text-[10px] text-[#78837a]"><LockKeyhole size={13}/>Local-first analysis. Your CSV stays on your device.</p></div>
      <DashboardPreview/>
    </section>
    <div className="mx-auto flex max-w-[1104px] flex-wrap items-center justify-between gap-4 border-y border-[#e3e4db] px-2 py-5"><span className="basis-full font-mono text-[9px] tracking-[.7px] text-[#98a097] md:basis-auto">MADE FOR THE SPREADSHEETS YOU ALREADY HAVE</span><div className="flex flex-wrap items-center gap-5 text-[10px] text-[#77837a]"><span className="flex items-center gap-2"><FileSpreadsheet size={15}/> CSV files</span><span className="flex items-center gap-2"><Database size={15}/> Multiple datasets</span><span className="flex items-center gap-2"><MousePointer2 size={15}/> Questions in plain language</span></div></div>
    <section id="how-it-works" className="mx-auto max-w-[1104px] px-5 py-16 md:px-2 md:py-24"><div className="mb-9 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><Eyebrow>A CLEARER WAY THROUGH</Eyebrow><h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-[-1.3px] md:text-[36px]">From raw rows to<br/><i className="not-italic text-[#597262]">real understanding.</i></h2></div><p className="max-w-[330px] text-xs leading-6 text-[#778179]">No formula archaeology. No mystery charts. Just a path from the file you have to the answer you need.</p></div><div className="grid gap-3 md:grid-cols-3">{features.map((feature,i)=><article key={feature.title} className="group rounded border border-[#e6e7de] bg-[#fbfaf6] p-5 transition hover:-translate-y-1 hover:border-[#cbd4ca]"><div className="flex justify-between"><span className={`grid size-9 place-items-center rounded-lg ${i===1?'bg-clay-pale text-clay':'bg-[#e9eee8] text-[#547361]'}`}><feature.icon size={18}/></span><span className="font-mono text-[10px] text-[#b3bab1]">0{i+1}</span></div><h3 className="mt-4 font-display text-[15px] font-bold">{feature.title}</h3><p className="mt-2 min-h-[54px] text-[11px] leading-[1.7] text-[#7a847c]">{feature.text}</p><Link to="/product" className="mt-4 inline-flex items-center gap-2 text-[10px] font-semibold text-[#5f7666]">Explore the product <ArrowRight size={13}/></Link></article>)}</div></section>
    <section id="privacy" className="mx-auto mb-16 grid max-w-[1104px] items-center gap-4 rounded border border-[#e2e4db] bg-[#eeefe8] p-6 md:grid-cols-[44px_1fr_auto] md:px-8"><span className="grid size-10 place-items-center rounded-full bg-[#dfe8df] text-[#557462]"><LockKeyhole size={18}/></span><div><Eyebrow>PRIVATE BY DEFAULT</Eyebrow><h2 className="mt-1 font-display text-lg font-bold">Your data stays yours.</h2><p className="mt-1 max-w-[560px] text-[11px] leading-5 text-[#778179]">Unbound analyzes CSV files on your computer. Sharing is a separate step, and you choose what a published dashboard contains.</p></div><Link to="/product" className="ml-14 inline-flex items-center gap-2 text-[11px] font-semibold text-forest-soft md:ml-4">Our approach to privacy <ArrowRight size={14}/></Link></section>
    <section className="relative overflow-hidden bg-forest px-5 py-16 text-center text-paper"><div className="relative z-10"><Sparkles className="mx-auto mb-4 text-clay" size={20}/><h2 className="font-display text-3xl font-bold leading-tight tracking-[-1px]">There’s a better question<br/>in that spreadsheet.</h2><p className="mb-6 mt-3 text-xs text-[#bdc8bf]">Find it with Unbound.</p><Link to="/analytics" className="inline-flex h-11 items-center gap-2 rounded bg-paper px-5 text-xs font-semibold text-forest">Open the local workspace <ArrowRight size={14}/></Link></div></section>
  </main><Footer/></>
}

function DashboardPreview() {
  const [period,setPeriod] = useState('Last 12 months')
  return <div className="relative rounded-xl border border-[#e2e4dc] bg-[#fffefa] p-4 shadow-2xl md:p-6"><div className="flex items-center justify-between"><span className="font-display text-xs font-semibold">Sales at a glance</span><select aria-label="Dashboard period" value={period} onChange={e=>setPeriod(e.target.value)} className="rounded border border-[#e8e9e2] bg-white px-2 py-1 text-[9px]"><option>Last 12 months</option><option>Last 6 months</option><option>This year</option></select></div><div className="mt-5 grid grid-cols-3 gap-2">{[['TOTAL REVENUE','$284,930'],['ORDERS','1,482'],['AVG ORDER','$192.25']].map(([label,value])=><div className="rounded border border-[#e9eae4] p-3" key={label}><small className="font-mono text-[8px] text-[#98a199]">{label}</small><strong className="mt-1 block font-display text-sm font-bold md:text-lg">{value}</strong><small className="text-[8px] text-[#62836e]">↑ 12.8%</small></div>)}</div><div className="mt-3 rounded border border-[#e9eae4] p-3"><div className="flex items-center gap-2 text-[10px] font-semibold"><Database size={14}/>Revenue over time</div><div className="mt-4 flex h-36 items-end gap-2 border-b border-l border-[#e8e9e2] px-3">{[44,62,51,72,59,86,66,94,78,100,84,92].map((height,i)=><button title={`${i+1} month data`} key={i} style={{height:`${height}%`}} className={`flex-1 rounded-t transition hover:opacity-70 ${i===9?'bg-clay':'bg-[#71877a]'}`}/>)}</div><div className="mt-2 flex justify-between font-mono text-[8px] text-[#929b92]"><span>JAN</span><span>MAR</span><span>MAY</span><span>JUL</span><span>SEP</span><span>DEC</span></div></div><div className="mt-3 flex items-center gap-2 rounded bg-[#f3f4ee] p-3 text-[10px] text-[#5e6e63]"><Sparkles size={13} className="text-clay"/>Which month had the highest sales?<ArrowRight className="ml-auto" size={12}/></div></div>
}

function ProductPage() {
  const steps = [{title:'Inspect',text:'Review detected types, missing values, and sample rows.'},{title:'Ask',text:'Get a checked analysis from a natural language question.'},{title:'Share',text:'Publish an approved dashboard snapshot when cloud publishing is ready.'}]
  return <><Header/><main className="mx-auto max-w-6xl px-5 py-16"><Eyebrow>THE PRODUCT</Eyebrow><h1 className="mt-5 font-display text-5xl font-bold tracking-[-3px] md:text-6xl">From a CSV<br/>to <i className="not-italic text-[#597262]">something clear.</i></h1><p className="mt-5 max-w-xl text-sm leading-7 text-[#6b776f]">Unbound helps you inspect, question, and visualize your data. The model interprets your question. The backend validates and calculates the result.</p><div className="mt-10 grid gap-4 border-y border-[#e3e4db] py-8 md:grid-cols-3">{steps.map((step,i)=><article className="py-2" key={step.title}><span className="font-mono text-[10px] text-[#9aa39a]">0{i+1} / 03</span><h2 className="mt-4 font-display text-lg font-bold">{step.title}</h2><p className="mt-2 max-w-xs text-xs leading-6 text-[#78827a]">{step.text}</p></article>)}</div><div id="privacy" className="mt-9 rounded bg-[#eeefe8] p-6"><h2 className="font-display text-lg font-bold">Local first. Share by choice.</h2><p className="mt-2 max-w-2xl text-xs leading-6 text-[#78827a]">The current prototype stores uploaded CSVs on this computer. Hosted accounts are not part of this release. Local CSV analysis opens directly from Analytics.</p></div><Link to="/analytics" className="mt-7 inline-flex items-center gap-2 rounded bg-forest px-5 py-3 text-xs font-semibold text-white">Open local workspace <ArrowRight size={14}/></Link></main><Footer/></>
}



export default App
