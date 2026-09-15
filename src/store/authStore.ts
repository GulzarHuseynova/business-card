import { useSyncExternalStore } from 'react';
import { authReducer, getInitialAuthState, normalizeRole } from './authSlice';
import type { AuthAction, AuthState } from '../types/auth-store.type';

export type { AuthAction, AuthState, UserRole } from '../types/auth-store.type';

let state: AuthState = getInitialAuthState();
const listeners = new Set<() => void>();

export const authStore = {
  getState: () => state,

  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  dispatch: (action: AuthAction) => {
    state = authReducer(state, action);
    listeners.forEach((listener) => listener());
  },
};

export const authActions = {
  setSession: (payload: Partial<AuthState>) => authStore.dispatch({ type: 'SET_SESSION', payload }),
  setAccountInfo: (payload: Record<string, unknown> | null) => authStore.dispatch({ type: 'SET_ACCOUNT_INFO', payload }),
  logout: () => authStore.dispatch({ type: 'LOGOUT' }),
};

export function useAuthSelector<T>(selector: (state: AuthState) => T): T {
  return useSyncExternalStore(
    authStore.subscribe,
    () => selector(authStore.getState()),
    () => selector(authStore.getState()),
  );
}

export { normalizeRole };
