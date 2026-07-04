import { createContext, useContext, useEffect, useRef, useState } from 'react'
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
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './AuthContext'
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../utils/categories'

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

// Normaliza un nombre para comparar: sin acentos, sin mayúsculas, sin espacios de más.
function normName(s) {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

// Firestore limita cada writeBatch a 500 operaciones; dejamos margen en 450.
async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db)
    ops.slice(i, i + 450).forEach((apply) => apply(batch))
    await batch.commit()
  }
}

// Fusiona categorías duplicadas (mismo nombre + mismo tipo) en una sola y
// reapunta hacia la conservada todo lo que las referenciaba: movimientos
// (expenses.category), recurrentes (recurring.category) y presupuestos
// (budgets, cuyo doc-id ES el id de la categoría). Devuelve un resumen.
async function dedupeCategories(uid) {
  const base = ['users', uid]

  const catSnap = await getDocs(collection(db, ...base, 'categories'))
  const cats = catSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const groups = new Map()
  for (const c of cats) {
    const key = `${c.type || 'expense'}::${normName(c.name)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  }

  const remap = new Map() // idDuplicado -> idConservado
  const ops = []
  let removed = 0
  let mergedGroups = 0

  for (const group of groups.values()) {
    if (group.length < 2) continue
    mergedGroups++

    const sorted = [...group].sort((a, b) => {
      const ad = a.id.startsWith('def-') ? 0 : 1
      const bd = b.id.startsWith('def-') ? 0 : 1
      if (ad !== bd) return ad - bd
      const ao = a.order ?? 9999
      const bo = b.order ?? 9999
      if (ao !== bo) return ao - bo
      const at = a.createdAt?.seconds ?? Infinity
      const bt = b.createdAt?.seconds ?? Infinity
      if (at !== bt) return at - bt
      return a.id < b.id ? -1 : 1
    })
    const canonical = sorted[0]
    const dupes = sorted.slice(1)

    const subs = new Map()
    for (const c of sorted) {
      for (const s of c.subcategories || []) {
        const k = normName(s.name)
        if (!subs.has(k)) subs.set(k, s)
      }
    }
    const mergedSubs = [...subs.values()]
    if (mergedSubs.length !== (canonical.subcategories || []).length) {
      ops.push((b) =>
        b.update(doc(db, ...base, 'categories', canonical.id), { subcategories: mergedSubs }),
      )
    }

    for (const d of dupes) {
      remap.set(d.id, canonical.id)
      ops.push((b) => b.delete(doc(db, ...base, 'categories', d.id)))
      removed++
    }
  }

  if (remap.size === 0) {
    return { mergedGroups: 0, removed: 0, repointed: 0 }
  }

  let repointed = 0
  for (const col of ['expenses', 'recurring']) {
    const snap = await getDocs(collection(db, ...base, col))
    snap.docs.forEach((d) => {
      const cur = d.data().category
      if (cur && remap.has(cur)) {
        ops.push((b) => b.update(d.ref, { category: remap.get(cur) }))
        repointed++
      }
    })
  }

  const budgetSnap = await getDocs(collection(db, ...base, 'budgets'))
  const budgetIds = new Set(budgetSnap.docs.map((d) => d.id))
  budgetSnap.docs.forEach((d) => {
    if (!remap.has(d.id)) return
    const target = remap.get(d.id)
    if (!budgetIds.has(target)) {
      const data = d.data()
      ops.push((b) => b.set(doc(db, ...base, 'budgets', target), { ...data, category: target }))
      budgetIds.add(target)
    }
    ops.push((b) => b.delete(doc(db, ...base, 'budgets', d.id)))
  })

  await commitOps(ops)
  return { mergedGroups, removed, repointed }
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
  const repairDuplicates = () => dedupeCategories(user.uid)

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
