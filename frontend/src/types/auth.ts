export interface AuthUser {
  id: number
  name: string
  email: string
  role: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: AuthUser
}