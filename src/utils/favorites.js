// Detecta los movimientos que más se repiten (mismo tipo, categoría,
// subcategoría, cuenta y monto exacto) para ofrecerlos como atajo.
// No hay favoritos "manuales": se calculan solos a partir del historial.
export function computeFrequentMovements(expenses, type, limit = 8) {
  const groups = new Map()
  for (const e of expenses) {
    if ((e.type ?? 'expense') !== type) continue
    const key = [e.category, e.subcategory ?? '', e.account ?? '', e.amount].join('|')
    const g = groups.get(key)
    if (g) {
      g.count++
      if (e.date > g.lastDate) {
        g.lastDate = e.date
        g.note = e.note ?? ''
      }
    } else {
      groups.set(key, {
        type,
        category: e.category,
        subcategory: e.subcategory ?? null,
        account: e.account ?? null,
        amount: e.amount,
        note: e.note ?? '',
        count: 1,
        lastDate: e.date,
      })
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || (a.lastDate < b.lastDate ? 1 : -1))
    .slice(0, limit)
}
