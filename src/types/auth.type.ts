export interface LoginFormValues {
  email: string;
  password: string;
  companyVoen?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  email?: string;
  companyVoen?: string;
}

export interface ChangePasswordResponse {
  success?: boolean;
  message?: string;
}

export type UserRole = 'super-admin' | 'company-admin' | 'employee';

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  role: UserRole | string;
  companyId?: string;
  companyVoen?: string;
  userId?: string;
  accountInfo?: Record<string, unknown> | null;
  mustChangePassword?: boolean;
  firstLogin?: boolean;
  isFirstLogin?: boolean;
}


export interface ApiErrorResponse {
  message?: string;
  statusCode?: number;
  error?: string;
}

export interface LoginProps {
  onLoginSuccess: () => void;
}
