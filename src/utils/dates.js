const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function todayISO() {
  return toISO(new Date())
}

export function toISO(date) {
  const d = new Date(date)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

export function formatDayLabel(isoDate) {
  const todayStr = todayISO()
  const yStr = addDaysISO(todayStr, -1)

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

export function prevMonthISO() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthOf(isoDate) {
  return isoDate.slice(0, 7)
}

export function addDaysISO(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toISO(d)
}

// Lunes de la semana a la que pertenece la fecha dada.
export function startOfWeekISO(iso = todayISO()) {
  const d = new Date(iso + 'T00:00:00')
  const day = (d.getDay() + 6) % 7 // 0 = lunes
  d.setDate(d.getDate() - day)
  return toISO(d)
}

export function shortDayName(iso) {
  const d = new Date(iso + 'T00:00:00')
  return DIAS_CORTOS[d.getDay()]
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
