import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import { useExpenses } from '../utils/useExpenses'
import { useAccounts } from '../utils/useAccounts'
import { useTrips, tripSummary, tripCategory, TRIP_CATEGORIES, ME_ID } from '../utils/useTrips'
import { useConfirm } from '../contexts/ConfirmContext'
import { formatDayLabel, todayISO } from '../utils/dates'

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back']

function useTripMovements(expenses) {
  return useMemo(() => {
    const map = new Map()
    for (const e of expenses) {
      if (!e.tripId) continue
      if (!map.has(e.tripId)) map.set(e.tripId, [])
      map.get(e.tripId).push(e)
    }
    return map
  }, [expenses])
}

export default function Vacaciones() {
  const navigate = useNavigate()
  const { expenses, loading: loadingExp } = useExpenses()
  const { accounts } = useAccounts()
  const { trips, loading, addTrip, updateTrip, deleteTrip, addMovement, updateMovement, deleteMovement } =
    useTrips()

  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | viaje

  const movementsByTrip = useTripMovements(expenses)
  const payAccounts = useMemo(() => accounts.filter((a) => !a.piggy), [accounts])
  const selected = trips.find((t) => t.id === selectedId) ?? null

  const saveTrip = async (data) => {
    if (editing && editing !== 'new') await updateTrip(editing.id, data)
    else await addTrip(data)
    setEditing(null)
  }

  if (loading || loadingExp) return <p className="loading-text">Cargando...</p>

  if (selected) {
    return (
      <TripDetail
        trip={selected}
        movements={movementsByTrip.get(selected.id) ?? []}
        accounts={payAccounts}
        onBack={() => setSelectedId(null)}
        onEdit={() => setEditing(selected)}
        onAdd={(m) => addMovement(selected, m, (id) => nameOf(selected, id))}
        onUpdate={updateMovement}
        onDelete={deleteMovement}
        editor={
          editing && (
            <TripEditor
              initial={editing === 'new' ? null : editing}
              onSave={saveTrip}
              onDelete={async (id) => {
                await deleteTrip(id)
                setEditing(null)
                setSelectedId(null)
              }}
              onClose={() => setEditing(null)}
            />
          )
        }
      />
    )
  }

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">←</button>
        <h1>Vacaciones</h1>
      </header>

      <p className="page-subtitle">
        Controla los gastos de un viaje en grupo: quién pagó qué y, al final, quién le debe a quién.
      </p>

      {trips.length === 0 ? (
        <button className="budget-cta" onClick={() => setEditing('new')}>
          Crea un viaje y empieza a repartir los gastos →
        </button>
      ) : (
        <div className="project-list">
          {trips.map((t) => {
            const s = tripSummary(t, movementsByTrip.get(t.id) ?? [])
            return (
              <button key={t.id} className="project-card" onClick={() => setSelectedId(t.id)}>
                <span className="project-card-head">
                  <span className="project-card-name">🏖️ {t.name}</span>
                </span>
                <span className="project-card-partner">
                  {(t.participants ?? []).map((p) => p.name).join(' · ')}
                </span>
                <span className="project-card-figures">
                  <span className="project-fig">
                    <span className="project-fig-label">Total</span>
                    <span className="project-fig-value">{formatMoney(s.totalCost)}</span>
                  </span>
                  <span className="project-fig">
                    <span className="project-fig-label">Por persona</span>
                    <span className="project-fig-value">{formatMoney(s.perPerson)}</span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nuevo viaje">+</button>

      {editing && (
        <TripEditor
          initial={editing === 'new' ? null : editing}
          onSave={saveTrip}
          onDelete={async (id) => {
            await deleteTrip(id)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

const nameOf = (owner, id) => (owner.participants ?? []).find((p) => p.id === id)?.name ?? '—'

function TripDetail({ trip, movements, accounts, onBack, onEdit, onAdd, onUpdate, onDelete, editor }) {
  const [adding, setAdding] = useState(null) // null | 'expense' | 'settlement'
  const [editingMov, setEditingMov] = useState(null)
  const [showBalance, setShowBalance] = useState(false)
  const s = tripSummary(trip, movements)
  const ordered = [...movements].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={onBack} aria-label="Volver">←</button>
        <h1>{trip.name}</h1>
        <button className="icon-btn" onClick={onEdit} aria-label="Editar viaje">⚙️</button>
      </header>

      <div className="total-card">
        <p>Total del viaje · {(trip.participants ?? []).length} viajeros</p>
        <h2>{formatMoney(s.totalCost)}</h2>
        <div className="facturable-totals">
          <span className="facturable-total-fact">Por persona {formatMoney(s.perPerson)}</span>
        </div>
      </div>

      <div className="trip-actions">
        <button className="btn-primary" onClick={() => setAdding('expense')}>+ Gasto</button>
        <button className="btn-ghost" onClick={() => setAdding('settlement')}>💸 Pago directo</button>
      </div>

      <button className="btn-primary project-add-btn" onClick={() => setShowBalance(true)}>
        Ver balance final
      </button>

      <h3 className="section-title">Historial</h3>
      {ordered.length === 0 ? (
        <p className="empty-state" style={{ fontSize: 13 }}>Aún no hay gastos en este viaje.</p>
      ) : (
        <div className="ledger-list">
          {ordered.map((m) => {
            const isSettlement = m.kind === 'settlement'
            const cat = tripCategory(m.category)
            return (
              <button key={m.id} className="ledger-item" onClick={() => setEditingMov(m)}>
                <span className="expense-icon" style={{ background: cat.color + '22', color: cat.color }}>
                  {isSettlement ? '💸' : cat.icon}
                </span>
                <span className="ledger-main">
                  <span className="ledger-concept">
                    {isSettlement
                      ? `${nameOf(trip, m.paidBy)} ➔ ${nameOf(trip, m.paidTo)}`
                      : m.concept || cat.name}
                  </span>
                  <span className="ledger-meta">
                    {isSettlement ? 'Pago directo' : `${cat.name} · pagó ${nameOf(trip, m.paidBy)}`}
                    {' · '}{formatDayLabel(m.date)}
                  </span>
                </span>
                <span className="ledger-amounts">
                  <span className={`ledger-amount ${isSettlement ? '' : 'expense-text'}`}>
                    {formatMoney(m.amount)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {adding && (
        <TripMovementSheet
          kind={adding}
          trip={trip}
          accounts={accounts}
          onSave={async (data) => {
            await onAdd(data)
            setAdding(null)
          }}
          onClose={() => setAdding(null)}
        />
      )}

      {editingMov && (
        <TripMovementSheet
          initial={editingMov}
          kind={editingMov.kind}
          trip={trip}
          accounts={accounts}
          onSave={async (data) => {
            await onUpdate(editingMov.id, {
              amount: data.amount,
              concept: data.concept,
              category: data.category,
              date: data.date,
              paidBy: data.paidBy,
              paidTo: data.paidTo ?? null,
              account: data.paidBy === ME_ID || data.paidTo === ME_ID ? data.account || null : null,
              offBook: data.paidBy !== ME_ID && data.paidTo !== ME_ID,
            })
            setEditingMov(null)
          }}
          onDelete={async () => {
            await onDelete(editingMov.id)
            setEditingMov(null)
          }}
          onClose={() => setEditingMov(null)}
        />
      )}

      {showBalance && <TripBalance trip={trip} summary={s} onClose={() => setShowBalance(false)} />}

      {editor}
    </div>
  )
}

function TripBalance({ trip, summary, onClose }) {
  const [toast, setToast] = useState('')

  const share = async () => {
    const lines = summary.settlements.map((d) => `• ${d.from} le paga ${formatMoney(d.amount)} a ${d.to}`)
    const text =
      `Balance — ${trip.name}\n\n` +
      `Total: ${formatMoney(summary.totalCost)}\n` +
      `Por persona: ${formatMoney(summary.perPerson)}\n\n` +
      `Aportaciones:\n` +
      summary.balances.map((b) => `• ${b.name}: ${formatMoney(b.paid)}`).join('\n') +
      `\n\nAjuste de cuentas:\n` +
      (lines.length ? lines.join('\n') : 'Cuentas al día ✓')
    if (navigator.share) {
      try {
        await navigator.share({ title: `Balance — ${trip.name}`, text })
        return
      } catch {
        return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setToast('Copiado al portapapeles ✓')
      setTimeout(() => setToast(''), 2500)
    } catch {
      setToast('No se pudo compartir')
      setTimeout(() => setToast(''), 2500)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>Balance final</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="register-amount">{formatMoney(summary.totalCost)}</div>
        <p className="loan-stmt-caption">Por persona {formatMoney(summary.perPerson)}</p>

        {summary.magnate && (
          <p className="trip-magnate">👑 Magnate del viaje: <strong>{summary.magnate.name}</strong></p>
        )}

        {summary.categories.length > 0 && (
          <div className="project-block">
            <p className="project-block-title">Desglose por categoría</p>
            {summary.categories.map((c) => (
              <div key={c.id} className="project-row">
                <span><span className="legend-dot" style={{ background: c.color }} /> {c.icon} {c.name}</span>
                <span>{formatMoney(c.value)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="project-block">
          <p className="project-block-title">Aportaciones</p>
          {summary.balances.map((b) => (
            <div key={b.id} className="project-row">
              <span>{b.name}</span>
              <span className={b.balance > 0.5 ? 'income-text' : b.balance < -0.5 ? 'expense-text' : ''}>
                {formatMoney(b.paid)}
              </span>
            </div>
          ))}
        </div>

        <div className="project-block">
          <p className="project-block-title">Ajuste de cuentas</p>
          {summary.settlements.length === 0 ? (
            <p className="pending-empty">Cuentas al día ✓</p>
          ) : (
            summary.settlements.map((d, i) => (
              <div key={i} className="project-row">
                <span>{d.from} ➔ {d.to}</span>
                <span className="expense-text">{formatMoney(d.amount)}</span>
              </div>
            ))
          )}
        </div>

        <button className="pending-share-list" onClick={share}>↗ Compartir balance</button>
        {toast && <p className="pending-toast">{toast}</p>}
      </div>
    </div>
  )
}

function TripEditor({ initial, onSave, onDelete, onClose }) {
  const confirm = useConfirm()
  const [name, setName] = useState(initial?.name ?? '')
  const [people, setPeople] = useState(
    initial?.participants ?? [{ id: ME_ID, name: 'Yo' }]
  )
  const [newName, setNewName] = useState('')

  const addPerson = () => {
    const n = newName.trim()
    if (!n) return
    setPeople([...people, { id: crypto.randomUUID(), name: n }])
    setNewName('')
  }

  const canSave = name.trim() !== '' && people.length >= 2

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{initial ? 'Editar viaje' : 'Nuevo viaje'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <p className="picker-label">Destino</p>
        <input
          className="note-input"
          type="text"
          placeholder="Ej. Cancún"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />

        <p className="picker-label">Viajeros</p>
        <div className="participant-list">
          {people.map((p) => (
            <div key={p.id} className="participant-row">
              <span className="participant-name">{p.id === ME_ID ? '👤 Yo' : p.name}</span>
              {p.id !== ME_ID && (
                <button
                  className="participant-remove"
                  onClick={() => setPeople(people.filter((x) => x.id !== p.id))}
                  aria-label="Quitar"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="participant-add">
          <input
            className="note-input"
            type="text"
            placeholder="Nombre del viajero"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPerson()}
          />
          <button className="btn-ghost" onClick={addPerson} disabled={!newName.trim()}>+</button>
        </div>
        {people.length < 2 && <p className="piggy-hint">Agrega al menos un viajero más.</p>}

        <div className="sheet-actions">
          {initial && (
            <button
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({
                  title: `Eliminar "${initial.name}"`,
                  message: 'Se elimina el viaje y todos sus gastos.',
                })
                if (ok) onDelete(initial.id)
              }}
            >
              Eliminar
            </button>
          )}
          <button
            className="btn-primary"
            disabled={!canSave}
            onClick={() => onSave({ name: name.trim(), participants: people })}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

function TripMovementSheet({ initial, kind, trip, accounts, onSave, onDelete, onClose }) {
  const confirm = useConfirm()
  const isSettlement = kind === 'settlement'
  const people = trip.participants ?? []
  const [cents, setCents] = useState(initial ? Math.round(initial.amount * 100) : 0)
  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? ME_ID)
  const [paidTo, setPaidTo] = useState(initial?.paidTo ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [concept, setConcept] = useState(initial?.concept ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [account, setAccount] = useState(initial?.account ?? (accounts[0]?.id ?? ''))

  const amount = cents / 100
  // Solo se pide cuenta cuando el dinero es tuyo: tú pagaste o tú lo recibes.
  const touchesMyMoney = paidBy === ME_ID || (isSettlement && paidTo === ME_ID)
  const canSave =
    amount > 0 &&
    !!paidBy &&
    (!isSettlement || (!!paidTo && paidTo !== paidBy)) &&
    (!isSettlement ? !!category : true) &&
    (!touchesMyMoney || !!account)

  const press = (k) => {
    if (k === 'back') setCents((c) => Math.floor(c / 10))
    else if (k === '.') return
    else setCents((c) => Math.min(c * 10 + Number(k), 9_999_999_99))
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{initial ? 'Editar' : isSettlement ? 'Pago directo' : 'Nuevo gasto'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="amount-display">{formatMoney(amount)}</div>
        <div className="keypad">
          {KEYS.map((k) => (
            <button key={k} type="button" className="key" onClick={() => press(k)}>
              {k === 'back' ? '⌫' : k}
            </button>
          ))}
        </div>

        <p className="picker-label">{isSettlement ? '¿Quién paga?' : '¿Quién pagó?'}</p>
        <div className="subcategory-picker">
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`subcategory-chip ${paidBy === p.id ? 'selected' : ''}`}
              onClick={() => setPaidBy(p.id)}
            >
              {p.id === ME_ID ? '👤 Yo' : p.name}
            </button>
          ))}
        </div>

        {isSettlement && (
          <>
            <p className="picker-label">¿A quién le paga?</p>
            <div className="subcategory-picker">
              {people
                .filter((p) => p.id !== paidBy)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`subcategory-chip ${paidTo === p.id ? 'selected' : ''}`}
                    onClick={() => setPaidTo(p.id)}
                  >
                    {p.id === ME_ID ? '👤 Yo' : p.name}
                  </button>
                ))}
            </div>
          </>
        )}

        {!isSettlement && (
          <>
            <p className="picker-label">Categoría</p>
            <div className="category-grid">
              {TRIP_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`category-chip ${category === c.id ? 'selected' : ''}`}
                  style={{ '--chip-color': c.color }}
                  onClick={() => setCategory(c.id)}
                >
                  <span className="category-icon">{c.icon}</span>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {touchesMyMoney && accounts.length > 0 && (
          <>
            <p className="picker-label">
              {paidBy === ME_ID ? '¿De qué cuenta salió?' : '¿A qué cuenta entró?'}
            </p>
            <div className="subcategory-picker">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`subcategory-chip ${account === a.id ? 'selected' : ''}`}
                  onClick={() => setAccount(a.id)}
                >
                  {a.icon} {a.name}
                </button>
              ))}
            </div>
            <p className="piggy-hint">Se registrará en tus movimientos y afectará el saldo de esa cuenta.</p>
          </>
        )}

        <p className="picker-label">Nota</p>
        <input
          className="note-input"
          type="text"
          placeholder="Opcional"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
        />

        <p className="picker-label">Fecha</p>
        <input
          className="date-input"
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
        />

        <div className="sheet-actions">
          {initial && (
            <button
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({ title: 'Eliminar', message: 'Se elimina del viaje.' })
                if (ok) onDelete()
              }}
            >
              Eliminar
            </button>
          )}
          <button
            className="btn-primary"
            disabled={!canSave}
            onClick={() =>
              onSave({
                kind: isSettlement ? 'settlement' : 'expense',
                amount,
                paidBy,
                paidTo: isSettlement ? paidTo : null,
                category: isSettlement ? null : category,
                concept,
                date,
                account,
              })
            }
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
