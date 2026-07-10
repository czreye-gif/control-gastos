import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ExpenseList, { formatMoney } from './ExpenseList'
import AddExpense from './AddExpense'
import { useExpenses } from '../utils/useExpenses'
import { useAccounts } from '../utils/useAccounts'
import {
  currentMonthISO,
  daysInMonth,
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

// ¿Estamos en los últimos 5 días del mes? (para lanzar el recordatorio).
export function isEndOfMonthWindow() {
  const day = Number(todayISO().slice(8, 10))
  const last = daysInMonth(currentMonthISO())
  return day >= last - 5
}

export default function GastosFacturables() {
  const { expenses, loading, updateExpense, deleteExpense } = useExpenses()
  const { accounts } = useAccounts()
  const navigate = useNavigate()
  const [month, setMonth] = useState(currentMonthISO())
  const [editing, setEditing] = useState(null)
  const months = useMemo(() => lastNMonths(6), [])

  const billable = useMemo(
    () => expenses.filter((e) => isBillable(e) && monthOf(e.date) === month),
    [expenses, month]
  )
  const total = billable.reduce((acc, e) => acc + e.amount, 0)

  const handleSave = async (data) => {
    if (!editing) return
    const op = updateExpense(editing.id, data)
    setEditing(null)
    try {
      await op
    } catch (e) {
      console.error('No se pudo sincronizar el movimiento:', e)
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
        Gastos que marcaste para solicitar factura (CFDI). Envía sus tickets por correo a contaduría;
        ellos realizan la conciliación.
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
      </div>

      {billable.length === 0 ? (
        <p className="empty-state">
          No hay gastos marcados como facturables en {formatMonthLabel(month)}.
          <br />
          Al registrar un gasto, activa <strong>🧾 Solicitar factura</strong> para que aparezca aquí.
        </p>
      ) : (
        <>
          <div className="facturables-hint">
            📧 Recuerda enviar los tickets de estos gastos a contaduría antes del cierre del mes.
          </div>
          <ExpenseList
            expenses={billable}
            accounts={accounts}
            onSelect={(expense) => setEditing(expense)}
          />
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
// mientras haya gastos facturables sin revisar. Se puede posponer por mes
// (guardado en localStorage) para no repetir el aviso una vez atendido.
export function FacturablesAlert() {
  const { expenses } = useExpenses()
  const navigate = useNavigate()
  const month = currentMonthISO()
  const dismissKey = 'facturables-alert-dismissed'
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(dismissKey) === month
  )

  const billable = useMemo(
    () => expenses.filter((e) => isBillable(e) && monthOf(e.date) === month),
    [expenses, month]
  )
  const total = billable.reduce((acc, e) => acc + e.amount, 0)

  if (dismissed || !isEndOfMonthWindow() || billable.length === 0) return null

  const dismiss = (e) => {
    e.stopPropagation()
    localStorage.setItem(dismissKey, month)
    setDismissed(true)
  }

  return (
    <button className="facturables-alert" onClick={() => navigate('/facturables')}>
      <span className="facturables-alert-icon">🧾</span>
      <span className="facturables-alert-body">
        <span className="facturables-alert-title">Cierre de mes: gastos facturables</span>
        <span className="facturables-alert-text">
          Tienes {billable.length} {billable.length === 1 ? 'gasto' : 'gastos'} por {formatMoney(total)}.
          Revísalos y envía los tickets a contaduría.
        </span>
      </span>
      <span className="facturables-alert-close" onClick={dismiss} aria-label="Posponer">
        ✕
      </span>
    </button>
  )
}
