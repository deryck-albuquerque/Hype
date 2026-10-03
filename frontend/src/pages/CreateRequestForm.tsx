import { useEffect, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { api } from '../lib/api'

type Priority = 'low' | 'medium' | 'high' | 'urgent'
type AssignableRole = 'developer' | 'qa'

interface AssignableUser {
  id: number
  name: string
  email: string
  role: AssignableRole
}

interface CreateRequestFormProps {
  onCancel: () => void
  onSuccess: () => void
}

const priorityOptions: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

export function CreateRequestForm({
  onCancel,
  onSuccess,
}: CreateRequestFormProps) {
  const [developers, setDevelopers] = useState<AssignableUser[]>([])
  const [qas, setQas] = useState<AssignableUser[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [developerId, setDeveloperId] = useState('')
  const [qaId, setQaId] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadAssignableUsers() {
      try {
        const [developersResponse, qasResponse] = await Promise.all([
          api.get<AssignableUser[]>('/users', {
            params: { role: 'developer' },
          }),
          api.get<AssignableUser[]>('/users', {
            params: { role: 'qa' },
          }),
        ])

        if (isMounted) {
          setDevelopers(developersResponse.data)
          setQas(qasResponse.data)
        }
      } catch {
        if (isMounted) {
          setUsersError('Não foi possível carregar a lista de Developers e QAs.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingUsers(false)
        }
      }
    }

    void loadAssignableUsers()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')
    setIsSubmitting(true)

    try {
      await api.post('/requests', {
        title,
        description,
        priority,
        developer_id: Number(developerId),
        qa_id: Number(qaId),
      })

      setTitle('')
      setDescription('')
      setPriority('medium')
      setDeveloperId('')
      setQaId('')

      onSuccess()
    } catch (requestError) {
      if (
        isAxiosError<{ detail?: string }>(requestError) &&
        typeof requestError.response?.data?.detail === 'string'
      ) {
        setSubmitError(requestError.response.data.detail)
      } else {
        setSubmitError('Não foi possível criar a solicitação.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = !isLoadingUsers && developers.length > 0 && qas.length > 0

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
      {isLoadingUsers && (
        <p className="text-sm text-slate-400">
          Carregando Developers e QAs...
        </p>
      )}

      {usersError && (
        <p role="alert" className="text-sm text-red-400">
          {usersError}
        </p>
      )}

      {!isLoadingUsers &&
        !usersError &&
        (developers.length === 0 || qas.length === 0) && (
          <p className="rounded-lg border border-amber-900 bg-amber-950/40 p-3 text-sm text-amber-300">
            É necessário cadastrar pelo menos um Developer e um QA antes de
            criar uma solicitação.
          </p>
        )}

      {canSubmit && (
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="request-title"
              className="mb-2 block text-sm font-medium"
            >
              Título
            </label>
            <input
              id="request-title"
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
              placeholder="Ex.: Corrigir fluxo de recuperação de senha"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="request-description"
              className="mb-2 block text-sm font-medium"
            >
              Descrição
            </label>
            <textarea
              id="request-description"
              required
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
              placeholder="Descreva o que precisa ser feito."
            />
          </div>

          <div>
            <label
              htmlFor="request-priority"
              className="mb-2 block text-sm font-medium"
            >
              Prioridade
            </label>
            <select
              id="request-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            >
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="request-developer"
              className="mb-2 block text-sm font-medium"
            >
              Developer Responsável
            </label>
            <select
              id="request-developer"
              required
              value={developerId}
              onChange={(event) => setDeveloperId(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            >
              <option value="">Selecione um Developer</option>
              {developers.map((developer) => (
                <option key={developer.id} value={developer.id}>
                  {developer.name} ({developer.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="request-qa"
              className="mb-2 block text-sm font-medium"
            >
              QA Responsável
            </label>
            <select
              id="request-qa"
              required
              value={qaId}
              onChange={(event) => setQaId(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            >
              <option value="">Selecione um QA</option>
              {qas.map((qa) => (
                <option key={qa.id} value={qa.id}>
                  {qa.name} ({qa.email})
                </option>
              ))}
            </select>
          </div>

          {submitError && (
            <p role="alert" className="text-sm text-red-400 sm:col-span-2">
              {submitError}
            </p>
          )}

          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
            >
              {isSubmitting ? 'Criando...' : 'Criar solicitação'}
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-700 px-4 py-2 font-medium transition hover:bg-slate-800 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  )
}