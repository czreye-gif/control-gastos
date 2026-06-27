import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '../contexts/CategoriesContext'
import { todayISO } from '../utils/dates'

export default function AddExpense({ initial, onSave, onDelete, onClose }) {
  const { categories } = useCategories()
  const navigate = useNavigate()
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const amountRef = useRef(null)

  // Al abrir, el cursor va directo al monto y se abre el teclado numérico.
  useEffect(() => {
    const t = setTimeout(() => amountRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  const canSave = Number(amount) > 0 && category

  const handleSave = () => {
    if (!canSave) return
    onSave({ amount: Number(amount), category, note: note.trim(), date })
  }

  const goToCategories = () => {
    onClose()
    navigate('/categorias')
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>{initial ? 'Editar gasto' : 'Nuevo gasto'}</h2>

        <div className="amount-row">
          <span className="amount-symbol">$</span>
          <input
            ref={amountRef}
            className="amount-input"
            type="text"
            inputMode="decimal"
            autoFocus
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          />
        </div>

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
