import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import ExpenseList, { formatMoney } from './ExpenseList'
import AddExpense from './AddExpense'
import { BudgetBar } from './Budgets'
import { useExpenses } from '../utils/useExpenses'
import { useBudgets } from '../utils/useBudgets'
import { useCategories } from '../contexts/CategoriesContext'
import {
  addDaysISO,
  currentMonthISO,
  monthOf,
  prevMonthISO,
  shortDayName,
  startOfWeekISO,
  todayISO,
} from '../utils/dates'

export default function Home() {
  const { expenses, loading, addExpense, updateExpense, deleteExpense } = useExpenses()
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)

  const { budgets } = useBudgets()
  const { categories } = useCategories()

  const expensesOnly = useMemo(() => expenses.filter((e) => e.type !== 'income'), [expenses])
  const stats = useMemo(() => computeStats(expensesOnly), [expensesOnly])
  const balance = useMemo(() => computeBalance(expenses), [expenses])

  // Presupuestos del mes con su gasto acumulado, ordenados por % consumido
  // para que lo más urgente (excedido / por excederse) aparezca primero.
  const budgetProgress = useMemo(() => {
    const month = currentMonthISO()
    const spentByCat = new Map()
    for (const e of expensesOnly) {
      if (monthOf(e.date) !== month) continue
      spentByCat.set(e.category, (spentByCat.get(e.category) ?? 0) + e.amount)
    }
    return budgets
      .map((b) => {
        const category = categories.find((c) => c.id === b.category)
        if (!category) return null
        return { category, limit: b.amount, spent: spentByCat.get(b.category) ?? 0 }
      })
      .filter(Boolean)
      .sort((a, b) => b.spent / b.limit - a.spent / a.limit)
  }, [budgets, categories, expensesOnly])

  const handleSave = async (data) => {
    if (editing) {
      await updateExpense(editing.id, data)
    } else {
      await addExpense(data)
    }
    setShowAdd(false)
    setEditing(null)
  }

  const handleDelete = async (id) => {
    await deleteExpense(id)
    setShowAdd(false)
    setEditing(null)
  }

  return (
    <div className="page">
      <div className="home-topbar">
        <h2>Mis finanzas</h2>
        <button className="icon-btn" onClick={() => navigate('/categorias')} aria-label="Editar categorías">
          ⚙️
        </button>
      </div>

      <div className="balance-card">
        <div className="balance-item">
          <span className="balance-label">Ingresos del mes</span>
          <span className="balance-value income">{formatMoney(balance.income)}</span>
        </div>
        <div className="balance-item">
          <span className="balance-label">Gastos del mes</span>
          <span className="balance-value expense">{formatMoney(balance.expense)}</span>
        </div>
        <div className="balance-item">
          <span className="balance-label">Balance</span>
          <span className={`balance-value ${balance.balance >= 0 ? 'income' : 'expense'}`}>
            {formatMoney(balance.balance)}
          </span>
        </div>
      </div>

      <h3 className="section-title">Gastos</h3>
      <div className="stat-grid">
        <StatCard label="Hoy" value={stats.today} prev={stats.yesterday} hint="vs ayer" />
        <StatCard label="Semana" value={stats.week} prev={stats.lastWeek} hint="vs sem. pasada" />
        <StatCard label="Mes" value={stats.month} prev={stats.lastMonth} hint="vs mes pasado" />
      </div>

      <div className="section-row">
        <h3 className="section-title">Presupuestos</h3>
        <button className="link-btn" onClick={() => navigate('/presupuestos')}>
          Gestionar ›
        </button>
      </div>
      {budgetProgress.length === 0 ? (
        <button className="budget-cta" onClick={() => navigate('/presupuestos')}>
          Define presupuestos por categoría para controlar tus gastos →
        </button>
      ) : (
        <div className="budget-list">
          {budgetProgress.slice(0, 3).map((b) => (
            <BudgetBar
              key={b.category.id}
              category={b.category}
              spent={b.spent}
              limit={b.limit}
              onClick={() => navigate('/presupuestos')}
            />
          ))}
        </div>
      )}

      <section className="chart-card">
        <h3>Últimos 7 días</h3>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={stats.last7}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2e37" />
            <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: '#ffffff10' }}
              contentStyle={{ background: '#1a1d24', border: '1px solid #2a2e37', borderRadius: 8, color: '#e5e7eb' }}
              formatter={(value) => formatMoney(value)}
            />
            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
              {stats.last7.map((d, i) => (
                <Cell key={i} fill={d.isToday ? '#22c55e' : '#3b6e4f'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="chart-card">
        <h3>Este mes vs mes pasado</h3>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={stats.monthCompare}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2e37" />
            <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: '#ffffff10' }}
              contentStyle={{ background: '#1a1d24', border: '1px solid #2a2e37', borderRadius: 8, color: '#e5e7eb' }}
              formatter={(value) => formatMoney(value)}
            />
            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
              {stats.monthCompare.map((d, i) => (
                <Cell key={i} fill={i === 1 ? '#22c55e' : '#3b6e4f'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <h3 className="section-title">Movimientos recientes</h3>
      {loading ? (
        <p className="loading-text">Cargando...</p>
      ) : (
        <ExpenseList
          expenses={expenses}
          onSelect={(expense) => {
            setEditing(expense)
            setShowAdd(true)
          }}
        />
      )}

      <button
        className="fab"
        onClick={() => {
          setEditing(null)
          setShowAdd(true)
        }}
        aria-label="Agregar movimiento"
      >
        +
      </button>

      {showAdd && (
        <AddExpense
          initial={editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => {
            setShowAdd(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, prev, hint }) {
  const pct = prev > 0 ? Math.round(((value - prev) / prev) * 100) : null
  const up = pct !== null && pct > 0
  const down = pct !== null && pct < 0

  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{formatMoney(value)}</span>
      {pct === null ? (
        <span className="stat-delta neutral">{hint}</span>
      ) : (
        <span className={`stat-delta ${up ? 'bad' : down ? 'good' : 'neutral'}`}>
          {up ? '▲' : down ? '▼' : '='} {Math.abs(pct)}% {hint}
        </span>
      )}
    </div>
  )
}

function computeBalance(expenses) {
  const month = currentMonthISO()
  const monthItems = expenses.filter((e) => monthOf(e.date) === month)
  const income = monthItems.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0)
  const expense = monthItems.filter((e) => e.type !== 'income').reduce((a, e) => a + e.amount, 0)
  return { income, expense, balance: income - expense }
}

function computeStats(expenses) {
  const today = todayISO()
  const yesterday = addDaysISO(today, -1)
  const weekStart = startOfWeekISO(today)
  const nextWeekStart = addDaysISO(weekStart, 7)
  const lastWeekStart = addDaysISO(weekStart, -7)
  const month = currentMonthISO()
  const lastMonth = prevMonthISO()

  const sumWhere = (pred) => expenses.filter(pred).reduce((a, e) => a + e.amount, 0)

  const last7 = []
  for (let i = 6; i >= 0; i--) {
    const iso = addDaysISO(today, -i)
    last7.push({ label: shortDayName(iso), total: sumWhere((e) => e.date === iso), isToday: iso === today })
  }

  return {
    today: sumWhere((e) => e.date === today),
    yesterday: sumWhere((e) => e.date === yesterday),
    week: sumWhere((e) => e.date >= weekStart && e.date < nextWeekStart),
    lastWeek: sumWhere((e) => e.date >= lastWeekStart && e.date < weekStart),
    month: sumWhere((e) => monthOf(e.date) === month),
    lastMonth: sumWhere((e) => monthOf(e.date) === lastMonth),
    last7,
    monthCompare: [
      { label: 'Mes pasado', total: sumWhere((e) => monthOf(e.date) === lastMonth) },
      { label: 'Este mes', total: sumWhere((e) => monthOf(e.date) === month) },
    ],
  }
}
