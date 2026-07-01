import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import { useExpenses } from '../utils/useExpenses'
import { useAccounts, computeBalances } from '../utils/useAccounts'
import { COLOR_OPTIONS } from '../utils/categories'

const ACCOUNT_ICONS = ['💵', '💳', '🏦', '🐷', '📱', '💰', '🪙', '💸']

export default function Accounts() {
  const { expenses, loading } = useExpenses()
  const { accounts, addAccount, updateAccount, deleteAccount } = useAccounts()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(null) // null | 'new' | cuenta

  const withBalance = useMemo(() => computeBalances(accounts, expenses), [accounts, expenses])
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

      {accounts.length > 0 && (
        <div className="total-card">
          <p>Saldo total</p>
          <h2>{formatMoney(total)}</h2>
        </div>
      )}

      {accounts.length === 0 ? (
        <p className="empty-state">
          Aún no tienes cuentas.
          <br />
          Toca + para agregar efectivo, tarjeta, banco, etc.
        </p>
      ) : (
        <div className="account-list">
          {withBalance.map((a) => (
            <button key={a.id} className="account-card" onClick={() => setEditing(a)}>
              <span className="account-icon" style={{ background: a.color + '22', color: a.color }}>
                {a.icon}
              </span>
              <span className="account-name">{a.name}</span>
              <span className={`account-balance ${a.balance < 0 ? 'negative' : ''}`}>
                {formatMoney(a.balance)}
              </span>
            </button>
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

function AccountEditor({ initial, onSave, onDelete, onClose }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? ACCOUNT_ICONS[0])
  const [color, setColor] = useState(initial?.color ?? COLOR_OPTIONS[0])
  const [balance, setBalance] = useState(
    initial?.initialBalance != null ? String(initial.initialBalance) : ''
  )

  const canSave = name.trim().length > 0
  const initialBalance = balance === '' ? 0 : Number(balance)

  const handleSave = () => {
    if (!canSave || !Number.isFinite(initialBalance)) return
    onSave({ name: name.trim(), icon, color, initialBalance })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>{initial ? 'Editar cuenta' : 'Nueva cuenta'}</h2>

        <div className="preview-chip" style={{ '--chip-color': color }}>
          <span className="category-icon">{icon}</span>
          <span>{name || 'Nombre'}</span>
        </div>

        <input
          className="note-input"
          type="text"
          placeholder="Nombre (ej. Tarjeta BBVA)"
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

        <div className="sheet-actions">
          {initial && (
            <button className="btn-danger" onClick={() => onDelete(initial.id)}>
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
