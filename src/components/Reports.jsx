import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useExpenses } from '../utils/useExpenses'
import { useCategories } from '../contexts/CategoriesContext'
import { currentMonthISO, formatMonthLabel, lastNMonths, monthOf } from '../utils/dates'
import { formatMoney } from './ExpenseList'

export default function Reports() {
  const { expenses, loading } = useExpenses()
  const { categories } = useCategories()
  const [month, setMonth] = useState(currentMonthISO())
  const months = useMemo(() => lastNMonths(6), [])

  const monthExpenses = useMemo(
    () => expenses.filter((e) => monthOf(e.date) === month),
    [expenses, month]
  )

  const total = monthExpenses.reduce((acc, e) => acc + e.amount, 0)

  const byCategory = useMemo(() => {
    const map = new Map()
    for (const e of monthExpenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    }
    return categories.map((c) => ({ ...c, value: map.get(c.id) ?? 0 })).filter((c) => c.value > 0)
  }, [monthExpenses, categories])

  const byMonth = useMemo(() => {
    return months.map((m) => ({
      month: formatMonthLabel(m).split(' ')[0].slice(0, 3),
      total: expenses.filter((e) => monthOf(e.date) === m).reduce((acc, e) => acc + e.amount, 0),
    }))
  }, [expenses, months])

  if (loading) return <p className="loading-text">Cargando...</p>

  return (
    <div className="page">
      <header className="reports-header">
        <h1>Reportes</h1>
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
      </header>

      <div className="total-card">
        <p>Total de {formatMonthLabel(month)}</p>
        <h2>{formatMoney(total)}</h2>
      </div>

      {byCategory.length === 0 ? (
        <p className="empty-state">No hay gastos registrados este mes.</p>
      ) : (
        <>
          <section className="chart-card">
            <h3>Por categoría</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {byCategory.map((c) => (
                    <Cell key={c.id} fill={c.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a1d24', border: '1px solid #2a2e37', borderRadius: 8, color: '#e5e7eb' }}
                  formatter={(value) => formatMoney(value)}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="legend-list">
              {byCategory
                .sort((a, b) => b.value - a.value)
                .map((c) => (
                  <li key={c.id}>
                    <span className="legend-dot" style={{ background: c.color }} />
                    <span>{c.icon} {c.name}</span>
                    <span className="legend-amount">{formatMoney(c.value)}</span>
                  </li>
                ))}
            </ul>
          </section>

          <section className="chart-card">
            <h3>Últimos 6 meses</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2e37" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: '#ffffff10' }}
                  contentStyle={{ background: '#1a1d24', border: '1px solid #2a2e37', borderRadius: 8, color: '#e5e7eb' }}
                  formatter={(value) => formatMoney(value)}
                />
                <Bar dataKey="total" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </>
      )}
    </div>
  )
}
