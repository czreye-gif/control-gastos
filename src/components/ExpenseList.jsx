import { useCategories } from '../contexts/CategoriesContext'
import { formatDayLabel } from '../utils/dates'

export default function ExpenseList({ expenses, onSelect, onSelectTransfer }) {
  const { getCategory, getSubcategory } = useCategories()

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p>Aún no has registrado movimientos.</p>
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
            <span>{formatMoney(netSum(items))}</span>
          </div>
          {items.map((expense) => {
            const cat = getCategory(expense.category)
            const sub = getSubcategory(expense.category, expense.subcategory)
            const isIncome = expense.type === 'income'
            const isTransfer = expense.transfer
            // Solo los traspasos entre cuentas (con transferId) son editables;
            // los depósitos a alcancías / tandas siguen sin abrir nada.
            const editableTransfer = isTransfer && expense.transferId && onSelectTransfer
            return (
              <button
                key={expense.id}
                className="expense-item"
                onClick={() =>
                  isTransfer ? editableTransfer && onSelectTransfer(expense) : onSelect(expense)
                }
              >
                {isTransfer ? (
                  <span className="expense-icon" style={{ background: '#64748b22', color: '#94a3b8' }}>
                    🔄
                  </span>
                ) : (
                  <span className="expense-icon" style={{ background: cat.color + '22', color: cat.color }}>
                    {cat.icon}
                  </span>
                )}
                <span className="expense-info">
                  <span className="expense-category">
                    {isTransfer ? expense.note || 'Traspaso' : cat.name}
                    {!isTransfer && sub && <span className="expense-subcategory"> · {sub.name}</span>}
                  </span>
                  {isTransfer ? (
                    <span className="expense-note">Traspaso</span>
                  ) : (
                    expense.note && <span className="expense-note">{expense.note}</span>
                  )}
                </span>
                <span className={`expense-amount ${isIncome ? 'income' : ''}`}>
                  {isIncome ? '+' : '-'}{formatMoney(expense.amount)}
                </span>
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

function netSum(items) {
  return items.reduce((acc, i) => acc + (i.type === 'income' ? i.amount : -i.amount), 0)
}

export function formatMoney(value) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
}
