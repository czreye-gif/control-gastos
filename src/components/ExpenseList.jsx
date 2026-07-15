import { useCategories } from '../contexts/CategoriesContext'
import { formatDayLabel } from '../utils/dates'

export default function ExpenseList({ expenses, onSelect, onSelectTransfer, onSelectTandaMovement, accounts }) {
  const { getCategory, getSubcategory } = useCategories()
  // Mapa de cuentas para poder decir a qué cuenta pertenece cada traspaso.
  const accountsMap = new Map((accounts ?? []).map((a) => [a.id, a]))

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
            const isTandaMovement = isTransfer && !!expense.tandaId
            const editableTransfer = isTransfer && expense.transferId && onSelectTransfer
            const owner = isTransfer ? accountsMap.get(expense.account) : null
            const handleClick = () => {
              if (isTandaMovement) return onSelectTandaMovement && onSelectTandaMovement(expense)
              if (isTransfer) return editableTransfer && onSelectTransfer(expense)
              return onSelect(expense)
            }
            return (
              <button
                key={expense.id}
                className="expense-item"
                onClick={handleClick}
              >
                {isTandaMovement ? (
                  <span className="expense-icon" style={{ background: '#7c3aed22', color: '#7c3aed' }}>
                    🤝
                  </span>
                ) : isTransfer ? (
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
                    {isTandaMovement
                      ? (expense.note || 'Tanda')
                      : isTransfer
                        ? (owner ? `${owner.icon} ${owner.name}` : expense.note || 'Traspaso')
                        : cat.name}
                    {!isTransfer && sub && <span className="expense-subcategory"> · {sub.name}</span>}
                    {!isTransfer && expense.billable && (
                      <span
                        className="expense-billable-badge"
                        title={expense.invoiceStatus === 'facturado' ? 'Facturado' : 'Por facturar'}
                      >
                        {expense.invoiceStatus === 'facturado' ? '✅' : '🧾'}
                      </span>
                    )}
                  </span>
                  {isTandaMovement ? (
                    <span className="expense-note">{expense.type === 'income' ? 'Cobro del pozo' : 'Aportación'}</span>
                  ) : isTransfer ? (
                    <span className="expense-note">{owner ? expense.note || 'Traspaso' : 'Traspaso'}</span>
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
