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

// Tipos de movimiento del libro diario de un proyecto. El usuario opera el
// proyecto (gestoría) con capital del socio, así que casi todo el dinero que
// pasa por sus cuentas NO es suyo: se registra como traspaso. Lo único que es
// ingreso real propio es el honorario (y el margen al comprar).
//
//  funding       — el socio entrega capital           → entra a mi cuenta (traspaso)
//  expense       — gasto del proyecto                 → sale de mi cuenta (traspaso)
//                  `paidFrom`: 'fund' (dinero del socio) | 'own' (lo adelanté yo)
//                  `charged` (opcional): lo que le cobré al socio; el excedente
//                  sobre el costo real es mi margen.
//  fee           — mi honorario por la gestión        → INGRESO REAL mío
//  reimbursement — me devuelven lo que adelanté       → traspaso
//  refund        — devuelvo el sobrante al socio      → traspaso
export const PROJECT_KINDS = ['funding', 'expense', 'fee', 'reimbursement', 'refund']

export const KIND_LABEL = {
  funding: 'Entrega de capital',
  expense: 'Gasto',
  fee: 'Mi honorario',
  reimbursement: 'Reembolso recibido',
  refund: 'Devolución al socio',
}

// Cuentas del proyecto a partir de sus movimientos.
export function projectDerived(movements = []) {
  let received = 0 // capital entregado por el socio
  let spentFund = 0 // costo real pagado con el fondo
  let chargedFund = 0 // lo cobrado al socio por esos gastos
  let advanced = 0 // costo real que adelanté de mi bolsa
  let chargedAdvanced = 0 // lo cobrado al socio por lo que adelanté
  let feesFromFund = 0 // honorarios que tomé del fondo
  let feesPaidApart = 0 // honorarios que me pagaron aparte
  let reimbursedFromFund = 0
  let reimbursedPaid = 0
  let refunded = 0

  for (const m of movements) {
    const amt = m.amount || 0
    const charged = m.charged != null ? m.charged : amt
    switch (m.projectKind) {
      case 'funding':
        received += amt
        break
      case 'expense':
        if (m.paidFrom === 'own') {
          advanced += amt
          chargedAdvanced += charged
        } else {
          spentFund += amt
          chargedFund += charged
        }
        break
      case 'fee':
        if (m.account) feesPaidApart += amt
        else feesFromFund += amt
        break
      case 'reimbursement':
        if (m.account) reimbursedPaid += amt
        else reimbursedFromFund += amt
        break
      case 'refund':
        refunded += amt
        break
      default:
        break
    }
  }

  const fees = feesFromFund + feesPaidApart
  const reimbursed = reimbursedFromFund + reimbursedPaid
  const totalCost = spentFund + advanced
  const totalCharged = chargedFund + chargedAdvanced
  const margin = totalCharged - totalCost

  // Lo que queda del dinero del socio en mis manos.
  const cash = received - chargedFund - feesFromFund - reimbursedFromFund - refunded
  // Lo que adelanté de mi bolsa y aún no me reembolsan.
  const owedToMe = chargedAdvanced - reimbursed
  // Mi ganancia por operar el proyecto.
  const profit = fees + margin

  return {
    received,
    spentFund,
    chargedFund, // lo cobrado al socio por los gastos pagados del fondo
    advanced,
    chargedAdvanced, // lo cobrado al socio por lo que adelanté
    reimbursed,
    refunded,
    fees,
    totalCost,
    totalCharged,
    margin,
    cash,
    owedToMe,
    profit,
  }
}

export function useProjects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setProjects([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', user.uid, 'projects')
    const q = query(ref, orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addProject = ({ name, partner, note }) => {
    return addDoc(collection(db, 'users', user.uid, 'projects'), {
      name,
      partner: partner || '',
      note: note || '',
      status: 'active',
      startDate: todayISO(),
      createdAt: serverTimestamp(),
    })
  }

  const updateProject = (id, data) =>
    updateDoc(doc(db, 'users', user.uid, 'projects', id), data)

  // Elimina el proyecto y todos los movimientos de su libro diario.
  const deleteProject = async (id) => {
    const snap = await getDocs(
      query(collection(db, 'users', user.uid, 'expenses'), where('projectId', '==', id))
    )
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'users', user.uid, 'projects', id))
  }

  // Dirección del dinero según el tipo de movimiento.
  const movementType = (kind) =>
    kind === 'funding' || kind === 'fee' || kind === 'reimbursement' ? 'income' : 'expense'

  const defaultNote = (project, kind, concept) => {
    if (concept?.trim()) return `${project.name}: ${concept.trim()}`
    return `${project.name}: ${KIND_LABEL[kind] ?? 'movimiento'}`
  }

  const addMovement = (project, { kind, amount, charged, concept, date, account, paidFrom, category }) => {
    return addDoc(collection(db, 'users', user.uid, 'expenses'), {
      amount,
      type: movementType(kind),
      // El honorario es lo único que sí es ingreso propio; todo lo demás es
      // dinero del socio que solo pasa por mis cuentas.
      transfer: kind !== 'fee',
      category: kind === 'fee' ? category || null : null,
      subcategory: null,
      note: defaultNote(project, kind, concept),
      concept: concept?.trim() || '',
      date: date || todayISO(),
      account: account || null,
      projectId: project.id,
      projectKind: kind,
      paidFrom: kind === 'expense' ? paidFrom || 'fund' : null,
      charged: kind === 'expense' && charged != null ? charged : null,
      createdAt: serverTimestamp(),
    })
  }

  const updateMovement = (movementId, data) =>
    updateDoc(doc(db, 'users', user.uid, 'expenses', movementId), data)

  const deleteMovement = (movementId) =>
    deleteDoc(doc(db, 'users', user.uid, 'expenses', movementId))

  return {
    projects,
    loading,
    addProject,
    updateProject,
    deleteProject,
    addMovement,
    updateMovement,
    deleteMovement,
  }
}
