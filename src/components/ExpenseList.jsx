import { useCategories } from '../contexts/CategoriesContext'
import { formatDayLabel } from '../utils/dates'

export default function ExpenseList({ expenses, onSelect }) {
  const { getCategory } = useCategories()

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p>Aún no has registrado gastos.</p>
        <p>Toca el botón + para agregar el primero.</p>
      </div>
    )
  }

  const groups = groupByDay(expenses)

  return (
    <div className="expense-list">
      {groups.map(([day, items]) => (
        <div key={day} className="day-group">
          <div className="day-header">
            <span>{formatDayLabel(day)}</span>
            <span>{formatMoney(sum(items))}</span>
          </div>
          {items.map((expense) => {
            const cat = getCategory(expense.category)
            return (
              <button
                key={expense.id}
                className="expense-item"
                onClick={() => onSelect(expense)}
              >
                <span className="expense-icon" style={{ background: cat.color + '22', color: cat.color }}>
                  {cat.icon}
                </span>
                <span className="expense-info">
                  <span className="expense-category">{cat.name}</span>
                  {expense.note && <span className="expense-note">{expense.note}</span>}
                </span>
                <span className="expense-amount">{formatMoney(expense.amount)}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function groupByDay(expenses) {
  const map = new Map()
  for (const e of expenses) {
    if (!map.has(e.date)) map.set(e.date, [])
    map.get(e.date).push(e)
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
}

function sum(items) {
  return items.reduce((acc, i) => acc + i.amount, 0)
}

export function formatMoney(value) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
}
