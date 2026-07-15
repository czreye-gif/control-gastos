import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import TransferSheet from './TransferSheet'
import { useExpenses } from '../utils/useExpenses'
import { useAccounts, computeBalances, computeTransfers, isPiggyLocked } from '../utils/useAccounts'
import { useConfirm } from '../contexts/ConfirmContext'
import { COLOR_OPTIONS } from '../utils/categories'
import { formatDayLabel, todayISO } from '../utils/dates'
import { useCategories } from '../contexts/CategoriesContext'

const ACCOUNT_ICONS = ['💵', '💳', '🏦', '🐷', '📱', '💰', '🪙', '💸']

export default function Accounts() {
  const { expenses, loading } = useExpenses()
  const { accounts, addAccount, updateAccount, deleteAccount, transfer, updateTransfer, deleteTransfer } =
    useAccounts()
  const { getCategory } = useCategories()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(null) // null | 'new' | cuenta
  const [kardex, setKardex] = useState(null) // null | cuenta
  const [transferSheet, setTransferSheet] = useState(null) // null | 'new' | traspaso

  // Las alcancías (piggy) ya no viven aquí: se manejan en el módulo Ahorros.
  const regular = useMemo(() => accounts.filter((a) => !a.piggy), [accounts])
  const withBalance = useMemo(() => computeBalances(regular, expenses), [regular, expenses])
  const total = withBalance.reduce((acc, a) => acc + a.balance, 0)

  const transfers = useMemo(() => computeTransfers(expenses), [expenses])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

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

      {regular.length >= 2 && (
        <button className="transfer-btn" onClick={() => setTransferSheet('new')}>
          🔄 Traspasar entre cuentas
        </button>
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
              <button className="account-main" onClick={() => setKardex(a)}>
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

      {transfers.length > 0 && (
        <>
          <h3 className="section-title">Traspasos</h3>
          <div className="transfer-list">
            {transfers.map((tr) => {
              const fromAcc = accountById.get(tr.from)
              const toAcc = accountById.get(tr.to)
              return (
                <button key={tr.transferId} className="transfer-item" onClick={() => setTransferSheet(tr)}>
                  <span className="transfer-icon">🔄</span>
                  <span className="transfer-info">
                    <span className="transfer-route">
                      {fromAcc ? `${fromAcc.icon} ${fromAcc.name}` : 'Cuenta eliminada'}
                      {' → '}
                      {toAcc ? `${toAcc.icon} ${toAcc.name}` : 'Cuenta eliminada'}
                    </span>
                    <span className="transfer-meta">
                      {formatDayLabel(tr.date)}
                      {tr.note ? ` · ${tr.note}` : ''}
                    </span>
                  </span>
                  <span className="transfer-amount">{formatMoney(tr.amount)}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nueva cuenta">
        +
      </button>

      {kardex && (
        <AccountKardex
          account={kardex}
          expenses={expenses}
          getCategory={getCategory}
          onEdit={() => { setKardex(null); setEditing(kardex) }}
          onClose={() => setKardex(null)}
        />
      )}

      {editing && (
        <AccountEditor
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}

      {transferSheet && (
        <TransferSheet
          initial={transferSheet === 'new' ? null : transferSheet}
          accounts={withBalance}
          onSubmit={async (data) => {
            if (transferSheet === 'new') await transfer(data)
            else await updateTransfer(transferSheet.transferId, data)
            setTransferSheet(null)
          }}
          onDelete={async () => {
            const ok = await confirm({
              title: 'Eliminar traspaso',
              message: 'Se eliminan las dos partes del traspaso y el dinero vuelve a como estaba.',
            })
            if (ok) {
              await deleteTransfer(transferSheet.transferId)
              setTransferSheet(null)
            }
          }}
          onClose={() => setTransferSheet(null)}
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

// Lista de depósitos de una alcancía, con opción de corregir cada uno. En
// alcancías sorpresa (bloqueadas) los montos van ocultos para no arruinar la
// sorpresa; solo se revela el monto al abrir un depósito para editarlo.
export function PiggyMovements({ piggy, expenses, onEditPiggy, onDeposit, onSelectDeposit, onClose }) {
  const locked = isPiggyLocked(piggy)
  const movements = useMemo(
    () =>
      expenses
        .filter((e) => e.account === piggy.id && e.transfer)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [expenses, piggy.id]
  )

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>
            <span style={{ color: piggy.color }}>{locked ? '🎁' : piggy.icon}</span> {piggy.name}
          </h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {locked && (
          <p className="piggy-hint">
            🎁 Alcancía sorpresa: los montos están ocultos hasta el {formatDayLabel(piggy.revealDate)}. Puedes
            verlos y corregirlos al abrir cada depósito.
          </p>
        )}

        {movements.length === 0 ? (
          <p className="empty-state" style={{ fontSize: 13 }}>
            Aún no hay depósitos en esta alcancía.
          </p>
        ) : (
          <div className="kardex-list">
            {movements.map((m) => (
              <button key={m.id} className="piggy-mov-item" onClick={() => onSelectDeposit(m)}>
                <span className="piggy-mov-label">{m.note || 'Depósito'}</span>
                <span className="piggy-mov-date">{formatDayLabel(m.date)}</span>
                <span className="piggy-mov-amount">{locked ? '••••' : formatMoney(m.amount)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="sheet-actions">
          <button className="btn-ghost" onClick={onEditPiggy}>Editar alcancía</button>
          <button className="btn-primary" onClick={onDeposit}>+ Depositar</button>
        </div>
      </div>
    </div>
  )
}

export function DepositEditor({ movement, onSave, onDelete, onClose }) {
  const confirm = useConfirm()
  const [value, setValue] = useState(String(movement.amount))
  const [date, setDate] = useState(movement.date)
  const amount = Number(value)
  const canSave = value !== '' && Number.isFinite(amount) && amount > 0

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>Editar depósito</h2>
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
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        <p className="picker-label">Fecha</p>
        <input
          className="date-input"
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
        />

        <div className="sheet-actions">
          <button
            className="btn-danger"
            onClick={async () => {
              const ok = await confirm({
                title: 'Eliminar depósito',
                message: 'Se elimina el depósito y su traspaso. El saldo de la alcancía se ajusta.',
              })
              if (ok) onDelete()
            }}
          >
            Eliminar
          </button>
          <button className="btn-primary" disabled={!canSave} onClick={() => onSave({ amount, date })}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

function AccountKardex({ account, expenses, getCategory, onEdit, onClose }) {
  const movements = useMemo(() => {
    return expenses
      .filter((e) => e.account === account.id)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  }, [expenses, account.id])

  const rows = useMemo(() => {
    let balance = account.initialBalance || 0
    const result = movements.map((m) => {
      const sign = (m.type ?? 'expense') === 'income' ? 1 : -1
      balance += sign * m.amount
      return { ...m, runningBalance: balance }
    })
    return result.reverse()
  }, [movements, account.initialBalance])

  const currentBalance = rows.length > 0 ? rows[0].runningBalance : (account.initialBalance || 0)

  const movLabel = (m) => {
    if (m.note) return m.note
    if (m.category) return getCategory(m.category).name
    return (m.type ?? 'expense') === 'income' ? 'Ingreso' : 'Gasto'
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>
            <span style={{ color: account.color }}>{account.icon}</span> {account.name}
          </h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className={`register-amount ${currentBalance < 0 ? 'expense-text' : ''}`}>
          {formatMoney(currentBalance)}
        </div>

        {rows.length === 0 ? (
          <p className="empty-state">No hay movimientos para esta cuenta.</p>
        ) : (
          <div className="kardex-list">
            {rows.map((m) => {
              const isIncome = (m.type ?? 'expense') === 'income'
              return (
                <div key={m.id} className="kardex-item">
                  <span className="kardex-desc">{movLabel(m)}</span>
                  <span className={`kardex-amount ${isIncome ? 'income-text' : 'expense-text'}`}>
                    {isIncome ? '+' : '−'}{formatMoney(m.amount)}
                  </span>
                  <span className="kardex-date">{formatDayLabel(m.date)}</span>
                  <span className={`kardex-balance ${m.runningBalance < 0 ? 'expense-text' : 'muted-text'}`}>
                    {formatMoney(m.runningBalance)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div className="sheet-actions">
          <button className="btn-ghost" onClick={onEdit}>Editar cuenta</button>
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
