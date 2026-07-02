import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import { useTandas } from '../utils/useTandas'
import { useAccounts } from '../utils/useAccounts'
import { useConfirm } from '../contexts/ConfirmContext'
import { formatDayLabel, periodDate, todayISO } from '../utils/dates'

const FREQUENCIES = [
  { id: 'semanal', label: 'Semanal', unit: 'semana' },
  { id: 'quincenal', label: 'Quincenal', unit: 'quincena' },
  { id: 'mensual', label: 'Mensual', unit: 'mes' },
]

const freqUnit = (id) => FREQUENCIES.find((f) => f.id === id)?.unit ?? 'periodo'

export default function Tandas() {
  const { tandas, loading, addTanda, updateTanda, deleteTanda, registerContribution, registerPayout } =
    useTandas()
  const { accounts } = useAccounts()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(null) // null | 'new' | tanda

  const handleSave = async (data) => {
    if (editing && editing !== 'new') {
      await updateTanda(editing.id, data)
    } else {
      await addTanda(data)
    }
    setEditing(null)
  }

  const handleDelete = async (id) => {
    await deleteTanda(id)
    setEditing(null)
  }

  if (loading) return <p className="loading-text">Cargando...</p>

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">
          ←
        </button>
        <h1>Tandas</h1>
      </header>

      <p className="page-subtitle">Ahorro rotatorio: aportas cada periodo y cobras el pozo en tu número.</p>

      {tandas.length === 0 ? (
        <p className="empty-state">
          Aún no tienes tandas.
          <br />
          Toca + para registrar una.
        </p>
      ) : (
        <div className="tanda-list">
          {tandas.map((t) => (
            <TandaCard
              key={t.id}
              tanda={t}
              accounts={accounts}
              onEdit={() => setEditing(t)}
              onContribute={() => registerContribution(t)}
              onPayout={() => registerPayout(t)}
            />
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nueva tanda">
        +
      </button>

      {editing && (
        <TandaEditor
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

function TandaCard({ tanda, accounts, onEdit, onContribute, onPayout }) {
  const confirm = useConfirm()
  const paid = tanda.paidCount ?? 0
  const pct = Math.min((paid / tanda.totalCount) * 100, 100)
  const contributed = tanda.amount * paid
  const commitment = tanda.amount * tanda.totalCount
  const pot = tanda.amount * tanda.totalCount
  const done = paid >= tanda.totalCount
  const nextDate = done ? null : periodDate(tanda.startDate, paid, tanda.frequency)
  const payoutDate = periodDate(tanda.startDate, tanda.myNumber - 1, tanda.frequency)
  const account = tanda.account ? accounts.find((a) => a.id === tanda.account) : null

  const askContribute = async () => {
    const ok = await confirm({
      title: 'Registrar aportación',
      message: `Se apartarán ${formatMoney(tanda.amount)}${account ? ` de ${account.name}` : ''}.`,
      confirmText: 'Registrar',
      danger: false,
    })
    if (ok) onContribute()
  }

  const askPayout = async () => {
    const ok = await confirm({
      title: 'Registrar cobro',
      message: `Recibirás el pozo de ${formatMoney(pot)}${account ? ` en ${account.name}` : ''}.`,
      confirmText: 'Cobrar',
      danger: false,
    })
    if (ok) onPayout()
  }

  return (
    <div className="tanda-card">
      <button className="tanda-head" onClick={onEdit}>
        <span className="tanda-name">{tanda.name}</span>
        <span className="tanda-meta">
          {formatMoney(tanda.amount)} / {freqUnit(tanda.frequency)} · {tanda.totalCount} números · tu #
          {tanda.myNumber}
        </span>
      </button>

      <div className="budget-track">
        <div className="budget-fill ok" style={{ width: `${pct}%` }} />
      </div>
      <div className="tanda-stats">
        <span>
          Aportado {formatMoney(contributed)} <span className="budget-bar-limit">/ {formatMoney(commitment)}</span>
        </span>
        <span>
          {paid}/{tanda.totalCount}
        </span>
      </div>

      <div className="tanda-info">
        {nextDate && <span>Próxima aportación: {formatDayLabel(nextDate)}</span>}
        {done && <span>Aportaciones completadas ✓</span>}
        <span>
          {tanda.payoutReceived
            ? 'Pozo cobrado ✓'
            : `Cobras el ${formatDayLabel(payoutDate)}: ${formatMoney(pot)}`}
        </span>
      </div>

      <div className="tanda-actions">
        {!done && (
          <button className="btn-primary" onClick={askContribute}>
            Registrar aportación
          </button>
        )}
        {!tanda.payoutReceived && (
          <button className="btn-ghost" onClick={askPayout}>
            Cobrar pozo
          </button>
        )}
      </div>
    </div>
  )
}

function TandaEditor({ initial, accounts, onSave, onDelete, onClose }) {
  const confirm = useConfirm()
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [frequency, setFrequency] = useState(initial?.frequency ?? 'semanal')
  const [totalCount, setTotalCount] = useState(initial ? String(initial.totalCount) : '')
  const [myNumber, setMyNumber] = useState(initial ? String(initial.myNumber) : '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO())
  const [account, setAccount] = useState(initial?.account ?? '')

  const amountNum = Number(amount)
  const totalNum = Number(totalCount)
  const myNum = Number(myNumber)
  const canSave =
    name.trim() &&
    amountNum > 0 &&
    Number.isInteger(totalNum) &&
    totalNum >= 1 &&
    Number.isInteger(myNum) &&
    myNum >= 1 &&
    myNum <= totalNum

  const handleSave = () => {
    if (!canSave) return
    onSave({
      name: name.trim(),
      amount: amountNum,
      frequency,
      totalCount: totalNum,
      myNumber: myNum,
      startDate,
      account: account || null,
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>{initial ? 'Editar tanda' : 'Nueva tanda'}</h2>

        <input
          className="note-input"
          type="text"
          placeholder="Nombre (ej. Tanda de la oficina)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <p className="picker-label">Monto por aportación</p>
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

        <p className="picker-label">Frecuencia</p>
        <div className="type-toggle">
          {FREQUENCIES.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`type-toggle-btn ${frequency === f.id ? 'selected' : ''}`}
              onClick={() => setFrequency(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="tanda-fields">
          <div>
            <p className="picker-label">Números (participantes)</p>
            <input
              className="note-input"
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="Ej. 10"
              value={totalCount}
              onChange={(e) => setTotalCount(e.target.value)}
            />
          </div>
          <div>
            <p className="picker-label">Tu número</p>
            <input
              className="note-input"
              type="number"
              inputMode="numeric"
              min="1"
              max={totalCount || undefined}
              placeholder="Ej. 4"
              value={myNumber}
              onChange={(e) => setMyNumber(e.target.value)}
            />
          </div>
        </div>

        <p className="picker-label">Fecha de la primera aportación</p>
        <input
          className="date-input"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        {accounts.length > 0 && (
          <>
            <p className="picker-label">Cuenta de origen (opcional)</p>
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

        <div className="sheet-actions">
          {initial && (
            <button
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({
                  title: `Eliminar "${initial.name}"`,
                  message: 'Se elimina la tanda. Los traspasos ya registrados se conservan.',
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
