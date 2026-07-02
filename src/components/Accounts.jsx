import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import { useExpenses } from '../utils/useExpenses'
import { useAccounts, computeBalances, isPiggyLocked } from '../utils/useAccounts'
import { useConfirm } from '../contexts/ConfirmContext'
import { COLOR_OPTIONS } from '../utils/categories'
import { formatDayLabel, todayISO } from '../utils/dates'

const ACCOUNT_ICONS = ['💵', '💳', '🏦', '🐷', '📱', '💰', '🪙', '💸']

export default function Accounts() {
  const { expenses, loading, } = useExpenses()
  const { accounts, addAccount, updateAccount, deleteAccount, deposit } = useAccounts()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(null) // null | 'new' | cuenta
  const [depositing, setDepositing] = useState(null) // alcancía a la que depositar

  const withBalance = useMemo(() => computeBalances(accounts, expenses), [accounts, expenses])
  // El total visible no revela las alcancías aún cerradas (sería spoiler).
  const total = withBalance.reduce((acc, a) => acc + (isPiggyLocked(a) ? 0 : a.balance), 0)
  const hasLockedPiggy = withBalance.some((a) => isPiggyLocked(a))

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
          <p>Saldo total{hasLockedPiggy ? ' (sin alcancías por abrir)' : ''}</p>
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
          {withBalance.map((a) => {
            const locked = isPiggyLocked(a)
            return (
              <div key={a.id} className={`account-card ${a.piggy ? 'piggy' : ''} ${locked ? 'locked' : ''}`}>
                <button className="account-main" onClick={() => setEditing(a)}>
                  <span className="account-icon" style={{ background: a.color + '22', color: a.color }}>
                    {locked ? '🎁' : a.icon}
                  </span>
                  <span className="account-info">
                    <span className="account-name">{a.name}</span>
                    {a.piggy && (
                      <span className="account-sub">
                        {locked ? `Se abre el ${formatDayLabel(a.revealDate)}` : '¡Alcancía abierta! 🎉'}
                      </span>
                    )}
                  </span>
                  {locked ? (
                    <span className="account-balance hidden">••••</span>
                  ) : (
                    <span className={`account-balance ${a.balance < 0 ? 'negative' : ''}`}>
                      {formatMoney(a.balance)}
                    </span>
                  )}
                </button>
                {a.piggy && (
                  <button className="account-deposit" onClick={() => setDepositing(a)}>
                    + Depositar
                  </button>
                )}
              </div>
            )
          })}
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

      {depositing && (
        <DepositSheet
          piggy={depositing}
          accounts={accounts}
          onDeposit={async (amount, source) => {
            await deposit({ piggy: depositing, amount, source })
            setDepositing(null)
          }}
          onClose={() => setDepositing(null)}
        />
      )}
    </div>
  )
}

function DepositSheet({ piggy, accounts, onDeposit, onClose }) {
  const [value, setValue] = useState('')
  const [source, setSource] = useState('')
  const amount = Number(value)
  const canSave = value !== '' && Number.isFinite(amount) && amount > 0
  const sources = accounts.filter((a) => a.id !== piggy.id && !a.piggy)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>Depositar en {piggy.name}</h2>

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

function AccountEditor({ initial, onSave, onDelete, onClose }) {
  const confirm = useConfirm()
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? ACCOUNT_ICONS[0])
  const [color, setColor] = useState(initial?.color ?? COLOR_OPTIONS[0])
  const [balance, setBalance] = useState(
    initial?.initialBalance != null ? String(initial.initialBalance) : ''
  )
  const [piggy, setPiggy] = useState(initial?.piggy ?? false)
  const [revealDate, setRevealDate] = useState(initial?.revealDate ?? '')

  const canSave = name.trim().length > 0 && (!piggy || revealDate)
  const initialBalance = balance === '' ? 0 : Number(balance)

  const handleSave = () => {
    if (!canSave || !Number.isFinite(initialBalance)) return
    onSave({
      name: name.trim(),
      icon,
      color,
      initialBalance,
      piggy,
      revealDate: piggy ? revealDate : null,
    })
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

        <button
          type="button"
          className={`piggy-toggle ${piggy ? 'on' : ''}`}
          onClick={() => setPiggy((p) => !p)}
        >
          <span>🎁 Alcancía sorpresa</span>
          <span className={`recurring-toggle ${piggy ? 'on' : ''}`}>
            <span className="recurring-knob" />
          </span>
        </button>
        {piggy && (
          <>
            <p className="picker-label">Se abre el (fecha sorpresa)</p>
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
                  message: 'Los movimientos asignados a esta cuenta se conservan, pero dejarán de contar en su saldo.',
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
