import { useEffect, useMemo, useState } from 'react'
import ExpenseList, { formatMoney } from './ExpenseList'
import AddExpense from './AddExpense'
import { useExpenses } from '../utils/useExpenses'
import { useCategories } from '../contexts/CategoriesContext'
import { formatMonthLabel, monthOf } from '../utils/dates'

const PAGE_SIZE = 20

export default function Movements() {
  const { expenses, loading, updateExpense, deleteExpense } = useExpenses()
  const { categories, getCategory, getSubcategory } = useCategories()

  const [search, setSearch] = useState('')
  const [type, setType] = useState('all') // all | expense | income
  const [categoryId, setCategoryId] = useState('all')
  const [month, setMonth] = useState('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [editing, setEditing] = useState(null)

  // Meses disponibles a partir de los datos reales (no un rango fijo).
  const availableMonths = useMemo(() => {
    const set = new Set(expenses.map((e) => monthOf(e.date)))
    return [...set].sort((a, b) => (a < b ? 1 : -1))
  }, [expenses])

  // Categorías del selector: acotadas al tipo elegido.
  const categoryOptions = useMemo(
    () => categories.filter((c) => type === 'all' || c.type === type),
    [categories, type]
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return expenses.filter((e) => {
      const eType = e.type ?? 'expense'
      if (type !== 'all' && eType !== type) return false
      if (categoryId !== 'all' && e.category !== categoryId) return false
      if (month !== 'all' && monthOf(e.date) !== month) return false
      if (term) {
        const cat = getCategory(e.category)
        const sub = getSubcategory(e.category, e.subcategory)
        const hay = `${e.note ?? ''} ${cat.name} ${sub?.name ?? ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [expenses, type, categoryId, month, search, getCategory, getSubcategory])

  // Al cambiar cualquier filtro, se reinicia la paginación.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, type, categoryId, month])

  // Si el tipo cambia y la categoría elegida ya no aplica, se limpia.
  useEffect(() => {
    if (categoryId !== 'all' && !categoryOptions.some((c) => c.id === categoryId)) {
      setCategoryId('all')
    }
  }, [categoryOptions, categoryId])

  const net = filtered.reduce((acc, e) => acc + ((e.type ?? 'expense') === 'income' ? e.amount : -e.amount), 0)
  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length
  const hasFilters = search.trim() !== '' || type !== 'all' || categoryId !== 'all' || month !== 'all'

  const clearFilters = () => {
    setSearch('')
    setType('all')
    setCategoryId('all')
    setMonth('all')
  }

  const handleSave = async (data) => {
    if (editing) await updateExpense(editing.id, data)
    setEditing(null)
  }

  const handleDelete = async (id) => {
    await deleteExpense(id)
    setEditing(null)
  }

  return (
    <div className="page">
      <header className="reports-header">
        <h1>Movimientos</h1>
      </header>

      <input
        className="search-input"
        type="search"
        placeholder="Buscar por nota o categoría…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="type-toggle">
        <button
          type="button"
          className={`type-toggle-btn ${type === 'all' ? 'selected' : ''}`}
          onClick={() => setType('all')}
        >
          Todos
        </button>
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

      <div className="filter-row">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="all">Todas las categorías</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">Todos los meses</option>
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="results-bar">
        <span>
          {filtered.length} {filtered.length === 1 ? 'movimiento' : 'movimientos'} · neto{' '}
          <strong className={net >= 0 ? 'income-text' : 'expense-text'}>{formatMoney(net)}</strong>
        </span>
        {hasFilters && (
          <button type="button" className="link-btn" onClick={clearFilters}>
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <p className="loading-text">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No hay movimientos que coincidan con la búsqueda.</p>
      ) : (
        <>
          <ExpenseList expenses={visible} onSelect={(expense) => setEditing(expense)} />
          {hasMore && (
            <button className="load-more-btn" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
              Cargar más ({filtered.length - visibleCount} restantes)
            </button>
          )}
        </>
      )}

      {editing && (
        <AddExpense
          initial={editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
