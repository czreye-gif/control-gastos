import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import { useRecurring, dueOccurrences } from '../utils/useRecurring'
import { useCategories } from '../contexts/CategoriesContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { useAccounts } from '../utils/useAccounts'
import { currentMonthISO, dateOfMonth, formatDayLabel, nextMonth, todayISO } from '../utils/dates'

export default function Recurring() {
  const { recurring, loading, addRecurring, updateRecurring, deleteRecurring, generateNow } = useRecurring()
  const { getCategory, getSubcategory } = useCategories()
  const { accounts } = useAccounts()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(null) // null | 'new' | plantilla

  const handleSave = async (data) => {
    if (editing && editing !== 'new') {
      await updateRecurring(editing.id, data)
    } else {
      const ref = await addRecurring(data)
      // Si el día ya pasó este mes, genera el primer movimiento al instante.
      await generateNow({ id: ref.id, ...data, startMonth: currentMonthISO(), lastGenerated: null, active: true })
    }
    setEditing(null)
  }

  const handleDelete = async (id) => {
    await deleteRecurring(id)
    setEditing(null)
  }

  const toggleActive = (e, t) => {
    e.stopPropagation()
    updateRecurring(t.id, { active: !(t.active !== false) })
  }

  if (loading) return <p className="loading-text">Cargando...</p>

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">
          ←
        </button>
        <h1>Pagos recurrentes</h1>
      </header>

      <p className="page-subtitle">Movimientos que se registran automáticamente cada mes.</p>

      {recurring.length === 0 ? (
        <p className="empty-state">
          Aún no tienes pagos recurrentes.
          <br />
          Toca + para agregar renta, suscripciones, etc.
        </p>
      ) : (
        <div className="recurring-list">
          {recurring.map((t) => {
            const cat = getCategory(t.category)
            const sub = getSubcategory(t.category, t.subcategory)
            const isIncome = t.type === 'income'
            const inactive = t.active === false
            return (
              <button
                key={t.id}
                className={`recurring-item ${inactive ? 'inactive' : ''}`}
                onClick={() => setEditing(t)}
              >
                <span className="expense-icon" style={{ background: cat.color + '22', color: cat.color }}>
                  {cat.icon}
                </span>
                <span className="expense-info">
                  <span className="expense-category">
                    {cat.name}
                    {sub && <span className="expense-subcategory"> · {sub.name}</span>}
                  </span>
                  <span className="expense-note">
                    Día {t.dayOfMonth} de cada mes{t.note ? ` · ${t.note}` : ''}
                  </span>
                </span>
                <span className="recurring-right">
                  <span className={`expense-amount ${isIncome ? 'income' : ''}`}>
                    {isIncome ? '+' : '-'}
                    {formatMoney(t.amount)}
                  </span>
                  <span
                    className={`recurring-toggle ${inactive ? '' : 'on'}`}
                    onClick={(e) => toggleActive(e, t)}
                    role="switch"
                    aria-checked={!inactive}
                    aria-label={inactive ? 'Activar' : 'Pausar'}
                  >
                    <span className="recurring-knob" />
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nuevo recurrente">
        +
      </button>

      {editing && (
        <RecurringEditor
          initial={editing === 'new' ? null : editing}
          accounts={accounts}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function RecurringEditor({ initial, accounts, onSave, onDelete, onClose }) {
  const { categories, getCategory } = useCategories()
  const confirm = useConfirm()
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [type, setType] = useState(initial?.type ?? 'expense')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [day, setDay] = useState(initial?.dayOfMonth ?? 1)
  const [account, setAccount] = useState(initial?.account ?? '')

  const visibleCategories = categories.filter((c) => c.type === type)
  const subcategories = category ? getCategory(category).subcategories ?? [] : []
  const amountNum = Number(amount)
  const canSave = amount !== '' && Number.isFinite(amountNum) && amountNum > 0 && category

  const selectType = (t) => {
    setType(t)
    setCategory('')
    setSubcategory('')
  }

  const handleSave = () => {
    if (!canSave) return
    onSave({
      amount: amountNum,
      type,
      category,
      subcategory: subcategory || null,
      note: note.trim(),
      dayOfMonth: Math.min(Math.max(Number(day) || 1, 1), 31),
      account: account || null,
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>{initial ? 'Editar recurrente' : 'Nuevo recurrente'}</h2>

        <div className="type-toggle">
          <button
            type="button"
            className={`type-toggle-btn ${type === 'expense' ? 'selected' : ''}`}
            onClick={() => selectType('expense')}
          >
            Gasto
          </button>
          <button
            type="button"
            className={`type-toggle-btn income ${type === 'income' ? 'selected' : ''}`}
            onClick={() => selectType('income')}
          >
            Ingreso
          </button>
        </div>

        <p className="picker-label">Monto</p>
        <div className="amount-input-wrap">
          <span className="amount-prefix">$</span>
          <input
            className="amount-input-field"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <p className="picker-label">Categoría</p>
        <div className="category-grid">
          {visibleCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`category-chip ${category === c.id ? 'selected' : ''}`}
              style={{ '--chip-color': c.color }}
              onClick={() => {
                setCategory(c.id)
                setSubcategory('')
              }}
            >
              <span className="category-icon">{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        {subcategories.length > 0 && (
          <>
            <p className="picker-label">Subcategoría (opcional)</p>
            <div className="subcategory-picker">
              {subcategories.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`subcategory-chip ${subcategory === s.id ? 'selected' : ''}`}
                  onClick={() => setSubcategory(subcategory === s.id ? '' : s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="picker-label">Día del mes</p>
        <div className="amount-input-wrap">
          <input
            className="amount-input-field"
            type="number"
            inputMode="numeric"
            min="1"
            max="31"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>

        {accounts.length > 0 && (
          <>
            <p className="picker-label">Cuenta (opcional)</p>
            <div className="subcategory-picker">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`subcategory-chip ${account === a.id ? 'selected' : ''}`}
                  onClick={() => setAccount(account === a.id ? '' : a.id)}
                >
                  {a.icon} {a.name}
                </button>
              ))}
            </div>
          </>
        )}

        <input
          className="note-input"
          type="text"
          placeholder="Nota (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="sheet-actions">
          {initial && (
            <button
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Eliminar recurrente',
                  message: 'Se dejará de registrar este pago automáticamente. Los movimientos ya creados se conservan.',
                })
                if (ok) onDelete(initial.id)
              }}
            >
              Eliminar
            </button>
          )}
          <button className="btn-primary" disabled={!canSave} onClick={handleSave}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// Próxima fecha de renovación (día del mes) de una plantilla recurrente.
function nextRenewal(t, today) {
  const cur = currentMonthISO()
  let d = dateOfMonth(cur, t.dayOfMonth || 1)
  if (d < today) d = dateOfMonth(nextMonth(cur), t.dayOfMonth || 1)
  return d
}

// Aviso (una vez al día) de los pagos recurrentes que se renuevan dentro de
// 5 días, con la opción de cancelarlos si el usuario ya no quiere pagarlos.
export function RecurringAlerts() {
  const { recurring, updateRecurring } = useRecurring()
  const { getCategory } = useCategories()
  const today = todayISO()
  const cur = currentMonthISO()
  const [closed, setClosed] = useState(() => localStorage.getItem('recurAlertDate') === today)

  // Si hay pagos ya vencidos, primero se confirman (RecurringConfirm);
  // este aviso previo se guarda para cuando no haya nada pendiente.
  const hasDue = recurring.some((t) => t.active !== false && dueOccurrences(t, cur, today).length > 0)

  const upcoming = useMemo(() => {
    if (closed) return []
    return recurring
      .filter((t) => t.active !== false)
      .map((t) => {
        const date = nextRenewal(t, today)
        const days = Math.round((new Date(date + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000)
        return { t, date, days }
      })
      .filter((x) => x.days >= 1 && x.days <= 5)
      .sort((a, b) => a.days - b.days)
  }, [recurring, today, closed])

  if (closed || hasDue || upcoming.length === 0) return null

  const dismiss = () => {
    localStorage.setItem('recurAlertDate', today)
    setClosed(true)
  }

  return (
    <div className="confirm-backdrop">
      <div className="confirm-dialog">
        <h3>🔔 Pagos por renovar</h3>
        <p>Estos pagos recurrentes se cargarán pronto. Cancélalos si ya no los quieres seguir pagando.</p>
        <div className="alert-list">
          {upcoming.map(({ t, date, days }) => (
            <div className="alert-item" key={t.id}>
              <div className="alert-info">
                <div className="alert-name">
                  {getCategory(t.category).icon} {getCategory(t.category).name}
                  {t.note ? ` · ${t.note}` : ''}
                </div>
                <div className="alert-sub">
                  {formatMoney(t.amount)} · {days === 0 ? 'hoy' : `en ${days} día${days === 1 ? '' : 's'}`} (
                  {formatDayLabel(date)})
                </div>
              </div>
              <button className="link-btn danger" onClick={() => updateRecurring(t.id, { active: false })}>
                Cancelar
              </button>
            </div>
          ))}
        </div>
        <div className="confirm-actions">
          <button className="btn-primary" onClick={dismiss}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

// Al abrir la app, si hay pagos recurrentes vencidos, pide confirmar con qué
// cuenta se pagó cada uno (con la cuenta original preseleccionada y opción de
// cambiarla) antes de registrarlos.
export function RecurringConfirm() {
  const { recurring, commitDue } = useRecurring()
  const { getCategory } = useCategories()
  const { accounts } = useAccounts()
  const payAccounts = accounts.filter((a) => !a.piggy)
  const today = todayISO()
  const cur = currentMonthISO()
  const processing = useRef(new Set())
  const [choices, setChoices] = useState({})
  const [closed, setClosed] = useState(false)

  const pending = useMemo(
    () =>
      recurring
        .filter((t) => t.active !== false && !processing.current.has(t.id))
        .map((t) => ({ t, occ: dueOccurrences(t, cur, today) }))
        .filter((x) => x.occ.length > 0),
    [recurring, cur, today]
  )

  // Sin cuentas dadas de alta no hay nada que confirmar: se registra solo.
  useEffect(() => {
    if (payAccounts.length > 0) return
    pending.forEach(({ t }) => {
      if (!processing.current.has(t.id)) {
        processing.current.add(t.id)
        commitDue(t, t.account || null)
      }
    })
  }, [pending, payAccounts, commitDue])

  if (payAccounts.length === 0 || pending.length === 0 || closed) return null

  const accountFor = (t) => (t.id in choices ? choices[t.id] : t.account || '')

  const confirmAll = async () => {
    const items = pending
    items.forEach(({ t }) => processing.current.add(t.id))
    for (const { t } of items) {
      await commitDue(t, accountFor(t) || null)
    }
  }

  return (
    <div className="confirm-backdrop">
      <div className="confirm-dialog">
        <h3>✅ Confirma tus pagos recurrentes</h3>
        <p>Estos pagos se cargaron. ¿Con qué cuenta los pagaste? Cámbiala si fue desde otra.</p>
        <div className="alert-list">
          {pending.map(({ t, occ }) => (
            <div className="rc-item" key={t.id}>
              <div className="alert-name">
                {getCategory(t.category).icon} {getCategory(t.category).name}
                {t.note ? ` · ${t.note}` : ''}
              </div>
              <div className="alert-sub">
                {formatMoney(t.amount)}
                {occ.length > 1 ? ` × ${occ.length}` : ''} · {formatDayLabel(occ[occ.length - 1].date)}
              </div>
              <div className="rc-accounts">
                <button
                  type="button"
                  className={`subcategory-chip ${!accountFor(t) ? 'selected' : ''}`}
                  onClick={() => setChoices((c) => ({ ...c, [t.id]: '' }))}
                >
                  Sin cuenta
                </button>
                {payAccounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`subcategory-chip ${accountFor(t) === a.id ? 'selected' : ''}`}
                    onClick={() => setChoices((c) => ({ ...c, [t.id]: a.id }))}
                  >
                    {a.icon} {a.name}
                    {a.id === t.account ? ' ✓' : ''}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="confirm-actions">
          <button className="btn-ghost" onClick={() => setClosed(true)}>
            Ahora no
          </button>
          <button className="btn-primary" onClick={confirmAll}>
            Confirmar y registrar
          </button>
        </div>
      </div>
    </div>
  )
}
