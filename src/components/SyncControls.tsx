import type { SyncStatus } from '../store/useAppData'
import { isApiConfigured } from '../lib/api'

interface Props {
  status: SyncStatus
  message: string | null
  unsyncedCount: number
  onSync: () => void
}

// Кнопка «Синхронизировать» + индикаторы офлайна и несинхронизированных изменений
export default function SyncControls({ status, message, unsyncedCount, onSync }: Props) {
  if (!isApiConfigured()) {
    return <span className="text-xs text-slate-400">API не настроен (VITE_API_URL)</span>
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {status === 'error' && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Офлайн — локальные данные
          </span>
        )}
        {unsyncedCount > 0 && (
          <span
            className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700"
            title="Изменения сохранены на устройстве и будут отправлены при следующей синхронизации"
          >
            ⚠ {unsyncedCount} не синхрониз.
          </span>
        )}
        <button
          onClick={onSync}
          disabled={status === 'loading'}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {status === 'loading' ? 'Синхронизация…' : '⟳ Синхронизировать'}
        </button>
      </div>
      {status === 'ok' && message && <span className="text-xs text-emerald-600">✓ {message}</span>}
      {status === 'error' && message && (
        <span className="max-w-64 text-right text-xs text-amber-700">{message}</span>
      )}
    </div>
  )
}
