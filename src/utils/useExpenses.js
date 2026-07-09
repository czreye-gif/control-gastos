import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export function useExpenses() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setExpenses([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', user.uid, 'expenses')
    const q = query(ref, orderBy('date', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Se ordena por fecha y, dentro del mismo día, por hora de registro
      // (`createdAt`). Firestore solo ordena por `date` (sin hora) y desempata
      // por id de documento, así que sin este paso los movimientos del mismo
      // día salían en desorden. Un movimiento recién agregado aún no tiene
      // `createdAt` del servidor (queda null): se trata como el más reciente
      // para que aparezca arriba de su día de inmediato.
      const docs = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          if (a.date !== b.date) return a.date < b.date ? 1 : -1
          return (b.createdAt?.seconds ?? Infinity) - (a.createdAt?.seconds ?? Infinity)
        })
      setExpenses(docs)
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addExpense = ({ amount, type, category, subcategory, note, date, account }) => {
    const ref = collection(db, 'users', user.uid, 'expenses')
    return addDoc(ref, {
      amount,
      type: type || 'expense',
      category,
      subcategory: subcategory || null,
      note: note || '',
      date,
      account: account || null,
      createdAt: serverTimestamp(),
    })
  }

  const updateExpense = (id, data) => {
    const ref = doc(db, 'users', user.uid, 'expenses', id)
    return updateDoc(ref, data)
  }

  const deleteExpense = (id) => {
    const ref = doc(db, 'users', user.uid, 'expenses', id)
    return deleteDoc(ref)
  }

  return { expenses, loading, addExpense, updateExpense, deleteExpense }
}
