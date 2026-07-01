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

// Una cuenta es un origen/destino de dinero (efectivo, tarjeta, banco…).
// Su saldo actual se calcula: saldo inicial + ingresos − gastos asignados.
export function useAccounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setAccounts([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', user.uid, 'accounts')
    const q = query(ref, orderBy('order'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAccounts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addAccount = ({ name, icon, color, initialBalance }) => {
    const ref = collection(db, 'users', user.uid, 'accounts')
    return addDoc(ref, {
      name,
      icon,
      color,
      initialBalance: initialBalance || 0,
      order: accounts.length,
      createdAt: serverTimestamp(),
    })
  }

  const updateAccount = (id, data) => {
    return updateDoc(doc(db, 'users', user.uid, 'accounts', id), data)
  }

  const deleteAccount = (id) => {
    return deleteDoc(doc(db, 'users', user.uid, 'accounts', id))
  }

  return { accounts, loading, addAccount, updateAccount, deleteAccount }
}

// Saldo actual por cuenta a partir de todos los movimientos.
export function computeBalances(accounts, expenses) {
  const delta = new Map()
  for (const e of expenses) {
    if (!e.account) continue
    const sign = (e.type ?? 'expense') === 'income' ? 1 : -1
    delta.set(e.account, (delta.get(e.account) ?? 0) + sign * e.amount)
  }
  return accounts.map((a) => ({
    ...a,
    balance: (a.initialBalance || 0) + (delta.get(a.id) ?? 0),
  }))
}
