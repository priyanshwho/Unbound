import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../app/providers/useTheme'
import { BrandMark } from '../ui/BrandMark'
import { Icon } from '../ui/Icon'

const links = [['Features', '#features'], ['How it works', '#how-it-works'], ['About', '#about'], ['FAQ', '#faq'], ['Contact', '#contact']]

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  return <header className="sticky top-0 z-50 flex h-[68px] items-center justify-between gap-3 border-b border-line bg-background/85 px-5 backdrop-blur-xl md:h-[76px] md:px-10 xl:px-[5.4vw]">
    <a className="inline-flex shrink-0 items-center gap-2.5 font-display text-xl font-extrabold tracking-[-.06em]" href="#home" aria-label="Unbound home"><BrandMark/> <span>unbound<span className="text-accent">.</span></span></a>
    <nav className={`${menuOpen ? 'flex' : 'hidden'} absolute left-3 right-3 top-[67px] flex-col rounded-2xl border border-line-strong bg-surface-1 p-2 shadow-2xl shadow-shadow md:static md:flex md:flex-row md:items-center md:gap-5 md:border-0 md:bg-transparent md:p-0 md:shadow-none xl:gap-8`} aria-label="Main navigation">
      {links.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-text-soft transition hover:bg-accent-soft hover:text-accent md:px-0 md:text-xs">{label}</a>)}
    </nav>
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme} className="grid size-11 place-items-center rounded-xl border border-line-strong bg-surface-1 text-text-soft transition hover:border-accent hover:text-accent"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17}/><span className="sr-only">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span></button>
      <Link aria-label="Open Analytics workspace" to="/analytics" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-[11px] font-bold text-white shadow-lg shadow-accent/20 transition hover:-translate-y-0.5 hover:bg-accent-strong sm:px-4 sm:text-xs">Analytics <Icon name="arrow" size={15}/></Link>
      <button type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)} className="grid size-11 place-items-center rounded-xl border border-line-strong bg-surface-1 text-text-soft md:hidden"><Icon name={menuOpen ? 'chevron' : 'menu'} size={19}/></button>
    </div>
  </header>
}
