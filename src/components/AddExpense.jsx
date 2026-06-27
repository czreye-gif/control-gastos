import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '../contexts/CategoriesContext'
import { todayISO } from '../utils/dates'
import { formatMoney } from './ExpenseList'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back']

export default function AddExpense({ initial, onSave, onDelete, onClose }) {
  const { categories } = useCategories()
  const navigate = useNavigate()
  // El monto se maneja en centavos, como en las terminales bancarias:
  // cada dígito que tecleas se acomoda desde la derecha.
  const [cents, setCents] = useState(initial ? Math.round(initial.amount * 100) : 0)
  const [category, setCategory] = useState(initial?.category ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())

  const amount = cents / 100
  const canSave = cents > 0 && category

  const pressKey = (k) => {
    if (k === 'back') {
      setCents((c) => Math.floor(c / 10))
    } else if (k === '00') {
      setCents((c) => Math.min(c * 100, 9_999_999_99))
    } else {
      setCents((c) => Math.min(c * 10 + Number(k), 9_999_999_99))
    }
  }

  const handleSave = () => {
    if (!canSave) return
    onSave({ amount, category, note: note.trim(), date })
  }

  const goToCategories = () => {
    onClose()
    navigate('/categorias')
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{initial ? 'Editar gasto' : 'Nuevo gasto'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="amount-display">{formatMoney(amount)}</div>

        <div className="category-grid">
          {categories.map((c) => (
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
          <button type="button" className="category-chip edit-chip" onClick={goToCategories}>
            <span className="category-icon">✏️</span>
            <span>Editar</span>
          </button>
        </div>

        <div className="keypad">
          {KEYS.map((k) => (
            <button key={k} type="button" className="key" onClick={() => pressKey(k)}>
              {k === 'back' ? '⌫' : k}
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
