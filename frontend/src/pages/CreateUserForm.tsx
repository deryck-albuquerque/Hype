import { useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { api } from '../lib/api'

type NewUserRole = 'developer' | 'qa'

interface CreateUserFormProps {
  onCancel: () => void
  onSuccess: () => void
}

export function CreateUserForm({
  onCancel,
  onSuccess,
}: CreateUserFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<NewUserRole>('developer')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await api.post('/users', {
        name,
        email,
        password,
        role,
      })

      setName('')
      setEmail('')
      setPassword('')
      setRole('developer')

      onSuccess()
    } catch (requestError) {
      if (
        isAxiosError<{ detail?: string }>(requestError) &&
        typeof requestError.response?.data?.detail === 'string'
      ) {
        setError(requestError.response.data.detail)
      } else {
        setError('Não foi possível cadastrar o usuário.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="user-name" className="mb-2 block text-sm font-medium">
            Nome
          </label>
          <input
            id="user-name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            placeholder="Nome do usuário"
          />
        </div>

        <div>
          <label
            htmlFor="user-email"
            className="mb-2 block text-sm font-medium"
          >
            E-mail
          </label>
          <input
            id="user-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            placeholder="usuario@empresa.com"
          />
        </div>

        <div>
          <label
            htmlFor="user-password"
            className="mb-2 block text-sm font-medium"
          >
            Senha
          </label>
          <input
            id="user-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            placeholder="Mínimo de 8 caracteres"
          />
        </div>

        <div>
          <label
            htmlFor="user-role"
            className="mb-2 block text-sm font-medium"
          >
            Perfil
          </label>
          <select
            id="user-role"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as NewUserRole)
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
          >
            <option value="developer">Developer</option>
            <option value="qa">QA</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-400 sm:col-span-2">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
          >
            {isSubmitting ? 'Cadastrando...' : 'Cadastrar'}
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
    </section>
  )
}