import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

// Un presupuesto es un límite mensual por categoría. Usamos el id de la
// categoría como id del documento para que definir/actualizar sea un upsert
// directo y no puedan quedar duplicados por categoría.
export function useBudgets() {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setBudgets([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', user.uid, 'budgets')
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      setBudgets(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const setBudget = (categoryId, amount) => {
    return setDoc(doc(db, 'users', user.uid, 'budgets', categoryId), {
      category: categoryId,
      amount,
    })
  }

  const deleteBudget = (categoryId) => {
    return deleteDoc(doc(db, 'users', user.uid, 'budgets', categoryId))
  }

  return { budgets, loading, setBudget, deleteBudget }
}
