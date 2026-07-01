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
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../utils/categories'

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
        const seed = [...DEFAULT_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES]
        const batch = writeBatch(db)
        seed.forEach((c, i) => {
          batch.set(doc(ref), { ...c, subcategories: [], order: i, createdAt: serverTimestamp() })
        })
        await batch.commit()
        return // el onSnapshot volverá a dispararse ya con datos
      }
      // Autorreparación: categorías creadas antes de que existiera el módulo
      // de Ingresos no tienen `type`, así que no calzan en ningún filtro.
      // Les asignamos 'expense' (eran todas de gasto en ese entonces).
      const fixBatch = writeBatch(db)
      let needsFix = false
      snapshot.docs.forEach((d) => {
        if (!d.data().type) {
          needsFix = true
          fixBatch.update(d.ref, { type: 'expense' })
        }
      })
      if (needsFix) {
        await fixBatch.commit()
        return // el onSnapshot volverá a dispararse ya con datos corregidos
      }

      setCategories(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addCategory = ({ name, icon, color, type }) => {
    const ref = collection(db, 'users', user.uid, 'categories')
    return addDoc(ref, {
      name,
      icon,
      color,
      type,
      subcategories: [],
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
        type: 'expense',
        subcategories: [],
      }
    )
  }

  const getSubcategory = (categoryId, subcategoryId) => {
    if (!subcategoryId) return null
    const cat = getCategory(categoryId)
    return cat.subcategories?.find((s) => s.id === subcategoryId) ?? null
  }

  const addSubcategory = (categoryId, { name, icon }) => {
    const cat = getCategory(categoryId)
    const subcategory = { id: crypto.randomUUID(), name, icon: icon ?? cat.icon }
    return updateCategory(categoryId, { subcategories: [...(cat.subcategories ?? []), subcategory] })
  }

  const deleteSubcategory = (categoryId, subcategoryId) => {
    const cat = getCategory(categoryId)
    return updateCategory(categoryId, {
      subcategories: (cat.subcategories ?? []).filter((s) => s.id !== subcategoryId),
    })
  }

  return (
    <CategoriesContext.Provider
      value={{
        categories,
        loading,
        addCategory,
        updateCategory,
        deleteCategory,
        getCategory,
        getSubcategory,
        addSubcategory,
        deleteSubcategory,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories() {
  return useContext(CategoriesContext)
}
