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
import { ME_ID, computeSplit } from './useSplit'

export { ME_ID }

// Dos formas de trabajar un proyecto:
//  'gestoria'   — tú operas con capital del socio. El costo corre por su
//                 cuenta (100%) y tú ganas honorarios y margen.
//  'asociacion' — los socios comparten el costo según su participación.
export const PROJECT_MODES = {
  gestoria: {
    label: '🛠️ Gestoría de operación',
    hint: 'Tú operas con capital del socio. El costo corre por su cuenta; tú ganas honorarios y margen.',
  },
  asociacion: {
    label: '🤝 Proyecto en asociación',
    hint: 'Los socios comparten el costo según su participación. Al final se calcula quién le debe a quién.',
  },
}

export const KIND_LABEL = {
  expense: 'Gasto',
  fee: 'Honorario',
  settlement: 'Pago directo',
}

// Resumen de un proyecto a partir de sus movimientos.
export function projectSummary(project, movements) {
  const split = computeSplit({
    participants: project.participants ?? [],
    movements,
  })
  const me = split.balances.find((b) => b.id === ME_ID)
  return {
    ...split,
    // En gestoría, el saldo a favor del usuario es justo lo que le deben
    // reembolsar (su participación es 0%).
    owedToMe: Math.max(0, me?.balance ?? 0),
    myBalance: me?.balance ?? 0,
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

  const addProject = ({ name, mode, participants, note }) =>
    addDoc(collection(db, 'users', user.uid, 'projects'), {
      name,
      mode: mode || 'gestoria',
      participants,
      note: note || '',
      status: 'active',
      startDate: todayISO(),
      pending: [],
      createdAt: serverTimestamp(),
    })

  const updateProject = (id, data) => updateDoc(doc(db, 'users', user.uid, 'projects', id), data)

  const deleteProject = async (id) => {
    const snap = await getDocs(
      query(collection(db, 'users', user.uid, 'expenses'), where('projectId', '==', id))
    )
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'users', user.uid, 'projects', id))
  }

  return {
    projects,
    loading,
    addProject,
    updateProject,
    deleteProject,
    ...useLedger(user, 'projectId'),
    ...usePending(user),
  }
}

// Movimientos del libro diario. Viven en `expenses` para que, cuando el dinero
// sale o entra de TUS cuentas, alimenten tu app de gastos (Movimientos, saldos
// y reportes). Cuando paga otro participante se marcan `offBook`: quedan en el
// libro del proyecto pero no ensucian tus movimientos ni tus saldos.
export function useLedger(user, ownerField) {
  const noteFor = (owner, m, nameOf) => {
    const who = nameOf(m.paidBy)
    if (m.kind === 'settlement') return `${owner.name}: pago de ${who} a ${nameOf(m.paidTo)}`
    if (m.kind === 'fee') return `${owner.name}: honorario`
    return `${owner.name}: ${m.concept?.trim() || 'gasto'}`
  }

  const addMovement = (owner, m, nameOf) => {
    const paidByMe = m.paidBy === ME_ID
    // El honorario es lo único que es ingreso propio real; el resto solo mueve
    // dinero (traspaso) o ni siquiera te toca.
    const isFee = m.kind === 'fee'
    const receivesMoney = m.kind === 'settlement' && m.paidTo === ME_ID
    return addDoc(collection(db, 'users', user.uid, 'expenses'), {
      amount: m.amount,
      type: isFee || receivesMoney ? 'income' : 'expense',
      transfer: !isFee,
      category: isFee ? m.category || null : m.category || null,
      subcategory: null,
      note: noteFor(owner, m, nameOf),
      concept: m.concept?.trim() || '',
      date: m.date || todayISO(),
      // Solo se pide (y se guarda) cuenta cuando el dinero es tuyo.
      account: paidByMe || receivesMoney ? m.account || null : null,
      [ownerField]: owner.id,
      kind: m.kind,
      paidBy: m.paidBy,
      paidTo: m.paidTo ?? null,
      charged: m.kind === 'expense' && m.charged != null ? m.charged : null,
      // Lo que paga otro participante no toca tus cuentas: fuera de tus listas.
      offBook: !paidByMe && !receivesMoney,
      createdAt: serverTimestamp(),
    })
  }

  const updateMovement = (id, data) => updateDoc(doc(db, 'users', user.uid, 'expenses', id), data)
  const deleteMovement = (id) => deleteDoc(doc(db, 'users', user.uid, 'expenses', id))

  return { addMovement, updateMovement, deleteMovement }
}

function usePending(user) {
  const setPending = (project, list) =>
    updateDoc(doc(db, 'users', user.uid, 'projects', project.id), { pending: list })

  const addPending = (project, { concept, amount, link }) =>
    setPending(project, [
      ...(project.pending ?? []),
      { id: crypto.randomUUID(), concept: concept.trim(), amount, link: link || '', status: 'topedir' },
    ])

  const updatePending = (project, itemId, data) =>
    setPending(
      project,
      (project.pending ?? []).map((p) => (p.id === itemId ? { ...p, ...data } : p))
    )

  const deletePending = (project, itemId) =>
    setPending(project, (project.pending ?? []).filter((p) => p.id !== itemId))

  return { addPending, updatePending, deletePending }
}

// --- Migración del modelo viejo (fondo + paidFrom) al de participantes ---
//
// Antes el proyecto tenía un socio en texto y los movimientos hablaban de un
// "fondo". Ahora todo se expresa como quién puso el dinero:
//   funding       → pago directo del socio hacia ti
//   expense       → gasto pagado por ti (salió de tu cuenta en ambos casos)
//   fee           → honorario tuyo
//   reimbursement → pago directo del socio hacia ti
//   refund        → pago directo tuyo hacia el socio
export async function migrateProject(uid, project) {
  if (project.participants) return false // ya migrado

  const partnerId = crypto.randomUUID()
  const partnerName = project.partner?.trim() || 'Socio'
  const participants = [
    { id: ME_ID, name: 'Yo', share: 0 },
    { id: partnerId, name: partnerName, share: 100 },
  ]

  const snap = await getDocs(
    query(collection(db, 'users', uid, 'expenses'), where('projectId', '==', project.id))
  )

  await Promise.all(
    snap.docs.map((d) => {
      const m = d.data()
      switch (m.projectKind) {
        case 'funding':
        case 'reimbursement':
          return updateDoc(d.ref, {
            kind: 'settlement',
            paidBy: partnerId,
            paidTo: ME_ID,
            offBook: false,
          })
        case 'refund':
          return updateDoc(d.ref, {
            kind: 'settlement',
            paidBy: ME_ID,
            paidTo: partnerId,
            offBook: false,
          })
        case 'fee':
          return updateDoc(d.ref, { kind: 'fee', paidBy: ME_ID, paidTo: null, offBook: false })
        default:
          // Los gastos salían de tu cuenta tanto "del fondo" como "adelantados".
          return updateDoc(d.ref, { kind: 'expense', paidBy: ME_ID, paidTo: null, offBook: false })
      }
    })
  )

  await updateDoc(doc(db, 'users', uid, 'projects', project.id), {
    mode: 'gestoria',
    participants,
  })
  return true
}
