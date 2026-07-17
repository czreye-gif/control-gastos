import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import { useExpenses } from '../utils/useExpenses'
import { useAccounts } from '../utils/useAccounts'
import { useLoans, loanDerived } from '../utils/useLoans'
import { useConfirm } from '../contexts/ConfirmContext'
import { formatDayLabel, todayISO } from '../utils/dates'

const sortByDateDesc = (a, b) => (a.date < b.date ? 1 : -1)

// Agrupa los movimientos de préstamo por loanId.
function useLoanMovements(expenses) {
  return useMemo(() => {
    const map = new Map()
    for (const e of expenses) {
      if (e.loanId) {
        if (!map.has(e.loanId)) map.set(e.loanId, [])
        map.get(e.loanId).push(e)
      }
    }
    return map
  }, [expenses])
}

export default function Prestamos() {
  const { expenses, loading: loadingExp } = useExpenses()
  const { accounts } = useAccounts()
  const {
    loans,
    loading: loadingLoans,
    addLoan,
    updateLoan,
    deleteLoan,
    registerPayment,
    updatePayment,
    deletePayment,
  } = useLoans()
  const navigate = useNavigate()

  const [editing, setEditing] = useState(null) // null | 'new' | préstamo
  const [paying, setPaying] = useState(null) // préstamo al que se le abona
  const [editingPayment, setEditingPayment] = useState(null) // { movement }

  const movementsByLoan = useLoanMovements(expenses)
  const payAccounts = useMemo(() => accounts.filter((a) => !a.piggy), [accounts])

  const withDerived = useMemo(
    () => loans.map((l) => ({ loan: l, movements: movementsByLoan.get(l.id) ?? [], d: loanDerived(l, movementsByLoan.get(l.id) ?? []) })),
    [loans, movementsByLoan]
  )
  const lent = withDerived.filter((x) => x.loan.direction === 'lent')
  const borrowed = withDerived.filter((x) => x.loan.direction === 'borrowed')
  const totalLent = lent.reduce((a, x) => a + x.d.remaining, 0)
  const totalBorrowed = borrowed.reduce((a, x) => a + x.d.remaining, 0)

  const saveLoan = async (data) => {
    if (editing && editing !== 'new') await updateLoan(editing, data)
    else await addLoan(data)
    setEditing(null)
  }
  const removeLoan = async (id) => {
    await deleteLoan(id)
    setEditing(null)
  }

  if (loadingExp || loadingLoans) return <p className="loading-text">Cargando...</p>

  const renderGroup = (title, items, emptyText) => (
    <>
      <div className="section-row">
        <h3 className="section-title">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="empty-state" style={{ fontSize: 13 }}>{emptyText}</p>
      ) : (
        <div className="loan-list">
          {items.map(({ loan, movements, d }) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              movements={movements}
              derived={d}
              onEdit={() => setEditing(loan)}
              onAddPayment={() => setPaying(loan)}
              onSelectPayment={(m) => setEditingPayment(m)}
            />
          ))}
        </div>
      )}
    </>
  )

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">←</button>
        <h1>Préstamos</h1>
      </header>

      <p className="page-subtitle">
        Controla el dinero que prestas y el que te prestan. Cada préstamo y abono mueve dinero de tus cuentas
        como traspaso (no cuenta como gasto ni ingreso).
      </p>

      <div className="loan-totals">
        <div className="loan-total-card lent">
          <span className="loan-total-label">Me deben</span>
          <span className="loan-total-value">{formatMoney(totalLent)}</span>
        </div>
        <div className="loan-total-card borrowed">
          <span className="loan-total-label">Yo debo</span>
          <span className="loan-total-value">{formatMoney(totalBorrowed)}</span>
        </div>
      </div>

      {renderGroup('🫲 Me deben', lent, 'Nadie te debe por ahora.')}
      {renderGroup('🫱 Yo debo', borrowed, 'No tienes deudas registradas.')}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nuevo préstamo">+</button>

      {editing && (
        <LoanEditor
          initial={editing === 'new' ? null : editing}
          accounts={payAccounts}
          onSave={saveLoan}
          onDelete={removeLoan}
          onClose={() => setEditing(null)}
        />
      )}
      {paying && (
        <PaymentSheet
          loan={paying}
          remaining={loanDerived(paying, movementsByLoan.get(paying.id) ?? []).remaining}
          accounts={payAccounts}
          onConfirm={async ({ amount, date, account }) => {
            await registerPayment(paying, { amount, date, account })
            setPaying(null)
          }}
          onClose={() => setPaying(null)}
        />
      )}
      {editingPayment && (
        <PaymentEditor
          movement={editingPayment}
          accounts={payAccounts}
          onSave={async (data) => {
            await updatePayment(editingPayment.id, data)
            setEditingPayment(null)
          }}
          onDelete={async () => {
            await deletePayment(editingPayment.id)
            setEditingPayment(null)
          }}
          onClose={() => setEditingPayment(null)}
        />
      )}
    </div>
  )
}

function LoanCard({ loan, movements, derived, onEdit, onAddPayment, onSelectPayment }) {
  const isLent = loan.direction === 'lent'
  const overdue = loan.dueDate && !derived.settled && loan.dueDate < todayISO()
  const payments = [...movements].filter((m) => m.loanKind === 'payment').sort(sortByDateDesc)

  return (
    <div className={`loan-card ${derived.settled ? 'settled' : ''} ${overdue ? 'overdue' : ''}`}>
      <button className="loan-head" onClick={onEdit}>
        <span className="loan-name">{loan.name}</span>
        <span className="loan-meta">
          {formatMoney(loan.amount)} · {formatDayLabel(loan.date)}
          {loan.note ? ` · ${loan.note}` : ''}
        </span>
      </button>

      <div className="loan-balance-row">
        <span className="loan-balance-label">{derived.settled ? 'Liquidado ✓' : isLent ? 'Te deben' : 'Debes'}</span>
        <span className={`loan-balance-value ${derived.settled ? 'settled' : isLent ? 'income-text' : 'expense-text'}`}>
          {formatMoney(derived.remaining)}
        </span>
      </div>

      <div className="loan-bar">
        <div className="loan-bar-fill" style={{ width: `${Math.round(derived.progress * 100)}%` }} />
      </div>
      <div className="loan-sub">
        Abonado {formatMoney(derived.paid)} de {formatMoney(loan.amount)}
        {loan.dueDate && (
          <span className={overdue ? 'loan-due overdue' : 'loan-due'}>
            {' · '}{overdue ? 'Venció' : 'Vence'} {formatDayLabel(loan.dueDate)}
          </span>
        )}
      </div>

      {!derived.settled && (
        <div className="loan-actions">
          <button className="btn-primary" onClick={onAddPayment}>
            {isLent ? 'Registrar abono recibido' : 'Registrar pago'}
          </button>
        </div>
      )}

      {payments.length > 0 && (
        <div className="tanda-history">
          <p className="tanda-history-title">Abonos</p>
          {payments.map((m) => (
            <button key={m.id} type="button" className="tanda-history-item" onClick={() => onSelectPayment(m)}>
              <span className="tanda-history-label">{isLent ? 'Abono recibido' : 'Pago'}</span>
              <span className="tanda-history-date">{formatDayLabel(m.date)}</span>
              <span className={`tanda-history-amount ${isLent ? 'income-text' : 'expense-text'}`}>
                {formatMoney(m.amount)}
              </span>
              <span className="tanda-history-edit" aria-hidden="true">✎</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LoanEditor({ initial, accounts, onSave, onDelete, onClose }) {
  const confirm = useConfirm()
  const [direction, setDirection] = useState(initial?.direction ?? 'lent')
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [account, setAccount] = useState(initial?.account ?? '')
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  const amountNum = Number(amount)
  const canSave = name.trim() && amountNum > 0 && !!account

  const handleSave = () => {
    if (!canSave) return
    onSave({
      name: name.trim(),
      direction,
      amount: amountNum,
      date,
      account: account || null,
      dueDate: dueDate || null,
      note: note.trim(),
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{initial ? 'Editar préstamo' : 'Nuevo préstamo'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {initial ? (
          <p className="piggy-hint">{direction === 'lent' ? '🫲 Me deben (presté)' : '🫱 Yo debo (me prestaron)'}</p>
        ) : (
          <div className="type-toggle">
            <button type="button" className={`type-toggle-btn ${direction === 'lent' ? 'selected' : ''}`} onClick={() => setDirection('lent')}>
              Me deben (presté)
            </button>
            <button type="button" className={`type-toggle-btn ${direction === 'borrowed' ? 'selected' : ''}`} onClick={() => setDirection('borrowed')}>
              Yo debo (me prestaron)
            </button>
          </div>
        )}

        <input
          className="note-input"
          type="text"
          placeholder={direction === 'lent' ? '¿A quién le prestaste?' : '¿Quién te prestó?'}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <p className="picker-label">Monto prestado</p>
        <div className="amount-input-wrap">
          <span className="amount-prefix">$</span>
          <input className="amount-input-field" type="number" inputMode="decimal" min="0" step="1" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        {accounts.length === 0 ? (
          <p className="piggy-hint">Primero crea una cuenta para poder indicar de dónde sale o entra el dinero.</p>
        ) : (
          <>
            <p className="picker-label">{direction === 'lent' ? 'Sale de' : 'Entra a'}</p>
            <div className="subcategory-picker">
              {accounts.map((a) => (
                <button key={a.id} type="button" className={`subcategory-chip ${account === a.id ? 'selected' : ''}`} onClick={() => setAccount(account === a.id ? '' : a.id)}>
                  {a.icon} {a.name}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="picker-label">Fecha del préstamo</p>
        <input className="date-input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />

        <p className="picker-label">Fecha de vencimiento (opcional)</p>
        <input className="date-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        <input className="note-input" type="text" placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />

        <div className="sheet-actions">
          {initial && (
            <button
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({
                  title: `Eliminar préstamo`,
                  message: 'Se elimina el préstamo y todos sus movimientos (capital y abonos). El saldo de las cuentas se ajusta.',
                })
                if (ok) onDelete(initial.id)
              }}
            >
              Eliminar
            </button>
          )}
          <button className="btn-primary" disabled={!canSave} onClick={handleSave}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

function PaymentSheet({ loan, remaining, accounts, onConfirm, onClose }) {
  const isLent = loan.direction === 'lent'
  const [value, setValue] = useState(remaining > 0 ? String(remaining) : '')
  const [date, setDate] = useState(todayISO())
  const [account, setAccount] = useState(loan.account ?? '')
  const amount = Number(value)
  const canSave = value !== '' && amount > 0 && !!account

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{isLent ? 'Registrar abono recibido' : 'Registrar pago'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <p className="picker-label">Monto</p>
        <div className="amount-input-wrap">
          <span className="amount-prefix">$</span>
          <input className="amount-input-field" type="number" inputMode="decimal" min="0" step="1" placeholder="0" value={value} autoFocus onChange={(e) => setValue(e.target.value)} />
        </div>
        <p className="piggy-hint">Saldo pendiente: {formatMoney(remaining)}</p>

        {accounts.length > 0 && (
          <>
            <p className="picker-label">{isLent ? 'Entra a' : 'Sale de'}</p>
            <div className="subcategory-picker">
              {accounts.map((a) => (
                <button key={a.id} type="button" className={`subcategory-chip ${account === a.id ? 'selected' : ''}`} onClick={() => setAccount(account === a.id ? '' : a.id)}>
                  {a.icon} {a.name}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="picker-label">Fecha</p>
        <input className="date-input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />

        <div className="sheet-actions">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={!canSave} onClick={() => onConfirm({ amount, date, account })}>Registrar</button>
        </div>
      </div>
    </div>
  )
}

function PaymentEditor({ movement, accounts, onSave, onDelete, onClose }) {
  const confirm = useConfirm()
  const [value, setValue] = useState(String(movement.amount))
  const [date, setDate] = useState(movement.date)
  const [account, setAccount] = useState(movement.account ?? '')
  const amount = Number(value)
  const canSave = value !== '' && amount > 0 && !!account

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>Editar abono</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <p className="picker-label">Monto</p>
        <div className="amount-input-wrap">
          <span className="amount-prefix">$</span>
          <input className="amount-input-field" type="number" inputMode="decimal" min="0" step="1" value={value} autoFocus onChange={(e) => setValue(e.target.value)} />
        </div>

        {accounts.length > 0 && (
          <>
            <p className="picker-label">Cuenta</p>
            <div className="subcategory-picker">
              {accounts.map((a) => (
                <button key={a.id} type="button" className={`subcategory-chip ${account === a.id ? 'selected' : ''}`} onClick={() => setAccount(account === a.id ? '' : a.id)}>
                  {a.icon} {a.name}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="picker-label">Fecha</p>
        <input className="date-input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />

        <div className="sheet-actions">
          <button
            className="btn-danger"
            onClick={async () => {
              const ok = await confirm({ title: 'Eliminar abono', message: 'Se elimina este abono y el saldo del préstamo se ajusta.' })
              if (ok) onDelete()
            }}
          >
            Eliminar
          </button>
          <button className="btn-primary" disabled={!canSave} onClick={() => onSave({ amount, date, account })}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

// Resumen para Inicio: cuánto te deben y cuánto debes.
export function LoansSummary({ loans, expenses, onOpen }) {
  const movementsByLoan = useLoanMovements(expenses)
  const totals = useMemo(() => {
    let lent = 0
    let borrowed = 0
    for (const l of loans) {
      const { remaining } = loanDerived(l, movementsByLoan.get(l.id) ?? [])
      if (l.direction === 'lent') lent += remaining
      else borrowed += remaining
    }
    return { lent, borrowed }
  }, [loans, movementsByLoan])

  if (loans.length === 0) return null

  return (
    <button className="loan-summary-card" onClick={onOpen}>
      <span className="loan-summary-item">
        <span className="loan-summary-label">🫲 Me deben</span>
        <span className="loan-summary-value income-text">{formatMoney(totals.lent)}</span>
      </span>
      <span className="loan-summary-item">
        <span className="loan-summary-label">🫱 Yo debo</span>
        <span className="loan-summary-value expense-text">{formatMoney(totals.borrowed)}</span>
      </span>
    </button>
  )
}

// Banner en Inicio para préstamos vencidos o por vencer (7 días). Se pospone
// por día (localStorage).
const LOAN_ALERT_DAYS = 7

export function LoansAlert({ loans, expenses, onOpen }) {
  const movementsByLoan = useLoanMovements(expenses)
  const today = todayISO()
  const dismissKey = 'loanAlertDate'
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissKey) === today)

  const alerts = useMemo(() => {
    return loans
      .map((l) => ({ l, d: loanDerived(l, movementsByLoan.get(l.id) ?? []) }))
      .filter(({ l, d }) => l.dueDate && !d.settled)
      .map(({ l, d }) => {
        const days = Math.round((new Date(l.dueDate + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000)
        return { l, d, days }
      })
      .filter(({ days }) => days <= LOAN_ALERT_DAYS)
      .sort((a, b) => a.days - b.days)
  }, [loans, movementsByLoan, today])

  if (dismissed || alerts.length === 0) return null

  const dismiss = (e) => {
    e.stopPropagation()
    localStorage.setItem(dismissKey, today)
    setDismissed(true)
  }

  const overdueCount = alerts.filter((a) => a.days < 0).length

  return (
    <button className="facturables-alert" onClick={onOpen}>
      <span className="facturables-alert-icon">🤝</span>
      <span className="facturables-alert-body">
        <span className="facturables-alert-title">
          {overdueCount > 0 ? 'Préstamos vencidos' : 'Préstamos por vencer'}
        </span>
        <span className="facturables-alert-text">
          {alerts.length} {alerts.length === 1 ? 'préstamo' : 'préstamos'} con fecha límite cercana. Revísalos.
        </span>
      </span>
      <span className="facturables-alert-close" onClick={dismiss} aria-label="Posponer">✕</span>
    </button>
  )
}
