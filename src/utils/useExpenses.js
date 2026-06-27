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
      setExpenses(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addExpense = ({ amount, category, note, date }) => {
    const ref = collection(db, 'users', user.uid, 'expenses')
    return addDoc(ref, {
      amount,
      category,
      note: note || '',
      date,
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
