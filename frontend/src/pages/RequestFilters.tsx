import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import type { RequestItem } from '../types/requests'

export interface RequestFilterValues {
  status: RequestItem['status'] | ''
  priority: RequestItem['priority'] | ''
  developerId: string
  createdFrom: string
  createdTo: string
}

export const emptyRequestFilters: RequestFilterValues = {
  status: '',
  priority: '',
  developerId: '',
  createdFrom: '',
  createdTo: '',
}

interface AssignableDeveloper {
  id: number
  name: string
  email: string
  role: string
}

interface RequestFiltersProps {
  isManager: boolean
  onApply: (filters: RequestFilterValues) => void
}

const statusOptions: { value: RequestItem['status']; label: string }[] = [
  { value: 'open', label: 'Aberta' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'done', label: 'Finalizada' },
  { value: 'in_test', label: 'Em teste' },
  { value: 'completed', label: 'Concluída' },
  { value: 'rejected', label: 'Rejeitada' },
]

const priorityOptions: {
  value: RequestItem['priority']
  label: string
}[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

export function RequestFilters({
  isManager,
  onApply,
}: RequestFiltersProps) {
  const [filters, setFilters] =
    useState<RequestFilterValues>(emptyRequestFilters)
  const [developers, setDevelopers] = useState<AssignableDeveloper[]>([])
  const [developerError, setDeveloperError] = useState('')
  const [filterError, setFilterError] = useState('')

  useEffect(() => {
    if (!isManager) return

    let isMounted = true

    async function loadDevelopers() {
      try {
        const response = await api.get<AssignableDeveloper[]>('/users', {
          params: { role: 'developer' },
        })

        if (isMounted) {
          setDevelopers(response.data)
        }
      } catch {
        if (isMounted) {
          setDeveloperError('Não foi possível carregar a lista de Developers.')
        }
      }
    }

    void loadDevelopers()

    return () => {
      isMounted = false
    }
  }, [isManager])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilterError('')

    if (
      filters.createdFrom &&
      filters.createdTo &&
      filters.createdFrom > filters.createdTo
    ) {
      setFilterError('A data inicial não pode ser posterior à data final.')
      return
    }

    onApply({ ...filters })
  }

  function handleClear() {
    setFilterError('')
    setFilters({ ...emptyRequestFilters })
    onApply({ ...emptyRequestFilters })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
    >
      <h3 className="mb-4 text-sm font-semibold text-slate-200">
        Filtrar solicitações
      </h3>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div>
          <label
            htmlFor="filter-status"
            className="mb-2 block text-xs font-medium text-slate-400"
          >
            Status
          </label>
          <select
            id="filter-status"
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as RequestFilterValues['status'],
              }))
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-400"
          >
            <option value="">Todos os status</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-priority"
            className="mb-2 block text-xs font-medium text-slate-400"
          >
            Prioridade
          </label>
          <select
            id="filter-priority"
            value={filters.priority}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                priority: event.target.value as RequestFilterValues['priority'],
              }))
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-400"
          >
            <option value="">Todas as prioridades</option>
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {isManager && (
          <div>
            <label
              htmlFor="filter-developer"
              className="mb-2 block text-xs font-medium text-slate-400"
            >
              Developer atribuído
            </label>
            <select
              id="filter-developer"
              value={filters.developerId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  developerId: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-400"
            >
              <option value="">Todos os Developers</option>
              {developers.map((developer) => (
                <option key={developer.id} value={developer.id}>
                  {developer.name}
                </option>
              ))}
            </select>

            {developerError && (
              <p className="mt-1 text-xs text-amber-300">{developerError}</p>
            )}
          </div>
        )}

        <div>
          <label
            htmlFor="filter-created-from"
            className="mb-2 block text-xs font-medium text-slate-400"
          >
            Criadas a partir de
          </label>
          <input
            id="filter-created-from"
            type="date"
            value={filters.createdFrom}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                createdFrom: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-400"
          />
        </div>

        <div>
          <label
            htmlFor="filter-created-to"
            className="mb-2 block text-xs font-medium text-slate-400"
          >
            Criadas até
          </label>
          <input
            id="filter-created-to"
            type="date"
            value={filters.createdTo}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                createdTo: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {filterError && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {filterError}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="submit"
          className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Aplicar filtros
        </button>

        <button
          type="button"
          onClick={handleClear}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium transition hover:bg-slate-800"
        >
          Limpar filtros
        </button>
      </div>
    </form>
  )
}