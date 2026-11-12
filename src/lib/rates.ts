import type { FrozenRates } from '../types'

/**
 * Справочный курс из бесплатного API open.er-api.com (без ключа, с CORS).
 * Один запрос: курсы из CNY во все валюты. API отдаёт USD за 1 ¥ и BYN за 1 ¥,
 * переворачиваем в наш формат «за $1»:
 *   cnyPerUsd = 1 / rates.USD  («$1 = X ¥»)
 *   usdByn    = rates.BYN / rates.USD  («$1 = Y Br»)
 */
export async function fetchAutoRates(): Promise<FrozenRates> {
  const res = await fetch('https://open.er-api.com/v6/latest/CNY')
  if (!res.ok) throw new Error(`Ошибка HTTP ${res.status}`)
  const data = await res.json()
  if (data?.result !== 'success' || !data?.rates?.USD || !data?.rates?.BYN) {
    throw new Error('Неожиданный ответ API курсов')
  }
  const usdPerCny = Number(data.rates.USD) // USD за 1 ¥
  return {
    cnyPerUsd: 1 / usdPerCny,
    usdByn: Number(data.rates.BYN) / usdPerCny,
    source: 'auto',
    capturedAt: new Date().toISOString().slice(0, 10),
  }
}
