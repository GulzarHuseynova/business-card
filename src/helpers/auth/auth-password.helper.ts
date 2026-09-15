import { authService } from '../../services/auth.service';
import { getStoredToken, getStoredUser } from '../../storage/auth.storage';
import { updateLocalCompanyAdminPassword } from '../../storage/local-auth/company-admin-local-auth';
import { findLocalEmployeeAccount, findLocalEmployeeById, updateLocalEmployeePassword, type LocalEmployeeAccount } from '../../storage/local-auth/employee-local-auth';
import { extractCompanyVoen, findStringDeep, normalizeRole } from '../../utils/api.utils';
import type { ChangePasswordRequest, ChangePasswordResponse } from '../../types/auth.type';
import { getStoredLoginEmail, markEmployeePasswordChangeCompleted, markStoredPasswordChanged } from '../../features/auth/auth-login.helpers';

export const changePassword = async (payload: ChangePasswordRequest): Promise<ChangePasswordResponse> => {
  const storedUser = getStoredUser();
  const email = payload.email?.trim() || getStoredLoginEmail();
  const userId = storedUser?.userId || storedUser?.id || email;
  const voen = payload.companyVoen?.trim() || storedUser?.companyVoen || extractCompanyVoen(storedUser?.accountInfo) || '';
  const currentPassword = payload.currentPassword.trim();
  const newPassword = payload.newPassword.trim();
  const confirmPassword = payload.confirmPassword.trim();
  const role = normalizeRole(storedUser?.role || findStringDeep(storedUser?.accountInfo, ['role', 'roleName', 'userRole']));

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new Error('Köhnə şifrə, yeni şifrə və təkrar şifrə mütləqdir.');
  }

  if (newPassword !== confirmPassword) {
    throw new Error('Yeni şifrə və təkrar şifrə eyni olmalıdır.');
  }

  const updateCompanyAdminPassword = () => updateLocalCompanyAdminPassword(email, voen, newPassword);
  const findEmployeeForPasswordChange = () => {
    const byCredentials = findLocalEmployeeAccount(email, currentPassword, voen);
    if (byCredentials) return byCredentials;

    const byId = userId ? findLocalEmployeeById(userId) : null;
    const byEmail = email ? findLocalEmployeeById(email) : null;
    const employee = byId || byEmail;

    if (!employee) return null;

    const samePassword = employee.password === currentPassword;
    const sameVoen = !voen || employee.voen === voen;
    return samePassword && sameVoen ? employee : null;
  };

  const updateEmployeePassword = (employee?: LocalEmployeeAccount | null) => {
    const targetId = employee?.id || userId || email;
    const targetVoen = employee?.voen || voen;

    return (
      updateLocalEmployeePassword(targetId, targetVoen, newPassword) ||
      updateLocalEmployeePassword(email, targetVoen, newPassword) ||
      updateLocalEmployeePassword(email, voen, newPassword)
    );
  };
  const persistEmployeePasswordCompletion = () => {
    if (role === 'employee') markEmployeePasswordChangeCompleted(email, voen, userId);
  };
  const accessToken = getStoredToken();

  if (accessToken.startsWith('local-company-admin-')) {
    const changed = updateCompanyAdminPassword();
    if (!changed) throw new Error('Lokal Company Admin hesabı tapılmadı.');
    markStoredPasswordChanged();
    return { success: true, message: 'Şifrə yeniləndi.' };
  }

  if (accessToken.startsWith('local-employee-')) {
    const employee = findEmployeeForPasswordChange();
    if (!employee) throw new Error('Köhnə kod/şifrə yanlışdır.');

    const changed = updateEmployeePassword(employee);
    if (!changed) throw new Error('Lokal Employee hesabı tapılmadı.');
    persistEmployeePasswordCompletion();
    markStoredPasswordChanged();
    return { success: true, message: 'Şifrə yeniləndi.' };
  }

  const response = await authService.changePassword({
    ...payload,
    currentPassword,
    newPassword,
    confirmPassword,
  });

  if (role === 'employee') updateEmployeePassword(findEmployeeForPasswordChange());
  if (role === 'company-admin') updateCompanyAdminPassword();
  persistEmployeePasswordCompletion();
  markStoredPasswordChanged();
  return response.data || { success: true };
};
