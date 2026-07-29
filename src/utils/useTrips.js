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
import { useLedger } from './useProjects'

export { ME_ID }

// Categorías de viaje, con icono y color para el desglose.
export const TRIP_CATEGORIES = [
  { id: 'alimentos', name: 'Alimentos', icon: '🍽️', color: '#f97316' },
  { id: 'alojamiento', name: 'Alojamiento', icon: '🏨', color: '#ec4899' },
  { id: 'transporte', name: 'Transporte', icon: '🚕', color: '#eab308' },
  { id: 'vuelos', name: 'Vuelos', icon: '✈️', color: '#3b82f6' },
  { id: 'gasolina', name: 'Gasolina', icon: '⛽', color: '#8b5cf6' },
  { id: 'supermercado', name: 'Supermercado', icon: '🛒', color: '#22c55e' },
  { id: 'entretenimiento', name: 'Entretenim.', icon: '🎟️', color: '#a855f7' },
  { id: 'tours', name: 'Tours', icon: '🗺️', color: '#ef4444' },
  { id: 'compras', name: 'Compras', icon: '🛍️', color: '#f43f5e' },
  { id: 'salud', name: 'Salud', icon: '💊', color: '#14b8a6' },
  { id: 'estacionamiento', name: 'Estac./Peaje', icon: '🅿️', color: '#64748b' },
  { id: 'rentaauto', name: 'Renta Auto', icon: '🚗', color: '#0ea5e9' },
  { id: 'propinas', name: 'Propinas', icon: '💵', color: '#84cc16' },
  { id: 'regalos', name: 'Regalos', icon: '🎁', color: '#06b6d4' },
  { id: 'servicios', name: 'Servicios', icon: '📶', color: '#10b981' },
  { id: 'otros', name: 'Otros', icon: '📦', color: '#94a3b8' },
]

export const tripCategory = (id) =>
  TRIP_CATEGORIES.find((c) => c.id === id) ?? { id, name: 'Otros', icon: '📦', color: '#94a3b8' }

// En vacaciones el gasto se reparte en partes iguales entre los viajeros.
export function tripSummary(trip, movements) {
  const split = computeSplit({
    participants: trip.participants ?? [],
    movements,
    equalShares: true,
  })

  // Desglose por categoría (solo gastos, no pagos directos).
  const byCategory = new Map()
  for (const m of movements) {
    if (m.kind === 'settlement') continue
    const id = m.category || 'otros'
    byCategory.set(id, (byCategory.get(id) ?? 0) + m.amount)
  }
  const categories = [...byCategory.entries()]
    .map(([id, value]) => ({ ...tripCategory(id), value }))
    .sort((a, b) => b.value - a.value)

  // Quién más aportó al viaje.
  const top = [...split.balances].sort((a, b) => b.paid - a.paid)[0]

  return { ...split, categories, magnate: top && top.paid > 0 ? top : null }
}

export function useTrips() {
  const { user } = useAuth()
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setTrips([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', user.uid, 'trips')
    const q = query(ref, orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTrips(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addTrip = ({ name, participants }) =>
    addDoc(collection(db, 'users', user.uid, 'trips'), {
      name,
      participants,
      status: 'active',
      startDate: todayISO(),
      createdAt: serverTimestamp(),
    })

  const updateTrip = (id, data) => updateDoc(doc(db, 'users', user.uid, 'trips', id), data)

  const deleteTrip = async (id) => {
    const snap = await getDocs(
      query(collection(db, 'users', user.uid, 'expenses'), where('tripId', '==', id))
    )
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'users', user.uid, 'trips', id))
  }

  return { trips, loading, addTrip, updateTrip, deleteTrip, ...useLedger(user, 'tripId') }
}
