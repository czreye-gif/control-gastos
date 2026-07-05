import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import { useRecurring, dueOccurrences } from '../utils/useRecurring'
import { useCategories } from '../contexts/CategoriesContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { useAccounts } from '../utils/useAccounts'
import { currentMonthISO, dateOfMonth, formatDayLabel, nextMonth, todayISO } from '../utils/dates'

export default function Recurring() {
  const { recurring, loading, addRecurring, updateRecurring, deleteRecurring, generateNow, commitOne } = useRecurring()
  const { getCategory, getSubcategory } = useCategories()
  const { accounts } = useAccounts()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(null)
  const [applying, setApplying] = useState(null)

  const handleSave = async (data) => {
    if (editing && editing !== 'new') {
      await updateRecurring(editing.id, data)
    } else {
      const ref = await addRecurring(data)
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
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">←</button>
        <h1>Pagos recurrentes</h1>
      </header>

      <p className="page-subtitle">Movimientos que se registran automáticamente cada mes.</p>

      {recurring.length === 0 ? (
        <p className="empty-state">
          Aún no tienes pagos recurrentes.<br />
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
              <div key={t.id} className={`recurring-item-wrap ${inactive ? 'inactive' : ''}`}>
                <button className="recurring-item" onClick={() => setEditing(t)}>
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
                      {isIncome ? '+' : '-'}{formatMoney(t.amount)}
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
                {!inactive && (
                  <button className="recurring-apply-btn" onClick={() => setApplying(t)}>
                    ▶ Aplicar ahora
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nuevo recurrente">+</button>

      {editing && (
        <RecurringEditor
          initial={editing === 'new' ? null : editing}
          accounts={accounts}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}

      {applying && (
        <ApplySheet
          t={applying}
          accounts={accounts.filter((a) => !a.piggy)}
          commitOne={commitOne}
          onClose={() => setApplying(null)}
        />
      )}
    </div>
  )
}

// Sheet para aplicar manualmente un pago con fecha y cuenta a elección.
function ApplySheet({ t, accounts, commitOne, onClose }) {
  const { getCategory } = useCategories()
  const cat = getCategory(t.category)
  const today = todayISO()
  const [account, setAccount] = useState(t.account || '')
  const [date, setDate] = useState(today)
  const [saving, setSaving] = useState(false)

  const handleApply = async () => {
    setSaving(true)
    await commitOne(t, account || null, date)
    setSaving(false)
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>Aplicar pago</h2>

        <div className="apply-summary">
          <span className="expense-icon" style={{ background: cat.color + '22', color: cat.color }}>{cat.icon}</span>
          <div>
            <p className="apply-name">{cat.name}{t.note ? ` · ${t.note}` : ''}</p>
            <p className="apply-amount">{formatMoney(t.amount)}</p>
          </div>
        </div>

        {accounts.length > 0 && (
          <>
            <p className="picker-label">Cuenta usada</p>
            <div className="subcategory-picker">
              <button type="button" className={`subcategory-chip ${!account ? 'selected' : ''}`} onClick={() => setAccount('')}>
                Sin cuenta
              </button>
              {accounts.map((a) => (
                <button key={a.id} type="button" className={`subcategory-chip ${account === a.id ? 'selected' : ''}`} onClick={() => setAccount(a.id)}>
                  {a.icon} {a.name}{a.id === t.account ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="picker-label">Fecha del pago</p>
        <input className="date-input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />

        <div className="sheet-actions">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleApply} disabled={saving}>
            {saving ? 'Registrando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RecurringEditor({ initial, accounts, onSave, onDelete, onClose }) {
  const { categories, getCategory } = useCategories()
  const confirm = useConfirm()
  const navigate = useNavigate()
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

  const selectType = (t) => { setType(t); setCategory(''); setSubcategory('') }

  const goToCategories = () => {
    onClose()
    navigate('/categorias')
  }

  const handleSave = () => {
    if (!canSave) return
    onSave({
      amount: amountNum, type, category,
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
        <div className="sheet-head">
          <h2>{initial ? 'Editar recurrente' : 'Nuevo recurrente'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="type-toggle">
          <button type="button" className={`type-toggle-btn ${type === 'expense' ? 'selected' : ''}`} onClick={() => selectType('expense')}>Gasto</button>
          <button type="button" className={`type-toggle-btn income ${type === 'income' ? 'selected' : ''}`} onClick={() => selectType('income')}>Ingreso</button>
        </div>

        <p className="picker-label">Monto</p>
        <div className="amount-input-wrap">
          <span className="amount-prefix">$</span>
          <input className="amount-input-field" type="number" inputMode="decimal" min="0" step="1" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <p className="picker-label">Categoría</p>
        <div className="category-grid">
          {visibleCategories.map((c) => (
            <button key={c.id} type="button" className={`category-chip ${category === c.id ? 'selected' : ''}`} style={{ '--chip-color': c.color }} onClick={() => { setCategory(c.id); setSubcategory('') }}>
              <span className="category-icon">{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
        <button type="button" className="edit-categories-btn" onClick={goToCategories}>
          ✏️ Editar categorías y subcategorías
        </button>

        {subcategories.length > 0 && (
          <>
            <p className="picker-label">Subcategoría (opcional)</p>
            <div className="subcategory-picker">
              {subcategories.map((s) => (
                <button key={s.id} type="button" className={`subcategory-chip ${subcategory === s.id ? 'selected' : ''}`} onClick={() => setSubcategory(subcategory === s.id ? '' : s.id)}>{s.name}</button>
              ))}
            </div>
          </>
        )}

        <p className="picker-label">Día del mes</p>
        <div className="amount-input-wrap">
          <input className="amount-input-field" type="number" inputMode="numeric" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>

        {accounts.length > 0 && (
          <>
            <p className="picker-label">Cuenta (opcional)</p>
            <div className="subcategory-picker">
              {accounts.map((a) => (
                <button key={a.id} type="button" className={`subcategory-chip ${account === a.id ? 'selected' : ''}`} onClick={() => setAccount(account === a.id ? '' : a.id)}>
                  {a.icon} {a.name}
                </button>
              ))}
            </div>
          </>
        )}

        <input className="note-input" type="text" placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />

        <div className="sheet-actions">
          {initial && (
            <button className="btn-danger" onClick={async () => {
              const ok = await confirm({ title: 'Eliminar recurrente', message: 'Se dejará de registrar este pago automáticamente. Los movimientos ya creados se conservan.' })
              if (ok) onDelete(initial.id)
            }}>Eliminar</button>
          )}
          <button className="btn-primary" disabled={!canSave} onClick={handleSave}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

function nextRenewal(t, today) {
  const cur = currentMonthISO()
  let d = dateOfMonth(cur, t.dayOfMonth || 1)
  if (d < today) d = dateOfMonth(nextMonth(cur), t.dayOfMonth || 1)
  return d
}

export function RecurringAlerts() {
  const { recurring, updateRecurring } = useRecurring()
  const { getCategory } = useCategories()
  const today = todayISO()
  const cur = currentMonthISO()
  const [closed, setClosed] = useState(() => localStorage.getItem('recurAlertDate') === today)

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

  const dismiss = () => { localStorage.setItem('recurAlertDate', today); setClosed(true) }

  return (
    <div className="confirm-backdrop">
      <div className="confirm-dialog">
        <h3>🔔 Pagos por renovar</h3>
        <p>Estos pagos recurrentes se cargarán pronto. Cancélalos si ya no los quieres seguir pagando.</p>
        <div className="alert-list">
          {upcoming.map(({ t, date, days }) => (
            <div className="alert-item" key={t.id}>
              <div className="alert-info">
                <div className="alert-name">{getCategory(t.category).icon} {getCategory(t.category).name}{t.note ? ` · ${t.note}` : ''}</div>
                <div className="alert-sub">{formatMoney(t.amount)} · {days === 1 ? 'mañana' : `en ${days} días`} ({formatDayLabel(date)})</div>
              </div>
              <button className="link-btn danger" onClick={() => updateRecurring(t.id, { active: false })}>Cancelar</button>
            </div>
          ))}
        </div>
        <div className="confirm-actions">
          <button className="btn-primary" onClick={dismiss}>Entendido</button>
        </div>
      </div>
    </div>
  )
}

export function RecurringConfirm() {
  const { recurring, commitOne } = useRecurring()
  const { getCategory } = useCategories()
  const { accounts } = useAccounts()
  const payAccounts = accounts.filter((a) => !a.piggy)
  const today = todayISO()
  const cur = currentMonthISO()
  const processing = useRef(new Set())

  const [skipped, setSkipped] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('recurSkips') || '{}')
      return new Set(Object.entries(stored).filter(([, d]) => d === today).map(([id]) => id))
    } catch { return new Set() }
  })

  const [expanded, setExpanded] = useState({})
  const [choices, setChoices] = useState({})
  const [dates, setDates] = useState({})
  const [saving, setSaving] = useState({})

  const pending = useMemo(
    () =>
      recurring
        .filter((t) => t.active !== false && !processing.current.has(t.id) && !skipped.has(t.id))
        .map((t) => ({ t, occ: dueOccurrences(t, cur, today) }))
        .filter((x) => x.occ.length > 0),
    [recurring, cur, today, skipped]
  )

  useEffect(() => {
    if (payAccounts.length > 0) return
    pending.forEach(({ t }) => {
      if (!processing.current.has(t.id)) {
        processing.current.add(t.id)
        commitOne(t, t.account || null, today)
      }
    })
  }, [pending, payAccounts, commitOne, today])

  if (payAccounts.length === 0 || pending.length === 0) return null

  const skipOne = (id) => {
    const next = new Set(skipped)
    next.add(id)
    setSkipped(next)
    try {
      const stored = JSON.parse(localStorage.getItem('recurSkips') || '{}')
      stored[id] = today
      localStorage.setItem('recurSkips', JSON.stringify(stored))
    } catch {}
  }

  const accountFor = (t) => (t.id in choices ? choices[t.id] : t.account || '')
  const dateFor = (t, occ) => (t.id in dates ? dates[t.id] : occ[occ.length - 1].date)

  const confirmOne = async (t, occ) => {
    setSaving((s) => ({ ...s, [t.id]: true }))
    processing.current.add(t.id)
    await commitOne(t, accountFor(t) || null, dateFor(t, occ))
    setSaving((s) => ({ ...s, [t.id]: false }))
  }

  return (
    <div className="confirm-backdrop">
      <div className="confirm-dialog">
        <h3>📅 Pagos recurrentes pendientes</h3>
        <p>Indica si ya pagaste cada uno o pospónlo para después.</p>
        <div className="alert-list">
          {pending.map(({ t, occ }) => {
            const cat = getCategory(t.category)
            const isExp = expanded[t.id]
            return (
              <div className="rc-item" key={t.id}>
                <div className="rc-item-header">
                  <span className="expense-icon" style={{ background: cat.color + '22', color: cat.color }}>{cat.icon}</span>
                  <div className="rc-item-info">
                    <div className="alert-name">{cat.name}{t.note ? ` · ${t.note}` : ''}</div>
                    <div className="alert-sub">
                      {formatMoney(t.amount)}{occ.length > 1 ? ` × ${occ.length} meses` : ''} · día {t.dayOfMonth}
                    </div>
                  </div>
                </div>

                {!isExp ? (
                  <div className="rc-item-actions">
                    <button className="btn-ghost rc-btn" onClick={() => skipOne(t.id)}>⏳ Aún no</button>
                    <button className="btn-primary rc-btn" onClick={() => setExpanded((e) => ({ ...e, [t.id]: true }))}>✅ Ya pagué</button>
                  </div>
                ) : (
                  <div className="rc-expanded">
                    <p className="picker-label" style={{ marginTop: 10 }}>Cuenta usada</p>
                    <div className="rc-accounts">
                      <button type="button" className={`subcategory-chip ${!accountFor(t) ? 'selected' : ''}`} onClick={() => setChoices((c) => ({ ...c, [t.id]: '' }))}>Sin cuenta</button>
                      {payAccounts.map((a) => (
                        <button key={a.id} type="button" className={`subcategory-chip ${accountFor(t) === a.id ? 'selected' : ''}`} onClick={() => setChoices((c) => ({ ...c, [t.id]: a.id }))}>
                          {a.icon} {a.name}{a.id === t.account ? ' ✓' : ''}
                        </button>
                      ))}
                    </div>
                    <p className="picker-label" style={{ marginTop: 8 }}>Fecha del pago</p>
                    <input className="date-input" type="date" value={dateFor(t, occ)} max={today} onChange={(e) => setDates((d) => ({ ...d, [t.id]: e.target.value }))} />
                    <button className="btn-primary rc-register-btn" onClick={() => confirmOne(t, occ)} disabled={saving[t.id]}>
                      {saving[t.id] ? 'Registrando…' : 'Registrar'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="confirm-actions">
          <button className="btn-ghost" onClick={() => pending.forEach(({ t }) => skipOne(t.id))}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
