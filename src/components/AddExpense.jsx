import { useMemo, useState } from 'react'
import { useCategories } from '../contexts/CategoriesContext'
import Categories from './Categories'
import { useConfirm } from '../contexts/ConfirmContext'
import { useAccounts } from '../utils/useAccounts'
import { computeFrequentMovements } from '../utils/favorites'
import { todayISO } from '../utils/dates'
import { formatMoney } from './ExpenseList'

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', 'back']

export default function AddExpense({ initial, expenses, onSave, onDelete, onClose }) {
  const { categories, getCategory, getSubcategory } = useCategories()
  const { accounts } = useAccounts()
  const confirm = useConfirm()
  // El monto se maneja en centavos, como en las terminales bancarias:
  // cada dígito que tecleas se acomoda desde la derecha.
  const [cents, setCents] = useState(initial ? Math.round(initial.amount * 100) : 0)
  const [type, setType] = useState(initial?.type ?? 'expense')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [account, setAccount] = useState(initial?.account ?? '')
  const [billable, setBillable] = useState(initial?.billable ?? false)
  const [saving, setSaving] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [showCategories, setShowCategories] = useState(false)

  // Favoritos = movimientos que ya se repitieron 2+ veces con el mismo
  // monto, categoría, subcategoría y cuenta. No se crean a mano: salen solos
  // del historial real, así el módulo no se llena de plantillas manuales.
  const frequentMovements = useMemo(
    () => computeFrequentMovements(expenses ?? [], type),
    [expenses, type]
  )

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
    if (t === 'income') setBillable(false)
  }

  const selectCategory = (id) => {
    setCategory(id)
    setSubcategory('')
  }

  // Llena todo el formulario con el favorito elegido de un solo toque;
  // el usuario solo confirma (o ajusta) fecha antes de guardar.
  const applyFavorite = (f) => {
    setCents(Math.round(f.amount * 100))
    setType(f.type || 'expense')
    setCategory(f.category)
    setSubcategory(f.subcategory || '')
    setNote(f.note || '')
    setAccount(f.account || '')
    setShowFavorites(false)
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
      billable: type === 'expense' ? billable : false,
    })
  }

  const goToCategories = () => setShowCategories(true)

  const askDelete = async () => {
    const ok = await confirm({
      title: type === 'income' ? 'Eliminar ingreso' : 'Eliminar gasto',
      message: 'Esta acción no se puede deshacer.',
    })
    if (ok) onDelete(initial.id)
  }

  return (
    <>
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
        {!initial && frequentMovements.length > 0 && (
          <button type="button" className="favorites-trigger" onClick={() => setShowFavorites(true)}>
            ⭐ Elegir un favorito
          </button>
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
        </div>
        <button type="button" className="edit-categories-btn" onClick={goToCategories}>
          ✏️ Editar categorías y subcategorías
        </button>

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

        {type === 'expense' && (
          <button
            type="button"
            className={`billable-toggle ${billable ? 'active' : ''}`}
            onClick={() => setBillable((b) => !b)}
          >
            <span className="billable-toggle-icon">🧾</span>
            <span className="billable-toggle-text">
              <span className="billable-toggle-label">Solicitar factura (CFDI)</span>
              <span className="billable-toggle-hint">Aparecerá en Gastos Facturables</span>
            </span>
            <span className={`billable-switch ${billable ? 'on' : ''}`}>
              <span className="billable-switch-dot" />
            </span>
          </button>
        )}

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

    {showFavorites && (
      <FavoritesPicker
        items={frequentMovements}
        accounts={accounts}
        getCategory={getCategory}
        getSubcategory={getSubcategory}
        onSelect={applyFavorite}
        onClose={() => setShowFavorites(false)}
      />
    )}

    {showCategories && (
      <div className="categories-overlay">
        <Categories onBack={() => setShowCategories(false)} initialType={type} />
      </div>
    )}
    </>
  )
}

function FavoritesPicker({ items, accounts, getCategory, getSubcategory, onSelect, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sticky">
          <div className="modal-head">
            <h2>Favoritos</h2>
            <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
          <p className="picker-label">Tus movimientos más repetidos. Toca uno para llenarlo.</p>
        </div>
        <div className="modal-body">
          {items.map((f, i) => {
            const cat = getCategory(f.category)
            const sub = getSubcategory(f.category, f.subcategory)
            const acc = accounts.find((a) => a.id === f.account)
            return (
              <button key={i} type="button" className="expense-item" onClick={() => onSelect(f)}>
                <span className="expense-icon" style={{ background: cat.color + '22', color: cat.color }}>
                  {cat.icon}
                </span>
                <span className="expense-info">
                  <span className="expense-category">
                    {cat.name}
                    {sub && <span className="expense-subcategory"> · {sub.name}</span>}
                  </span>
                  <span className="expense-note">
                    {acc ? `${acc.icon} ${acc.name} · ` : ''}{f.count}× registrado
                  </span>
                </span>
                <span className={`expense-amount ${f.type === 'income' ? 'income' : ''}`}>
                  {f.type === 'income' ? '+' : '-'}{formatMoney(f.amount)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
