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

// Cálculos derivados de un préstamo a partir de sus movimientos.
//  - `paid`: suma de los abonos registrados.
//  - `remaining`: capital que falta por cobrar/pagar.
//  - `settled`: true cuando ya se liquidó.
export function loanDerived(loan, movements = []) {
  const payments = movements.filter((m) => m.loanKind === 'payment')
  const paid = payments.reduce((a, m) => a + m.amount, 0)
  const remaining = Math.max(0, (loan.amount || 0) - paid)
  const settled = remaining <= 0.005
  const progress = loan.amount > 0 ? Math.min(1, paid / loan.amount) : 0
  return { paid, remaining, settled, progress, paymentsCount: payments.length }
}

// Un préstamo lleva el control del dinero que prestas ('lent' = me deben) o que
// te prestan ('borrowed' = yo debo). El capital y cada abono se registran como
// traspasos (marca `loanId`, `loanKind`), es decir, mueven dinero de tus
// cuentas pero NO cuentan como gasto/ingreso.
export function useLoans() {
  const { user } = useAuth()
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoans([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', user.uid, 'loans')
    const q = query(ref, orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLoans(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  // Tipo y nota del movimiento según dirección y si es capital o abono:
  //  lent principal   → sale de mi cuenta (expense) · "Préstamo a X"
  //  lent payment      → entra a mi cuenta (income)  · "Abono de X"
  //  borrowed principal → entra a mi cuenta (income)  · "Préstamo de X"
  //  borrowed payment   → sale de mi cuenta (expense) · "Pago a X"
  const movementType = (direction, kind) => {
    const isLent = direction === 'lent'
    return kind === 'principal' ? (isLent ? 'expense' : 'income') : isLent ? 'income' : 'expense'
  }
  const movementNote = (direction, kind, name) => {
    const isLent = direction === 'lent'
    if (kind === 'principal') return isLent ? `Préstamo a ${name}` : `Préstamo de ${name}`
    return isLent ? `Abono de ${name}` : `Pago a ${name}`
  }

  const addLoanMovement = ({ loanId, direction, kind, amount, account, date, name }) => {
    return addDoc(collection(db, 'users', user.uid, 'expenses'), {
      amount,
      type: movementType(direction, kind),
      transfer: true,
      category: null,
      subcategory: null,
      note: movementNote(direction, kind, name),
      date: date || todayISO(),
      account: account || null,
      loanId,
      loanKind: kind,
      createdAt: serverTimestamp(),
    })
  }

  const addLoan = async ({ name, direction, amount, date, account, dueDate, note }) => {
    const ref = await addDoc(collection(db, 'users', user.uid, 'loans'), {
      name,
      direction,
      amount,
      date: date || todayISO(),
      account: account || null,
      dueDate: dueDate || null,
      note: note || '',
      createdAt: serverTimestamp(),
    })
    await addLoanMovement({ loanId: ref.id, direction, kind: 'principal', amount, account, date, name })
    return ref
  }

  // Actualiza el préstamo y mantiene en sincronía su movimiento de capital
  // (monto, fecha, cuenta y nota), para no romper el cuadre de la cuenta.
  const updateLoan = async (loan, data) => {
    await updateDoc(doc(db, 'users', user.uid, 'loans', loan.id), data)
    const snap = await getDocs(
      query(collection(db, 'users', user.uid, 'expenses'), where('loanId', '==', loan.id))
    )
    const principal = snap.docs.find((d) => d.data().loanKind === 'principal')
    if (principal) {
      const m = { ...loan, ...data }
      await updateDoc(principal.ref, {
        amount: m.amount,
        account: m.account || null,
        date: m.date,
        type: movementType(m.direction, 'principal'),
        note: movementNote(m.direction, 'principal', m.name),
      })
    }
  }

  // Elimina el préstamo y todos sus movimientos (capital y abonos).
  const deleteLoan = async (id) => {
    const snap = await getDocs(
      query(collection(db, 'users', user.uid, 'expenses'), where('loanId', '==', id))
    )
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'users', user.uid, 'loans', id))
  }

  const registerPayment = (loan, { amount, date, account }) =>
    addLoanMovement({
      loanId: loan.id,
      direction: loan.direction,
      kind: 'payment',
      amount,
      account,
      date,
      name: loan.name,
    })

  const updatePayment = (movementId, { amount, date, account }) =>
    updateDoc(doc(db, 'users', user.uid, 'expenses', movementId), {
      amount,
      date,
      account: account || null,
    })

  const deletePayment = (movementId) => deleteDoc(doc(db, 'users', user.uid, 'expenses', movementId))

  return {
    loans,
    loading,
    addLoan,
    updateLoan,
    deleteLoan,
    registerPayment,
    updatePayment,
    deletePayment,
  }
}
