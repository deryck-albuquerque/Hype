import { useEffect, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { api } from '../lib/api'
import type { AuthUser } from '../types/auth'

interface ProfilePageProps {
  user: AuthUser
  onUserUpdated: (updatedUser: AuthUser) => void
}

interface ApiErrorResponse {
  detail?: string | Array<{ msg?: string }>
}

const roleLabels: Record<string, string> = {
  po: 'PO',
  tech_lead: 'Tech Lead',
  developer: 'Developer',
  qa: 'QA',
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError<ApiErrorResponse>(error)) {
    return fallback
  }

  const detail = error.response?.data?.detail

  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join(' ')
  }

  return fallback
}

export function ProfilePage({ user, onUserUpdated }: ProfilePageProps) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [profileError, setProfileError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const roleLabel = roleLabels[user.role] ?? user.role

  useEffect(() => {
    setName(user.name)
    setEmail(user.email)
  }, [user.name, user.email])

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError('')
    setProfileMessage('')
    setIsSavingProfile(true)

    try {
      const response = await api.patch<AuthUser>('/users/me', {
        name,
        email,
      })

      onUserUpdated(response.data)
      setProfileMessage('Seus dados foram atualizados.')
    } catch (requestError) {
      setProfileError(
        getErrorMessage(
          requestError,
          'Não foi possível atualizar seus dados.',
        ),
      )
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')

    if (newPassword !== confirmPassword) {
      setPasswordError('A nova senha e a confirmação não são iguais.')
      return
    }

    setIsChangingPassword(true)

    try {
      const response = await api.patch<{ detail: string }>(
        '/auth/me/password',
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
      )

      setPasswordMessage(response.data.detail)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (requestError) {
      setPasswordError(
        getErrorMessage(
          requestError,
          'Não foi possível alterar a senha.',
        ),
      )
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <div className="mb-6 flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-xl font-semibold text-cyan-300"
          >
            {user.name.trim().charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Dados Do Perfil</h2>
            <p className="mt-1 text-sm text-slate-400">
              Atualize seu nome e e-mail.
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
          <p className="text-xs text-slate-500">Perfil De Acesso</p>
          <p className="mt-1 text-sm font-medium text-slate-200">
            {roleLabel}
          </p>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="profile-name"
              className="mb-2 block text-sm font-medium"
            >
              Nome
            </label>
            <input
              id="profile-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>

          <div>
            <label
              htmlFor="profile-email"
              className="mb-2 block text-sm font-medium"
            >
              E-mail
            </label>
            <input
              id="profile-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>

          {profileError && (
            <p role="alert" className="text-sm text-red-400">
              {profileError}
            </p>
          )}

          {profileMessage && (
            <p role="status" className="text-sm text-emerald-400">
              {profileMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSavingProfile}
            className="rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavingProfile ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">Alterar Senha</h2>
          <p className="mt-1 text-sm text-slate-400">
            Informe sua senha atual e escolha uma nova com pelo menos 8
            caracteres.
          </p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="current-password"
              className="mb-2 block text-sm font-medium"
            >
              Senha Atual
            </label>
            <input
              id="current-password"
              name="current-password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>

          <div>
            <label
              htmlFor="new-password"
              className="mb-2 block text-sm font-medium"
            >
              Nova Senha
            </label>
            <input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-2 block text-sm font-medium"
            >
              Confirme a Nova Senha
            </label>
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>

          {passwordError && (
            <p role="alert" className="text-sm text-red-400">
              {passwordError}
            </p>
          )}

          {passwordMessage && (
            <p role="status" className="text-sm text-emerald-400">
              {passwordMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isChangingPassword}
            className="rounded-lg border border-slate-700 px-4 py-2.5 font-semibold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isChangingPassword ? 'Alterando...' : 'Alterar senha'}
          </button>
        </form>
      </section>
    </div>
  )
}