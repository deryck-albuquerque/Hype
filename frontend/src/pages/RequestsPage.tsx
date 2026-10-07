import { useCallback, useEffect, useState } from 'react'
import {
  List,
  Plus,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { isAxiosError } from 'axios'
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

interface ManagedUser {
  id: number
  name: string
  email: string
  role: string
}

type ActiveView = 'requests' | 'users' | 'create_request' | 'profile'

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

function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (
    isAxiosError<{ detail?: string }>(error) &&
    typeof error.response?.data?.detail === 'string'
  ) {
    return error.response.data.detail
  }

  return fallbackMessage
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
  const [isDeletingRequest, setIsDeletingRequest] = useState(false)
  const [deleteRequestError, setDeleteRequestError] = useState('')
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [appliedFilters, setAppliedFilters] =
    useState<RequestFilterValues>({ ...emptyRequestFilters })

  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null)
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [deleteUserError, setDeleteUserError] = useState('')

  const isManager = user.role === 'po' || user.role === 'tech_lead'
  const roleLabel = roleLabels[user.role] ?? user.role

  const sectionTitle = isManager
    ? 'Solicitações Da Equipe'
    : 'Minhas solicitações'

  const pageTitle =
    activeView === 'requests'
      ? `Olá, ${user.name}`
      : activeView === 'create_request'
        ? 'Criar Solicitação'
        : activeView === 'users'
          ? 'Usuários'
          : 'Meu Perfil'

  const pageDescription =
    activeView === 'requests'
      ? `${roleLabel} · Acompanhe suas solicitações por aqui.`
      : activeView === 'create_request'
        ? `${roleLabel} · Crie uma nova solicitação. Somente PO e Tech Lead podem abrir solicitações.`
        : activeView === 'users'
          ? `${roleLabel} · Gerencie os perfis e acessos da equipe.`
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

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true)
    setUsersError('')

    try {
      const response = await api.get<ManagedUser[]>('/users')
      setManagedUsers(response.data)
    } catch {
      setUsersError('Não foi possível carregar os usuários.')
    } finally {
      setIsLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    void loadRequests(appliedFilters)
  }, [loadRequests, appliedFilters])

  useEffect(() => {
    if (activeView === 'users' && isManager) {
      void loadUsers()
    }
  }, [activeView, isManager, loadUsers])

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
    setIsCreateUserOpen(false)
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

  function openDeleteRequestDialog(request: RequestItem) {
    setDeleteRequestError('')
    setRequestToDelete(request)
  }

  function closeDeleteRequestDialog() {
    if (isDeletingRequest) return
    setRequestToDelete(null)
    setDeleteRequestError('')
  }

  async function handleDeleteRequest() {
    if (!requestToDelete) return

    const request = requestToDelete
    setIsDeletingRequest(true)
    setDeleteRequestError('')

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
      setDeleteRequestError('Não foi possível excluir a solicitação.')
    } finally {
      setIsDeletingRequest(false)
    }
  }

  function openDeleteUserDialog(managedUser: ManagedUser) {
    setDeleteUserError('')
    setUserToDelete(managedUser)
  }

  function closeDeleteUserDialog() {
    if (isDeletingUser) return
    setUserToDelete(null)
    setDeleteUserError('')
  }

  async function handleDeleteUser() {
    if (!userToDelete) return

    const selectedUser = userToDelete
    setIsDeletingUser(true)
    setDeleteUserError('')

    try {
      await api.delete(`/users/${selectedUser.id}`)

      setManagedUsers((currentUsers) =>
        currentUsers.filter((item) => item.id !== selectedUser.id),
      )

      setUserToDelete(null)
      setNotice('Usuário excluído com sucesso.')
    } catch (requestError) {
      setDeleteUserError(
        getApiErrorMessage(
          requestError,
          'Não foi possível excluir o usuário.',
        ),
      )
    } finally {
      setIsDeletingUser(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen w-full flex-col lg:flex-row">
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
                  onClick={() => showView('users')}
                  className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    activeView === 'users'
                      ? 'bg-cyan-400/10 text-cyan-300'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <Users size={18} aria-hidden="true" />
                  <span>Usuários</span>
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

        <div className="min-w-0 flex-1 px-4 py-8 sm:px-8 xl:px-10">
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

          {activeView === 'users' && isManager ? (
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">Perfis cadastrados</h2>
                  <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                    {managedUsers.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen((isOpen) => !isOpen)}
                  className="flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  <Plus size={16} aria-hidden="true" />
                  {isCreateUserOpen ? 'Fechar cadastro' : 'Novo Usuário'}
                </button>
              </div>

              {isCreateUserOpen && (
                <div className="mb-6">
                  <CreateUserForm
                    onCancel={() => setIsCreateUserOpen(false)}
                    onSuccess={() => {
                      setIsCreateUserOpen(false)
                      setNotice('Usuário cadastrado com sucesso.')
                      void loadUsers()
                    }}
                  />
                </div>
              )}

              {isLoadingUsers && (
                <p className="py-8 text-center text-slate-400">
                  Carregando usuários...
                </p>
              )}

              {!isLoadingUsers && usersError && (
                <div className="rounded-lg border border-red-900 bg-red-950/40 p-4">
                  <p role="alert" className="text-sm text-red-300">
                    {usersError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadUsers()}
                    className="mt-3 text-sm font-semibold text-red-200 underline"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {!isLoadingUsers && !usersError && managedUsers.length === 0 && (
                <p className="py-8 text-center text-slate-400">
                  Nenhum usuário cadastrado.
                </p>
              )}

              {!isLoadingUsers && !usersError && managedUsers.length > 0 && (
                <div className="space-y-3">
                  {managedUsers.map((managedUser) => {
                    const isCurrentUser = managedUser.id === user.id

                    return (
                      <article
                        key={managedUser.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-cyan-300">
                            <UserRound size={18} aria-hidden="true" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {managedUser.name}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs font-normal text-slate-500">
                                  Você
                                </span>
                              )}
                            </p>
                            <p className="truncate text-sm text-slate-400">
                              {managedUser.email}
                            </p>
                            <span className="mt-2 inline-flex rounded-full bg-cyan-950 px-2.5 py-1 text-xs font-medium text-cyan-300">
                              {roleLabels[managedUser.role] ?? managedUser.role}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-label={`Excluir usuário ${managedUser.name}`}
                          title={
                            isCurrentUser
                              ? 'Você não pode excluir sua própria conta'
                              : 'Excluir usuário'
                          }
                          disabled={isCurrentUser}
                          onClick={() => openDeleteUserDialog(managedUser)}
                          className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:border-red-800 hover:bg-red-950/50 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
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
                                onClick={() =>
                                  openDeleteRequestDialog(request)
                                }
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
              closeDeleteRequestDialog()
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-request-dialog-title"
            aria-describedby="delete-request-dialog-description"
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
          >
            <h2
              id="delete-request-dialog-title"
              className="text-lg font-semibold"
            >
              Excluir Solicitação
            </h2>

            <p
              id="delete-request-dialog-description"
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

            {deleteRequestError && (
              <p role="alert" className="mt-4 text-sm text-red-400">
                {deleteRequestError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteRequestDialog}
                disabled={isDeletingRequest}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium transition hover:bg-slate-800 disabled:opacity-50"
              >
                Sair
              </button>

              <button
                type="button"
                onClick={() => void handleDeleteRequest()}
                disabled={isDeletingRequest}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeletingRequest
                  ? 'Excluindo...'
                  : 'Confirmar exclusão'}
              </button>
            </div>
          </section>
        </div>
      )}

      {userToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteUserDialog()
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-user-dialog-title"
            aria-describedby="delete-user-dialog-description"
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
          >
            <h2 id="delete-user-dialog-title" className="text-lg font-semibold">
              Excluir usuário
            </h2>

            <p
              id="delete-user-dialog-description"
              className="mt-3 text-sm leading-6 text-slate-300"
            >
              Deseja realmente excluir este perfil?
            </p>

            <p className="mt-2 font-medium text-slate-100">
              {userToDelete.name}
            </p>
            <p className="text-sm text-slate-400">{userToDelete.email}</p>
            <span className="mt-2 inline-flex rounded-full bg-cyan-950 px-2.5 py-1 text-xs font-medium text-cyan-300">
              {roleLabels[userToDelete.role] ?? userToDelete.role}
            </span>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Usuários associados a solicitações ou ao histórico não podem ser
              excluídos. O último perfil PO também será preservado.
            </p>

            {deleteUserError && (
              <p role="alert" className="mt-4 text-sm text-red-400">
                {deleteUserError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteUserDialog}
                disabled={isDeletingUser}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium transition hover:bg-slate-800 disabled:opacity-50"
              >
                Sair
              </button>

              <button
                type="button"
                onClick={() => void handleDeleteUser()}
                disabled={isDeletingUser}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeletingUser ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}