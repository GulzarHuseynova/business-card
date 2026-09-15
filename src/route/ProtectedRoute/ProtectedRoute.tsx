import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router';
import { authSessionStorage } from '../../storage/auth-session.storage';
import { useAuthSelector } from '../../store/authStore';
import { getStoredToken, readAuthStateFromStorage } from '../../storage/auth.storage';
import type { ProtectedRouteProps } from '../../types/route.type';

export default function ProtectedRoute({ children, onUnauthorized }: ProtectedRouteProps) {
  const storeRole = useAuthSelector((state) => state.role);
  const accessToken = useAuthSelector((state) => state.accessToken) || getStoredToken();
  const role = storeRole || readAuthStateFromStorage().role;
  const isAuthorized = Boolean(accessToken && role);

  useEffect(() => {
    if (!isAuthorized) {
      authSessionStorage.clear();
      onUnauthorized?.();
    }
  }, [isAuthorized, onUnauthorized]);

  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  return children || <Outlet />;
}
