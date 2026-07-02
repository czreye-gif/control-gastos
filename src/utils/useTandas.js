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

// Una tanda es un ahorro rotatorio: aportas un monto fijo cada periodo y
// cobras el pozo una vez, en tu número. Cada aportación (y el cobro) se
// registra como un traspaso: mueve dinero de tu cuenta pero NO cuenta como
// gasto/ingreso (lleva la marca `transfer: true`).
export function useTandas() {
  const { user } = useAuth()
  const [tandas, setTandas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setTandas([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', user.uid, 'tandas')
    const q = query(ref, orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTandas(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addTanda = ({ name, amount, frequency, totalCount, myNumber, startDate, account }) => {
    const ref = collection(db, 'users', user.uid, 'tandas')
    return addDoc(ref, {
      name,
      amount,
      frequency: frequency || 'semanal',
      totalCount,
      myNumber,
      startDate,
      account: account || null,
      paidCount: 0,
      payoutReceived: false,
      createdAt: serverTimestamp(),
    })
  }

  const updateTanda = (id, data) => {
    return updateDoc(doc(db, 'users', user.uid, 'tandas', id), data)
  }

  const deleteTanda = (id) => {
    return deleteDoc(doc(db, 'users', user.uid, 'tandas', id))
  }

  // Crea un movimiento de traspaso ligado a la cuenta (si hay).
  const addTransfer = ({ amount, type, note, account, tandaId }) => {
    const ref = collection(db, 'users', user.uid, 'expenses')
    return addDoc(ref, {
      amount,
      type,
      transfer: true,
      category: null,
      subcategory: null,
      note,
      date: todayISO(),
      account: account || null,
      tandaId,
      createdAt: serverTimestamp(),
    })
  }

  const registerContribution = async (t) => {
    if ((t.paidCount ?? 0) >= t.totalCount) return
    await addTransfer({
      amount: t.amount,
      type: 'expense',
      note: `Tanda: ${t.name}`,
      account: t.account,
      tandaId: t.id,
    })
    await updateTanda(t.id, { paidCount: (t.paidCount ?? 0) + 1 })
  }

  const registerPayout = async (t) => {
    if (t.payoutReceived) return
    await addTransfer({
      amount: t.amount * t.totalCount,
      type: 'income',
      note: `Tanda ${t.name}: cobro`,
      account: t.account,
      tandaId: t.id,
    })
    await updateTanda(t.id, { payoutReceived: true })
  }

  return {
    tandas,
    loading,
    addTanda,
    updateTanda,
    deleteTanda,
    registerContribution,
    registerPayout,
  }
}
