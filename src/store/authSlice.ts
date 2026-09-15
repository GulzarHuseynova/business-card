import { authSessionStorage } from '../storage/auth-session.storage';
import type { AuthAction, AuthState } from '../types/auth-store.type';
import { normalizeRole } from '../utils/api.utils';
import { persistAuthSession, readAuthStateFromStorage } from '../storage/auth.storage';

const getString = (value: unknown) => (typeof value === 'string' ? value : '');

export const emptyAuthState: AuthState = {
  isAuthenticated: false,
  accessToken: '',
  refreshToken: '',
  role: '',
  companyId: '',
  companyVoen: '',
  userId: '',
  accountInfo: null,
};

export const getInitialAuthState = (): AuthState => readAuthStateFromStorage();

const persistAuthState = (next: AuthState) => {
  persistAuthSession(next);
};

export const authReducer = (current: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_SESSION': {
      const next: AuthState = {
        ...current,
        ...action.payload,
        isAuthenticated: Boolean(action.payload.accessToken ?? current.accessToken),
        role: normalizeRole(action.payload.role ?? current.role),
        accessToken: getString(action.payload.accessToken ?? current.accessToken),
        refreshToken: getString(action.payload.refreshToken ?? current.refreshToken),
        companyId: getString(action.payload.companyId ?? current.companyId),
        companyVoen: getString(action.payload.companyVoen ?? current.companyVoen),
        userId: getString(action.payload.userId ?? current.userId),
        accountInfo: action.payload.accountInfo === undefined ? current.accountInfo : action.payload.accountInfo,
      };

      persistAuthState(next);
      return next;
    }

    case 'SET_ACCOUNT_INFO': {
      const next: AuthState = { ...current, accountInfo: action.payload };
      persistAuthState(next);
      return next;
    }

    case 'LOGOUT': {
      authSessionStorage.clear();
      return emptyAuthState;
    }

    default:
      return current;
  }
};

export const authSlice = {
  name: 'auth',
  getInitialState: getInitialAuthState,
  reducer: authReducer,
};

export { normalizeRole };
