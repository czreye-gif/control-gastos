// Motor de reparto compartido por Proyectos y Vacaciones.
//
// La idea es una sola: cada participante tiene un % del costo. Se compara lo
// que puso contra lo que le tocaba y el saldo dice quién debe a quién.
//   - Vacaciones / asociación → partes iguales o % definidos.
//   - Gestoría de operación   → el socio carga el 100% y tú el 0%, así todo lo
//     que pagas de tu bolsa te lo deben.
//
// Un movimiento puede ser:
//   'expense'    — gasto del proyecto/viaje (suma al costo)
//   'fee'        — tu honorario: también es costo, y cuenta como algo que
//                  aportaste (por eso el socio te lo debe)
//   'settlement' — pago directo entre dos personas (no suma al costo)

export const ME_ID = 'me'

// Reparte el costo y calcula los saldos de cada participante.
export function computeSplit({ participants = [], movements = [], equalShares = false }) {
  const paid = {}
  for (const p of participants) paid[p.id] = 0

  let totalCost = 0
  let totalRealCost = 0 // sin margen: lo que realmente costó
  let margin = 0
  let fees = 0

  for (const m of movements) {
    // `charged` permite cobrar más de lo que costó; la diferencia es margen.
    const charged = m.charged != null ? m.charged : m.amount
    if (m.kind === 'settlement') {
      if (paid[m.paidBy] != null) paid[m.paidBy] += m.amount
      if (paid[m.paidTo] != null) paid[m.paidTo] -= m.amount
      continue
    }
    totalCost += charged
    totalRealCost += m.amount
    if (m.kind === 'fee') fees += m.amount
    else margin += charged - m.amount
    if (paid[m.paidBy] != null) paid[m.paidBy] += charged
  }

  const shareOf = (p) =>
    equalShares ? (participants.length ? 100 / participants.length : 0) : p.share ?? 0

  const balances = participants.map((p) => {
    const owed = (totalCost * shareOf(p)) / 100
    return {
      id: p.id,
      name: p.name,
      share: shareOf(p),
      paid: paid[p.id] ?? 0,
      owed,
      balance: (paid[p.id] ?? 0) - owed,
    }
  })

  return {
    totalCost,
    totalRealCost,
    margin,
    fees,
    profit: fees + margin,
    balances,
    settlements: settleDebts(balances),
    perPerson: participants.length ? totalCost / participants.length : 0,
  }
}

// Empareja a quien debe con quien tiene saldo a favor, con el menor número de
// pagos posible (voraz: el que más debe le paga al que más se le debe).
function settleDebts(balances) {
  const debtors = balances
    .filter((b) => b.balance < -0.5)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.balance - b.balance)
  const creditors = balances
    .filter((b) => b.balance > 0.5)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balance - a.balance)

  const out = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]
    const c = creditors[j]
    const amount = Math.min(-d.balance, c.balance)
    if (amount > 0.5) out.push({ fromId: d.id, from: d.name, toId: c.id, to: c.name, amount })
    d.balance += amount
    c.balance -= amount
    if (Math.abs(d.balance) < 0.5) i++
    if (c.balance < 0.5) j++
  }
  return out
}

// Reparte 100% entre participantes en partes iguales (para asociación).
export function equalSharesFor(count) {
  if (count <= 0) return []
  const base = Math.floor((100 / count) * 100) / 100
  const shares = Array(count).fill(base)
  // El redondeo sobrante se le da al primero para que sume exactamente 100.
  shares[0] = Math.round((100 - base * (count - 1)) * 100) / 100
  return shares
}
