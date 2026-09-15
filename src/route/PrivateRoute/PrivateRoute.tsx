import { cloneElement, useCallback, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import PublicCard from '../../pages/public/public-card';
import { authSessionStorage } from '../../storage/auth-session.storage';
import { useAuthSelector } from '../../store/authStore';
import { isLocalCompanyAdminToken, isLocalEmployeeToken, readAuthStateFromStorage } from '../../storage/auth.storage';
import type { NormalizedRole } from '../../types/common.type';
import type { PrivateRouteProps } from '../../types/route.type';
import ProtectedRoute from '../ProtectedRoute/ProtectedRoute';
import { privateRoutes, roleHome } from './PrivateRoutes';

const getActiveRole = (storeRole: NormalizedRole): NormalizedRole => {
  if (isLocalEmployeeToken()) return 'employee';
  if (isLocalCompanyAdminToken()) return 'company-admin';

  return storeRole || readAuthStateFromStorage().role;
};

export default function PrivateRoute({ onLogout }: PrivateRouteProps) {
  const storeRole = useAuthSelector((state) => state.role);
  const role = getActiveRole(storeRole);

  const handleLogout = useCallback(() => {
    authSessionStorage.clear();
    onLogout?.();
  }, [onLogout]);

  useEffect(() => {
    if (!role) {
      handleLogout();
    }
  }, [handleLogout, role]);

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/card/:cardId" element={<PublicCard />} />
      <Route path="/v/:cardId" element={<PublicCard />} />

      <Route element={<ProtectedRoute onUnauthorized={handleLogout} />}>
        <Route path="/" element={<Navigate to={roleHome[role]} replace />} />
        <Route path="/login" element={<Navigate to={roleHome[role]} replace />} />

        {privateRoutes
          .filter((route) => route.roles.includes(role))
          .map((route) => (
            <Route
              key={route.key}
              path={route.path}
              element={cloneElement(route.element, { onLogout: handleLogout })}
            />
          ))}

        {role === 'super-admin' && (
          <Route path="/super-admin/*" element={<Navigate to="/admin/statistics" replace />} />
        )}

        <Route path="*" element={<Navigate to={roleHome[role]} replace />} />
      </Route>
    </Routes>
  );
}
