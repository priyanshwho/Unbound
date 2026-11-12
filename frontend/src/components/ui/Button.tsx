import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonStyle = 'primary' | 'secondary' | 'quiet'
const styles: Record<ButtonStyle, string> = {
  primary: 'bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent-strong',
  secondary: 'border border-line-strong bg-surface-1 text-text hover:border-accent hover:bg-accent-soft',
  quiet: 'text-text-soft hover:bg-accent-soft hover:text-accent',
}
const base = 'inline-flex min-h-11 items-center justify-center gap-2.5 rounded-xl px-4 text-[13px] font-bold transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonStyle; className?: string; children: ReactNode }) {
  return <button className={`${base} ${styles[variant]} ${className}`} {...props}>{children}</button>
}

export function ButtonLink({ variant = 'primary', className = '', children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonStyle; className?: string; children: ReactNode }) {
  return <a className={`${base} ${styles[variant]} ${className}`} {...props}>{children}</a>
}
