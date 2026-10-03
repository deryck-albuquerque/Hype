import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { api } from '../lib/api'
import type { AuthUser } from '../types/auth'
import type { RequestItem } from '../types/requests'

type RequestStatus = RequestItem['status']

interface RequestHistoryItem {
  id: number
  actor_id: number
  actor_name: string
  action: string
  field_name: string
  old_value: string | null
  new_value: string | null
  old_display_value: string | null
  new_display_value: string | null
  comment: string | null
  created_at: string
}

interface RequestDetailsProps {
  request: RequestItem
  user: AuthUser
  onUpdated: (updatedRequest: RequestItem) => void
}

const statusLabels: Record<RequestStatus, string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  done: 'Finalizada',
  in_test: 'Em teste',
  completed: 'Concluída',
  rejected: 'Rejeitada',
}

const allStatuses = Object.keys(statusLabels) as RequestStatus[]

const actionLabels: Record<string, string> = {
  created: 'criou a solicitação',
  assigned: 'atribuiu',
  updated: 'atualizou a solicitação',
  status_changed: 'alterou o status',
  approved: 'aprovou a solicitação',
  rejected: 'rejeitou a solicitação',
}

const fieldLabels: Record<string, string> = {
  developer_id: 'Developer responsável',
  qa_id: 'QA responsável',
}

function getAvailableStatuses(
  role: string,
  currentStatus: RequestStatus,
): RequestStatus[] {
  if (role === 'po' || role === 'tech_lead') {
    return allStatuses.filter((status) => status !== currentStatus)
  }

  if (role === 'developer') {
    if (currentStatus === 'open') return ['in_progress']
    if (currentStatus === 'in_progress') return ['done']
    if (currentStatus === 'rejected') return ['in_progress']
  }

  if (role === 'qa') {
    if (currentStatus === 'done') return ['in_test']
    if (currentStatus === 'in_test') return ['completed', 'rejected']
  }

  return []
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date))
}

function formatStatus(value: string | null) {
  if (!value) return 'Não informado'
  return statusLabels[value as RequestStatus] ?? value
}

function getHistoryChange(item: RequestHistoryItem) {
  if (item.field_name === 'status') {
    return `Status: ${formatStatus(item.new_value)}`
  }

  if (item.field_name === 'developer_id' || item.field_name === 'qa_id') {
    const assigneeName = item.new_display_value ?? 'Não atribuído'
    return `${fieldLabels[item.field_name]}: ${assigneeName}`
  }

  const fieldName = item.field_name || 'Campo'
  const oldValue = item.old_value ?? '—'
  const newValue = item.new_value ?? '—'

  return `${fieldName}: ${oldValue} → ${newValue}`
}

export function RequestDetails({
  request,
  user,
  onUpdated,
}: RequestDetailsProps) {
  const [history, setHistory] = useState<RequestHistoryItem[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [nextStatus, setNextStatus] = useState<RequestStatus | ''>('')
  const [comment, setComment] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [updateNotice, setUpdateNotice] = useState('')

  const availableStatuses = getAvailableStatuses(user.role, request.status)
  const commentRequired =
    user.role === 'qa' &&
    (nextStatus === 'completed' || nextStatus === 'rejected')

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    setHistoryError('')

    try {
      const response = await api.get<RequestHistoryItem[]>(
        `/requests/${request.id}/history`,
      )
      setHistory(response.data)
    } catch {
      setHistoryError('Não foi possível carregar o histórico.')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [request.id])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    const statuses = getAvailableStatuses(user.role, request.status)
    setNextStatus(statuses[0] ?? '')
  }, [user.role, request.status])

  async function handleStatusUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdateError('')
    setUpdateNotice('')

    if (!nextStatus) return

    if (commentRequired && !comment.trim()) {
      setUpdateError('Adicione um comentário para aprovar ou rejeitar.')
      return
    }

    setIsUpdating(true)

    try {
      const response = await api.patch<RequestItem>(
        `/requests/${request.id}/status`,
        {
          status: nextStatus,
          comment: comment.trim() || null,
        },
      )

      onUpdated(response.data)
      setComment('')
      setUpdateNotice('Status atualizado com sucesso.')
      await loadHistory()
    } catch (requestError) {
      if (
        isAxiosError<{ detail?: string }>(requestError) &&
        typeof requestError.response?.data?.detail === 'string'
      ) {
        setUpdateError(requestError.response.data.detail)
      } else {
        setUpdateError('Não foi possível atualizar o status.')
      }
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="mt-5 grid gap-6 border-t border-slate-800 pt-5 lg:grid-cols-2">
      <section>
        <h4 className="font-semibold">Histórico</h4>

        {isLoadingHistory && (
          <p className="mt-3 text-sm text-slate-400">
            Carregando histórico...
          </p>
        )}

        {!isLoadingHistory && historyError && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {historyError}
          </p>
        )}

        {!isLoadingHistory && !historyError && history.length === 0 && (
          <p className="mt-3 text-sm text-slate-400">
            Ainda não há registros no histórico.
          </p>
        )}

        {!isLoadingHistory && !historyError && history.length > 0 && (
          <ol className="mt-4 space-y-4 border-l border-slate-700 pl-4">
            {history.map((item) => (
              <li key={item.id} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-cyan-400" />

                <p className="text-slate-200">
                  <span className="font-medium">{item.actor_name}</span>{' '}
                  {actionLabels[item.action] ?? item.action}
                  {item.field_name && <> · {getHistoryChange(item)}</>}
                </p>

                {item.comment && (
                  <p className="mt-1 rounded-md bg-slate-900 p-2 text-slate-400">
                    {item.comment}
                  </p>
                )}

                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(item.created_at)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h4 className="font-semibold">Atualizar status</h4>

        {availableStatuses.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            Você não tem ações de status disponíveis nesta solicitação.
          </p>
        ) : (
          <form onSubmit={handleStatusUpdate} className="mt-3 space-y-4">
            <div>
              <label
                htmlFor={`next-status-${request.id}`}
                className="mb-2 block text-sm font-medium"
              >
                Novo status
              </label>

              <select
                id={`next-status-${request.id}`}
                value={nextStatus}
                onChange={(event) =>
                  setNextStatus(event.target.value as RequestStatus)
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
              >
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor={`status-comment-${request.id}`}
                className="mb-2 block text-sm font-medium"
              >
                Comentário {commentRequired ? '(obrigatório)' : '(opcional)'}
              </label>

              <textarea
                id={`status-comment-${request.id}`}
                rows={3}
                required={commentRequired}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                placeholder={
                  commentRequired
                    ? 'Explique o resultado do teste.'
                    : 'Adicione um comentário, se necessário.'
                }
              />
            </div>

            {updateError && (
              <p role="alert" className="text-sm text-red-400">
                {updateError}
              </p>
            )}

            {updateNotice && (
              <p role="status" className="text-sm text-emerald-400">
                {updateNotice}
              </p>
            )}

            <button
              type="submit"
              disabled={isUpdating}
              className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
            >
              {isUpdating ? 'Atualizando...' : 'Atualizar status'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}