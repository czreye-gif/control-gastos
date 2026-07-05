import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import { useExpenses } from '../utils/useExpenses'
import { useAccounts, computeBalances } from '../utils/useAccounts'
import { useConfirm } from '../contexts/ConfirmContext'
import { COLOR_OPTIONS } from '../utils/categories'
import { todayISO } from '../utils/dates'

const ACCOUNT_ICONS = ['💵', '💳', '🏦', '🐷', '📱', '💰', '🪙', '💸']

export default function Accounts() {
  const { expenses, loading } = useExpenses()
  const { accounts, addAccount, updateAccount, deleteAccount } = useAccounts()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(null) // null | 'new' | cuenta

  // Las alcancías (piggy) ya no viven aquí: se manejan en el módulo Ahorros.
  const regular = useMemo(() => accounts.filter((a) => !a.piggy), [accounts])
  const withBalance = useMemo(() => computeBalances(regular, expenses), [regular, expenses])
  const total = withBalance.reduce((acc, a) => acc + a.balance, 0)

  const handleSave = async (data) => {
    if (editing && editing !== 'new') {
      await updateAccount(editing.id, data)
    } else {
      await addAccount(data)
    }
    setEditing(null)
  }

  const handleDelete = async (id) => {
    await deleteAccount(id)
    setEditing(null)
  }

  if (loading) return <p className="loading-text">Cargando...</p>

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">
          ←
        </button>
        <h1>Cuentas</h1>
      </header>

      {regular.length > 0 && (
        <div className="total-card">
          <p>Saldo total</p>
          <h2>{formatMoney(total)}</h2>
        </div>
      )}

      {regular.length === 0 ? (
        <p className="empty-state">
          Aún no tienes cuentas.
          <br />
          Toca + para agregar efectivo, tarjeta, banco, etc.
        </p>
      ) : (
        <div className="account-list">
          {withBalance.map((a) => (
            <div key={a.id} className="account-card">
              <button className="account-main" onClick={() => setEditing(a)}>
                <span className="account-icon" style={{ background: a.color + '22', color: a.color }}>
                  {a.icon}
                </span>
                <span className="account-info">
                  <span className="account-name">{a.name}</span>
                </span>
                <span className={`account-balance ${a.balance < 0 ? 'negative' : ''}`}>
                  {formatMoney(a.balance)}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nueva cuenta">
        +
      </button>

      {editing && (
        <AccountEditor
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

export function DepositSheet({ piggy, accounts, onDeposit, onClose }) {
  const [value, setValue] = useState('')
  const [source, setSource] = useState('')
  const amount = Number(value)
  const canSave = value !== '' && Number.isFinite(amount) && amount > 0
  const sources = accounts.filter((a) => a.id !== piggy.id && !a.piggy)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>Depositar en {piggy.name}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
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
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        {sources.length > 0 && (
          <>
            <p className="picker-label">Sale de (opcional)</p>
            <div className="subcategory-picker">
              {sources.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`subcategory-chip ${source === a.id ? 'selected' : ''}`}
                  onClick={() => setSource(source === a.id ? '' : a.id)}
                >
                  {a.icon} {a.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="sheet-actions">
          <button className="btn-primary" disabled={!canSave} onClick={() => onDeposit(amount, source || null)}>
            Depositar
          </button>
        </div>
      </div>
    </div>
  )
}

export function AccountEditor({ initial, variant = 'account', onSave, onDelete, onClose }) {
  const isPiggy = variant === 'piggy'
  const confirm = useConfirm()
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? (isPiggy ? '🎁' : ACCOUNT_ICONS[0]))
  const [color, setColor] = useState(initial?.color ?? COLOR_OPTIONS[0])
  const [balance, setBalance] = useState(
    initial?.initialBalance != null ? String(initial.initialBalance) : ''
  )
  const [revealDate, setRevealDate] = useState(initial?.revealDate ?? '')

  const canSave = name.trim().length > 0 && (!isPiggy || revealDate)
  const initialBalance = balance === '' ? 0 : Number(balance)

  const noun = isPiggy ? 'alcancía' : 'cuenta'

  const handleSave = () => {
    if (!canSave || !Number.isFinite(initialBalance)) return
    onSave({
      name: name.trim(),
      icon,
      color,
      initialBalance,
      piggy: isPiggy,
      revealDate: isPiggy ? revealDate : null,
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{initial ? `Editar ${noun}` : `Nueva ${noun}`}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="preview-chip" style={{ '--chip-color': color }}>
          <span className="category-icon">{icon}</span>
          <span>{name || 'Nombre'}</span>
        </div>

        <input
          className="note-input"
          type="text"
          placeholder={isPiggy ? 'Nombre (ej. Alcancía cumpleaños)' : 'Nombre (ej. Tarjeta BBVA)'}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <p className="picker-label">Icono</p>
        <div className="icon-picker">
          {ACCOUNT_ICONS.map((i) => (
            <button
              key={i}
              type="button"
              className={`icon-option ${icon === i ? 'selected' : ''}`}
              onClick={() => setIcon(i)}
            >
              {i}
            </button>
          ))}
        </div>

        <p className="picker-label">Color</p>
        <div className="color-picker">
          {COLOR_OPTIONS.map((col) => (
            <button
              key={col}
              type="button"
              className={`color-option ${color === col ? 'selected' : ''}`}
              style={{ background: col }}
              onClick={() => setColor(col)}
            />
          ))}
        </div>

        <p className="picker-label">Saldo inicial</p>
        <div className="amount-input-wrap">
          <span className="amount-prefix">$</span>
          <input
            className="amount-input-field"
            type="number"
            inputMode="decimal"
            step="1"
            placeholder="0"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </div>

        {isPiggy && (
          <>
            <p className="picker-label">🎁 Se abre el (fecha sorpresa)</p>
            <input
              className="date-input"
              type="date"
              min={todayISO()}
              value={revealDate}
              onChange={(e) => setRevealDate(e.target.value)}
            />
            <p className="piggy-hint">Su saldo estará oculto hasta esa fecha. ¡Puedes depositar cuando quieras!</p>
          </>
        )}

        <div className="sheet-actions">
          {initial && (
            <button
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({
                  title: `Eliminar "${initial.name}"`,
                  message: 'Los movimientos asignados se conservan, pero dejarán de contar en su saldo.',
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
