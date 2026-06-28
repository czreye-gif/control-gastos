// Categorías de gasto con las que arranca la app la primera vez.
// Después el usuario puede editarlas/agregarlas (se guardan en Firestore).
export const DEFAULT_CATEGORIES = [
  { name: 'Comida', icon: '🍔', color: '#f97316', type: 'expense' },
  { name: 'Transporte', icon: '🚗', color: '#3b82f6', type: 'expense' },
  { name: 'Vivienda', icon: '🏠', color: '#8b5cf6', type: 'expense' },
  { name: 'Servicios', icon: '💡', color: '#eab308', type: 'expense' },
  { name: 'Salud', icon: '🏥', color: '#ef4444', type: 'expense' },
  { name: 'Entretenimiento', icon: '🎮', color: '#ec4899', type: 'expense' },
  { name: 'Ropa', icon: '👕', color: '#06b6d4', type: 'expense' },
  { name: 'Educación', icon: '📚', color: '#22c55e', type: 'expense' },
  { name: 'Ahorro', icon: '💰', color: '#14b8a6', type: 'expense' },
  { name: 'Otros', icon: '🧾', color: '#64748b', type: 'expense' },
]

// Categorías de ingreso con las que arranca la app la primera vez.
export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salario', icon: '💼', color: '#22c55e', type: 'income' },
  { name: 'Ventas', icon: '🛍️', color: '#0ea5e9', type: 'income' },
  { name: 'Inversiones', icon: '📈', color: '#a855f7', type: 'income' },
  { name: 'Regalos', icon: '🎁', color: '#ec4899', type: 'income' },
  { name: 'Reembolsos', icon: '↩️', color: '#14b8a6', type: 'income' },
  { name: 'Otros ingresos', icon: '💵', color: '#64748b', type: 'income' },
]

// Iconos disponibles al crear/editar una categoría o subcategoría,
// agrupados por tema para que sean fáciles de hojear.
export const ICON_GROUPS = [
  {
    label: 'Comida y bebida',
    icons: ['🍔', '🍕', '🌮', '🍜', '🍣', '🍎', '🥗', '☕', '🍺', '🍷', '🧋', '🛒'],
  },
  {
    label: 'Transporte',
    icons: ['🚗', '🚕', '🚌', '🚇', '🚲', '🛵', '⛽', '🅿️', '✈️', '🚢', '🚆', '🛫'],
  },
  {
    label: 'Hogar y servicios',
    icons: ['🏠', '🏢', '💡', '🔧', '🚿', '🔌', '🧹', '🛋️', '🪴', '🔑', '🧺', '🛠️'],
  },
  {
    label: 'Salud y bienestar',
    icons: ['🏥', '💊', '🩺', '🦷', '🧘', '🏋️', '🧴', '😴', '🩹', '👓'],
  },
  {
    label: 'Ocio y entretenimiento',
    icons: ['🎮', '🎬', '🎵', '🎨', '🎉', '🎲', '📷', '🎤', '🏖️', '🎂', '🎟️', '⚽'],
  },
  {
    label: 'Compras y ropa',
    icons: ['👕', '👗', '👟', '👜', '💍', '🕶️', '🧢'],
  },
  {
    label: 'Educación y trabajo',
    icons: ['📚', '🎓', '✏️', '💻', '🖥️', '📱', '🖨️', '💼', '📈', '📊'],
  },
  {
    label: 'Dinero',
    icons: ['💰', '💳', '🏦', '💵', '🪙', '🧾', '↩️', '🎁'],
  },
  {
    label: 'Familia y mascotas',
    icons: ['👶', '👨‍👩‍👧', '🐶', '🐱', '🐾'],
  },
  {
    label: 'Otros',
    icons: ['❤️', '⭐', '📌', '🌎', '🧳', '🔥', '🧰'],
  },
]

// Lista plana, útil para validaciones o búsquedas simples.
export const ICON_OPTIONS = ICON_GROUPS.flatMap((g) => g.icons)

// Colores disponibles al crear/editar una categoría.
export const COLOR_OPTIONS = [
  '#f97316', '#f59e0b', '#eab308', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899',
  '#ef4444', '#64748b',
]
