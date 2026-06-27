// Categorías con las que arranca la app la primera vez.
// Después el usuario puede editarlas/agregarlas (se guardan en Firestore).
export const DEFAULT_CATEGORIES = [
  { name: 'Comida', icon: '🍔', color: '#f97316' },
  { name: 'Transporte', icon: '🚗', color: '#3b82f6' },
  { name: 'Vivienda', icon: '🏠', color: '#8b5cf6' },
  { name: 'Servicios', icon: '💡', color: '#eab308' },
  { name: 'Salud', icon: '🏥', color: '#ef4444' },
  { name: 'Entretenimiento', icon: '🎮', color: '#ec4899' },
  { name: 'Ropa', icon: '👕', color: '#06b6d4' },
  { name: 'Educación', icon: '📚', color: '#22c55e' },
  { name: 'Ahorro', icon: '💰', color: '#14b8a6' },
  { name: 'Otros', icon: '🧾', color: '#64748b' },
]

// Iconos disponibles al crear/editar una categoría.
export const ICON_OPTIONS = [
  '🍔', '🍎', '☕', '🍺', '🛒', '🚗', '⛽', '🚌', '✈️', '🏠',
  '💡', '🔧', '🏥', '💊', '🎮', '🎬', '🎁', '👕', '📚', '💰',
  '💳', '🏦', '📱', '💻', '🐶', '🏋️', '🧴', '🧾', '💵', '❤️',
]

// Colores disponibles al crear/editar una categoría.
export const COLOR_OPTIONS = [
  '#f97316', '#f59e0b', '#eab308', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899',
  '#ef4444', '#64748b',
]
