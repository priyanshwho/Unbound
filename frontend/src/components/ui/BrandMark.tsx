export function BrandMark({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-flex h-6 w-6 skew-x-[-17deg] items-end gap-[3px] ${className}`}><span className="h-3 w-1.5 rounded-t-sm bg-accent/70"/><span className="h-[18px] w-1.5 rounded-t-sm bg-accent/90"/><span className="h-6 w-1.5 rounded-t-sm bg-accent"/></span>
}
