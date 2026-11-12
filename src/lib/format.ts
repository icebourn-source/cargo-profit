// Форматирование чисел и дат (русская локаль)

export function fmtNum(n: number, digits = 2): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: digits })
}

export function fmtUsd(n: number): string {
  return `${fmtNum(n)} $`
}

export function fmtByn(n: number): string {
  return `${fmtNum(n)} Br`
}

export function fmtPct(n: number | null): string {
  return n === null ? '—' : `${fmtNum(n, 1)} %`
}

// date — 'YYYY-MM-DD'; добавляем время, чтобы не было сдвига из-за часового пояса
export function fmtDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU')
}

export function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
