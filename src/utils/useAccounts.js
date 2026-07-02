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
import { todayISO } from './dates'

// Una alcancía sorpresa es una cuenta con fecha de apertura: su saldo se
// mantiene oculto hasta ese día.
export function isPiggyLocked(account) {
  return !!(account.piggy && account.revealDate && todayISO() < account.revealDate)
}

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

  const addAccount = ({ name, icon, color, initialBalance, piggy, revealDate }) => {
    const ref = collection(db, 'users', user.uid, 'accounts')
    return addDoc(ref, {
      name,
      icon,
      color,
      initialBalance: initialBalance || 0,
      piggy: piggy || false,
      revealDate: revealDate || null,
      order: accounts.length,
      createdAt: serverTimestamp(),
    })
  }

  // Depositar en una alcancía crea un traspaso de entrada; si se indica una
  // cuenta origen, también el traspaso de salida correspondiente.
  const deposit = async ({ piggy, amount, source }) => {
    const expRef = collection(db, 'users', user.uid, 'expenses')
    await addDoc(expRef, {
      amount,
      type: 'income',
      transfer: true,
      category: null,
      subcategory: null,
      note: `Depósito: ${piggy.name}`,
      date: todayISO(),
      account: piggy.id,
      createdAt: serverTimestamp(),
    })
    if (source) {
      await addDoc(expRef, {
        amount,
        type: 'expense',
        transfer: true,
        category: null,
        subcategory: null,
        note: `A ${piggy.name}`,
        date: todayISO(),
        account: source,
        createdAt: serverTimestamp(),
      })
    }
  }

  const updateAccount = (id, data) => {
    return updateDoc(doc(db, 'users', user.uid, 'accounts', id), data)
  }

  const deleteAccount = (id) => {
    return deleteDoc(doc(db, 'users', user.uid, 'accounts', id))
  }

  return { accounts, loading, addAccount, updateAccount, deleteAccount, deposit }
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
