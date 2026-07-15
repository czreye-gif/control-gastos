import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import AddExpense from './AddExpense'
import { useExpenses } from '../utils/useExpenses'
import { useAccounts } from '../utils/useAccounts'
import { useCategories } from '../contexts/CategoriesContext'
import {
  currentMonthISO,
  daysInMonth,
  formatDayLabel,
  formatMonthLabel,
  lastNMonths,
  monthOf,
  todayISO,
} from '../utils/dates'

// Un gasto es facturable si el usuario lo marcó al registrarlo. Solo aplica a
// gastos reales (no traspasos ni ingresos).
function isBillable(e) {
  return !!e.billable && !e.transfer && (e.type ?? 'expense') === 'expense'
}

function isFacturado(e) {
  return e.invoiceStatus === 'facturado'
}

// ¿Estamos en los últimos 5 días del mes? (para lanzar el recordatorio).
export function isEndOfMonthWindow() {
  const day = Number(todayISO().slice(8, 10))
  const last = daysInMonth(currentMonthISO())
  return day >= last - 5
}

export default function GastosFacturables() {
  const { expenses, loading, updateExpense, deleteExpense } = useExpenses()
  const { accounts } = useAccounts()
  const { getCategory, getSubcategory } = useCategories()
  const navigate = useNavigate()
  const [month, setMonth] = useState(currentMonthISO())
  const [filter, setFilter] = useState('todos') // todos | pendiente | facturado
  const [editing, setEditing] = useState(null)
  const months = useMemo(() => lastNMonths(6), [])

  const billable = useMemo(
    () =>
      expenses
        .filter((e) => isBillable(e) && monthOf(e.date) === month)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [expenses, month]
  )

  const totalPendiente = billable.filter((e) => !isFacturado(e)).reduce((a, e) => a + e.amount, 0)
  const totalFacturado = billable.filter((e) => isFacturado(e)).reduce((a, e) => a + e.amount, 0)
  const total = totalPendiente + totalFacturado

  const visible = useMemo(() => {
    if (filter === 'pendiente') return billable.filter((e) => !isFacturado(e))
    if (filter === 'facturado') return billable.filter((e) => isFacturado(e))
    return billable
  }, [billable, filter])

  const toggleStatus = (e) => {
    updateExpense(e.id, { invoiceStatus: isFacturado(e) ? 'pendiente' : 'facturado' })
  }

  const handleSave = async (data) => {
    if (!editing) return
    const op = updateExpense(editing.id, data)
    setEditing(null)
    try {
      await op
    } catch (err) {
      console.error('No se pudo sincronizar el movimiento:', err)
    }
  }

  const handleDelete = async (id) => {
    await deleteExpense(id)
    setEditing(null)
  }

  if (loading) return <p className="loading-text">Cargando...</p>

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">
          ←
        </button>
        <h1>Gastos Facturables</h1>
      </header>

      <p className="page-subtitle">
        Gastos que marcaste para solicitar factura (CFDI). Marca cada uno como facturado cuando ya te
        timbraron. Envía los tickets pendientes por correo a contaduría; ellos concilian.
      </p>

      <div className="filter-row">
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="total-card">
        <p>
          {billable.length} {billable.length === 1 ? 'gasto facturable' : 'gastos facturables'} ·{' '}
          {formatMonthLabel(month)}
        </p>
        <h2>{formatMoney(total)}</h2>
        <div className="facturable-totals">
          <span className="facturable-total-pend">⏳ Pendiente {formatMoney(totalPendiente)}</span>
          <span className="facturable-total-fact">✅ Facturado {formatMoney(totalFacturado)}</span>
        </div>
      </div>

      {billable.length === 0 ? (
        <p className="empty-state">
          No hay gastos marcados como facturables en {formatMonthLabel(month)}.
          <br />
          Al registrar un gasto, activa <strong>🧾 Solicitar factura</strong> para que aparezca aquí.
        </p>
      ) : (
        <>
          <div className="type-toggle">
            <button
              type="button"
              className={`type-toggle-btn ${filter === 'todos' ? 'selected' : ''}`}
              onClick={() => setFilter('todos')}
            >
              Todos
            </button>
            <button
              type="button"
              className={`type-toggle-btn ${filter === 'pendiente' ? 'selected' : ''}`}
              onClick={() => setFilter('pendiente')}
            >
              Pendientes
            </button>
            <button
              type="button"
              className={`type-toggle-btn ${filter === 'facturado' ? 'selected' : ''}`}
              onClick={() => setFilter('facturado')}
            >
              Facturados
            </button>
          </div>

          {totalPendiente > 0 && (
            <div className="facturables-hint">
              📧 Recuerda enviar los tickets de los gastos <strong>pendientes</strong> a contaduría antes del
              cierre del mes.
            </div>
          )}

          <div className="facturable-list">
            {visible.map((e) => {
              const cat = getCategory(e.category)
              const sub = getSubcategory(e.category, e.subcategory)
              const facturado = isFacturado(e)
              return (
                <div key={e.id} className="facturable-item">
                  <button className="facturable-main" onClick={() => setEditing(e)}>
                    <span className="expense-icon" style={{ background: cat.color + '22', color: cat.color }}>
                      {cat.icon}
                    </span>
                    <span className="expense-info">
                      <span className="expense-category">
                        {cat.name}
                        {sub && <span className="expense-subcategory"> · {sub.name}</span>}
                      </span>
                      <span className="expense-note">
                        {formatDayLabel(e.date)}
                        {e.note ? ` · ${e.note}` : ''}
                      </span>
                    </span>
                    <span className="expense-amount">-{formatMoney(e.amount)}</span>
                  </button>
                  <button
                    className={`invoice-chip ${facturado ? 'facturado' : 'pendiente'}`}
                    onClick={() => toggleStatus(e)}
                  >
                    {facturado ? '✅ Facturado' : '⏳ Pendiente'}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {editing && (
        <AddExpense
          initial={editing}
          expenses={expenses}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// Banner recordatorio que aparece en Inicio durante los últimos 5 días del mes,
// mientras haya gastos facturables PENDIENTES. Se puede posponer por día
// (guardado en localStorage): reaparece cada uno de los 5 días del cierre.
export function FacturablesAlert() {
  const { expenses } = useExpenses()
  const navigate = useNavigate()
  const month = currentMonthISO()
  const today = todayISO()
  const dismissKey = 'facturables-alert-dismissed'
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissKey) === today)

  const pendientes = useMemo(
    () => expenses.filter((e) => isBillable(e) && !isFacturado(e) && monthOf(e.date) === month),
    [expenses, month]
  )
  const total = pendientes.reduce((acc, e) => acc + e.amount, 0)

  if (dismissed || !isEndOfMonthWindow() || pendientes.length === 0) return null

  const dismiss = (e) => {
    e.stopPropagation()
    localStorage.setItem(dismissKey, today)
    setDismissed(true)
  }

  return (
    <button className="facturables-alert" onClick={() => navigate('/facturables')}>
      <span className="facturables-alert-icon">🧾</span>
      <span className="facturables-alert-body">
        <span className="facturables-alert-title">Cierre de mes: gastos por facturar</span>
        <span className="facturables-alert-text">
          Tienes {pendientes.length} {pendientes.length === 1 ? 'gasto pendiente' : 'gastos pendientes'} por{' '}
          {formatMoney(total)}. Revísalos y envía los tickets a contaduría.
        </span>
      </span>
      <span className="facturables-alert-close" onClick={dismiss} aria-label="Posponer">
        ✕
      </span>
    </button>
  )
}
