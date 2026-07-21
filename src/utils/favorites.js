// Detecta los movimientos que más se repiten (mismo tipo, categoría,
// subcategoría y cuenta) para ofrecerlos como atajo. Lo que define un
// favorito es el "qué" (categoría/subcategoría/cuenta), no el monto exacto:
// dos compras de café por $45 y $52 cuentan como el mismo favorito. El monto
// sugerido es el más reciente de ese grupo (el usuario puede ajustarlo antes
// de guardar). No hay favoritos "manuales": se calculan solos del historial.
//
// Se excluyen los traspasos (`transfer: true` — depósitos a alcancía, pagos
// entre cuentas, aportaciones de tanda, movimientos de préstamo…): no tienen
// categoría real y no son gastos/ingresos, así que no deben aparecer aquí.
export function computeFrequentMovements(expenses, type, limit = 8) {
  const groups = new Map()
  for (const e of expenses) {
    if (e.transfer) continue
    if ((e.type ?? 'expense') !== type) continue
    if (!e.category) continue
    const key = [e.category, e.subcategory ?? '', e.account ?? ''].join('|')
    const g = groups.get(key)
    if (g) {
      g.count++
      if (e.date > g.lastDate) {
        g.lastDate = e.date
        g.note = e.note ?? ''
        g.amount = e.amount
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
