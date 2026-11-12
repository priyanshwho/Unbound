import { BrandMark } from '../../components/ui/BrandMark'
import { ButtonLink } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'

const footerGroups = [
  { title: 'Explore', links: [['Features', '#features'], ['How it works', '#how-it-works'], ['About', '#about']] },
  { title: 'Support', links: [['FAQ', '#faq'], ['Contact', '#contact']] },
]

export function FooterSection() {
  return <footer id="footer" className="flex min-h-screen flex-col justify-between bg-background-deep px-6 pb-5 md:px-12 xl:px-[8vw]">
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center py-16">
      <div className="pb-12 text-center md:pb-16"><span className="mx-auto mb-5 grid size-11 place-items-center rounded-2xl border border-accent/30 bg-accent-soft text-accent"><Icon name="spark" size={19}/></span><p className="font-mono text-[10px] tracking-[.12em] text-accent">MAKE SPACE FOR THE ANSWER</p><h2 className="mb-7 mt-4 font-display text-5xl font-extrabold leading-[1.04] tracking-[-.055em] md:text-7xl">Ready to meet<br/><span className="text-muted">your data clearly?</span></h2><ButtonLink href="/analytics" className="min-h-[52px] px-6">Open Analytics <Icon name="arrow" size={17}/></ButtonLink></div>
      <div className="grid gap-8 border-t border-line-strong py-9 md:grid-cols-[1.8fr_.7fr_.7fr] md:gap-12">
        <div><a className="inline-flex items-center gap-2 font-display text-xl font-extrabold tracking-[-.06em]" href="#home"><BrandMark/> unbound<span className="text-accent">.</span></a><p className="mt-3 max-w-xs text-xs leading-6 text-text-soft">A local-first space to ask better questions of your data.</p><span className="mt-2 inline-flex items-center gap-2 font-mono text-[9px] text-muted"><Icon name="lock" size={14}/> Built around your control</span></div>
        {footerGroups.map(group => <div key={group.title} className="flex flex-col items-start gap-2"><b className="mb-1 font-display text-xs">{group.title}</b>{group.links.map(([label, href]) => <a key={label} className="flex min-h-8 items-center text-xs text-text-soft transition hover:text-accent" href={href}>{label}</a>)}</div>)}
      </div>
    </div>
    <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-3 border-t border-line text-[9px] text-muted"><span>© 2026 Unbound. Made for thoughtful analysis.</span><a className="min-h-11 inline-flex items-center text-text-soft hover:text-accent" href="#home">Back to top ↑</a><span className="hidden font-mono tracking-wider md:block">LOCAL DATA · CLEAR ANSWERS</span></div>
  </footer>
}
