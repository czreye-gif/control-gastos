import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '../contexts/CategoriesContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { COLOR_OPTIONS, ICON_GROUPS } from '../utils/categories'

export default function Categories() {
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    addSubcategory,
    deleteSubcategory,
    repairDuplicates,
  } = useCategories()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [type, setType] = useState('expense')
  const [editing, setEditing] = useState(null) // null | 'new' | categoría
  const [repairing, setRepairing] = useState(false)
  const [repairStatus, setRepairStatus] = useState('')

  const visible = useMemo(() => categories.filter((c) => c.type === type), [categories, type])

  const handleRepair = async () => {
    const ok = await confirm({
      title: 'Reparar duplicados',
      message:
        'Fusiona las categorías repetidas (mismo nombre y tipo) en una sola y reasigna sus movimientos, presupuestos y recurrentes. Conviene exportar un respaldo antes desde Migración.',
      confirmText: 'Reparar',
      danger: false,
    })
    if (!ok) return
    setRepairing(true)
    setRepairStatus('Reparando…')
    try {
      const r = await repairDuplicates()
      setRepairStatus(
        r.removed === 0
          ? '✅ No se encontraron categorías duplicadas.'
          : `✅ ${r.mergedGroups} grupo(s) fusionado(s), ${r.removed} copia(s) eliminada(s), ${r.repointed} movimiento(s) reasignado(s).`,
      )
    } catch (e) {
      setRepairStatus('❌ Error: ' + e.message)
    }
    setRepairing(false)
  }

  // `editing` solo guarda el id; la categoría "viva" se busca en cada render
  // para que los cambios de Firestore (p.ej. subcategorías) se reflejen al instante.
  const editingCategory =
    editing && editing !== 'new' ? categories.find((c) => c.id === editing.id) ?? editing : editing

  const handleSave = async ({ name, icon, color }) => {
    if (editing && editing !== 'new') {
      await updateCategory(editing.id, { name, icon, color })
    } else {
      await addCategory({ name, icon, color, type })
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

      <div className="type-toggle">
        <button
          type="button"
          className={`type-toggle-btn ${type === 'expense' ? 'selected' : ''}`}
          onClick={() => setType('expense')}
        >
          Gastos
        </button>
        <button
          type="button"
          className={`type-toggle-btn income ${type === 'income' ? 'selected' : ''}`}
          onClick={() => setType('income')}
        >
          Ingresos
        </button>
      </div>

      <div className="category-rows">
        {visible.map((c) => (
          <button key={c.id} className="category-row" onClick={() => setEditing(c)}>
            <span className="row-icon" style={{ background: c.color + '22', color: c.color }}>
              {c.icon}
            </span>
            <span className="row-name">
              {c.name}
              {c.subcategories?.length > 0 && (
                <span className="row-sub-count"> · {c.subcategories.length} subcategorías</span>
              )}
            </span>
            <span className="row-edit">Editar ›</span>
          </button>
        ))}
      </div>

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nueva categoría">
        +
      </button>

      <div className="category-maintenance">
        <button className="btn-ghost" onClick={handleRepair} disabled={repairing}>
          {repairing ? 'Reparando…' : '🧹 Reparar duplicados'}
        </button>
        {repairStatus && <p className="migration-status">{repairStatus}</p>}
      </div>

      {editing && (
        <CategoryEditor
          initial={editing === 'new' ? null : editingCategory}
          onSave={handleSave}
          onDelete={handleDelete}
          onAddSubcategory={(data) => addSubcategory(editingCategory.id, data)}
          onDeleteSubcategory={(subId) => deleteSubcategory(editingCategory.id, subId)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function CategoryEditor({ initial, onSave, onDelete, onAddSubcategory, onDeleteSubcategory, onClose }) {
  const confirm = useConfirm()
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? ICON_GROUPS[0].icons[0])
  const [color, setColor] = useState(initial?.color ?? COLOR_OPTIONS[0])
  const [subName, setSubName] = useState('')

  const canSave = name.trim().length > 0

  const handleAddSub = () => {
    if (!subName.trim()) return
    onAddSubcategory({ name: subName.trim() })
    setSubName('')
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{initial ? 'Editar categoría' : 'Nueva categoría'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

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
        <div className="icon-picker-groups">
          {ICON_GROUPS.map((group) => (
            <div key={group.label} className="icon-group">
              <p className="icon-group-label">{group.label}</p>
              <div className="icon-picker">
                {group.icons.map((i) => (
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
            </div>
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

        {initial && (
          <>
            <p className="picker-label">Subcategorías</p>
            <div className="subcategory-list">
              {(initial.subcategories ?? []).map((s) => (
                <span key={s.id} className="subcategory-tag">
                  {s.name}
                  <button
                    type="button"
                    className="subcategory-remove"
                    onClick={() => onDeleteSubcategory(s.id)}
                    aria-label={`Eliminar ${s.name}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {(initial.subcategories ?? []).length === 0 && (
                <p className="subcategory-empty">Sin subcategorías todavía.</p>
              )}
            </div>
            <div className="subcategory-add">
              <input
                className="note-input"
                type="text"
                placeholder="Nueva subcategoría"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddSub()
                  }
                }}
              />
              <button type="button" className="icon-btn" onClick={handleAddSub} aria-label="Agregar subcategoría">
                +
              </button>
            </div>
          </>
        )}

        <div className="sheet-actions">
          {initial && (
            <button
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({
                  title: `Eliminar "${initial.name}"`,
                  message: 'Los movimientos de esta categoría quedarán como "Sin categoría".',
                })
                if (ok) onDelete(initial.id)
              }}
            >
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
