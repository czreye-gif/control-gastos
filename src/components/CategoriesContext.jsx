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
import { dedupeCategories } from '../utils/dedupeCategories'

const CategoriesContext = createContext(null)

// ID determinista para cada categoría por defecto (p.ej. "def-expense-comida").
// Al sembrar con `set` sobre un ID fijo, si el sembrado llega a correr más de
// una vez simplemente sobrescribe en lugar de crear copias. Esto es lo que
// evita que las categorías se dupliquen/tripliquen.
function defaultId(c) {
  const slug = c.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `def-${c.type}-${slug}`
}

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
      // Sembramos las categorías por defecto solo la primera vez del usuario.
      // Dos candados evitan duplicados:
      //  1. `!snapshot.metadata.fromCache`: NO sembramos con una lectura de la
      //     caché local (que puede venir vacía antes de que el servidor
      //     confirme las escrituras), solo con una confirmación del servidor.
      //  2. IDs deterministas (`defaultId`): aunque el sembrado corriera dos
      //     veces, `set` sobre el mismo ID sobrescribe en vez de duplicar.
      if (snapshot.empty && !snapshot.metadata.fromCache && !seededRef.current) {
        seededRef.current = true
        const seed = [...DEFAULT_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES]
        const batch = writeBatch(db)
        seed.forEach((c, i) => {
          batch.set(doc(ref, defaultId(c)), {
            ...c,
            subcategories: [],
            order: i,
            createdAt: serverTimestamp(),
          })
        })
        await batch.commit()
        return // el onSnapshot volverá a dispararse ya con datos
      }
      // Autorreparación: categorías creadas antes de módulos posteriores
      // pueden no tener `type` (antes de Ingresos) o `subcategories` (antes
      // de las subcategorías). Sin estos campos no calzan en los filtros.
      const fixBatch = writeBatch(db)
      let needsFix = false
      snapshot.docs.forEach((d) => {
        const data = d.data()
        const fix = {}
        if (!data.type) fix.type = 'expense'
        if (!Array.isArray(data.subcategories)) fix.subcategories = []
        if (Object.keys(fix).length > 0) {
          needsFix = true
          fixBatch.update(d.ref, fix)
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

  // Mantenimiento: fusiona categorías duplicadas ya existentes en Firestore.
  const repairDuplicates = () => dedupeCategories(db, user.uid)

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
        repairDuplicates,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories() {
  return useContext(CategoriesContext)
}
