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
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

// Un favorito guarda una plantilla de movimiento (monto, categoría,
// subcategoría, cuenta, nota) para llenarla con un solo toque en el
// módulo de nuevo movimiento, en vez de repetir los mismos pasos cada vez.
export function useFavorites() {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setFavorites([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', user.uid, 'favorites')
    const q = query(ref, orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFavorites(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addFavorite = ({ name, amount, type, category, subcategory, note, account }) => {
    const ref = collection(db, 'users', user.uid, 'favorites')
    return addDoc(ref, {
      name,
      amount,
      type: type || 'expense',
      category,
      subcategory: subcategory || null,
      note: note || '',
      account: account || null,
      createdAt: serverTimestamp(),
    })
  }

  const deleteFavorite = (id) => {
    return deleteDoc(doc(db, 'users', user.uid, 'favorites', id))
  }

  return { favorites, loading, addFavorite, deleteFavorite }
}
