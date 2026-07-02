import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { periodDate, todayISO } from './dates'

// Cálculos derivados de una tanda (centraliza la regla del turno propio):
//  - Si `paysOnOwnTurn` es false (estilo "de 11"), NO aportas el día de tu
//    turno, así que haces una aportación menos.
//  - El pozo que recibes = (aportaciones totales) × monto  → neto ≈ $0.
export function tandaDerived(t) {
  const N = t.totalCount
  const skip = t.paysOnOwnTurn === false ? t.myNumber - 1 : -1
  const periods = []
  for (let i = 0; i < N; i++) if (i !== skip) periods.push(i)

  const totalContributions = periods.length
  const paid = t.paidCount ?? 0
  const done = paid >= totalContributions
  const nextIndex = done ? null : periods[paid]
  const nextDate = nextIndex == null ? null : periodDate(t.startDate, nextIndex, t.frequency)
  const payoutIndex = t.myNumber - 1
  const payoutDate = periodDate(t.startDate, payoutIndex, t.frequency)
  const pot = t.amount * totalContributions
  const commitment = t.amount * totalContributions
  const contributed = t.amount * paid
  const myTurnReached = todayISO() >= payoutDate

  return {
    totalContributions,
    paid,
    done,
    nextIndex,
    nextDate,
    payoutIndex,
    payoutDate,
    pot,
    commitment,
    contributed,
    myTurnReached,
  }
}

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

  const addTanda = ({ name, amount, frequency, totalCount, myNumber, startDate, account, paysOnOwnTurn }) => {
    const ref = collection(db, 'users', user.uid, 'tandas')
    return addDoc(ref, {
      name,
      amount,
      frequency: frequency || 'semanal',
      totalCount,
      myNumber,
      startDate,
      account: account || null,
      paysOnOwnTurn: paysOnOwnTurn !== false,
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

  // Crea un movimiento de traspaso ligado a la cuenta (si hay), en la fecha dada.
  const addTransfer = ({ amount, type, note, account, tandaId, date }) => {
    const ref = collection(db, 'users', user.uid, 'expenses')
    return addDoc(ref, {
      amount,
      type,
      transfer: true,
      category: null,
      subcategory: null,
      note,
      date: date || todayISO(),
      account: account || null,
      tandaId,
      createdAt: serverTimestamp(),
    })
  }

  // Borra el traspaso más reciente de la tanda del tipo indicado.
  const deleteLatestTransfer = async (tandaId, type) => {
    const expCol = collection(db, 'users', user.uid, 'expenses')
    const snap = await getDocs(query(expCol, where('tandaId', '==', tandaId)))
    const matching = snap.docs
      .filter((d) => d.data().type === type)
      .sort((a, b) => (b.data().createdAt?.seconds ?? 0) - (a.data().createdAt?.seconds ?? 0))
    if (matching[0]) await deleteDoc(matching[0].ref)
  }

  const registerContribution = async (t, date) => {
    const { totalContributions, paid } = tandaDerived(t)
    if (paid >= totalContributions) return
    await addTransfer({
      amount: t.amount,
      type: 'expense',
      note: `Tanda: ${t.name}`,
      account: t.account,
      tandaId: t.id,
      date,
    })
    await updateTanda(t.id, { paidCount: paid + 1 })
  }

  const undoContribution = async (t) => {
    const paid = t.paidCount ?? 0
    if (paid <= 0) return
    await deleteLatestTransfer(t.id, 'expense')
    await updateTanda(t.id, { paidCount: paid - 1 })
  }

  const registerPayout = async (t, date) => {
    if (t.payoutReceived) return
    const { pot } = tandaDerived(t)
    await addTransfer({
      amount: pot,
      type: 'income',
      note: `Tanda ${t.name}: cobro`,
      account: t.account,
      tandaId: t.id,
      date,
    })
    await updateTanda(t.id, { payoutReceived: true })
  }

  const undoPayout = async (t) => {
    if (!t.payoutReceived) return
    await deleteLatestTransfer(t.id, 'income')
    await updateTanda(t.id, { payoutReceived: false })
  }

  return {
    tandas,
    loading,
    addTanda,
    updateTanda,
    deleteTanda,
    registerContribution,
    undoContribution,
    registerPayout,
    undoPayout,
  }
}
