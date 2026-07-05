import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '../contexts/CategoriesContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { useAccounts } from '../utils/useAccounts'
import { useFavorites } from '../utils/useFavorites'
import { todayISO } from '../utils/dates'
import { formatMoney } from './ExpenseList'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back']

export default function AddExpense({ initial, onSave, onDelete, onClose }) {
  const { categories, getCategory } = useCategories()
  const { accounts } = useAccounts()
  const { favorites, addFavorite, deleteFavorite } = useFavorites()
  const confirm = useConfirm()
  const navigate = useNavigate()
  // El monto se maneja en centavos, como en las terminales bancarias:
  // cada dígito que tecleas se acomoda desde la derecha.
  const [cents, setCents] = useState(initial ? Math.round(initial.amount * 100) : 0)
  const [type, setType] = useState(initial?.type ?? 'expense')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [account, setAccount] = useState(initial?.account ?? '')
  const [saving, setSaving] = useState(false)
  const [removingFavorites, setRemovingFavorites] = useState(false)
  const [namingFavorite, setNamingFavorite] = useState(false)
  const [favoriteName, setFavoriteName] = useState('')

  const amount = cents / 100
  const canSave = cents > 0 && category
  const visibleCategories = categories.filter((c) => c.type === type)
  const subcategories = category ? getCategory(category).subcategories ?? [] : []
  // Las alcancías no son método de pago; se excluyen del selector de cuenta.
  const payAccounts = accounts.filter((a) => !a.piggy)

  const pressKey = (k) => {
    if (k === 'back') {
      setCents((c) => Math.floor(c / 10))
    } else if (k === '00') {
      setCents((c) => Math.min(c * 100, 9_999_999_99))
    } else {
      setCents((c) => Math.min(c * 10 + Number(k), 9_999_999_99))
    }
  }

  const selectType = (t) => {
    setType(t)
    setCategory('')
    setSubcategory('')
  }

  const selectCategory = (id) => {
    setCategory(id)
    setSubcategory('')
  }

  // Llena todo el formulario con la plantilla del favorito de un solo toque;
  // el usuario solo confirma (o ajusta) fecha/nota antes de guardar.
  const applyFavorite = (f) => {
    setCents(Math.round(f.amount * 100))
    setType(f.type || 'expense')
    setCategory(f.category)
    setSubcategory(f.subcategory || '')
    setNote(f.note || '')
    setAccount(f.account || '')
  }

  const startSaveFavorite = () => {
    if (!canSave) return
    setFavoriteName(getCategory(category).name)
    setNamingFavorite(true)
  }

  const confirmSaveFavorite = () => {
    const name = favoriteName.trim()
    if (!name) return
    addFavorite({
      name,
      amount,
      type,
      category,
      subcategory: subcategory || null,
      note: note.trim(),
      account: account || null,
    })
    setNamingFavorite(false)
    setFavoriteName('')
  }

  const askDeleteFavorite = async (f) => {
    const ok = await confirm({
      title: 'Eliminar favorito',
      message: `Se quitará "${f.name}" de tus favoritos.`,
    })
    if (ok) deleteFavorite(f.id)
  }

  const handleSave = () => {
    // Candado anti doble-guardado: `saving` se activa de forma síncrona en el
    // primer clic, así que cualquier clic posterior sale de inmediato. El padre
    // (Home) persiste el movimiento y cierra la modal. Antes no había candado ni
    // se cerraba la modal, por eso el usuario guardaba el mismo movimiento varias
    // veces creyendo que no pasaba nada.
    if (!canSave || saving) return
    setSaving(true)
    onSave({
      amount,
      type,
      category,
      subcategory: subcategory || null,
      note: note.trim(),
      date,
      account: account || null,
    })
  }

  const goToCategories = () => {
    onClose()
    navigate('/categorias')
  }

  const askDelete = async () => {
    const ok = await confirm({
      title: type === 'income' ? 'Eliminar ingreso' : 'Eliminar gasto',
      message: 'Esta acción no se puede deshacer.',
    })
    if (ok) onDelete(initial.id)
  }

  return (
    <div className="modal-backdrop" onClick={saving ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sticky">
        <div className="modal-head">
          <h2>{initial ? (type === 'income' ? 'Editar ingreso' : 'Editar gasto') : 'Nuevo movimiento'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar" disabled={saving}>✕</button>
        </div>

        {!initial && (
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
        )}

        <div className={`amount-display ${type === 'income' ? 'income' : ''}`}>{formatMoney(amount)}</div>
        </div>

        <div className="modal-body">
        {!initial && (
          <div className="favorites-section">
            <div className="picker-label-row">
              <p className="picker-label">Favoritos</p>
              {favorites.length > 0 && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setRemovingFavorites((v) => !v)}
                >
                  {removingFavorites ? 'Listo' : 'Editar'}
                </button>
              )}
            </div>
            <div className="favorites-row">
              {favorites.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`favorite-chip ${removingFavorites ? 'removing' : ''}`}
                  onClick={() => (removingFavorites ? askDeleteFavorite(f) : applyFavorite(f))}
                >
                  {removingFavorites && <span className="favorite-remove">✕</span>}
                  <span className="favorite-chip-icon">{getCategory(f.category).icon}</span>
                  <span className="favorite-chip-name">{f.name}</span>
                  <span className="favorite-chip-amount">{formatMoney(f.amount)}</span>
                </button>
              ))}
              <button
                type="button"
                className="favorite-chip favorite-chip-add"
                onClick={startSaveFavorite}
                disabled={!canSave}
              >
                <span className="favorite-chip-icon">＋</span>
                <span className="favorite-chip-name">Guardar actual</span>
              </button>
            </div>
            {namingFavorite && (
              <div className="favorite-naming">
                <input
                  className="note-input"
                  autoFocus
                  type="text"
                  placeholder="Nombre del favorito (ej. Café mañana)"
                  value={favoriteName}
                  onChange={(e) => setFavoriteName(e.target.value)}
                />
                <div className="favorite-naming-actions">
                  <button type="button" className="btn-danger" onClick={() => setNamingFavorite(false)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!favoriteName.trim()}
                    onClick={confirmSaveFavorite}
                  >
                    Guardar favorito
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="keypad">
          {KEYS.map((k) => (
            <button key={k} type="button" className="key" onClick={() => pressKey(k)}>
              {k === 'back' ? '⌫' : k}
            </button>
          ))}
        </div>

        <div className="category-grid">
          {visibleCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`category-chip ${category === c.id ? 'selected' : ''}`}
              style={{ '--chip-color': c.color }}
              onClick={() => selectCategory(c.id)}
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

        {payAccounts.length > 0 && (
          <>
            <p className="picker-label">
              {type === 'income' ? 'Cuenta de destino (opcional)' : 'Método de pago (opcional)'}
            </p>
            <div className="subcategory-picker">
              {payAccounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`subcategory-chip ${account === a.id ? 'selected' : ''}`}
                  onClick={() => setAccount(account === a.id ? '' : a.id)}
                >
                  {a.icon} {a.name}
                </button>
              ))}
            </div>
          </>
        )}

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
            <button className="btn-danger" onClick={askDelete} disabled={saving}>
              Eliminar
            </button>
          )}
          <button className="btn-primary" disabled={!canSave || saving} onClick={handleSave}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
