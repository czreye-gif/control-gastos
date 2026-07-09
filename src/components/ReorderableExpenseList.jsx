import { useEffect, useRef, useState } from 'react'
import { useCategories } from '../contexts/CategoriesContext'
import { formatMoney } from './ExpenseList'
import { formatDayLabel } from '../utils/dates'

function groupByDay(items) {
  const map = new Map()
  for (const e of items) {
    if (!map.has(e.date)) map.set(e.date, [])
    map.get(e.date).push(e)
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
}

// Mueve el item `dragId` a la posición del item `overId` (solo si son del
// mismo día). Reordena localmente para el arrastre en vivo.
function moveWithinDay(list, dragId, overId) {
  const from = list.findIndex((e) => e.id === dragId)
  const to = list.findIndex((e) => e.id === overId)
  if (from < 0 || to < 0 || list[from].date !== list[to].date) return list
  const next = list.slice()
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}

// Lista de movimientos con agarre ≡ para reordenar dentro del mismo día
// mediante arrastre por punteros (funciona con dedo en móvil). Al soltar,
// avisa al padre con los items del día en su nuevo orden para persistirlo.
export default function ReorderableExpenseList({ expenses, onReorderDay }) {
  const { getCategory, getSubcategory } = useCategories()
  const [list, setList] = useState(expenses)
  const dragId = useRef(null)
  const dragDay = useRef(null)
  const [, force] = useState(0)

  // Re-sincroniza con los datos externos, salvo mientras se arrastra.
  useEffect(() => {
    if (!dragId.current) setList(expenses)
  }, [expenses])

  const handleDown = (e, item) => {
    dragId.current = item.id
    dragDay.current = item.date
    force((n) => n + 1)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* algunos navegadores lanzan si el puntero ya se soltó */
    }
  }

  const handleMove = (e) => {
    if (!dragId.current) return
    e.preventDefault()
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const target = el && el.closest('[data-move-id]')
    if (!target) return
    const overId = target.getAttribute('data-move-id')
    const overDay = target.getAttribute('data-move-day')
    if (overDay !== dragDay.current || overId === dragId.current) return
    setList((prev) => moveWithinDay(prev, dragId.current, overId))
  }

  const handleUp = () => {
    if (!dragId.current) return
    const day = dragDay.current
    const dayItems = list.filter((e) => e.date === day)
    dragId.current = null
    dragDay.current = null
    force((n) => n + 1)
    onReorderDay(dayItems)
  }

  const groups = groupByDay(list)

  return (
    <div className="expense-list">
      {groups.map(([day, items]) => (
        <div key={day} className="day-group">
          <div className="day-header">
            <span>{formatDayLabel(day)}</span>
          </div>
          {items.map((expense) => {
            const cat = getCategory(expense.category)
            const sub = getSubcategory(expense.category, expense.subcategory)
            const isIncome = expense.type === 'income'
            const isTransfer = expense.transfer
            return (
              <div
                key={expense.id}
                data-move-id={expense.id}
                data-move-day={day}
                className={`expense-item reorder-item ${dragId.current === expense.id ? 'dragging' : ''}`}
              >
                <span
                  className="reorder-handle"
                  onPointerDown={(e) => handleDown(e, expense)}
                  onPointerMove={handleMove}
                  onPointerUp={handleUp}
                  onPointerCancel={handleUp}
                  aria-label="Arrastrar para reordenar"
                >
                  ≡
                </span>
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
                  {!isTransfer && expense.note && <span className="expense-note">{expense.note}</span>}
                </span>
                <span className={`expense-amount ${isIncome ? 'income' : ''}`}>
                  {isIncome ? '+' : '-'}
                  {formatMoney(expense.amount)}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
