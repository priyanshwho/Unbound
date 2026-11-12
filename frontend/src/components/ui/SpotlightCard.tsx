import type { PointerEvent, ReactNode } from 'react'

export function SpotlightCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  function trackPointer(event: PointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--pointer-x', `${event.clientX - bounds.left}px`)
    event.currentTarget.style.setProperty('--pointer-y', `${event.clientY - bounds.top}px`)
  }

  return <article onPointerMove={trackPointer} className={`group relative isolate overflow-hidden rounded-2xl border border-line bg-[radial-gradient(320px_circle_at_var(--pointer-x,-100px)_var(--pointer-y,-100px),var(--spotlight),transparent_68%)] bg-surface-1 transition duration-200 hover:-translate-y-1 hover:border-accent/50 ${className}`}>{children}</article>
}
