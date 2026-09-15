import { useLocation } from 'react-router';
import AppLayout from '../../components/Layout';
import type { SuperAdminProps } from '../../types/super.type';
import SuperAuditLog from './super-audit-log';
import SuperInfo from './super-info';
import { SuperAdminHome } from './components/super-admin-home';
import SuperStatistics from './super-statistics';
import { useSuperAdminController } from '../../hooks/use-super-admin-controller';

function SuperAdmin({ onLogout }: SuperAdminProps) {
  const location = useLocation();
  const controller = useSuperAdminController(onLogout);

  const isStatisticsPage = location.pathname.startsWith('/admin/statistics');
  const isAuditLogPage = location.pathname.startsWith('/admin/audit-log');
  const isInfoPage = location.pathname.startsWith('/admin/info');

  return (
    <AppLayout
      role="super-admin"
      onLogout={controller.handleLogout}
      titleSuffix="Super Admin"
      userName="Super Admin"
      avatarText="S"
    >
      {isStatisticsPage ? (
        <SuperStatistics controller={controller} />
      ) : isAuditLogPage ? (
        <SuperAuditLog />
      ) : isInfoPage ? (
        <SuperInfo />
      ) : (
        <SuperAdminHome controller={controller} />
      )}
    </AppLayout>
  );
}

export default SuperAdmin;
