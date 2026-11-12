import { ButtonLink } from '../../components/ui/Button'
import { Icon, type IconName } from '../../components/ui/Icon'

const steps: { number: string; icon: IconName; title: string; description: string }[] = [
  { number: '01', icon: 'upload', title: 'Add your files', description: 'Bring in CSVs and review detected columns, missing values, and date ranges.' },
  { number: '02', icon: 'database', title: 'Check the structure', description: 'Confirm measures and relationships before a calculation runs.' },
  { number: '03', icon: 'chat', title: 'Ask a question', description: 'Describe what you want to learn and see the time period and method.' },
  { number: '04', icon: 'chart', title: 'Shape your dashboard', description: 'Create charts from the result, then refine them in the editor.' },
]

export function HowItWorksSection() {
  return <section id="how-it-works" className="flex min-h-screen items-center px-5 py-20 md:px-10 md:py-24 xl:px-[8vw]"><div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-24"><div><span className="font-mono text-[10px] tracking-[.12em] text-accent">02 / HOW IT WORKS</span><h2 className="mb-4 mt-5 font-display text-[clamp(40px,5vw,67px)] font-extrabold leading-[1.06] tracking-[-.055em]">From CSV to<br/><span className="text-muted">confident decisions.</span></h2><p className="mb-6 max-w-sm text-sm leading-7 text-text-soft">A clear sequence keeps your analysis understandable, from the first column to the final chart.</p><ButtonLink href="/analytics" variant="secondary">Start with a file <Icon name="arrow" size={15}/></ButtonLink></div><div className="relative"><div className="absolute bottom-16 left-5 top-16 -z-10 border-l border-dashed border-accent/40"/>{steps.map(step => <article key={step.number} className="grid min-h-[105px] grid-cols-[28px_40px_minmax(0,1fr)_22px] items-center gap-3 border-b border-line py-4 first:border-t md:grid-cols-[38px_44px_minmax(0,1fr)_24px] md:gap-4"><span className="self-start pt-1 font-mono text-[10px] text-accent">{step.number}</span><span className="grid size-9 place-items-center rounded-xl border border-line-strong bg-surface-1 text-accent md:size-11"><Icon name={step.icon} size={18}/></span><div><h3 className="mb-1 font-display text-sm font-bold md:text-base">{step.title}</h3><p className="max-w-lg text-[11px] leading-5 text-text-soft md:text-xs md:leading-6">{step.description}</p></div><span className="grid size-5 place-items-center rounded-full bg-lime-soft text-lime"><Icon name="check" size={13}/></span></article>)}</div></div></section>
}
