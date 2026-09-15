import type { ReactElement, ReactNode } from 'react';
import type { UserRole } from './auth.type';

export interface PrivateRouteProps {
  onLogout?: () => void;
}

export interface PublicRouteProps {
  onLoginSuccess: () => void;
}

export interface ProtectedRouteProps {
  children?: ReactNode;
  onUnauthorized?: () => void;
}

export interface PrivateRouteChildConfig {
  key: string;
  path?: string;
  index?: boolean;
  element: ReactElement;
}

export interface PrivateRouteConfig {
  key: string;
  path: string;
  roles: UserRole[];
  element: ReactElement<{ onLogout?: () => void }>;
  children?: PrivateRouteChildConfig[];
}
