import type { NormalizedRole } from './common.type';

export type UserRole = NormalizedRole;

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string;
  refreshToken: string;
  role: UserRole;
  companyId: string;
  companyVoen: string;
  userId: string;
  accountInfo: Record<string, unknown> | null;
}

export type AuthAction =
  | { type: 'SET_SESSION'; payload: Partial<AuthState> }
  | { type: 'SET_ACCOUNT_INFO'; payload: Record<string, unknown> | null }
  | { type: 'LOGOUT' };
