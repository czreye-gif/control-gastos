import { useEffect, useRef, useState } from 'react'
import { CATEGORIES } from '../utils/categories'
import { todayISO } from '../utils/dates'

export default function AddExpense({ initial, onSave, onDelete, onClose }) {
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const amountRef = useRef(null)

  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  const canSave = Number(amount) > 0 && category

  const handleSave = () => {
    if (!canSave) return
    onSave({ amount: Number(amount), category, note: note.trim(), date })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>{initial ? 'Editar gasto' : 'Nuevo gasto'}</h2>

        <input
          ref={amountRef}
          className="amount-input"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <div className="category-grid">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`category-chip ${category === c.id ? 'selected' : ''}`}
              style={{ '--chip-color': c.color }}
              onClick={() => setCategory(c.id)}
            >
              <span className="category-icon">{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        <input
          className="note-input"
          type="text"
          placeholder="Nota (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <input
          className="date-input"
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
        />

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
