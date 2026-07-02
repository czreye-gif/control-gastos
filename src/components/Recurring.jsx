import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import { useRecurring } from '../utils/useRecurring'
import { useCategories } from '../contexts/CategoriesContext'
import { useConfirm } from '../contexts/ConfirmContext'

export default function Recurring() {
  const { recurring, loading, addRecurring, updateRecurring, deleteRecurring } = useRecurring()
  const { getCategory, getSubcategory } = useCategories()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(null) // null | 'new' | plantilla

  const handleSave = async (data) => {
    if (editing && editing !== 'new') {
      await updateRecurring(editing.id, data)
    } else {
      await addRecurring(data)
    }
    setEditing(null)
  }

  const handleDelete = async (id) => {
    await deleteRecurring(id)
    setEditing(null)
  }

  const toggleActive = (e, t) => {
    e.stopPropagation()
    updateRecurring(t.id, { active: !(t.active !== false) })
  }

  if (loading) return <p className="loading-text">Cargando...</p>

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">
          ←
        </button>
        <h1>Pagos recurrentes</h1>
      </header>

      <p className="page-subtitle">Movimientos que se registran automáticamente cada mes.</p>

      {recurring.length === 0 ? (
        <p className="empty-state">
          Aún no tienes pagos recurrentes.
          <br />
          Toca + para agregar renta, suscripciones, etc.
        </p>
      ) : (
        <div className="recurring-list">
          {recurring.map((t) => {
            const cat = getCategory(t.category)
            const sub = getSubcategory(t.category, t.subcategory)
            const isIncome = t.type === 'income'
            const inactive = t.active === false
            return (
              <button
                key={t.id}
                className={`recurring-item ${inactive ? 'inactive' : ''}`}
                onClick={() => setEditing(t)}
              >
                <span className="expense-icon" style={{ background: cat.color + '22', color: cat.color }}>
                  {cat.icon}
                </span>
                <span className="expense-info">
                  <span className="expense-category">
                    {cat.name}
                    {sub && <span className="expense-subcategory"> · {sub.name}</span>}
                  </span>
                  <span className="expense-note">
                    Día {t.dayOfMonth} de cada mes{t.note ? ` · ${t.note}` : ''}
                  </span>
                </span>
                <span className="recurring-right">
                  <span className={`expense-amount ${isIncome ? 'income' : ''}`}>
                    {isIncome ? '+' : '-'}
                    {formatMoney(t.amount)}
                  </span>
                  <span
                    className={`recurring-toggle ${inactive ? '' : 'on'}`}
                    onClick={(e) => toggleActive(e, t)}
                    role="switch"
                    aria-checked={!inactive}
                    aria-label={inactive ? 'Activar' : 'Pausar'}
                  >
                    <span className="recurring-knob" />
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nuevo recurrente">
        +
      </button>

      {editing && (
        <RecurringEditor
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function RecurringEditor({ initial, onSave, onDelete, onClose }) {
  const { categories, getCategory } = useCategories()
  const confirm = useConfirm()
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [type, setType] = useState(initial?.type ?? 'expense')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [day, setDay] = useState(initial?.dayOfMonth ?? 1)

  const visibleCategories = categories.filter((c) => c.type === type)
  const subcategories = category ? getCategory(category).subcategories ?? [] : []
  const amountNum = Number(amount)
  const canSave = amount !== '' && Number.isFinite(amountNum) && amountNum > 0 && category

  const selectType = (t) => {
    setType(t)
    setCategory('')
    setSubcategory('')
  }

  const handleSave = () => {
    if (!canSave) return
    onSave({
      amount: amountNum,
      type,
      category,
      subcategory: subcategory || null,
      note: note.trim(),
      dayOfMonth: Math.min(Math.max(Number(day) || 1, 1), 31),
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>{initial ? 'Editar recurrente' : 'Nuevo recurrente'}</h2>

        <div className="type-toggle">
          <button
            type="button"
            className={`type-toggle-btn ${type === 'expense' ? 'selected' : ''}`}
            onClick={() => selectType('expense')}
          >
            Gasto
          </button>
          <button
            type="button"
            className={`type-toggle-btn income ${type === 'income' ? 'selected' : ''}`}
            onClick={() => selectType('income')}
          >
            Ingreso
          </button>
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
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <p className="picker-label">Categoría</p>
        <div className="category-grid">
          {visibleCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`category-chip ${category === c.id ? 'selected' : ''}`}
              style={{ '--chip-color': c.color }}
              onClick={() => {
                setCategory(c.id)
                setSubcategory('')
              }}
            >
              <span className="category-icon">{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        {subcategories.length > 0 && (
          <>
            <p className="picker-label">Subcategoría (opcional)</p>
            <div className="subcategory-picker">
              {subcategories.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`subcategory-chip ${subcategory === s.id ? 'selected' : ''}`}
                  onClick={() => setSubcategory(subcategory === s.id ? '' : s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="picker-label">Día del mes</p>
        <div className="amount-input-wrap">
          <input
            className="amount-input-field"
            type="number"
            inputMode="numeric"
            min="1"
            max="31"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>

        <input
          className="note-input"
          type="text"
          placeholder="Nota (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="sheet-actions">
          {initial && (
            <button
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Eliminar recurrente',
                  message: 'Se dejará de registrar este pago automáticamente. Los movimientos ya creados se conservan.',
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
