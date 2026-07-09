import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
import { COLOR_OPTIONS } from '../utils/categories'

// Paleta para subcategorías: alterna entre los colores disponibles.
const SUB_COLORS = [...COLOR_OPTIONS, '#64748b', '#475569', '#94a3b8']

export default function Reports() {
  const { expenses, loading } = useExpenses()
  const { categories } = useCategories()
  const [month, setMonth] = useState(currentMonthISO())
  const [type, setType] = useState('expense')
  const [selectedCatId, setSelectedCatId] = useState(null)
  const months = useMemo(() => lastNMonths(6), [])

  // Limpia la selección al cambiar tipo o mes.
  useEffect(() => { setSelectedCatId(null) }, [type, month])

  const typeExpenses = useMemo(
    () => expenses.filter((e) => (e.type ?? 'expense') === type && !e.transfer),
    [expenses, type]
  )
  const typeCategories = useMemo(() => categories.filter((c) => c.type === type), [categories, type])

  const monthExpenses = useMemo(
    () => typeExpenses.filter((e) => monthOf(e.date) === month),
    [typeExpenses, month]
  )

  const total = monthExpenses.reduce((acc, e) => acc + e.amount, 0)

  const byCategory = useMemo(() => {
    const map = new Map()
    for (const e of monthExpenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    }
    return typeCategories.map((c) => ({ ...c, value: map.get(c.id) ?? 0 })).filter((c) => c.value > 0)
  }, [monthExpenses, typeCategories])

  // Limpia la selección si la categoría ya no existe en los datos del mes.
  useEffect(() => {
    if (selectedCatId && !byCategory.some((c) => c.id === selectedCatId)) {
      setSelectedCatId(null)
    }
  }, [byCategory, selectedCatId])

  const selectedCat = useMemo(
    () => (selectedCatId ? byCategory.find((c) => c.id === selectedCatId) ?? null : null),
    [selectedCatId, byCategory]
  )

  // Desglose de subcategorías para la categoría seleccionada.
  const bySubcategory = useMemo(() => {
    if (!selectedCatId) return []
    const cat = typeCategories.find((c) => c.id === selectedCatId)
    const subs = cat?.subcategories ?? []
    const catExps = monthExpenses.filter((e) => e.category === selectedCatId)
    const map = new Map()
    for (const e of catExps) {
      const key = e.subcategory ?? ''
      map.set(key, (map.get(key) ?? 0) + e.amount)
    }
    return [...map.entries()]
      .map(([subId, value], i) => {
        const sub = subId ? subs.find((s) => s.id === subId) : null
        return {
          id: subId || '__none__',
          name: sub ? sub.name : (subs.length === 0 ? cat?.name ?? 'Total' : 'Sin subcategoría'),
          icon: sub?.icon ?? cat?.icon ?? '',
          value,
          color: SUB_COLORS[i % SUB_COLORS.length],
        }
      })
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [selectedCatId, monthExpenses, typeCategories])

  const hasRealSubcategories = bySubcategory.some((s) => s.id !== '__none__')

  const byMonth = useMemo(() => {
    return months.map((m) => ({
      month: formatMonthLabel(m).split(' ')[0].slice(0, 3),
      total: typeExpenses.filter((e) => monthOf(e.date) === m).reduce((acc, e) => acc + e.amount, 0),
    }))
  }, [typeExpenses, months])

  // --- Balance (ingresos vs gastos) ---
  const incomeMovs = useMemo(
    () => expenses.filter((e) => (e.type ?? 'expense') === 'income' && !e.transfer),
    [expenses]
  )
  const spendMovs = useMemo(
    () => expenses.filter((e) => (e.type ?? 'expense') === 'expense' && !e.transfer),
    [expenses]
  )

  const sumInMonth = (movs, m) =>
    movs.filter((e) => monthOf(e.date) === m).reduce((acc, e) => acc + e.amount, 0)

  const monthIncome = sumInMonth(incomeMovs, month)
  const monthExpense = sumInMonth(spendMovs, month)
  const saldo = monthIncome - monthExpense

  const balanceByMonth = useMemo(() => {
    return months.map((m) => ({
      month: formatMonthLabel(m).split(' ')[0].slice(0, 3),
      ingresos: sumInMonth(incomeMovs, m),
      gastos: sumInMonth(spendMovs, m),
    }))
  }, [incomeMovs, spendMovs, months])

  const toggleCat = (id) => setSelectedCatId((prev) => (prev === id ? null : id))

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

      <div className="type-toggle">
        <button
          type="button"
          className={`type-toggle-btn ${type === 'expense' ? 'selected' : ''}`}
          onClick={() => setType('expense')}
        >
          Gastos
        </button>
        <button
          type="button"
          className={`type-toggle-btn income ${type === 'income' ? 'selected' : ''}`}
          onClick={() => setType('income')}
        >
          Ingresos
        </button>
        <button
          type="button"
          className={`type-toggle-btn ${type === 'balance' ? 'selected' : ''}`}
          onClick={() => setType('balance')}
        >
          Balance
        </button>
      </div>

      {type !== 'balance' && (
        <div className="total-card">
          <p>Total de {formatMonthLabel(month)}</p>
          <h2>{formatMoney(total)}</h2>
        </div>
      )}

      {type === 'balance' ? (
        <>
          <div className={`total-card ${saldo < 0 ? 'negative' : ''}`}>
            <p>Saldo de {formatMonthLabel(month)}</p>
            <h2>{formatMoney(saldo)}</h2>
          </div>

          <div className="balance-breakdown">
            <div className="balance-item">
              <span className="legend-dot" style={{ background: '#22c55e' }} />
              <span>Ingresos</span>
              <span className="legend-amount">{formatMoney(monthIncome)}</span>
            </div>
            <div className="balance-item">
              <span className="legend-dot" style={{ background: '#f87171' }} />
              <span>Gastos</span>
              <span className="legend-amount">{formatMoney(monthExpense)}</span>
            </div>
          </div>

          <section className="chart-card">
            <h3>Ingresos vs gastos (últimos 6 meses)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={balanceByMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2e37" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: '#ffffff10' }}
                  contentStyle={{ background: '#1a1d24', border: '1px solid #2a2e37', borderRadius: 8, color: '#e5e7eb' }}
                  formatter={(value) => formatMoney(value)}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar name="Ingresos" dataKey="ingresos" fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar name="Gastos" dataKey="gastos" fill="#f87171" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </>
      ) : byCategory.length === 0 ? (
        <p className="empty-state">
          {type === 'income' ? 'No hay ingresos registrados este mes.' : 'No hay gastos registrados este mes.'}
        </p>
      ) : (
        <>
          {/* Gráfico por categoría */}
          <section className="chart-card">
            <h3>Por categoría <span className="chart-hint">Toca una categoría para ver el detalle</span></h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  onClick={(data) => toggleCat(data.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {byCategory.map((c) => (
                    <Cell
                      key={c.id}
                      fill={c.color}
                      opacity={selectedCatId && selectedCatId !== c.id ? 0.35 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a1d24', border: '1px solid #2a2e37', borderRadius: 8, color: '#e5e7eb' }}
                  formatter={(value) => formatMoney(value)}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="legend-list">
              {[...byCategory]
                .sort((a, b) => b.value - a.value)
                .map((c) => (
                  <li
                    key={c.id}
                    className={`legend-item-btn ${selectedCatId === c.id ? 'legend-item-active' : ''}`}
                    onClick={() => toggleCat(c.id)}
                  >
                    <span className="legend-dot" style={{ background: c.color }} />
                    <span>{c.icon} {c.name}</span>
                    <span className="legend-amount">{formatMoney(c.value)}</span>
                    <span className="legend-chevron">{selectedCatId === c.id ? '▴' : '▾'}</span>
                  </li>
                ))}
            </ul>
          </section>

          {/* Gráfico por subcategoría (drill-down) */}
          {selectedCat && (
            <section className="chart-card subchart-card">
              <div className="subchart-header">
                <button className="icon-btn" onClick={() => setSelectedCatId(null)} aria-label="Cerrar">←</button>
                <h3>
                  <span style={{ color: selectedCat.color }}>{selectedCat.icon}</span>{' '}
                  {selectedCat.name}
                </h3>
                <span className="subchart-total">{formatMoney(selectedCat.value)}</span>
              </div>

              {!hasRealSubcategories ? (
                <p className="empty-state" style={{ fontSize: 13, marginTop: 8 }}>
                  Esta categoría no tiene subcategorías registradas.
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={bySubcategory}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {bySubcategory.map((s) => (
                          <Cell key={s.id} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#1a1d24', border: '1px solid #2a2e37', borderRadius: 8, color: '#e5e7eb' }}
                        formatter={(value) => formatMoney(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="legend-list">
                    {bySubcategory.map((s) => (
                      <li key={s.id}>
                        <span className="legend-dot" style={{ background: s.color }} />
                        <span>{s.icon} {s.name}</span>
                        <span className="legend-amount">{formatMoney(s.value)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

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
