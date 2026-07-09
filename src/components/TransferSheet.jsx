import { useMemo, useState } from 'react'
import { formatMoney } from './ExpenseList'
import { useExpenses } from '../utils/useExpenses'
import { useAccounts, computeBalances, computeTransfers } from '../utils/useAccounts'
import { useConfirm } from '../contexts/ConfirmContext'
import { todayISO } from '../utils/dates'

// Hoja para crear o editar un traspaso entre cuentas.
export default function TransferSheet({ initial, accounts, onSubmit, onDelete, onClose }) {
  const [from, setFrom] = useState(initial?.from ?? '')
  const [to, setTo] = useState(initial?.to ?? '')
  const [value, setValue] = useState(initial ? String(initial.amount) : '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [note, setNote] = useState(initial?.note ?? '')
  const [saving, setSaving] = useState(false)

  const amount = Number(value)
  const fromAcc = accounts.find((a) => a.id === from)
  // Al editar, el saldo mostrado ya incluye este traspaso; se le suma de vuelta
  // el monto original para juzgar la suficiencia como si no existiera.
  const availableFrom = fromAcc ? fromAcc.balance + (initial && initial.from === from ? initial.amount : 0) : 0
  const insufficient = fromAcc && amount > 0 && amount > availableFrom
  const canSave = from && to && from !== to && value !== '' && Number.isFinite(amount) && amount > 0

  // Al elegir origen, si el destino coincide se limpia para evitar A→A.
  const selectFrom = (id) => {
    setFrom(id)
    if (to === id) setTo('')
  }

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    await onSubmit({ from, to, amount, date, note })
  }

  return (
    <div className="sheet-backdrop" onClick={saving ? undefined : onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{initial ? 'Editar traspaso' : 'Traspasar entre cuentas'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar" disabled={saving}>✕</button>
        </div>

        <p className="picker-label">Desde</p>
        <div className="subcategory-picker">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`subcategory-chip ${from === a.id ? 'selected' : ''}`}
              onClick={() => selectFrom(a.id)}
            >
              {a.icon} {a.name} · {formatMoney(a.balance)}
            </button>
          ))}
        </div>

        <p className="picker-label">Hacia</p>
        <div className="subcategory-picker">
          {accounts
            .filter((a) => a.id !== from)
            .map((a) => (
              <button
                key={a.id}
                type="button"
                className={`subcategory-chip ${to === a.id ? 'selected' : ''}`}
                onClick={() => setTo(to === a.id ? '' : a.id)}
              >
                {a.icon} {a.name} · {formatMoney(a.balance)}
              </button>
            ))}
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
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        {insufficient && (
          <p className="tanda-error">⚠️ El monto supera el saldo de {fromAcc.name} ({formatMoney(availableFrom)}). El traspaso se registra igual y la cuenta quedará en negativo.</p>
        )}

        <p className="picker-label">Fecha</p>
        <input
          className="date-input"
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
        />

        <input
          className="note-input"
          type="text"
          placeholder="Nota (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="sheet-actions">
          {initial ? (
            <button className="btn-danger" onClick={onDelete} disabled={saving}>Eliminar</button>
          ) : (
            <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          )}
          <button className="btn-primary" disabled={!canSave || saving} onClick={handleSave}>
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Traspasar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Wrapper autocontenido para editar/eliminar un traspaso desde cualquier
// lista de movimientos. Reconstruye las cuentas con saldo y cablea las
// operaciones del hook, para que Inicio y Movimientos solo tengan que abrirlo.
export function EditTransferSheet({ transfer, onClose }) {
  const { expenses } = useExpenses()
  const { accounts, updateTransfer, deleteTransfer } = useAccounts()
  const confirm = useConfirm()

  const withBalance = useMemo(
    () => computeBalances(accounts.filter((a) => !a.piggy), expenses),
    [accounts, expenses]
  )

  return (
    <TransferSheet
      initial={transfer}
      accounts={withBalance}
      onSubmit={async (data) => {
        await updateTransfer(transfer.transferId, data)
        onClose()
      }}
      onDelete={async () => {
        const ok = await confirm({
          title: 'Eliminar traspaso',
          message: 'Se eliminan las dos partes del traspaso y el dinero vuelve a como estaba.',
        })
        if (ok) {
          await deleteTransfer(transfer.transferId)
          onClose()
        }
      }}
      onClose={onClose}
    />
  )
}

// Encuentra el traspaso completo (ambas partes) al que pertenece un movimiento
// de traspaso, a partir de su transferId. Devuelve null si no aplica.
export function transferForLeg(expenses, leg) {
  if (!leg?.transferId) return null
  return computeTransfers(expenses).find((t) => t.transferId === leg.transferId) ?? null
}
