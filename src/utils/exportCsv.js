// Exportación de movimientos a CSV (compatible con Excel/Google Sheets).

const BOM = String.fromCharCode(0xfeff)

// Escapa un valor para CSV: entrecomilla si contiene coma, comillas o salto.
function esc(value) {
  const s = String(value ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Construye el CSV. El monto va con signo (ingreso +, gasto −) para que
// sume directo en una hoja de cálculo. Se antepone BOM para que Excel
// respete los acentos en UTF-8.
export function movementsToCsv(rows, { categoryName, subcategoryName, accountName }) {
  const header = ['Fecha', 'Tipo', 'Categoría', 'Subcategoría', 'Cuenta', 'Nota', 'Monto']
  const lines = [header.join(',')]

  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  for (const e of sorted) {
    const isIncome = (e.type ?? 'expense') === 'income'
    const signed = isIncome ? e.amount : -e.amount
    lines.push(
      [
        e.date,
        isIncome ? 'Ingreso' : 'Gasto',
        categoryName(e.category),
        subcategoryName(e.category, e.subcategory),
        accountName(e.account),
        e.note ?? '',
        signed,
      ]
        .map(esc)
        .join(',')
    )
  }

  return BOM + lines.join('\r\n')
}

export function downloadFile(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
