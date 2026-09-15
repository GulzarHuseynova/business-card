import SuperAdmin from '../../pages/super-admin/super-admin';
import CompanyAdmin from '../../pages/company-admin/company-admin';
import Employee from '../../pages/employee/employee';
import type { PrivateRouteConfig } from '../../types/route.type';
import type { UserRole } from '../../types/auth.type';

export const roleHome: Record<UserRole, string> = {
  'super-admin': '/admin/statistics',
  'company-admin': '/company-admin/company',
  employee: '/employee/business-card',
};

export const privateRoutes: PrivateRouteConfig[] = [
  {
    key: 'super-admin',
    path: '/admin/*',
    roles: ['super-admin'],
    element: <SuperAdmin />,
  },
  {
    key: 'company-admin',
    path: '/company-admin/*',
    roles: ['company-admin'],
    element: <CompanyAdmin />,
  },
  {
    key: 'employee',
    path: '/employee/*',
    roles: ['employee'],
    element: <Employee />,
  },
];
