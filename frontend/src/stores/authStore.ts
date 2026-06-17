import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  employee_id: string
  name: string
  email: string | null
  role: string
  is_active: boolean
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  setAuth: (token: string, refreshToken: string, user: User) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, refreshToken, user) =>
        set({ token, refreshToken, user }),
      logout: () => set({ token: null, refreshToken: null, user: null }),
      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),
    }),
    { name: 'intelliserve-auth' },
  ),
)
