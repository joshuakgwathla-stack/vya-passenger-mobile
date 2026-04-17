import React, { createContext, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { authApi } from './api'

interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  profile_picture?: string
  role: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken')
      if (token) {
        const { data } = await authApi.me()
        setUser(data.data)
      }
    } catch {
      await SecureStore.deleteItemAsync('accessToken')
      await SecureStore.deleteItemAsync('refreshToken')
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password)
    await SecureStore.setItemAsync('accessToken', data.data.accessToken)
    await SecureStore.setItemAsync('refreshToken', data.data.refreshToken)
    setUser(data.data.user)
  }

  const register = async (formData: any) => {
    const { data } = await authApi.register(formData)
    await SecureStore.setItemAsync('accessToken', data.data.accessToken)
    await SecureStore.setItemAsync('refreshToken', data.data.refreshToken)
    setUser(data.data.user)
  }

  const logout = async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken')
      if (refreshToken) await authApi.logout(refreshToken)
    } catch {}
    await SecureStore.deleteItemAsync('accessToken')
    await SecureStore.deleteItemAsync('refreshToken')
    setUser(null)
  }

  const refresh = async () => {
    const { data } = await authApi.me()
    setUser(data.data)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
