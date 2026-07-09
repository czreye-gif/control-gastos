import { useEffect, useMemo, useState } from 'react'
import ExpenseList, { formatMoney } from './ExpenseList'
import AddExpense from './AddExpense'
import { EditTransferSheet, transferForLeg } from './TransferSheet'
import { useExpenses } from '../utils/useExpenses'
import { useCategories } from '../contexts/CategoriesContext'
import { useAccounts } from '../utils/useAccounts'
import { formatMonthLabel, monthOf, todayISO } from '../utils/dates'
import { downloadFile, movementsToCsv } from '../utils/exportCsv'

const PAGE_SIZE = 20

export default function Movements() {
  const { expenses, loading, updateExpense, deleteExpense } = useExpenses()
  const { categories, getCategory, getSubcategory } = useCategories()
  const { accounts } = useAccounts()

  const [search, setSearch] = useState('')
  const [type, setType] = useState('all') // all | expense | income
  const [categoryId, setCategoryId] = useState('all')
  const [month, setMonth] = useState('all')
  const [accountId, setAccountId] = useState('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [editing, setEditing] = useState(null)
  const [editingTransfer, setEditingTransfer] = useState(null)

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

  // Cuánto dinero movió cada categoría con los filtros activos (menos el de
  // categoría, que es justo el que se está eligiendo). Sirve para marcar con
  // un "LED" las que sí tuvieron flujo y ordenar el selector por monto.
  const categoryTotals = useMemo(() => {
    const term = search.trim().toLowerCase()
    const totals = new Map()
    for (const e of expenses) {
      const eType = e.type ?? 'expense'
      if (type !== 'all' && eType !== type) continue
      if (accountId !== 'all' && (e.account ?? '') !== accountId) continue
      if (month !== 'all' && monthOf(e.date) !== month) continue
      if (term) {
        const cat = getCategory(e.category)
        const sub = getSubcategory(e.category, e.subcategory)
        const hay = `${e.note ?? ''} ${cat.name} ${sub?.name ?? ''}`.toLowerCase()
        if (!hay.includes(term)) continue
      }
      if (!e.category) continue
      totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount)
    }
    return totals
  }, [expenses, type, accountId, month, search, getCategory, getSubcategory])

  // Selector ordenado: primero las de mayor flujo de dinero; las vacías al final.
  const sortedCategoryOptions = useMemo(
    () =>
      [...categoryOptions].sort((a, b) => {
        const ta = categoryTotals.get(a.id) ?? 0
        const tb = categoryTotals.get(b.id) ?? 0
        if (tb !== ta) return tb - ta
        return a.name.localeCompare(b.name)
      }),
    [categoryOptions, categoryTotals]
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return expenses.filter((e) => {
      const eType = e.type ?? 'expense'
      if (type !== 'all' && eType !== type) return false
      if (categoryId !== 'all' && e.category !== categoryId) return false
      if (accountId !== 'all' && (e.account ?? '') !== accountId) return false
      if (month !== 'all' && monthOf(e.date) !== month) return false
      if (term) {
        const cat = getCategory(e.category)
        const sub = getSubcategory(e.category, e.subcategory)
        const hay = `${e.note ?? ''} ${cat.name} ${sub?.name ?? ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [expenses, type, categoryId, accountId, month, search, getCategory, getSubcategory])

  // Al cambiar cualquier filtro, se reinicia la paginación.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, type, categoryId, accountId, month])

  // Si el tipo cambia y la categoría elegida ya no aplica, se limpia.
  useEffect(() => {
    if (categoryId !== 'all' && !categoryOptions.some((c) => c.id === categoryId)) {
      setCategoryId('all')
    }
  }, [categoryOptions, categoryId])

  const net = filtered.reduce((acc, e) => acc + ((e.type ?? 'expense') === 'income' ? e.amount : -e.amount), 0)
  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length
  const hasFilters =
    search.trim() !== '' || type !== 'all' || categoryId !== 'all' || accountId !== 'all' || month !== 'all'

  const clearFilters = () => {
    setSearch('')
    setType('all')
    setCategoryId('all')
    setAccountId('all')
    setMonth('all')
  }

  const accountName = (id) => (id ? accounts.find((a) => a.id === id)?.name ?? '' : '')

  const handleExport = () => {
    if (filtered.length === 0) return
    const csv = movementsToCsv(filtered, {
      categoryName: (id) => getCategory(id).name,
      subcategoryName: (catId, subId) => getSubcategory(catId, subId)?.name ?? '',
      accountName,
    })
    downloadFile(`movimientos_${todayISO()}.csv`, csv)
  }

  const handleSave = async (data) => {
    if (!editing) {
      setEditing(null)
      return
    }
    // Cierre optimista (igual que en Home): cerramos la modal al instante y
    // sincronizamos en segundo plano, para que no se sienta "congelada".
    const op = updateExpense(editing.id, data)
    setEditing(null)
    try {
      await op
    } catch (e) {
      console.error('No se pudo sincronizar el movimiento:', e)
    }
  }

  const handleDelete = async (id) => {
    await deleteExpense(id)
    setEditing(null)
  }

  return (
    <div className="page">
      <header className="reports-header">
        <h1>Movimientos</h1>
        <button
          type="button"
          className="export-btn"
          onClick={handleExport}
          disabled={filtered.length === 0}
        >
          ⬇ Exportar
        </button>
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
          {sortedCategoryOptions.map((c) => {
            const total = categoryTotals.get(c.id) ?? 0
            return (
              <option key={c.id} value={c.id}>
                {total > 0 ? '🟢' : '⚪'} {c.icon} {c.name}{total > 0 ? ` (${formatMoney(total)})` : ''}
              </option>
            )
          })}
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

      {accounts.length > 0 && (
        <div className="filter-row">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="all">Todas las cuentas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
            <option value="">Sin cuenta</option>
          </select>
        </div>
      )}

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
          <ExpenseList
            expenses={visible}
            onSelect={(expense) => setEditing(expense)}
            onSelectTransfer={(leg) => setEditingTransfer(transferForLeg(expenses, leg))}
          />
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

      {editingTransfer && (
        <EditTransferSheet transfer={editingTransfer} onClose={() => setEditingTransfer(null)} />
      )}
    </div>
  )
}
