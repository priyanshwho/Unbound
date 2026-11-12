import { Link } from 'react-router-dom'

export function NotFoundRoute() {
  return <main className="grid min-h-screen place-items-center bg-background px-5 text-center text-text"><div><p className="font-mono text-xs tracking-widest text-accent">404</p><h1 className="mt-3 font-display text-4xl font-extrabold">Page not found</h1><Link className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-accent" to="/">Return home</Link></div></main>
}
