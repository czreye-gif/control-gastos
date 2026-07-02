import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// Credenciales del proyecto "Control-Gastos" en Firebase Console.
// Estas claves son seguras para apps web (no son secretas); la seguridad
// real la dan las reglas de Firestore en firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyAUZ97-_iSwEtCQzYVbUtMSzMLRLls7Nas',
  authDomain: 'control-gastos-386a1.firebaseapp.com',
  projectId: 'control-gastos-386a1',
  storageBucket: 'control-gastos-386a1.firebasestorage.app',
  messagingSenderId: '788156288089',
  appId: '1:788156288089:web:604f6ac0f31912329e3548',
  measurementId: 'G-DXL6ZNQD4X',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
// Fuerza el selector de cuentas de Google en cada inicio de sesión
googleProvider.setCustomParameters({ prompt: 'select_account' })

// Caché local persistente: la app sigue leyendo y guardando datos aunque
// no haya internet (IndexedDB del navegador), y Firestore sincroniza solo
// en cuanto detecta conexión de nuevo. `persistentMultipleTabManager`
// evita conflictos si el usuario abre la app en varias pestañas/dispositivos.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
