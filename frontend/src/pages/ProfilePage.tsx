import { useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { api } from '../lib/api'
import type { AuthUser } from '../types/auth'

interface ProfilePageProps {
  user: AuthUser
  onUserUpdated: (updatedUser: AuthUser) => void
}

interface ApiError {
  detail?: string | Array<{ msg?: string }>
}

type ProfileUpdate = {
  name?: string
  email?: string
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<ApiError>(error)) {
    const detail = error.response?.data?.detail

    if (typeof detail === 'string') {
      return detail
    }

    if (Array.isArray(detail)) {
      return detail.map((item) => item.msg).filter(Boolean).join(' ') || fallback
    }
  }

  return fallback
}

function formatRole(role: string): string {
  const labels: Record<string, string> = {
    po: 'PO',
    developer: 'Developer',
    tech_lead: 'Tech Lead',
    qa: 'QA',
  }

  return labels[role] ?? role
}

export function ProfilePage({ user, onUserUpdated }: ProfilePageProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError('')
    setProfileSuccess('')

    const updatedName = name.trim()
    const updatedEmail = email.trim()
    const payload: ProfileUpdate = {}

    if (updatedName && updatedName !== user.name) {
      payload.name = updatedName
    }

    if (updatedEmail && updatedEmail !== user.email) {
      payload.email = updatedEmail
    }

    if (!payload.name && !payload.email) {
      setProfileError('Informe um novo nome ou e-mail para atualizar.')
      return
    }

    setIsSavingProfile(true)

    try {
      const response = await api.patch<AuthUser>('/users/me', payload)

      onUserUpdated(response.data)
      setName('')
      setEmail('')
      setProfileSuccess('Dados atualizados com sucesso.')
    } catch (error) {
      setProfileError(
        getErrorMessage(error, 'Não foi possível atualizar seus dados.'),
      )
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword !== confirmPassword) {
      setPasswordError('A nova senha e a confirmação não são iguais.')
      return
    }

    setIsSavingPassword(true)

    try {
      await api.patch('/auth/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Senha atualizada com sucesso.')
    } catch (error) {
      setPasswordError(
        getErrorMessage(error, 'Não foi possível atualizar a senha.'),
      )
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Dados Do Perfil</h2>
        <p className="mt-1 text-sm text-slate-400">
          Confira os dados atuais e atualize seu nome ou e-mail.
        </p>

        <div className="mt-5 grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Nome
            </p>
            <p className="mt-1 break-words text-sm text-slate-100">{user.name}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              E-mail
            </p>
            <p className="mt-1 break-words text-sm text-slate-100">
              {user.email}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Perfil De Acesso
            </p>
            <p className="mt-1 text-sm text-slate-100">
              {formatRole(user.role)}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleProfileSubmit}
          className="mt-6 grid gap-4 sm:grid-cols-2"
        >
          <div>
            <label
              htmlFor="profile-name"
              className="mb-2 block text-sm font-medium"
            >
              Novo Nome
            </label>
            <input
              id="profile-name"
              type="text"
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={user.name}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>

          <div>
            <label
              htmlFor="profile-email"
              className="mb-2 block text-sm font-medium"
            >
              Novo E-mail
            </label>
            <input
              id="profile-email"
              type="email"
              autoComplete="email"
              maxLength={255}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={user.email}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>

          {profileError && (
            <p role="alert" className="text-sm text-red-400 sm:col-span-2">
              {profileError}
            </p>
          )}

          {profileSuccess && (
            <p role="status" className="text-sm text-emerald-400 sm:col-span-2">
              {profileSuccess}
            </p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingProfile ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Alterar Senha</h2>
        <p className="mt-1 text-sm text-slate-400">
          Informe sua senha atual e escolha uma nova senha com pelo menos 8
          caracteres.
        </p>

        <form
          onSubmit={handlePasswordSubmit}
          className="mt-5 grid gap-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label
              htmlFor="current-password"
              className="mb-2 block text-sm font-medium"
            >
              Senha atual
            </label>
            <input
              id="current-password"
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
              Confirmar Nova Senha
            </label>
            <input
              id="confirm-password"
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
            <p role="alert" className="text-sm text-red-400 sm:col-span-2">
              {passwordError}
            </p>
          )}

          {passwordSuccess && (
            <p role="status" className="text-sm text-emerald-400 sm:col-span-2">
              {passwordSuccess}
            </p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isSavingPassword}
              className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingPassword ? 'Atualizando...' : 'Atualizar senha'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}