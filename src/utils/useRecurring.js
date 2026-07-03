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
import { currentMonthISO, dateOfMonth, nextMonth, todayISO } from './dates'

// Una plantilla recurrente describe un movimiento mensual fijo (renta,
// suscripciones…). Guarda `dayOfMonth`, el mes de inicio y `lastGenerated`
// para poder generar los movimientos pendientes sin duplicar.
export function useRecurring() {
  const { user } = useAuth()
  const [recurring, setRecurring] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setRecurring([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', user.uid, 'recurring')
    const q = query(ref, orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecurring(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addRecurring = ({ amount, type, category, subcategory, note, dayOfMonth, account }) => {
    const ref = collection(db, 'users', user.uid, 'recurring')
    return addDoc(ref, {
      amount,
      type: type || 'expense',
      category,
      subcategory: subcategory || null,
      note: note || '',
      dayOfMonth,
      account: account || null,
      active: true,
      startMonth: currentMonthISO(),
      lastGenerated: null,
      createdAt: serverTimestamp(),
    })
  }

  const updateRecurring = (id, data) => {
    return updateDoc(doc(db, 'users', user.uid, 'recurring', id), data)
  }

  const deleteRecurring = (id) => {
    return deleteDoc(doc(db, 'users', user.uid, 'recurring', id))
  }

  // Genera de inmediato los movimientos vencidos de una plantilla (p.ej. al
  // crearla si su día ya pasó este mes). Usa la cuenta asignada.
  const generateNow = (t) => generateOccurrences(user.uid, t)

  // Registra los movimientos vencidos de una plantilla con la cuenta que el
  // usuario confirmó (puede ser distinta de la asignada, o ninguna).
  const commitDue = (t, account) => generateOccurrences(user.uid, t, account)

  // Registra UN solo movimiento en una fecha específica y actualiza lastGenerated.
  const commitOne = async (t, account, date) => {
    if (t.active === false) return
    const acc = account !== undefined ? account || null : t.account || null
    const month = date.slice(0, 7)
    await addDoc(collection(db, 'users', user.uid, 'expenses'), {
      amount: t.amount,
      type: t.type || 'expense',
      category: t.category,
      subcategory: t.subcategory || null,
      note: t.note || '',
      date,
      account: acc,
      recurringId: t.id,
      createdAt: serverTimestamp(),
    })
    const last = t.lastGenerated
    if (!last || month >= last) {
      await updateDoc(doc(db, 'users', user.uid, 'recurring', t.id), {
        lastGenerated: month,
      })
    }
  }

  return { recurring, loading, addRecurring, updateRecurring, deleteRecurring, generateNow, commitDue, commitOne }
}

// Meses "vencidos" de una plantilla: desde su inicio (o el último generado)
// hasta el mes actual, pero solo si ya pasó el día del mes.
export function dueOccurrences(t, curMonth, today) {
  const occ = []
  let m = t.startMonth || curMonth
  while (m <= curMonth) {
    const alreadyDone = t.lastGenerated && m <= t.lastGenerated
    if (!alreadyDone) {
      const date = dateOfMonth(m, t.dayOfMonth || 1)
      if (date <= today) occ.push({ month: m, date })
    }
    if (m === curMonth) break
    m = nextMonth(m)
  }
  return occ
}

// Crea los movimientos vencidos de una plantilla y actualiza lastGenerated.
// Si se pasa `accountOverride` (incluso null), se usa esa cuenta; si no, la
// cuenta asignada a la plantilla.
async function generateOccurrences(uid, t, accountOverride) {
  if (t.active === false) return
  const occ = dueOccurrences(t, currentMonthISO(), todayISO())
  if (occ.length === 0) return

  const account = accountOverride !== undefined ? accountOverride || null : t.account || null
  const expRef = collection(db, 'users', uid, 'expenses')
  for (const { date } of occ) {
    await addDoc(expRef, {
      amount: t.amount,
      type: t.type || 'expense',
      category: t.category,
      subcategory: t.subcategory || null,
      note: t.note || '',
      date,
      account,
      recurringId: t.id,
      createdAt: serverTimestamp(),
    })
  }
  await updateDoc(doc(db, 'users', uid, 'recurring', t.id), {
    lastGenerated: occ[occ.length - 1].month,
  })
}
