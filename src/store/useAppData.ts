import { useEffect, useState } from 'react'
import type { AppState, CarrierPreset, RateSettings, Shipment } from '../types'
import { loadState, saveState } from '../lib/storage'
import { deleteShipment as apiDelete, fetchShipments, isApiConfigured, saveShipment as apiSave } from '../lib/api'

export type SyncStatus = 'idle' | 'loading' | 'ok' | 'error'

// id поставок с несинхронизированными изменениями (отдельный ключ — не смешиваем с данными)
const UNSYNCED_KEY = 'cargo-profit:unsynced'

function loadUnsynced(): string[] {
  try {
    const raw = localStorage.getItem(UNSYNCED_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function persistUnsynced(ids: string[]): void {
  try {
    localStorage.setItem(UNSYNCED_KEY, JSON.stringify(ids))
  } catch {
    // переполнение localStorage — не критично для синхронизации
  }
}

/**
 * Состояние приложения + синхронизация с сервером.
 * Сервер — источник истины при успешной загрузке; localStorage — офлайн-кэш.
 * Изменения сохраняются локально сразу (оптимистично) и тут же отправляются на сервер;
 * при ошибке поставка помечается «не синхронизирована» и будет отправлена позже.
 */
export function useAppData() {
  const [state, setState] = useState<AppState>(loadState)
  const [sync, setSync] = useState<{ status: SyncStatus; message: string | null }>({ status: 'idle', message: null })
  const [unsyncedIds, setUnsyncedIds] = useState<string[]>(loadUnsynced)
  const [ready, setReady] = useState(false)

  // Автосохранение данных в localStorage
  useEffect(() => {
    saveState(state)
  }, [state])

  // Старт: сначала отправляем накопленные несинхронизированные изменения,
  // затем подгружаем актуальные данные с сервера. При ошибке — показываем кэш.
  useEffect(() => {
    if (!isApiConfigured()) {
      setReady(true)
      return
    }
    let cancelled = false
    const run = async () => {
      setSync({ status: 'loading', message: null })
      try {
        const local = loadState()
        for (const id of loadUnsynced()) {
          const s = local.shipments.find((x) => x.id === id)
          if (s) await apiSave(s) // поставка есть локально — сохраняем на сервер
          else await apiDelete(id) // локально удалена — удаляем и на сервере
        }
        persistUnsynced([])
        if (!cancelled) setUnsyncedIds([])
        const remote = await fetchShipments()
        if (!cancelled) setState((st) => ({ ...st, shipments: remote }))
        if (!cancelled) setSync({ status: 'ok', message: `Обновлено ${new Date().toLocaleTimeString('ru-RU')}` })
      } catch (e) {
        if (!cancelled) {
          setSync({ status: 'error', message: e instanceof Error ? e.message : 'Ошибка загрузки' })
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const markSynced = (id: string) =>
    setUnsyncedIds((prev) => {
      const next = prev.filter((x) => x !== id)
      persistUnsynced(next)
      return next
    })

  const markUnsynced = (id: string) =>
    setUnsyncedIds((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      persistUnsynced(next)
      return next
    })

  const pushUpsert = async (s: Shipment) => {
    try {
      await apiSave(s)
      markSynced(s.id)
    } catch {
      markUnsynced(s.id)
    }
  }

  const pushDelete = async (id: string) => {
    try {
      await apiDelete(id)
      markSynced(id)
    } catch {
      markUnsynced(id)
    }
  }

  // Создание или обновление поставки: сразу в localStorage, затем на сервер
  const upsertShipment = (s: Shipment) => {
    setState((st) =>
      st.shipments.some((x) => x.id === s.id)
        ? { ...st, shipments: st.shipments.map((x) => (x.id === s.id ? s : x)) }
        : { ...st, shipments: [s, ...st.shipments] },
    )
    if (isApiConfigured()) void pushUpsert(s)
  }

  const deleteShipment = (id: string) => {
    setState((st) => ({ ...st, shipments: st.shipments.filter((x) => x.id !== id) }))
    if (isApiConfigured()) void pushDelete(id)
  }

  // Принудительная синхронизация (кнопка в шапке)
  const syncNow = async () => {
    if (!isApiConfigured()) return
    setSync({ status: 'loading', message: null })
    try {
      const remote = await fetchShipments()
      setState((st) => ({ ...st, shipments: remote }))
      setSync({ status: 'ok', message: `Синхронизировано ${new Date().toLocaleTimeString('ru-RU')}` })
    } catch (e) {
      setSync({ status: 'error', message: e instanceof Error ? e.message : 'Ошибка синхронизации' })
    }
  }

  const saveCarriers = (carriers: CarrierPreset[]) => setState((st) => ({ ...st, carriers }))
  const setRateSettings = (rateSettings: RateSettings) => setState((st) => ({ ...st, rateSettings }))

  return {
    state,
    upsertShipment,
    deleteShipment,
    saveCarriers,
    setRateSettings,
    sync,
    syncNow,
    ready,
    unsyncedCount: unsyncedIds.length,
  }
}
