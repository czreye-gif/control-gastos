import { useEffect, useRef, useState } from 'react'
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

  const addRecurring = ({ amount, type, category, subcategory, note, dayOfMonth }) => {
    const ref = collection(db, 'users', user.uid, 'recurring')
    return addDoc(ref, {
      amount,
      type: type || 'expense',
      category,
      subcategory: subcategory || null,
      note: note || '',
      dayOfMonth,
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

  return { recurring, loading, addRecurring, updateRecurring, deleteRecurring }
}

// Meses "vencidos" de una plantilla: desde su inicio (o el último generado)
// hasta el mes actual, pero solo si ya pasó el día del mes.
function dueOccurrences(t, curMonth, today) {
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

// Genera los movimientos recurrentes pendientes una vez por sesión/usuario.
// Se lee de una sola vez (getDocs) para no re-disparar con cada cambio.
export function useRecurringGenerator() {
  const { user } = useAuth()
  const lastUidRef = useRef(null)

  useEffect(() => {
    if (!user) return
    if (lastUidRef.current === user.uid) return
    lastUidRef.current = user.uid

    const run = async () => {
      const recRef = collection(db, 'users', user.uid, 'recurring')
      const snap = await getDocs(recRef)
      const today = todayISO()
      const curMonth = currentMonthISO()

      for (const d of snap.docs) {
        const t = d.data()
        if (t.active === false) continue
        const occ = dueOccurrences(t, curMonth, today)
        if (occ.length === 0) continue

        const expRef = collection(db, 'users', user.uid, 'expenses')
        for (const { date } of occ) {
          await addDoc(expRef, {
            amount: t.amount,
            type: t.type || 'expense',
            category: t.category,
            subcategory: t.subcategory || null,
            note: t.note || '',
            date,
            recurringId: d.id,
            createdAt: serverTimestamp(),
          })
        }
        await updateDoc(d.ref, { lastGenerated: occ[occ.length - 1].month })
      }
    }

    run().catch((err) => console.error('Error generando recurrentes:', err))
  }, [user])
}
