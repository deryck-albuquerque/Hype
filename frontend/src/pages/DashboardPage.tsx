import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { api } from '../lib/api'
import type { AuthUser } from '../types/auth'

type RequestStatus =
  | 'open'
  | 'in_progress'
  | 'done'
  | 'in_test'
  | 'completed'
  | 'rejected'

interface DashboardSummary {
  role: string
  total: number
  status_counts: Record<RequestStatus, number>
}

interface DashboardPageProps {
  user: AuthUser
}

const statusItems: {
  key: RequestStatus
  label: string
  color: string
}[] = [
  { key: 'open', label: 'Abertas', color: 'bg-sky-400' },
  { key: 'in_progress', label: 'Em Andamento', color: 'bg-amber-400' },
  { key: 'done', label: 'Prontas Para Teste', color: 'bg-violet-400' },
  { key: 'in_test', label: 'Em Teste', color: 'bg-cyan-400' },
  { key: 'completed', label: 'Concluídas', color: 'bg-emerald-400' },
  { key: 'rejected', label: 'Rejeitadas', color: 'bg-red-400' },
]

const roleLabels: Record<string, string> = {
  po: 'PO',
  tech_lead: 'Tech Lead',
  developer: 'Developer',
  qa: 'QA',
}

export function DashboardPage({ user }: DashboardPageProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadSummary() {
      setIsLoading(true)
      setError('')

      try {
        const response = await api.get<DashboardSummary>(
          '/dashboard/summary',
        )

        if (isMounted) {
          setSummary(response.data)
        }
      } catch (requestError) {
        if (!isMounted) return

        if (
          isAxiosError<{ detail?: string }>(requestError) &&
          typeof requestError.response?.data?.detail === 'string'
        ) {
          setError(requestError.response.data.detail)
        } else {
          setError('Não foi possível carregar o resumo.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadSummary()

    return () => {
      isMounted = false
    }
  }, [])

  const completedLabel =
    user.role === 'qa' ? 'Aprovadas' : 'Concluídas'

  const scopeDescription =
    user.role === 'po' || user.role === 'tech_lead'
      ? 'Solicitações que você criou'
      : 'Solicitações atribuídas a você'

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p className="py-8 text-center text-slate-400">
          Carregando seu resumo...
        </p>
      </section>
    )
  }

  if (error || !summary) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p role="alert" className="text-sm text-red-300">
          {error || 'Não foi possível carregar o resumo.'}
        </p>
      </section>
    )
  }

  const cards = [
    {
      label: 'Total',
      value: summary.total,
      color: 'text-slate-100',
    },
    {
      label: 'Abertas',
      value: summary.status_counts.open,
      color: 'text-sky-300',
    },
    {
      label: 'Em Andamento',
      value: summary.status_counts.in_progress,
      color: 'text-amber-300',
    },
    {
      label: 'Prontas Para Teste',
      value: summary.status_counts.done,
      color: 'text-violet-300',
    },
    {
      label: 'Em Teste',
      value: summary.status_counts.in_test,
      color: 'text-cyan-300',
    },
    {
      label: completedLabel,
      value: summary.status_counts.completed,
      color: 'text-emerald-300',
    },
    {
      label: 'Rejeitadas',
      value: summary.status_counts.rejected,
      color: 'text-red-300',
    },
  ]

  const maxStatusCount = Math.max(
    1,
    ...statusItems.map((item) => summary.status_counts[item.key]),
  )

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Resumo</h2>
          <p className="mt-1 text-sm text-slate-400">
            {roleLabels[user.role] ?? user.role} · {scopeDescription}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article
              key={card.label}
              className="rounded-xl border border-slate-800 bg-slate-950 p-4"
            >
              <p className="text-sm text-slate-400">{card.label}</p>
              <p className={`mt-2 text-3xl font-semibold ${card.color}`}>
                {card.value}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Distribuição Por Status</h2>
          <p className="mt-1 text-sm text-slate-400">
            Uma visão rápida do andamento das suas solicitações.
          </p>
        </div>

        <div className="space-y-4">
          {statusItems.map((item) => {
            const count = summary.status_counts[item.key]
            const percentage = (count / maxStatusCount) * 100
            const label =
              item.key === 'completed' ? completedLabel : item.label

            return (
              <div key={item.key}>
                <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                  <span className="text-slate-300">{label}</span>
                  <span className="tabular-nums text-slate-400">{count}</span>
                </div>

                <div
                  className="h-2 overflow-hidden rounded-full bg-slate-800"
                  role="progressbar"
                  aria-label={label}
                  aria-valuemin={0}
                  aria-valuemax={maxStatusCount}
                  aria-valuenow={count}
                >
                  <div
                    className={`h-full rounded-full transition-all ${item.color}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}