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
  writeBatch,
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
      // Orden dentro de cada día:
      //  1. Si el usuario reacomodó el día a mano, manda su `order` (ascendente:
      //     0 = arriba). Un movimiento nuevo aún sin `order` se trata como el
      //     más reciente (-Infinity) para que entre arriba de su día.
      //  2. Como respaldo (día sin reacomodar), la hora de registro
      //     (`createdAt`) desc, ya que Firestore solo ordena por `date` (sin
      //     hora) y desempata por id de documento.
      const docs = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          if (a.date !== b.date) return a.date < b.date ? 1 : -1
          const oa = a.order ?? -Infinity
          const ob = b.order ?? -Infinity
          if (oa !== ob) return oa - ob
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

  // Guarda el orden manual de los movimientos de un día. Recibe los items en el
  // orden visual deseado (arriba → abajo) y les asigna `order` 0..n-1. Solo
  // escribe los que cambiaron, en un lote.
  const reorderDay = async (dayItems) => {
    const batch = writeBatch(db)
    let changed = 0
    dayItems.forEach((it, i) => {
      if (it.order !== i) {
        batch.update(doc(db, 'users', user.uid, 'expenses', it.id), { order: i })
        changed++
      }
    })
    if (changed > 0) await batch.commit()
  }

  return { expenses, loading, addExpense, updateExpense, deleteExpense, reorderDay }
}
