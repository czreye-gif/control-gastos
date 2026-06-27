export const CATEGORIES = [
  { id: 'comida', label: 'Comida', icon: '🍔', color: '#f97316' },
  { id: 'transporte', label: 'Transporte', icon: '🚗', color: '#3b82f6' },
  { id: 'vivienda', label: 'Vivienda', icon: '🏠', color: '#8b5cf6' },
  { id: 'servicios', label: 'Servicios', icon: '💡', color: '#eab308' },
  { id: 'salud', label: 'Salud', icon: '🏥', color: '#ef4444' },
  { id: 'entretenimiento', label: 'Entretenimiento', icon: '🎮', color: '#ec4899' },
  { id: 'ropa', label: 'Ropa', icon: '👕', color: '#06b6d4' },
  { id: 'educacion', label: 'Educación', icon: '📚', color: '#22c55e' },
  { id: 'ahorro', label: 'Ahorro', icon: '💰', color: '#14b8a6' },
  { id: 'otros', label: 'Otros', icon: '🧾', color: '#64748b' },
]

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
}
