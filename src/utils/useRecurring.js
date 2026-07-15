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
import { addDaysISO, currentMonthISO, dateOfMonth, nextMonth, todayISO } from './dates'

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

  const addRecurring = ({
    amount,
    type,
    category,
    subcategory,
    note,
    dayOfMonth,
    account,
    frequency,
    intervalDays,
    anchorDate,
  }) => {
    const ref = collection(db, 'users', user.uid, 'recurring')
    return addDoc(ref, {
      amount,
      type: type || 'expense',
      category,
      subcategory: subcategory || null,
      note: note || '',
      account: account || null,
      active: true,
      // 'mensual' = día fijo del mes (dayOfMonth); 'dias' = cada N días desde
      // anchorDate (periodo personalizado).
      frequency: frequency || 'mensual',
      dayOfMonth: dayOfMonth ?? null,
      intervalDays: intervalDays ?? null,
      anchorDate: anchorDate ?? null,
      startMonth: currentMonthISO(),
      lastGenerated: null,
      lastGeneratedDate: null,
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

  // Registra UN solo movimiento en una fecha específica y avanza el cursor. En
  // modo 'dias' el cursor es una fecha (lastGeneratedDate) que salta a la última
  // ocurrencia vencida; en 'mensual' es un mes (lastGenerated).
  const commitOne = async (t, account, date) => {
    if (t.active === false) return
    const acc = account !== undefined ? account || null : t.account || null
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
    if ((t.frequency ?? 'mensual') === 'dias') {
      const occ = dueOccurrences(t, currentMonthISO(), todayISO())
      const through = occ.length ? occ[occ.length - 1].date : date
      const prev = t.lastGeneratedDate
      if (!prev || through >= prev) {
        await updateDoc(doc(db, 'users', user.uid, 'recurring', t.id), { lastGeneratedDate: through })
      }
    } else {
      const month = date.slice(0, 7)
      const last = t.lastGenerated
      if (!last || month >= last) {
        await updateDoc(doc(db, 'users', user.uid, 'recurring', t.id), { lastGenerated: month })
      }
    }
  }

  return { recurring, loading, addRecurring, updateRecurring, deleteRecurring, generateNow, commitDue, commitOne }
}

// Ocurrencias "vencidas" de una plantilla (aún sin registrar y con fecha ≤ hoy).
//  - 'dias': avanza desde anchorDate en pasos de intervalDays.
//  - 'mensual': recorre mes por mes desde su inicio con el día fijo.
export function dueOccurrences(t, curMonth, today) {
  if ((t.frequency ?? 'mensual') === 'dias') {
    const occ = []
    const step = Math.max(1, Number(t.intervalDays) || 1)
    const anchor = t.anchorDate || today
    const last = t.lastGeneratedDate
    let d = anchor
    let guard = 0
    while (d <= today && guard < 2000) {
      if (!last || d > last) occ.push({ month: d.slice(0, 7), date: d })
      d = addDaysISO(d, step)
      guard++
    }
    return occ
  }

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
  const cursor =
    (t.frequency ?? 'mensual') === 'dias'
      ? { lastGeneratedDate: occ[occ.length - 1].date }
      : { lastGenerated: occ[occ.length - 1].month }
  await updateDoc(doc(db, 'users', uid, 'recurring', t.id), cursor)
}
