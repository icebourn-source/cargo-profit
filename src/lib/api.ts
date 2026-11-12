import type { Shipment } from '../types'

// Адрес API задаётся на сборке: VITE_API_URL (например, https://cargo-profit-api.onrender.com)
// Таймаут большой: бесплатный Render «засыпает» и холодный старт занимает до ~минуты
const TIMEOUT_MS = 65000

export class ApiError extends Error {}

export function isApiConfigured(): boolean {
  return Boolean(((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim())
}

function apiUrl(path = ''): string {
  const base = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim()
  if (!base) throw new ApiError('Не задана переменная VITE_API_URL (адрес API)')
  return `${base.replace(/\/+$/, '')}/api/shipments${path}`
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ApiError(`Сервер ответил ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`)
    }
    return (await res.json()) as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApiError('Сервер не ответил вовремя — возможно, просыпается. Попробуйте ещё раз.')
    }
    throw new ApiError('Нет соединения с сервером (офлайн?)')
  } finally {
    clearTimeout(timer)
  }
}

// Все поставки с сервера
export function fetchShipments(): Promise<Shipment[]> {
  return request<Shipment[]>(apiUrl())
}

// Создать или обновить поставку (upsert целиком, включая товары)
export async function saveShipment(s: Shipment): Promise<void> {
  await request(apiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s),
  })
}

// Удалить поставку
export async function deleteShipment(id: string): Promise<void> {
  await request(apiUrl(`/${encodeURIComponent(id)}`), { method: 'DELETE' })
}
