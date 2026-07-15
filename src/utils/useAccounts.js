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
  // cuenta origen, también el traspaso de salida correspondiente. Ambas partes
  // comparten un `depositId` para poder editarlas o eliminarlas juntas después.
  const deposit = async ({ piggy, amount, source }) => {
    const expRef = collection(db, 'users', user.uid, 'expenses')
    const depositId = crypto.randomUUID()
    await addDoc(expRef, {
      amount,
      type: 'income',
      transfer: true,
      category: null,
      subcategory: null,
      note: `Depósito: ${piggy.name}`,
      date: todayISO(),
      account: piggy.id,
      depositId,
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
        depositId,
        createdAt: serverTimestamp(),
      })
    }
  }

  // Corrige un depósito ya registrado (monto, fecha y cuenta de origen).
  //  - La parte de entrada (income, en la alcancía) siempre se actualiza.
  //  - La parte de salida (expense, en la cuenta origen) se actualiza a la
  //    cuenta elegida; si el depósito viejo no tenía salida, se crea.
  //  - Los depósitos viejos sin `depositId` se "reparan": se les asigna uno y
  //    se les crea su parte de salida para dejarlos cuadrados.
  const updateDeposit = async ({ id, depositId, amount, date, source, piggyName }) => {
    const expCol = collection(db, 'users', user.uid, 'expenses')
    const dateData = date ? { date } : {}
    const makeExpenseLeg = (dep, when) => ({
      amount,
      type: 'expense',
      transfer: true,
      category: null,
      subcategory: null,
      note: `A ${piggyName ?? 'alcancía'}`,
      date: when || todayISO(),
      account: source,
      depositId: dep,
      createdAt: serverTimestamp(),
    })

    if (depositId) {
      const snap = await getDocs(query(expCol, where('depositId', '==', depositId)))
      const incomeLeg = snap.docs.find((d) => (d.data().type ?? 'expense') === 'income')
      const expenseLeg = snap.docs.find((d) => (d.data().type ?? 'expense') === 'expense')
      if (incomeLeg) await updateDoc(incomeLeg.ref, { amount, ...dateData })
      const when = date || incomeLeg?.data().date
      if (source) {
        if (expenseLeg) await updateDoc(expenseLeg.ref, { amount, account: source, ...dateData })
        else await addDoc(expCol, makeExpenseLeg(depositId, when))
      } else if (expenseLeg) {
        await deleteDoc(expenseLeg.ref)
      }
    } else {
      const newId = crypto.randomUUID()
      const ref = doc(db, 'users', user.uid, 'expenses', id)
      await updateDoc(ref, { amount, ...dateData, depositId: newId })
      if (source) await addDoc(expCol, makeExpenseLeg(newId, date))
    }
  }

  // Elimina un depósito completo (sus dos partes si están ligadas).
  const deleteDeposit = async ({ id, depositId }) => {
    const expCol = collection(db, 'users', user.uid, 'expenses')
    if (depositId) {
      const snap = await getDocs(query(expCol, where('depositId', '==', depositId)))
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
    } else {
      await deleteDoc(doc(db, 'users', user.uid, 'expenses', id))
    }
  }

  // Nota de cada parte del traspaso. La nota "cruda" del usuario se guarda
  // aparte en `transferNote` para poder reconstruirla al editar sin tener que
  // parsear el texto visible.
  const legNote = (dir, otherName, note) => {
    const extra = note?.trim() ? ` · ${note.trim()}` : ''
    return dir === 'out'
      ? `Traspaso a ${otherName ?? 'otra cuenta'}${extra}`
      : `Traspaso de ${otherName ?? 'otra cuenta'}${extra}`
  }

  // Traspaso entre dos cuentas: sale dinero de una y entra en la otra. Se
  // registra como un par de movimientos marcados `transfer: true` (no cuentan
  // como gasto/ingreso) y ligados por un mismo `transferId` para poder
  // editar o eliminar el par completo después.
  const transfer = async ({ from, to, amount, date, note }) => {
    if (!from || !to || from === to || !(amount > 0)) return
    const expRef = collection(db, 'users', user.uid, 'expenses')
    const when = date || todayISO()
    const fromAcc = accounts.find((a) => a.id === from)
    const toAcc = accounts.find((a) => a.id === to)
    const cleanNote = note?.trim() || ''
    const transferId = crypto.randomUUID()
    await addDoc(expRef, {
      amount,
      type: 'expense',
      transfer: true,
      category: null,
      subcategory: null,
      note: legNote('out', toAcc?.name, cleanNote),
      transferNote: cleanNote,
      date: when,
      account: from,
      transferId,
      createdAt: serverTimestamp(),
    })
    await addDoc(expRef, {
      amount,
      type: 'income',
      transfer: true,
      category: null,
      subcategory: null,
      note: legNote('in', fromAcc?.name, cleanNote),
      transferNote: cleanNote,
      date: when,
      account: to,
      transferId,
      createdAt: serverTimestamp(),
    })
  }

  // Edita las dos partes de un traspaso ya existente (monto, cuentas, fecha,
  // nota). Busca los movimientos por `transferId` y actualiza la salida y la
  // entrada de forma consistente.
  const updateTransfer = async (transferId, { from, to, amount, date, note }) => {
    if (!transferId || !from || !to || from === to || !(amount > 0)) return
    const expCol = collection(db, 'users', user.uid, 'expenses')
    const snap = await getDocs(query(expCol, where('transferId', '==', transferId)))
    const when = date || todayISO()
    const fromAcc = accounts.find((a) => a.id === from)
    const toAcc = accounts.find((a) => a.id === to)
    const cleanNote = note?.trim() || ''
    await Promise.all(
      snap.docs.map((d) => {
        const isOut = (d.data().type ?? 'expense') === 'expense'
        return updateDoc(d.ref, {
          amount,
          account: isOut ? from : to,
          date: when,
          note: legNote(isOut ? 'out' : 'in', isOut ? toAcc?.name : fromAcc?.name, cleanNote),
          transferNote: cleanNote,
        })
      }),
    )
  }

  // Elimina un traspaso completo (sus dos movimientos).
  const deleteTransfer = async (transferId) => {
    if (!transferId) return
    const expCol = collection(db, 'users', user.uid, 'expenses')
    const snap = await getDocs(query(expCol, where('transferId', '==', transferId)))
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
  }

  const updateAccount = (id, data) => {
    return updateDoc(doc(db, 'users', user.uid, 'accounts', id), data)
  }

  const deleteAccount = (id) => {
    return deleteDoc(doc(db, 'users', user.uid, 'accounts', id))
  }

  return {
    accounts,
    loading,
    addAccount,
    updateAccount,
    deleteAccount,
    deposit,
    updateDeposit,
    deleteDeposit,
    transfer,
    updateTransfer,
    deleteTransfer,
  }
}

// Reconstruye los traspasos entre cuentas a partir de sus dos movimientos
// ligados por `transferId`: la salida (expense) da la cuenta origen y la
// entrada (income) la cuenta destino. Devuelve la lista ordenada por fecha
// descendente. Solo incluye traspasos completos (con sus dos partes).
export function computeTransfers(expenses) {
  const groups = new Map()
  for (const e of expenses) {
    if (!e.transferId) continue
    let g = groups.get(e.transferId)
    if (!g) {
      g = { transferId: e.transferId, amount: e.amount, date: e.date, note: e.transferNote ?? '' }
      groups.set(e.transferId, g)
    }
    if ((e.type ?? 'expense') === 'expense') g.from = e.account
    else g.to = e.account
    if (e.transferNote) g.note = e.transferNote
  }
  return [...groups.values()]
    .filter((g) => g.from && g.to)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
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
