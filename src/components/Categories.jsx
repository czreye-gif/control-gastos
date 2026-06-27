import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '../contexts/CategoriesContext'
import { COLOR_OPTIONS, ICON_OPTIONS } from '../utils/categories'

export default function Categories() {
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(null) // null | 'new' | categoría

  const handleSave = async ({ name, icon, color }) => {
    if (editing && editing !== 'new') {
      await updateCategory(editing.id, { name, icon, color })
    } else {
      await addCategory({ name, icon, color })
    }
    setEditing(null)
  }

  const handleDelete = async (id) => {
    await deleteCategory(id)
    setEditing(null)
  }

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">
          ←
        </button>
        <h1>Categorías</h1>
      </header>

      <div className="category-rows">
        {categories.map((c) => (
          <button key={c.id} className="category-row" onClick={() => setEditing(c)}>
            <span className="row-icon" style={{ background: c.color + '22', color: c.color }}>
              {c.icon}
            </span>
            <span className="row-name">{c.name}</span>
            <span className="row-edit">Editar ›</span>
          </button>
        ))}
      </div>

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nueva categoría">
        +
      </button>

      {editing && (
        <CategoryEditor
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function CategoryEditor({ initial, onSave, onDelete, onClose }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? ICON_OPTIONS[0])
  const [color, setColor] = useState(initial?.color ?? COLOR_OPTIONS[0])

  const canSave = name.trim().length > 0

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>{initial ? 'Editar categoría' : 'Nueva categoría'}</h2>

        <div className="preview-chip" style={{ '--chip-color': color }}>
          <span className="category-icon">{icon}</span>
          <span>{name || 'Nombre'}</span>
        </div>

        <input
          className="note-input"
          type="text"
          placeholder="Nombre de la categoría"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <p className="picker-label">Icono</p>
        <div className="icon-picker">
          {ICON_OPTIONS.map((i) => (
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

        <div className="sheet-actions">
          {initial && (
            <button className="btn-danger" onClick={() => onDelete(initial.id)}>
              Eliminar
            </button>
          )}
          <button className="btn-primary" disabled={!canSave} onClick={() => onSave({ name: name.trim(), icon, color })}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
