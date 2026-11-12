import { Link, useParams } from 'react-router-dom'

export function SharedDashboardRoute() {
  const { shareId } = useParams()
  return <main className="grid min-h-screen place-items-center bg-background px-5 text-text"><div className="max-w-md text-center"><p className="font-mono text-xs tracking-widest text-accent">SHARED DASHBOARD</p><h1 className="mt-3 font-display text-3xl font-extrabold">Dashboard viewer is planned.</h1><p className="mt-3 text-sm leading-6 text-text-soft">The public snapshot route will display a reviewed, published dashboard. Reference: {shareId}</p><Link className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-accent" to="/">Back to Unbound</Link></div></main>
}
