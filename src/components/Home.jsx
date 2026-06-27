import { useMemo, useState } from 'react'
import ExpenseList, { formatMoney } from './ExpenseList'
import AddExpense from './AddExpense'
import { useExpenses } from '../utils/useExpenses'
import { todayISO } from '../utils/dates'

export default function Home() {
  const { expenses, loading, addExpense, updateExpense, deleteExpense } = useExpenses()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)

  const todayTotal = useMemo(() => {
    const today = todayISO()
    return expenses.filter((e) => e.date === today).reduce((acc, e) => acc + e.amount, 0)
  }, [expenses])

  const handleSave = async (data) => {
    if (editing) {
      await updateExpense(editing.id, data)
    } else {
      await addExpense(data)
    }
    setShowAdd(false)
    setEditing(null)
  }

  const handleDelete = async (id) => {
    await deleteExpense(id)
    setShowAdd(false)
    setEditing(null)
  }

  return (
    <div className="page">
      <header className="home-header">
        <p>Gastado hoy</p>
        <h1>{formatMoney(todayTotal)}</h1>
      </header>

      {loading ? (
        <p className="loading-text">Cargando...</p>
      ) : (
        <ExpenseList
          expenses={expenses}
          onSelect={(expense) => {
            setEditing(expense)
            setShowAdd(true)
          }}
        />
      )}

      <button
        className="fab"
        onClick={() => {
          setEditing(null)
          setShowAdd(true)
        }}
        aria-label="Agregar gasto"
      >
        +
      </button>

      {showAdd && (
        <AddExpense
          initial={editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => {
            setShowAdd(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
