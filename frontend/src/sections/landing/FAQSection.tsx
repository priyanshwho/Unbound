import { useState } from 'react'
import { Icon } from '../../components/ui/Icon'

const questions = [
  { question: 'Does Unbound upload my CSVs?', answer: 'The planned creator workflow analyzes files locally through the companion service. A dashboard can be shared as a reviewed snapshot, without sending raw rows by default.' },
  { question: 'What can I ask about my data?', answer: 'Ask questions your columns can answer, such as monthly sales trends, top products, category comparisons, and changes between periods.' },
  { question: 'Can I edit a dashboard after it is created?', answer: 'Yes. The dashboard uses supported cards and charts, so you can change chart types, metrics, filters, and layout through the editor.' },
  { question: 'Do I need to know SQL?', answer: 'No. Ask in plain language. Unbound turns the request into a checked analysis plan and lets the data engine calculate the result.' },
  { question: 'Can other people view a dashboard?', answer: 'Sharing is planned as an optional, reviewed snapshot. Viewers will not need your local model to open a published dashboard.' },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number>(0)
  return <section id="faq" className="flex min-h-screen items-center px-5 py-20 md:px-10 md:py-24 xl:px-[8vw]"><div className="mx-auto grid w-full max-w-6xl gap-9 md:grid-cols-[.78fr_1.22fr] md:gap-20"><div><span className="font-mono text-[10px] tracking-[.12em] text-accent">04 / FAQ</span><h2 className="mb-4 mt-5 font-display text-[clamp(40px,5vw,64px)] font-extrabold leading-[1.06] tracking-[-.055em]">Good questions.<br/><span className="text-muted">Clear answers.</span></h2><p className="mb-3 max-w-xs text-sm leading-7 text-text-soft">Still curious about how Unbound works? Here are a few details.</p><a className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-accent" href="#contact">Ask us directly <Icon name="arrow" size={15}/></a></div><div className="border-t border-line-strong">{questions.map((item, index) => <div className="border-b border-line-strong" key={item.question}><button className="grid min-h-[68px] w-full grid-cols-[25px_1fr_28px] items-center gap-2 text-left text-xs font-bold transition hover:text-accent md:min-h-[73px] md:grid-cols-[34px_1fr_28px] md:gap-3 md:text-sm" type="button" aria-expanded={openIndex === index} onClick={() => setOpenIndex(openIndex === index ? -1 : index)}><span className="font-mono text-[9px] text-muted">0{index + 1}</span><span>{item.question}</span><span className={`grid size-7 place-items-center rounded-full border border-line text-accent transition ${openIndex === index ? 'rotate-180 bg-accent-soft' : ''}`}><Icon name="chevron" size={16}/></span></button>{openIndex === index && <p className="mb-5 ml-8 mr-4 text-xs leading-6 text-text-soft md:ml-12">{item.answer}</p>}</div>)}</div></div></section>
}
