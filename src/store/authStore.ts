import { create } from 'zustand'

export interface Account {
  uuid: string
  username: string
  type: 'microsoft' | 'offline'
  accessToken?: string
  avatar?: string
}

interface AuthState {
  accounts: Account[]
  currentAccount: Account | null
  setCurrentAccount: (account: Account | null) => void
  loadAccounts: () => Promise<void>
  addAccount: (account: Account) => void
  removeAccount: (uuid: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accounts: [],
  currentAccount: null,

  setCurrentAccount: (account) => set({ currentAccount: account }),

  loadAccounts: async () => {
    try {
      const accounts = await window.electronAPI.getAccounts()
      const current = get().currentAccount
      set({
        accounts,
        currentAccount: current
          ? accounts.find(a => a.uuid === current.uuid) ?? accounts[0] ?? null
          : accounts[0] ?? null
      })
    } catch {
      set({ accounts: [], currentAccount: null })
    }
  },

  addAccount: (account) => {
    set(s => ({
      accounts: [...s.accounts.filter(a => a.uuid !== account.uuid), account],
      currentAccount: account
    }))
  },

  removeAccount: async (uuid) => {
    await window.electronAPI.logout(uuid)
    set(s => {
      const accounts = s.accounts.filter(a => a.uuid !== uuid)
      return {
        accounts,
        currentAccount: s.currentAccount?.uuid === uuid ? accounts[0] ?? null : s.currentAccount
      }
    })
  }
}))
