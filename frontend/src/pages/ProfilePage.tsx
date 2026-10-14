import { useEffect, useState, type FormEvent } from 'react'
import { Camera, Trash2, UserRound } from 'lucide-react'
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

interface AvatarResponse {
  avatar_url: string | null
}

type ProfileUpdate = {
  name?: string
  email?: string
}

const MAX_AVATAR_SIZE = 2 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState('')
  const [avatarSuccess, setAvatarSuccess] = useState('')
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(true)
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadAvatar() {
      setIsLoadingAvatar(true)

      try {
        const response = await api.get<AvatarResponse>('/users/me/avatar')

        if (isMounted) {
          setAvatarUrl(response.data.avatar_url)
        }
      } catch {
        if (isMounted) {
          setAvatarError('Não foi possível carregar sua foto de perfil.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingAvatar(false)
        }
      }
    }

    void loadAvatar()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedAvatar) {
      setAvatarPreview(null)
      return
    }

    const previewUrl = URL.createObjectURL(selectedAvatar)
    setAvatarPreview(previewUrl)

    return () => URL.revokeObjectURL(previewUrl)
  }, [selectedAvatar])

  useEffect(() => {
    if (!profileSuccess) return

    const timeoutId = window.setTimeout(() => {
      setProfileSuccess('')
    }, 5000)

    return () => window.clearTimeout(timeoutId)
  }, [profileSuccess])

  useEffect(() => {
    if (!avatarSuccess) return

    const timeoutId = window.setTimeout(() => {
      setAvatarSuccess('')
    }, 5000)

    return () => window.clearTimeout(timeoutId)
  }, [avatarSuccess])

  useEffect(() => {
    if (!passwordSuccess) return

    const timeoutId = window.setTimeout(() => {
      setPasswordSuccess('')
    }, 5000)

    return () => window.clearTimeout(timeoutId)
  }, [passwordSuccess])

  function handleAvatarSelection(file: File | undefined) {
    setAvatarError('')
    setAvatarSuccess('')

    if (!file) return

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Escolha uma imagem JPEG, PNG ou WebP.')
      return
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('A imagem deve ter no máximo 2 MB.')
      return
    }

    setSelectedAvatar(file)
  }

  async function handleAvatarUpload() {
    if (!selectedAvatar) {
      setAvatarError('Selecione uma imagem antes de enviar.')
      return
    }

    setAvatarError('')
    setAvatarSuccess('')
    setIsSavingAvatar(true)

    const formData = new FormData()
    formData.append('file', selectedAvatar)

    try {
      const response = await api.post<AvatarResponse>(
        '/users/me/avatar',
        formData,
      )

      setAvatarUrl(response.data.avatar_url)
      setSelectedAvatar(null)
      setAvatarSuccess('Foto de perfil atualizada com sucesso.')
    } catch (error) {
      setAvatarError(
        getErrorMessage(error, 'Não foi possível atualizar sua foto.'),
      )
    } finally {
      setIsSavingAvatar(false)
    }
  }

  async function handleAvatarRemoval() {
    setAvatarError('')
    setAvatarSuccess('')

    if (selectedAvatar) {
      setSelectedAvatar(null)
      return
    }

    if (!avatarUrl) return

    setIsRemovingAvatar(true)

    try {
      await api.delete('/users/me/avatar')
      setAvatarUrl(null)
      setAvatarSuccess('Foto de perfil removida.')
    } catch (error) {
      setAvatarError(
        getErrorMessage(error, 'Não foi possível remover sua foto.'),
      )
    } finally {
      setIsRemovingAvatar(false)
    }
  }

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

  const visibleAvatar = avatarPreview ?? avatarUrl

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Foto de Perfil</h2>
        <p className="mt-1 text-sm text-slate-400">
          Escolha uma imagem JPEG, PNG ou WebP de até 2 MB.
        </p>

        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-950 text-cyan-300">
            {visibleAvatar ? (
              <img
                src={visibleAvatar}
                alt={`Foto de perfil de ${user.name}`}
                className="size-full object-cover"
                onError={() => {
                  if (!avatarPreview) {
                    setAvatarUrl(null)
                    setAvatarError(
                      'Não foi possível carregar a foto. Tente atualizar a página.',
                    )
                  }
                }}
              />
            ) : (
              <span className="text-3xl font-semibold">
                {user.name.trim().charAt(0).toUpperCase() || (
                  <UserRound size={32} aria-hidden="true" />
                )}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium transition hover:bg-slate-800">
                <Camera size={16} aria-hidden="true" />
                Escolher imagem
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={isSavingAvatar || isRemovingAvatar}
                  onChange={(event) => {
                    handleAvatarSelection(event.target.files?.[0])
                    event.currentTarget.value = ''
                  }}
                />
              </label>

              {selectedAvatar && (
                <button
                  type="button"
                  onClick={() => void handleAvatarUpload()}
                  disabled={isSavingAvatar || isRemovingAvatar}
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingAvatar ? 'Enviando...' : 'Salvar foto'}
                </button>
              )}

              {(avatarUrl || selectedAvatar) && (
                <button
                  type="button"
                  onClick={() => void handleAvatarRemoval()}
                  disabled={isSavingAvatar || isRemovingAvatar}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-red-800 hover:bg-red-950/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={16} aria-hidden="true" />
                  {isRemovingAvatar
                    ? 'Removendo...'
                    : selectedAvatar
                      ? 'Cancelar seleção'
                      : 'Remover foto'}
                </button>
              )}
            </div>

            {selectedAvatar && (
              <p className="text-xs text-slate-400">
                Imagem selecionada: {selectedAvatar.name}
              </p>
            )}

            {isLoadingAvatar && (
              <p className="text-xs text-slate-500">
                Carregando foto atual...
              </p>
            )}
          </div>
        </div>

        {avatarError && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {avatarError}
          </p>
        )}

        {avatarSuccess && (
          <p role="status" className="mt-4 text-sm text-emerald-400">
            {avatarSuccess}
          </p>
        )}
      </section>

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
            <p className="mt-1 break-words text-sm text-slate-100">
              {user.name}
            </p>
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