import { useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const COLLECTIONS = ['expenses', 'accounts', 'categories', 'tandas', 'recurring', 'budgets']

export default function Migration() {
  const { user } = useAuth()
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef()

  const exportData = async () => {
    setBusy(true)
    setStatus('Exportando…')
    try {
      const data = {}
      for (const col of COLLECTIONS) {
        const snap = await getDocs(collection(db, 'users', user.uid, col))
        data[col] = snap.docs.map((d) => ({ _id: d.id, ...d.data() }))
      }
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `control-gastos-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setStatus(`✅ Exportado: ${Object.values(data).reduce((a, c) => a + c.length, 0)} documentos`)
    } catch (e) {
      setStatus('❌ Error al exportar: ' + e.message)
    }
    setBusy(false)
  }

  const importData = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setBusy(true)
    setStatus('Leyendo archivo…')
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      let total = 0
      for (const col of COLLECTIONS) {
        if (!data[col]?.length) continue
        setStatus(`Importando ${col}…`)

        // Borra los documentos actuales de esta colección
        const existing = await getDocs(collection(db, 'users', user.uid, col))
        const deleteBatch = writeBatch(db)
        existing.docs.forEach((d) => deleteBatch.delete(d.ref))
        if (existing.docs.length > 0) await deleteBatch.commit()

        // Escribe los nuevos en lotes de 500 (límite de Firestore)
        const items = data[col]
        for (let i = 0; i < items.length; i += 500) {
          const batch = writeBatch(db)
          items.slice(i, i + 500).forEach(({ _id, createdAt, ...rest }) => {
            // Reusa el mismo ID para mantener referencias (recurringId, etc.)
            const ref = doc(db, 'users', user.uid, col, _id)
            batch.set(ref, { ...rest, createdAt: serverTimestamp() })
          })
          await batch.commit()
          total += items.slice(i, i + 500).length
        }
      }
      setStatus(`✅ Importados ${total} documentos. ¡Cierra esta pantalla y recarga la app!`)
    } catch (e) {
      setStatus('❌ Error al importar: ' + e.message)
    }
    setBusy(false)
    e.target.value = ''
  }

  return (
    <div className="page">
      <header className="sub-header">
        <h1>Migración de datos</h1>
      </header>

      <div className="migration-card">
        <h3>Cuenta activa</h3>
        <p className="migration-email">{user?.email}</p>
      </div>

      <div className="migration-card">
        <h3>Paso 1 — Exportar</h3>
        <p className="migration-hint">
          Entra como <strong>czrlibelle@gmail.com</strong> y toca Exportar para descargar un archivo con
          todos tus datos.
        </p>
        <button className="btn-primary" onClick={exportData} disabled={busy}>
          ⬇️ Exportar mis datos
        </button>
      </div>

      <div className="migration-card">
        <h3>Paso 2 — Importar</h3>
        <p className="migration-hint">
          Cierra sesión, entra como <strong>careye@gmail.com</strong> y selecciona el archivo que
          descargaste. <strong>Esto reemplazará todos los datos actuales de esta cuenta.</strong>
        </p>
        <button className="btn-primary" onClick={() => fileRef.current.click()} disabled={busy}>
          ⬆️ Importar archivo
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importData} />
      </div>

      {status && <p className="migration-status">{status}</p>}
    </div>
  )
}
