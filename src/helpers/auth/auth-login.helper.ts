import { authService } from '../../services/auth.service';
import { cleanupLegacyAuthStorage, patchStoredUser } from '../../storage/auth.storage';
import { findLocalCompanyAdminAccount } from '../../storage/local-auth/company-admin-local-auth';
import { applyLocalEmployeeOverrideToAccount, findLocalEmployeeOverride, localEmployeeAccountInfo, readLocalEmployeeAccounts, saveLocalEmployeeAccount } from '../../storage/local-auth/employee-local-auth';
import {extractAccessToken,extractCompanyId,extractCompanyVoen,extractRefreshToken,extractRole,extractUserId,parseJwt,} from '../../utils/api.utils';
import type { LoginFormValues, LoginResponse } from '../../types/auth.type';
import {buildBackendEmployeeFallback,buildCompanyAdminAccountInfo,buildLoginPayload,clearStaleBackendSession,findCachedBackendLogin,hasEmployeeCompletedPasswordChange,hasEmployeePasswordChangeRequired,isAuthCredentialError,isCompanyAdminPasswordChanged,isNetworkOrTimeoutError,looksLikeEmployeeAccount,mergeEmployeeAccountInfo,readFirstLoginFlag,readRawRole,saveBackendLoginCache,tryLocalCompanyAdminLogin,withCompanyAdminFirstLoginFlags,} from '../../features/auth/auth-login.helpers';

export const login = async (payload: LoginFormValues): Promise<LoginResponse> => {
  const enteredVoen = payload.companyVoen?.trim() || '';
  let loginData: Record<string, unknown>;

  try {
    clearStaleBackendSession();
    const response = await authService.login(buildLoginPayload(payload));
    loginData = response.data;
  } catch (error) {
    if (isNetworkOrTimeoutError(error)) {
      const localCompanyAdminLogin = tryLocalCompanyAdminLogin(payload, enteredVoen);
      if (localCompanyAdminLogin) return localCompanyAdminLogin;

      const cachedBackendLogin = findCachedBackendLogin();
      if (cachedBackendLogin) return cachedBackendLogin;
    }

    if (isAuthCredentialError(error)) {
      const localCompanyAdminLogin = tryLocalCompanyAdminLogin(payload, enteredVoen);
      if (localCompanyAdminLogin) return localCompanyAdminLogin;

      throw new Error('E-poçt, kod və ya VÖEN yanlışdır.', { cause: error });
    }

    throw error;
  }

  const accessToken = extractAccessToken(loginData);
  const refreshToken = extractRefreshToken(loginData);

  if (!accessToken) {
    throw new Error('Login cavabında accessToken tapılmadı.');
  }

  localStorage.setItem('token', accessToken);
  cleanupLegacyAuthStorage();
  if (refreshToken) {
    // refreshToken cavabda qala bilər, amma localStorage/sessionStorage-ə yazılmır.
  }

  let accountInfo: Record<string, unknown> | null = null;
  try {
    const accountResponse = await authService.getAccountInfo();
    accountInfo = accountResponse.data;
  } catch {
    // Account info is optional; token data is enough for routing.
  }

  const decoded = parseJwt(accessToken);
  const backendRole = extractRole(accountInfo, loginData, decoded);
  const rawRole = readRawRole(accountInfo, loginData, decoded);
  const companyVoen = enteredVoen || extractCompanyVoen(accountInfo, loginData, decoded);
  const localCompanyAdminAfterApi = findLocalCompanyAdminAccount(payload.email, payload.password, companyVoen);

  let companyId = extractCompanyId(accountInfo, loginData, decoded);

  let userId = extractUserId(accountInfo, loginData, decoded);

  const blockedEmployeeOverride = findLocalEmployeeOverride({
    id: userId,
    email: payload.email,
    companyId,
    companyVoen,
  });

  if (companyVoen && blockedEmployeeOverride?.isActive === false) {
    throw new Error('Bu əməkdaş deaktiv edilib.');
  }

  let role = backendRole;

  if (companyVoen) {
    if (localCompanyAdminAfterApi) {
      role = 'company-admin';
      companyId = companyId || localCompanyAdminAfterApi.companyId;
      userId = userId || localCompanyAdminAfterApi.gmail;
      accountInfo = {
        ...buildCompanyAdminAccountInfo(localCompanyAdminAfterApi, readFirstLoginFlag(accountInfo, loginData, decoded) ?? true),
        ...(accountInfo || {}),
        role: 'company-admin',
        companyId,
        companyVoen,
        voen: companyVoen,
        userId,
        id: userId,
      };
    } else if (backendRole === 'company-admin') {
      role = 'company-admin';
    } else if (backendRole === 'employee' || !backendRole || backendRole === 'super-admin' || looksLikeEmployeeAccount(accountInfo, loginData, decoded)) {
      const employeeFallback = applyLocalEmployeeOverrideToAccount(buildBackendEmployeeFallback(
        payload.email,
        payload.password,
        companyId,
        companyVoen,
        accountInfo,
        loginData,
        decoded
      ));
      if (employeeFallback.isActive === false) throw new Error('Bu əməkdaş deaktiv edilib.');
      saveLocalEmployeeAccount(employeeFallback);

      role = 'employee';
      companyId = companyId || employeeFallback.companyId;
      userId = userId || employeeFallback.id;

      const employeeAccountInfo = localEmployeeAccountInfo(employeeFallback);
      accountInfo = {
        ...mergeEmployeeAccountInfo(employeeAccountInfo, accountInfo),
        role: 'employee',
        companyId: companyId || employeeFallback.companyId,
        companyVoen: companyVoen || employeeFallback.voen,
        voen: companyVoen || employeeFallback.voen,
        userId: userId || employeeFallback.id,
        id: userId || employeeFallback.id,
        employeeId: userId || employeeFallback.id,
      };
    }
  } else if (!role) {
    const rawText = String(rawRole || '').trim().toLowerCase();
    role = rawText === 'admin' ? 'super-admin' : 'super-admin';
  }

  if (companyVoen && (!role || role === 'super-admin')) {
    throw new Error('Bu VÖEN üçün CompanyAdmin və ya Employee hesabı tapılmadı.');
  }

  const canRequirePasswordChange = role === 'company-admin' || role === 'employee';
  const backendFirstLoginFlag = canRequirePasswordChange
    ? readFirstLoginFlag(accountInfo, loginData, decoded)
    : undefined;

  const storedEmployeeForPassword = role === 'employee'
    ? (
        readLocalEmployeeAccounts().find((employee) => {
          const sameId = userId && employee.id === userId;
          const sameEmail = employee.email.trim().toLowerCase() === payload.email.trim().toLowerCase();
          const sameCompany = !companyVoen || employee.voen === companyVoen || employee.companyId === companyId;
          return (sameId || sameEmail) && sameCompany;
        }) || null
      )
    : null;

  const employeeStoredFirstLogin = storedEmployeeForPassword
    ? (storedEmployeeForPassword.mustChangePassword ?? storedEmployeeForPassword.isFirstLogin ?? storedEmployeeForPassword.firstLogin ?? true)
    : undefined;
  const employeePasswordChangeCompleted = role === 'employee' && hasEmployeeCompletedPasswordChange(
    payload.email,
    companyVoen,
    userId,
  );
  const employeePasswordChangeRequired = role === 'employee' && hasEmployeePasswordChangeRequired(
    payload.email,
    companyVoen,
    userId,
  );

  const mustChangePassword = role === 'company-admin'
    ? (backendFirstLoginFlag ?? !isCompanyAdminPasswordChanged())
    : role === 'employee'
      ? (
          employeePasswordChangeCompleted || employeeStoredFirstLogin === false
            ? false
            : employeePasswordChangeRequired || employeeStoredFirstLogin === true
              ? true
              : backendFirstLoginFlag ?? true
        )
      : false;

  if (canRequirePasswordChange) {
    patchStoredUser({
      email: payload.email.trim().toLowerCase(),
      mustChangePassword,
      firstLogin: mustChangePassword,
      isFirstLogin: mustChangePassword,
      forcePasswordChange: mustChangePassword,
    });
  }

  const companyAdminFallbackInfo = localCompanyAdminAfterApi
    ? buildCompanyAdminAccountInfo(localCompanyAdminAfterApi, mustChangePassword)
    : {};

  const withFirstLoginFlags = (info: Record<string, unknown>) => ({
    ...info,
    mustChangePassword,
    firstLogin: mustChangePassword,
    isFirstLogin: mustChangePassword,
    forcePasswordChange: mustChangePassword,
  });

  const finalAccountInfo = accountInfo
    ? (
        role === 'company-admin'
          ? withCompanyAdminFirstLoginFlags({ ...companyAdminFallbackInfo, ...accountInfo }, mustChangePassword)
          : role === 'employee'
            ? withFirstLoginFlags(accountInfo)
            : accountInfo
      )
    : (
        role === 'company-admin'
          ? withCompanyAdminFirstLoginFlags(companyAdminFallbackInfo, mustChangePassword)
          : role === 'employee'
            ? withFirstLoginFlags({})
            : accountInfo
      );

  const finalResponse: LoginResponse = {
    accessToken,
    refreshToken,
    role,
    companyId,
    companyVoen,
    userId,
    accountInfo: finalAccountInfo,
    mustChangePassword,
    firstLogin: mustChangePassword,
    isFirstLogin: mustChangePassword,
  };

  saveBackendLoginCache();
  return finalResponse;
};
