import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { AnalysisResponse } from '../../analysis-chat/types'
import type { DashboardChartType } from '../dashboard-types'

const COLORS = ['#4c91ff', '#c8ee79', '#ff9d72', '#a78bfa', '#43d9c7', '#f2cf5b']

export function DashboardChart({ result, type: requestedType }: { result: AnalysisResponse; type: DashboardChartType }) {
  const rows = result.rows.map(row => ({
    category: String(row.category ?? '(missing group)'),
    value: row.value == null ? null : Number(row.value),
  })).filter(row => row.value === null || Number.isFinite(row.value))
  const measurable = rows.some(row => row.value !== null)
  const type = requestedType === 'pie' && (rows.length > 8 || rows.some(row => row.value === null || row.value < 0) || !rows.some(row => row.value !== null && row.value > 0))
    ? 'bar'
    : requestedType
  const common = { data: rows, margin: { top: 12, right: 12, bottom: 8, left: 0 } }
  const axisColor = 'var(--muted)'
  const tooltipStyle = { background: 'var(--surface-1)', border: '1px solid var(--line-strong)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }

  if (!measurable) return <p className="px-3 py-6 text-sm text-muted">No matching values to chart.</p>

  if (type === 'table') return <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-line text-muted"><tr><th className="px-3 py-3 font-medium">Group</th><th className="px-3 py-3 text-right font-medium">Value</th></tr></thead><tbody>{rows.map((row, index) => <tr className="border-b border-line last:border-0" key={`${row.category}-${index}`}><td className="px-3 py-3">{row.category}</td><td className="px-3 py-3 text-right font-mono tabular-nums">{row.value?.toLocaleString() ?? '—'}</td></tr>)}</tbody></table></div>

  if (type === 'pie') return <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip contentStyle={tooltipStyle}/><Legend formatter={value => <span style={{ color: axisColor, fontSize: 11 }}>{value}</span>}/><Pie data={rows} dataKey="value" nameKey="category" innerRadius={54} outerRadius={96} paddingAngle={3}>{rows.map((row, index) => <Cell key={`${row.category}-${index}`} fill={COLORS[index % COLORS.length]}/>)}</Pie></PieChart></ResponsiveContainer></div>

  if (type === 'line') return <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart {...common}><CartesianGrid stroke="var(--grid-line)" vertical={false}/><XAxis dataKey="category" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} width={56}/><Tooltip contentStyle={tooltipStyle}/><Line type="monotone" dataKey="value" name={result.plan.measure ?? 'Rows'} stroke={COLORS[0]} strokeWidth={3} dot={{ fill: COLORS[1], r: 3 }} activeDot={{ r: 5 }}/></LineChart></ResponsiveContainer></div>

  const horizontal = type === 'horizontal_bar'
  return <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart {...common} layout={horizontal ? 'vertical' : 'horizontal'}><CartesianGrid stroke="var(--grid-line)" vertical={!horizontal} horizontal={horizontal}/>{horizontal ? <><XAxis type="number" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="category" width={110} tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false}/></> : <><XAxis dataKey="category" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} width={56}/></>}<Tooltip contentStyle={tooltipStyle}/><Bar dataKey="value" name={result.plan.measure ?? 'Rows'} fill={COLORS[0]} radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={42}/></BarChart></ResponsiveContainer></div>
}

