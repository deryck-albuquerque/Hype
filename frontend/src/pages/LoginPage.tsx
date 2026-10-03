import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { api } from '../lib/api'
import type { AuthResponse, AuthUser } from '../types/auth'
import { RequestsPage } from './RequestsPage'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(() =>
    Boolean(localStorage.getItem('hype_access_token')),
  )
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadSession() {
      const token = localStorage.getItem('hype_access_token')

      if (!token) {
        setIsCheckingSession(false)
        return
      }

      try {
        const response = await api.get<AuthUser>('/auth/me')

        if (isMounted) {
          setUser(response.data)
        }
      } catch {
        localStorage.removeItem('hype_access_token')
      } finally {
        if (isMounted) {
          setIsCheckingSession(false)
        }
      }
    }

    void loadSession()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await api.post<AuthResponse>('/auth/login', {
        email,
        password,
      })

      localStorage.setItem('hype_access_token', response.data.access_token)
      setUser(response.data.user)
    } catch {
      setError('Não foi possível fazer login. Confira seu e-mail e sua senha.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('hype_access_token')
    setUser(null)
    setPassword('')
    setError('')
    setShowLogin(false)
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Verificando sessão...
      </main>
    )
  }

  if (user) {
    return <RequestsPage user={user} onLogout={handleLogout} />
  }

  if (!showLogin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-slate-100">
        <section className="w-full max-w-2xl">
          <header className="mb-16 text-center">
            <p className="text-xl font-bold uppercase tracking-[0.2em] text-cyan-400">
              Hype
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Triagem De Solicitações
            </p>
          </header>

          <div className="text-center">
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
              Acompanhe o trabalho em um só lugar
            </h1>

            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-400 sm:text-base">
              Organize solicitações, acompanhe as etapas e consulte o histórico
              de cada tarefa.
            </p>

            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Fazer login
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <header className="mb-8">
          <p className="mb-2 text-lg font-bold uppercase tracking-[0.2em] text-cyan-400">
            Hype
          </p>

          <h1 className="text-2xl font-bold">Login</h1>
          <p className="mt-2 text-sm text-slate-400">
            Acesse sua conta para continuar.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              placeholder="voce@empresa.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
            >
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              placeholder="Sua senha"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setError('')
            setShowLogin(false)
          }}
          className="mt-5 w-full text-sm text-slate-400 transition hover:text-cyan-300"
        >
          Voltar
        </button>
      </section>
    </main>
  )
}