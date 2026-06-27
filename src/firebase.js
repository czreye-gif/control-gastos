import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

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
export const db = getFirestore(app)
