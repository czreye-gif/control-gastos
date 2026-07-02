import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import { useExpenses } from '../utils/useExpenses'
import { useBudgets } from '../utils/useBudgets'
import { useCategories } from '../contexts/CategoriesContext'
import { currentMonthISO, formatMonthLabel, monthOf } from '../utils/dates'

// Estado visual de un presupuesto según cuánto se ha consumido.
function budgetState(spent, limit) {
  const ratio = limit > 0 ? spent / limit : 0
  if (ratio >= 1) return 'over'
  if (ratio >= 0.75) return 'warn'
  return 'ok'
}

// Barra de progreso reutilizable (la usa también Inicio).
export function BudgetBar({ category, spent, limit, onClick }) {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
  const state = budgetState(spent, limit)
  const remaining = limit - spent
  const ratio = limit > 0 ? Math.round((spent / limit) * 100) : 0

  return (
    <button type="button" className="budget-bar" onClick={onClick}>
      <div className="budget-bar-head">
        <span className="budget-bar-name">
          {category.icon} {category.name}
        </span>
        <span className="budget-bar-amount">
          {formatMoney(spent)} <span className="budget-bar-limit">/ {formatMoney(limit)}</span>
        </span>
      </div>
      <div className="budget-track">
        <div className={`budget-fill ${state}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`budget-bar-foot ${state}`}>
        {state === 'over'
          ? `Excedido por ${formatMoney(spent - limit)}`
          : `Quedan ${formatMoney(remaining)} · ${ratio}% usado`}
      </div>
    </button>
  )
}

export default function Budgets() {
  const { expenses, loading } = useExpenses()
  const { budgets, setBudget, deleteBudget } = useBudgets()
  const { categories } = useCategories()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(null) // categoría en edición | null

  const month = currentMonthISO()

  const spentByCat = useMemo(() => {
    const map = new Map()
    for (const e of expenses) {
      if ((e.type ?? 'expense') !== 'expense' || e.transfer) continue
      if (monthOf(e.date) !== month) continue
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    }
    return map
  }, [expenses, month])

  const budgetMap = useMemo(() => new Map(budgets.map((b) => [b.category, b.amount])), [budgets])

  const expenseCategories = useMemo(() => categories.filter((c) => c.type === 'expense'), [categories])

  const withBudget = expenseCategories.filter((c) => budgetMap.has(c.id))
  const withoutBudget = expenseCategories.filter((c) => !budgetMap.has(c.id))

  const totals = useMemo(() => {
    let budget = 0
    let spent = 0
    for (const c of withBudget) {
      budget += budgetMap.get(c.id)
      spent += spentByCat.get(c.id) ?? 0
    }
    return { budget, spent }
  }, [withBudget, budgetMap, spentByCat])

  const handleSave = async (amount) => {
    await setBudget(editing.id, amount)
    setEditing(null)
  }

  const handleRemove = async () => {
    await deleteBudget(editing.id)
    setEditing(null)
  }

  if (loading) return <p className="loading-text">Cargando...</p>

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">
          ←
        </button>
        <h1>Presupuestos</h1>
      </header>

      <p className="page-subtitle">Límites de gasto para {formatMonthLabel(month)}</p>

      {withBudget.length > 0 && (
        <div className={`total-card ${totals.spent > totals.budget ? 'negative' : ''}`}>
          <p>Gastado de tu presupuesto</p>
          <h2>
            {formatMoney(totals.spent)} <span className="total-of">/ {formatMoney(totals.budget)}</span>
          </h2>
        </div>
      )}

      {withBudget.length > 0 && (
        <div className="budget-list">
          {withBudget.map((c) => (
            <BudgetBar
              key={c.id}
              category={c}
              spent={spentByCat.get(c.id) ?? 0}
              limit={budgetMap.get(c.id)}
              onClick={() => setEditing(c)}
            />
          ))}
        </div>
      )}

      <h3 className="section-title">Sin presupuesto</h3>
      {withoutBudget.length === 0 ? (
        <p className="empty-state">Todas tus categorías de gasto ya tienen presupuesto.</p>
      ) : (
        <div className="category-rows">
          {withoutBudget.map((c) => (
            <button key={c.id} className="category-row" onClick={() => setEditing(c)}>
              <span className="row-icon" style={{ background: c.color + '22', color: c.color }}>
                {c.icon}
              </span>
              <span className="row-name">{c.name}</span>
              <span className="row-edit">Definir ›</span>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <BudgetEditor
          category={editing}
          initialAmount={budgetMap.get(editing.id) ?? null}
          onSave={handleSave}
          onRemove={handleRemove}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function BudgetEditor({ category, initialAmount, onSave, onRemove, onClose }) {
  const [value, setValue] = useState(initialAmount != null ? String(initialAmount) : '')
  const amount = Number(value)
  const canSave = value !== '' && Number.isFinite(amount) && amount > 0

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>
          {category.icon} {category.name}
        </h2>
        <p className="picker-label">Límite mensual</p>
        <div className="amount-input-wrap">
          <span className="amount-prefix">$</span>
          <input
            className="amount-input-field"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            placeholder="0"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSave) onSave(amount)
            }}
          />
        </div>

        <div className="sheet-actions">
          {initialAmount != null && (
            <button className="btn-danger" onClick={onRemove}>
              Quitar
            </button>
          )}
          <button className="btn-primary" disabled={!canSave} onClick={() => onSave(amount)}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
