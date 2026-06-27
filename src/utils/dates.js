const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function todayISO() {
  const d = new Date()
  return toISO(d)
}

export function toISO(date) {
  const d = new Date(date)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

export function formatDayLabel(isoDate) {
  const todayStr = todayISO()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yStr = toISO(yesterday)

  if (isoDate === todayStr) return 'Hoy'
  if (isoDate === yStr) return 'Ayer'

  const d = new Date(isoDate + 'T00:00:00')
  return `${d.getDate()} de ${MESES[d.getMonth()]}`
}

export function formatMonthLabel(isoMonth) {
  const [year, month] = isoMonth.split('-')
  return `${MESES[parseInt(month, 10) - 1]} ${year}`
}

export function currentMonthISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthOf(isoDate) {
  return isoDate.slice(0, 7)
}

export function lastNMonths(n) {
  const months = []
  const d = new Date()
  d.setDate(1)
  for (let i = 0; i < n; i++) {
    months.unshift(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return months
}
