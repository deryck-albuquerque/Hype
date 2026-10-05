import { useCallback, useEffect, useState } from 'react'
import {
  List,
  Plus,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { api } from '../lib/api'
import type { AuthUser } from '../types/auth'
import type { RequestItem } from '../types/requests'
import { CreateRequestForm } from './CreateRequestForm'
import { CreateUserForm } from './CreateUserForm'
import { ProfilePage } from './ProfilePage'
import { RequestDetails } from './RequestDetails'
import {
  RequestFilters,
  emptyRequestFilters,
  type RequestFilterValues,
} from './RequestFilters'

interface RequestsPageProps {
  user: AuthUser
  onUserUpdated: (updatedUser: AuthUser) => void
  onLogout: () => void
}

type ActiveView = 'requests' | 'create_user' | 'create_request' | 'profile'

const statusLabels: Record<RequestItem['status'], string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  done: 'Finalizada',
  in_test: 'Em teste',
  completed: 'Concluída',
  rejected: 'Rejeitada',
}

const priorityLabels: Record<RequestItem['priority'], string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

const roleLabels: Record<string, string> = {
  po: 'PO',
  tech_lead: 'Tech Lead',
  developer: 'Developer',
  qa: 'QA',
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function RequestsPage({
  user,
  onUserUpdated,
  onLogout,
}: RequestsPageProps) {
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeView, setActiveView] = useState<ActiveView>('requests')
  const [expandedRequestId, setExpandedRequestId] = useState<number | null>(null)
  const [requestToDelete, setRequestToDelete] = useState<RequestItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [appliedFilters, setAppliedFilters] =
    useState<RequestFilterValues>({ ...emptyRequestFilters })

  const isManager = user.role === 'po' || user.role === 'tech_lead'
  const roleLabel = roleLabels[user.role] ?? user.role

  const sectionTitle = isManager
    ? 'Solicitações da equipe'
    : 'Minhas solicitações'

  const pageTitle =
    activeView === 'requests'
      ? `Olá, ${user.name}`
      : activeView === 'create_request'
        ? 'Criar Solicitação'
        : activeView === 'create_user'
          ? 'Cadastrar Usuário'
          : 'Meu Perfil'

  const pageDescription =
    activeView === 'requests'
      ? `${roleLabel} · Acompanhe suas solicitações por aqui.`
      : activeView === 'create_request'
        ? `${roleLabel} · Crie uma nova solicitação. Somente PO e Tech Lead podem abrir solicitações.`
        : activeView === 'create_user'
          ? `${roleLabel} · Crie um perfil Developer ou QA. Somente PO e Tech Lead podem cadastrar usuários.`
          : `${roleLabel} · Gerencie seus dados e sua senha.`

  const activeFilterCount = Object.values(appliedFilters).filter(
    (value) => value !== '',
  ).length

  const loadRequests = useCallback(
    async (filters: RequestFilterValues) => {
      setIsLoading(true)
      setError('')

      const params: Record<string, string | number> = {}

      if (filters.status) {
        params.status = filters.status
      }

      if (filters.priority) {
        params.priority = filters.priority
      }

      if (filters.developerId) {
        params.developer_id = Number(filters.developerId)
      }

      if (filters.createdFrom) {
        params.created_from = filters.createdFrom
      }

      if (filters.createdTo) {
        params.created_to = filters.createdTo
      }

      try {
        const response = await api.get<RequestItem[]>('/requests', { params })
        setRequests(response.data)
      } catch {
        setError('Não foi possível carregar as solicitações.')
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadRequests(appliedFilters)
  }, [loadRequests, appliedFilters])

  useEffect(() => {
    if (!notice) return

    const timeoutId = window.setTimeout(() => {
      setNotice('')
    }, 5000)

    return () => window.clearTimeout(timeoutId)
  }, [notice])

  function showView(view: ActiveView) {
    setNotice('')
    setActiveView(view)
  }

  function applyFilters(filters: RequestFilterValues) {
    setAppliedFilters(filters)
  }

  function updateRequest(updatedRequest: RequestItem) {
    setRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === updatedRequest.id ? updatedRequest : request,
      ),
    )
  }

  function openDeleteDialog(request: RequestItem) {
    setDeleteError('')
    setRequestToDelete(request)
  }

  function closeDeleteDialog() {
    if (isDeleting) return
    setRequestToDelete(null)
    setDeleteError('')
  }

  async function handleDeleteRequest() {
    if (!requestToDelete) return

    const request = requestToDelete
    setIsDeleting(true)
    setDeleteError('')

    try {
      await api.delete(`/requests/${request.id}`)

      setRequests((currentRequests) =>
        currentRequests.filter((item) => item.id !== request.id),
      )

      if (expandedRequestId === request.id) {
        setExpandedRequestId(null)
      }

      setRequestToDelete(null)
      setNotice('Solicitação e histórico excluídos com sucesso.')
    } catch {
      setDeleteError('Não foi possível excluir a solicitação.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="flex flex-col border-b border-slate-800 bg-slate-900/70 p-5 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Hype
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Triagem De Solicitações
            </p>
          </div>

          <nav className="mt-6 flex gap-2 overflow-x-auto lg:flex-col">
            <button
              type="button"
              onClick={() => showView('requests')}
              className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                activeView === 'requests'
                  ? 'bg-cyan-400/10 text-cyan-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <List size={18} aria-hidden="true" />
              <span>Solicitações</span>
            </button>

            <button
              type="button"
              onClick={() => showView('profile')}
              className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                activeView === 'profile'
                  ? 'bg-cyan-400/10 text-cyan-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <UserRound size={18} aria-hidden="true" />
              <span>Meu Perfil</span>
            </button>

            {isManager && (
              <>
                <button
                  type="button"
                  onClick={() => showView('create_request')}
                  className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    activeView === 'create_request'
                      ? 'bg-cyan-400/10 text-cyan-300'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <Plus size={18} aria-hidden="true" />
                  <span>Criar Solicitação</span>
                </button>

                <button
                  type="button"
                  onClick={() => showView('create_user')}
                  className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    activeView === 'create_user'
                      ? 'bg-cyan-400/10 text-cyan-300'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <Users size={18} aria-hidden="true" />
                  <span>Cadastrar Usuário</span>
                </button>
              </>
            )}
          </nav>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-800 pt-4 lg:mt-auto">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="text-xs text-slate-400">{roleLabel}</p>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm transition hover:bg-slate-800"
            >
              Sair
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-8 sm:px-8">
          <header className="mb-8">
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              {pageDescription}
            </p>
          </header>

          {notice && (
            <p
              role="status"
              className="mb-4 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300"
            >
              {notice}
            </p>
          )}

          {activeView === 'create_user' && isManager ? (
            <CreateUserForm
              onCancel={() => showView('requests')}
              onSuccess={() => {
                setNotice('Usuário cadastrado com sucesso.')
              }}
            />
          ) : activeView === 'create_request' && isManager ? (
            <CreateRequestForm
              onCancel={() => showView('requests')}
              onSuccess={() => {
                setNotice('Solicitação criada com sucesso.')
                void loadRequests(appliedFilters)
              }}
            />
          ) : activeView === 'profile' ? (
            <ProfilePage user={user} onUserUpdated={onUserUpdated} />
          ) : (
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{sectionTitle}</h2>
                  <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                    {requests.length}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-expanded={isFiltersOpen}
                    aria-controls="request-filters-panel"
                    onClick={() => setIsFiltersOpen((isOpen) => !isOpen)}
                    className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium transition hover:bg-slate-800"
                  >
                    <SlidersHorizontal size={16} aria-hidden="true" />
                    Filtros
                    {activeFilterCount > 0 && (
                      <span className="rounded-full bg-cyan-400 px-2 py-0.5 text-xs font-semibold text-slate-950">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void loadRequests(appliedFilters)}
                    disabled={isLoading}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isLoading ? 'Atualizando...' : 'Atualizar'}
                  </button>
                </div>
              </div>

              <div
                id="request-filters-panel"
                className={isFiltersOpen ? 'block' : 'hidden'}
              >
                <RequestFilters
                  isManager={isManager}
                  onApply={applyFilters}
                />
              </div>

              {isLoading && (
                <p className="py-8 text-center text-slate-400">
                  Carregando solicitações...
                </p>
              )}

              {!isLoading && error && (
                <div className="rounded-lg border border-red-900 bg-red-950/40 p-4">
                  <p role="alert" className="text-sm text-red-300">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadRequests(appliedFilters)}
                    className="mt-3 text-sm font-semibold text-red-200 underline"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {!isLoading && !error && requests.length === 0 && (
                <p className="py-8 text-center text-slate-400">
                  Nenhuma solicitação encontrada.
                </p>
              )}

              {!isLoading && !error && requests.length > 0 && (
                <div className="space-y-4">
                  {requests.map((request) => {
                    const isExpanded = expandedRequestId === request.id

                    return (
                      <article
                        key={request.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-slate-500">
                              Solicitação #{request.id}
                            </p>
                            <h3 className="mt-1 font-semibold">
                              {request.title}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-cyan-950 px-3 py-1 text-xs font-medium text-cyan-300">
                              {statusLabels[request.status]}
                            </span>

                            {isManager && (
                              <button
                                type="button"
                                aria-label={`Excluir solicitação ${request.title}`}
                                title="Excluir solicitação"
                                onClick={() => openDeleteDialog(request)}
                                className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:border-red-800 hover:bg-red-950/50 hover:text-red-300"
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="mt-3 whitespace-pre-line break-words [overflow-wrap:anywhere] text-left text-sm leading-7 text-slate-300">
                          {request.description}
                        </p>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                            <p className="flex items-center gap-1.5 text-xs text-slate-500">
                              <UserRound size={14} aria-hidden="true" />
                              Developer Responsável
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-200">
                              {request.developer_name}
                            </p>
                          </div>

                          <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                            <p className="flex items-center gap-1.5 text-xs text-slate-500">
                              <UserRound size={14} aria-hidden="true" />
                              QA Responsável
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-200">
                              {request.qa_name}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                          <span>
                            Prioridade: {priorityLabels[request.priority]}
                          </span>
                          <span>
                            Criada em: {formatDate(request.created_at)}
                          </span>
                        </div>

                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedRequestId(
                              isExpanded ? null : request.id,
                            )
                          }
                          className="mt-5 text-sm font-medium text-cyan-300 hover:text-cyan-200"
                        >
                          {isExpanded
                            ? 'Ocultar detalhes e histórico'
                            : 'Ver detalhes e histórico'}
                        </button>

                        {isExpanded && (
                          <RequestDetails
                            request={request}
                            user={user}
                            onUpdated={updateRequest}
                          />
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {requestToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteDialog()
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
          >
            <h2 id="delete-dialog-title" className="text-lg font-semibold">
              Excluir Solicitação
            </h2>

            <p
              id="delete-dialog-description"
              className="mt-3 text-sm leading-6 text-slate-300"
            >
              Você deseja mesmo deletar esta solicitação?
            </p>

            <p className="mt-2 text-sm font-medium text-slate-100">
              {requestToDelete.title}
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              O histórico desta solicitação também será excluído.
            </p>

            {deleteError && (
              <p role="alert" className="mt-4 text-sm text-red-400">
                {deleteError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={isDeleting}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium transition hover:bg-slate-800 disabled:opacity-50"
              >
                Sair
              </button>

              <button
                type="button"
                onClick={() => void handleDeleteRequest()}
                disabled={isDeleting}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}