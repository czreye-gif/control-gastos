import { createContext, useContext, useEffect, useRef, useState } from 'react'
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
import { useAuth } from './AuthContext'
import { DEFAULT_CATEGORIES } from '../utils/categories'

const CategoriesContext = createContext(null)

export function CategoriesProvider({ children }) {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const seededRef = useRef(false)

  useEffect(() => {
    if (!user) {
      setCategories([])
      setLoading(false)
      return
    }
    seededRef.current = false
    const ref = collection(db, 'users', user.uid, 'categories')
    const q = query(ref, orderBy('order'))
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Primera vez del usuario: sembramos las categorías por defecto.
      if (snapshot.empty && !seededRef.current) {
        seededRef.current = true
        const batch = writeBatch(db)
        DEFAULT_CATEGORIES.forEach((c, i) => {
          batch.set(doc(ref), { ...c, order: i, createdAt: serverTimestamp() })
        })
        await batch.commit()
        return // el onSnapshot volverá a dispararse ya con datos
      }
      setCategories(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addCategory = ({ name, icon, color }) => {
    const ref = collection(db, 'users', user.uid, 'categories')
    return addDoc(ref, {
      name,
      icon,
      color,
      order: categories.length,
      createdAt: serverTimestamp(),
    })
  }

  const updateCategory = (id, data) => {
    return updateDoc(doc(db, 'users', user.uid, 'categories', id), data)
  }

  const deleteCategory = (id) => {
    return deleteDoc(doc(db, 'users', user.uid, 'categories', id))
  }

  const getCategory = (id) => {
    return (
      categories.find((c) => c.id === id) ?? {
        id,
        name: 'Sin categoría',
        icon: '🧾',
        color: '#64748b',
      }
    )
  }

  return (
    <CategoriesContext.Provider
      value={{ categories, loading, addCategory, updateCategory, deleteCategory, getCategory }}
    >
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories() {
  return useContext(CategoriesContext)
}
