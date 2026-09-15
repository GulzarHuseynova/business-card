import { runtimeStorage } from '../../storage/runtime.storage';
import axios from 'axios';
import { cleanupLegacyAuthStorage, getStoredUser, patchStoredUser, replaceStoredAuthSession } from '../../storage/auth.storage';
import type { LoginFormValues, LoginResponse } from '../../types/auth.type';
import { findLocalCompanyAdminAccount, type LocalCompanyAdminAccount } from '../../storage/local-auth/company-admin-local-auth';
import { readLocalEmployeeAccounts, type LocalEmployeeAccount } from '../../storage/local-auth/employee-local-auth';
import {asBoolean,asNumber,asString,findDeep,findStringDeep,isRecord,normalizeArray,normalizeRole,} from '../../utils/api.utils';

export const BACKEND_LOGIN_CACHE_KEY = 'backendLoginCache';
export const EMPLOYEE_PASSWORD_CHANGED_PREFIX = 'employee-password-changed:';
export const EMPLOYEE_PASSWORD_REQUIRED_PREFIX = 'employee-password-required:';

const getEmployeePasswordStateKeys = (prefix: string, email: string, voen: string, userId = '') => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUserId = userId.trim().toLowerCase();
  const company = voen.trim() || 'no-voen';
  const keys = new Set<string>();

  if (normalizedEmail) keys.add(`${prefix}${company}:${normalizedEmail}`);
  if (normalizedUserId) keys.add(`${prefix}${company}:${normalizedUserId}`);

  if (normalizedUserId) keys.add(`${prefix}user:${normalizedUserId}`);

  return Array.from(keys);
};

export const getEmployeePasswordChangedKey = (email: string, voen: string, userId = '') => {
  const identity = (email || userId).trim().toLowerCase();
  const company = voen.trim();
  return identity ? `${EMPLOYEE_PASSWORD_CHANGED_PREFIX}${company || 'no-voen'}:${identity}` : '';
};

const readEmployeePasswordState = (key: string) => {
  const runtimeValue = runtimeStorage.getItem(key);
  if (runtimeValue !== null) return runtimeValue;

  const legacyValue = localStorage.getItem(key);
  if (legacyValue !== null) {
    runtimeStorage.setItem(key, legacyValue);
    localStorage.removeItem(key);
  }

  return legacyValue;
};

const writeEmployeePasswordState = (key: string, value: string | null) => {
  if (value === null) runtimeStorage.removeItem(key);
  else runtimeStorage.setItem(key, value);

  localStorage.removeItem(key);
};

export const hasEmployeeCompletedPasswordChange = (email: string, voen: string, userId = '') => {
  return getEmployeePasswordStateKeys(EMPLOYEE_PASSWORD_CHANGED_PREFIX, email, voen, userId)
    .some((key) => readEmployeePasswordState(key) === 'true');
};

export const hasEmployeePasswordChangeRequired = (email: string, voen: string, userId = '') => {
  return getEmployeePasswordStateKeys(EMPLOYEE_PASSWORD_REQUIRED_PREFIX, email, voen, userId)
    .some((key) => readEmployeePasswordState(key) === 'true');
};

export const markEmployeePasswordChangeCompleted = (email: string, voen: string, userId = '') => {
  const completedKeys = getEmployeePasswordStateKeys(EMPLOYEE_PASSWORD_CHANGED_PREFIX, email, voen, userId);
  const requiredKeys = getEmployeePasswordStateKeys(EMPLOYEE_PASSWORD_REQUIRED_PREFIX, email, voen, userId);

  completedKeys.forEach((key) => writeEmployeePasswordState(key, 'true'));
  requiredKeys.forEach((key) => writeEmployeePasswordState(key, null));
};

export const markEmployeePasswordChangeRequired = (email: string, voen: string, userId = '') => {
  const completedKeys = getEmployeePasswordStateKeys(EMPLOYEE_PASSWORD_CHANGED_PREFIX, email, voen, userId);
  const requiredKeys = getEmployeePasswordStateKeys(EMPLOYEE_PASSWORD_REQUIRED_PREFIX, email, voen, userId);

  completedKeys.forEach((key) => writeEmployeePasswordState(key, null));
  requiredKeys.forEach((key) => writeEmployeePasswordState(key, 'true'));
};

export const clearBackendLoginCache = () => {
  runtimeStorage.removeItem(BACKEND_LOGIN_CACHE_KEY);
};

export const isNetworkOrTimeoutError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  if (error.response) return false;

  const code = error.code || '';
  const message = error.message || '';

  return (
    code === 'ECONNABORTED' ||
    code === 'ERR_NETWORK' ||
    /timeout|network|connection|timed out/i.test(message)
  );
};

export const isAuthCredentialError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === 400 || status === 401 || status === 403 || status === 404;
};

export const saveBackendLoginCache = () => {
  clearBackendLoginCache();
};

export const findCachedBackendLogin = (): LoginResponse | null => {
  clearBackendLoginCache();
  return null;
};

export const cleanPayload = (payload: Record<string, unknown>) => {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== ''));
};


export const isCompanyAdminPasswordChanged = () => {
  const user = getStoredUser();
  const accountInfo = user?.accountInfo || null;

  return Boolean(
    user?.mustChangePassword === false ||
      user?.firstLogin === false ||
      user?.isFirstLogin === false ||
      accountInfo?.mustChangePassword === false ||
      accountInfo?.firstLogin === false ||
      accountInfo?.isFirstLogin === false ||
      accountInfo?.forcePasswordChange === false
  );
};

export const getStoredLoginEmail = () => {
  const user = getStoredUser();
  const accountInfo = user?.accountInfo || null;

  return (
    user?.email ||
    findStringDeep(accountInfo, ['email', 'gmail', 'adminEmail', 'userEmail', 'mail', 'emailAddress']) ||
    user?.userId ||
    user?.id ||
    ''
  );
};

export const markStoredPasswordChanged = () => {
  const current = getStoredUser();
  const accountInfo = current?.accountInfo || {};

  patchStoredUser({
    ...current,
    mustChangePassword: false,
    firstLogin: false,
    isFirstLogin: false,
    forcePasswordChange: false,
    accountInfo: {
      ...accountInfo,
      mustChangePassword: false,
      firstLogin: false,
      isFirstLogin: false,
      forcePasswordChange: false,
    },
  });
};


export const readFirstLoginFlag = (...sources: unknown[]): boolean | undefined => {
  for (const source of sources) {
    const value = findDeep(source, [
      'isFirstLogin',
      'firstLogin',
      'mustChangePassword',
      'forcePasswordChange',
      'mustChangeCode',
    ]);

    if (value !== undefined && value !== null && value !== '') {
      return asBoolean(value, false);
    }
  }

  return undefined;
};

export const withCompanyAdminFirstLoginFlags = (
  accountInfo: Record<string, unknown>,
  mustChangePassword: boolean,
): Record<string, unknown> => ({
  ...accountInfo,
  mustChangePassword,
  firstLogin: mustChangePassword,
  isFirstLogin: mustChangePassword,
  forcePasswordChange: mustChangePassword,
});


export const getCompanyNameFromSources = (...sources: unknown[]) => {
  for (const source of sources) {
    const name = findStringDeep(source, ['companyName', 'name', 'title']);
    if (name) return name;
  }
  return 'Şirkət';
};

export const preferEmployeeText = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text && !['-', '--', 'null', 'undefined', 'n/a', 'na', 'yoxdur', 'yox'].includes(text.toLowerCase())) return text;
  }

  return '';
};

const preferEmployeePhoto = (...values: unknown[]) => {
  const photos = values.map((value) => preferEmployeeText(value)).filter(Boolean);
  return photos.find((value) => value.startsWith('data:image/')) || photos[0] || '';
};

export const pickSocialUrlFromRow = (row: Record<string, unknown>, wanted: string) => {
  const key = wanted.toLowerCase();
  const source = row.socialAccounts || row.socials || row.socialLinks || findDeep(row, ['socialAccounts', 'socials', 'socialLinks']);
  const account = normalizeArray<Record<string, unknown>>(source).find((item) => {
    const platform = findStringDeep(item, ['platform', 'platformName', 'socialPlatform', 'socialMedia', 'socialMediaName', 'type', 'name', 'label']).toLowerCase();
    const url = findStringDeep(item, ['url', 'link', 'value', 'href', 'profileUrl', 'accountUrl', 'socialUrl']).toLowerCase();
    return platform.includes(key) || url.includes(key);
  });

  return account ? findStringDeep(account, ['url', 'link', 'value', 'href', 'profileUrl', 'accountUrl', 'socialUrl']) : '';
};

export const hasBackendItems = (value: unknown) => normalizeArray(value).length > 0;

export const mergeEmployeeAccountInfo = (
  localInfo: Record<string, unknown>,
  backendInfo: Record<string, unknown> | null,
): Record<string, unknown> => {
  const backend = backendInfo || {};
  const rawCanEdit = findDeep(backend, ['canEdit', 'canEditProfile', 'canedit', 'canUpdate', 'editPermission', 'editable']);
  const localCanEdit = findDeep(localInfo, ['canEdit', 'canEditProfile', 'canedit', 'canUpdate', 'editPermission', 'editable']);
  const backendPermission = rawCanEdit === undefined || rawCanEdit === null || rawCanEdit === '' ? undefined : asBoolean(rawCanEdit, true);
  const localPermission = localCanEdit === undefined || localCanEdit === null || localCanEdit === '' ? undefined : asBoolean(localCanEdit, true);
  const canEdit = backendPermission === false || localPermission === false
    ? false
    : backendPermission ?? localPermission ?? true;

  return {
    ...localInfo,
    ...backend,
    id: preferEmployeeText(findStringDeep(backend, ['id', 'userId', 'employeeId', 'cardId']), localInfo.id, localInfo.userId),
    userId: preferEmployeeText(findStringDeep(backend, ['userId', 'id', 'employeeId', 'cardId']), localInfo.userId, localInfo.id),
    companyId: preferEmployeeText(findStringDeep(backend, ['companyId', 'companyID', 'company_id']), localInfo.companyId),
    companyVoen: preferEmployeeText(findStringDeep(backend, ['companyVoen', 'voen', 'taxId', 'taxNumber']), localInfo.companyVoen, localInfo.voen),
    voen: preferEmployeeText(findStringDeep(backend, ['voen', 'companyVoen', 'taxId', 'taxNumber']), localInfo.voen, localInfo.companyVoen),
    companyName: preferEmployeeText(findStringDeep(backend, ['companyName']), localInfo.companyName),
    firstName: preferEmployeeText(findStringDeep(backend, ['firstName', 'givenName']), localInfo.firstName),
    lastName: preferEmployeeText(findStringDeep(backend, ['lastName', 'surname']), localInfo.lastName),
    middleName: preferEmployeeText(findStringDeep(backend, ['middleName', 'fatherName']), localInfo.middleName),
    jobTitle: preferEmployeeText(findStringDeep(backend, ['jobTitle', 'position', 'title', 'roleName']), localInfo.jobTitle, localInfo.position),
    position: preferEmployeeText(findStringDeep(backend, ['position', 'jobTitle', 'title']), localInfo.position, localInfo.jobTitle),
    email: preferEmployeeText(findStringDeep(backend, ['email', 'email1', 'gmail', 'mail', 'emailAddress']), localInfo.email, localInfo.gmail),
    phone1: preferEmployeeText(findStringDeep(backend, ['phone1', 'phone', 'phoneNumber', 'mobile']), localInfo.phone1),
    phone2: preferEmployeeText(findStringDeep(backend, ['phone2', 'secondaryPhone']), localInfo.phone2),
    whatsapp: preferEmployeeText(findStringDeep(backend, ['whatsapp', 'whatsappPhone', 'whatsAppPhone']), localInfo.whatsapp),
    whatsappPhone: preferEmployeeText(findStringDeep(backend, ['whatsappPhone', 'whatsapp', 'whatsAppPhone']), localInfo.whatsappPhone, localInfo.whatsapp),
    extensionNumber: preferEmployeeText(findStringDeep(backend, ['extensionNumber', 'internalNumber', 'extension']), localInfo.extensionNumber),
    internalNumber: preferEmployeeText(findStringDeep(backend, ['internalNumber', 'extensionNumber', 'extension']), localInfo.internalNumber, localInfo.extensionNumber),
    linkedin: preferEmployeeText(findStringDeep(backend, ['linkedin', 'linkedInUrl', 'linkedinUrl', 'linkedInProfile']), pickSocialUrlFromRow(backend, 'linkedin'), localInfo.linkedin),
    linkedInUrl: preferEmployeeText(findStringDeep(backend, ['linkedInUrl', 'linkedinUrl', 'linkedin', 'linkedInProfile']), pickSocialUrlFromRow(backend, 'linkedin'), localInfo.linkedInUrl, localInfo.linkedin),
    linkedinUrl: preferEmployeeText(findStringDeep(backend, ['linkedinUrl', 'linkedInUrl', 'linkedin', 'linkedInProfile']), pickSocialUrlFromRow(backend, 'linkedin'), localInfo.linkedinUrl, localInfo.linkedin),
    facebook: preferEmployeeText(findStringDeep(backend, ['facebook', 'facebookUrl', 'fbUrl']), pickSocialUrlFromRow(backend, 'facebook'), localInfo.facebook),
    facebookUrl: preferEmployeeText(findStringDeep(backend, ['facebookUrl', 'facebook', 'fbUrl']), pickSocialUrlFromRow(backend, 'facebook'), localInfo.facebookUrl, localInfo.facebook),
    instagram: preferEmployeeText(findStringDeep(backend, ['instagram', 'instagramUrl', 'instaUrl']), pickSocialUrlFromRow(backend, 'instagram'), localInfo.instagram),
    instagramUrl: preferEmployeeText(findStringDeep(backend, ['instagramUrl', 'instagram', 'instaUrl']), pickSocialUrlFromRow(backend, 'instagram'), localInfo.instagramUrl, localInfo.instagram),
    socialAccounts: hasBackendItems(backend.socialAccounts) ? backend.socialAccounts : localInfo.socialAccounts,
    socials: hasBackendItems(backend.socials) ? backend.socials : localInfo.socials,
    photo: preferEmployeePhoto(localInfo.photoUrl, localInfo.photo, findStringDeep(backend, ['photoUrl', 'photo', 'avatarUrl', 'avatar', 'profilePhotoUrl'])),
    photoUrl: preferEmployeePhoto(localInfo.photoUrl, localInfo.photo, findStringDeep(backend, ['photoUrl', 'photo', 'avatarUrl', 'avatar', 'profilePhotoUrl'])),
    cardBackground: preferEmployeeText(findStringDeep(backend, ['cardBackground', 'cardBackgroundUrl', 'backgroundUrl', 'backgroundImageUrl']), localInfo.cardBackground, localInfo.cardBackgroundUrl),
    cardBackgroundUrl: preferEmployeeText(findStringDeep(backend, ['cardBackgroundUrl', 'cardBackground', 'backgroundUrl', 'backgroundImageUrl']), localInfo.cardBackgroundUrl, localInfo.cardBackground),
    additionalInfo: preferEmployeeText(findStringDeep(backend, ['additionalInfo', 'description', 'bio', 'about']), localInfo.additionalInfo),
    dateOfBirth: preferEmployeeText(findStringDeep(backend, ['dateOfBirth', 'birthDate', 'birthday', 'dob']), localInfo.dateOfBirth),
    address: preferEmployeeText(findStringDeep(backend, ['address', 'homeAddress', 'residentialAddress', 'location']), localInfo.address),
    googleMapsUrl: preferEmployeeText(findStringDeep(backend, ['googleMapsUrl', 'mapsUrl', 'mapUrl', 'addressUrl']), localInfo.googleMapsUrl),
    canEdit,
    canEditProfile: canEdit,
    canUpdate: canEdit,
    editPermission: canEdit,
    editable: canEdit,
    role: 'employee',
  };
};

export const findExistingLocalEmployee = (email: string, id: string, voen: string, companyId: string) => {
  const cleanEmail = email.trim().toLowerCase();
  const cleanVoen = voen.trim();

  return readLocalEmployeeAccounts().find((employee) => {
    const sameId = id && employee.id === id;
    const sameEmail = cleanEmail && employee.email.trim().toLowerCase() === cleanEmail;
    const sameCompany =
      (!cleanVoen && !companyId) ||
      (cleanVoen && employee.voen === cleanVoen) ||
      (companyId && employee.companyId === companyId);

    return (sameId || sameEmail) && sameCompany;
  }) || null;
};

export const rowToLocalEmployeeAccount = (
  row: Record<string, unknown>,
  password: string,
  fallbackCompanyId: string,
  fallbackVoen: string,
  fallbackCompanyName: string,
): LocalEmployeeAccount => {
  const fullName = findStringDeep(row, ['fullName', 'name', 'userName']);
  const parts = fullName.split(' ').filter(Boolean);
  const email = findStringDeep(row, ['email', 'Email', 'gmail', 'Gmail', 'mail', 'Mail', 'emailAddress', 'EmailAddress', 'userEmail', 'UserEmail', 'workEmail', 'WorkEmail']);
  const companyId = findStringDeep(row, ['companyId', 'companyID', 'company_id']) || fallbackCompanyId;
  const idCandidates = [
    asString(row.userId),
    asString(row.employeeId),
    asString(row.cardId),
    asString(row.profileId),
    asString(row.id),
    findStringDeep(row, ['sub', 'nameidentifier', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']),
  ];
  const id = idCandidates.find((candidate) => candidate && candidate !== companyId) || email || crypto.randomUUID();
  const voen = findStringDeep(row, ['companyVoen', 'voen', 'taxId', 'taxNumber']) || fallbackVoen;
  const existing = findExistingLocalEmployee(email, id, voen, companyId);

  const rawIsActive = findDeep(row, ['isActive', 'active', 'enabled', 'status']);
  const rawCanEdit = findDeep(row, ['canEdit', 'canEditProfile', 'canedit', 'editPermission', 'editable']);
  const firstLoginFlag = readFirstLoginFlag(row);
  const mustChangePassword = firstLoginFlag ?? existing?.mustChangePassword ?? existing?.isFirstLogin ?? existing?.firstLogin ?? true;

  return {
    id: preferEmployeeText(id, existing?.id, email) || crypto.randomUUID(),
    companyId: preferEmployeeText(companyId, existing?.companyId, fallbackCompanyId),
    companyName: preferEmployeeText(findStringDeep(row, ['companyName']), existing?.companyName, fallbackCompanyName, 'Şirkət'),
    voen: preferEmployeeText(voen, existing?.voen, fallbackVoen),
    firstName: preferEmployeeText(findStringDeep(row, ['firstName']), existing?.firstName, parts[0]),
    lastName: preferEmployeeText(findStringDeep(row, ['lastName']), existing?.lastName, parts.slice(1).join(' ')),
    middleName: preferEmployeeText(findStringDeep(row, ['middleName', 'fatherName']), existing?.middleName),
    jobTitle: preferEmployeeText(findStringDeep(row, ['jobTitle', 'position', 'title', 'roleName']), existing?.jobTitle, 'Əməkdaş'),
    email: preferEmployeeText(email, existing?.email),
    password: password || existing?.password || '',
    phone1: preferEmployeeText(findStringDeep(row, ['phone1', 'phone', 'phoneNumber', 'mobile']), existing?.phone1, '-'),
    phone2: preferEmployeeText(findStringDeep(row, ['phone2', 'secondaryPhone']), existing?.phone2),
    whatsapp: preferEmployeeText(findStringDeep(row, ['whatsapp', 'whatsappPhone', 'whatsAppPhone']), existing?.whatsapp),
    extensionNumber: preferEmployeeText(findStringDeep(row, ['extensionNumber', 'internalNumber', 'extension']), existing?.extensionNumber),
    linkedin: preferEmployeeText(findStringDeep(row, ['linkedin', 'linkedInUrl', 'linkedinUrl', 'linkedInProfile']), pickSocialUrlFromRow(row, 'linkedin'), existing?.linkedin),
    facebook: preferEmployeeText(findStringDeep(row, ['facebook', 'facebookUrl', 'fbUrl']), pickSocialUrlFromRow(row, 'facebook'), existing?.facebook),
    instagram: preferEmployeeText(findStringDeep(row, ['instagram', 'instagramUrl', 'instaUrl']), pickSocialUrlFromRow(row, 'instagram'), existing?.instagram),
    isActive: rawIsActive === undefined ? existing?.isActive ?? true : asBoolean(rawIsActive, true),
    canEdit: rawCanEdit === undefined ? existing?.canEdit ?? true : asBoolean(rawCanEdit, true),
    photo: preferEmployeePhoto(existing?.photoUrl, existing?.photo, findStringDeep(row, ['photoUrl', 'photo', 'avatarUrl', 'avatar', 'profilePhotoUrl'])),
    photoUrl: preferEmployeePhoto(existing?.photoUrl, existing?.photo, findStringDeep(row, ['photoUrl', 'photo', 'avatarUrl', 'avatar', 'profilePhotoUrl'])),
    cardBackground: preferEmployeeText(findStringDeep(row, ['cardBackground', 'cardBackgroundUrl', 'backgroundUrl', 'backgroundImageUrl']), existing?.cardBackground, existing?.cardBackgroundUrl),
    cardBackgroundUrl: preferEmployeeText(findStringDeep(row, ['cardBackgroundUrl', 'cardBackground', 'backgroundUrl', 'backgroundImageUrl']), existing?.cardBackgroundUrl, existing?.cardBackground),
    additionalInfo: preferEmployeeText(findStringDeep(row, ['additionalInfo', 'description', 'bio', 'about']), existing?.additionalInfo),
    dateOfBirth: preferEmployeeText(findStringDeep(row, ['dateOfBirth', 'birthDate', 'birthday', 'dob']), existing?.dateOfBirth),
    address: preferEmployeeText(findStringDeep(row, ['address', 'homeAddress', 'residentialAddress', 'location']), existing?.address),
    googleMapsUrl: preferEmployeeText(findStringDeep(row, ['googleMapsUrl', 'mapsUrl', 'mapUrl', 'addressUrl']), existing?.googleMapsUrl),
    socialAccounts: Array.isArray(row.socialAccounts) ? row.socialAccounts as LocalEmployeeAccount['socialAccounts'] : existing?.socialAccounts,
    scans: asNumber(findStringDeep(row, ['scans', 'scanCount']) || existing?.scans, 0),
    mustChangePassword,
    firstLogin: mustChangePassword,
    isFirstLogin: mustChangePassword,
    forcePasswordChange: mustChangePassword,
  };
};

export const buildCompanyAdminAccountInfo = (
  account: LocalCompanyAdminAccount,
  mustChangePassword: boolean,
): Record<string, unknown> => {
  const companyName = account.companyName || 'Şirkət';

  return {
    id: account.gmail,
    userId: account.gmail,
    email: account.gmail,
    gmail: account.gmail,
    fullName: account.adminName,
    name: account.adminName,
    role: 'company-admin',
    mustChangePassword,
    firstLogin: mustChangePassword,
    isFirstLogin: mustChangePassword,
    forcePasswordChange: mustChangePassword,
    companyId: account.companyId,
    companyVoen: account.voen,
    voen: account.voen,
    company: {
      id: account.companyId,
      companyId: account.companyId,
      name: companyName,
      companyName,
      voen: account.voen,
      companyVoen: account.voen,
      address: account.address,
      contact: account.contact || account.phone || account.gmail,
      email: account.gmail,
      phone: account.phone,
      logo: account.logo || account.logoUrl,
      logoUrl: account.logoUrl || account.logo,
      employeeLimit: account.employeeLimit || 0,
      userLimit: account.employeeLimit || 0,
      status: 'Aktiv',
      isActive: true,
    },
  };
};

export const buildLocalCompanyAdminResponse = (account: LocalCompanyAdminAccount): LoginResponse => {
  const accessToken = `local-company-admin-${btoa(`${account.gmail}:${account.voen}:${Date.now()}`)}`;
  const mustChangePassword = account.mustChangePassword !== false && !isCompanyAdminPasswordChanged();
  const accountInfo = buildCompanyAdminAccountInfo(account, mustChangePassword);

  replaceStoredAuthSession(accessToken, {
    refreshToken: '',
    role: 'company-admin',
    companyId: account.companyId,
    companyVoen: account.voen,
    userId: account.gmail,
    email: account.gmail,
    accountInfo,
    mustChangePassword,
    firstLogin: mustChangePassword,
    isFirstLogin: mustChangePassword,
    forcePasswordChange: mustChangePassword,
  });

  return {
    accessToken,
    refreshToken: '',
    role: 'company-admin',
    mustChangePassword,
    firstLogin: mustChangePassword,
    isFirstLogin: mustChangePassword,
    companyId: account.companyId,
    companyVoen: account.voen,
    userId: account.gmail,
    accountInfo,
  };
};


export const buildLoginPayload = (values: LoginFormValues): Record<string, unknown> => {
  const email = values.email.trim();
  const password = values.password.trim();
  const companyVoen = values.companyVoen?.trim() || undefined;

  return cleanPayload({
    email,
    password,
    companyVoen,
  });
};

export const tryLocalCompanyAdminLogin = (payload: LoginFormValues, enteredVoen: string): LoginResponse | null => {
  const cleanVoen = enteredVoen.trim();
  if (!cleanVoen) return null;

  const localCompanyAdmin = findLocalCompanyAdminAccount(
    payload.email,
    payload.password,
    cleanVoen,
  );

  return localCompanyAdmin ? buildLocalCompanyAdminResponse(localCompanyAdmin) : null;
};


export const readRawRole = (...sources: unknown[]) => {
  for (const source of sources) {
    const value = findDeep(source, [
      'role',
      'roles',
      'userRole',
      'roleName',
      'accountRole',
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
    ]);

    if (value !== undefined && value !== null && value !== '') return value;
  }

  return '';
};

export const looksLikeEmployeeAccount = (...sources: unknown[]) => {
  return Boolean(
    findStringDeep(sources, ['employeeId', 'jobTitle', 'position', 'phone1', 'phoneNumber']) ||
      normalizeRole(readRawRole(...sources)) === 'employee'
  );
};

export const buildBackendEmployeeFallback = (
  email: string,
  password: string,
  companyId: string,
  companyVoen: string,
  ...sources: unknown[]
): LocalEmployeeAccount => {
  const source = {
    ...(isRecord(sources[2]) ? sources[2] : {}),
    ...(isRecord(sources[1]) ? sources[1] : {}),
    ...(isRecord(sources[0]) ? sources[0] : {}),
    email,
    companyId,
    companyVoen,
    voen: companyVoen,
    role: 'employee',
  };

  const employee = rowToLocalEmployeeAccount(
    source,
    password,
    companyId,
    companyVoen,
    getCompanyNameFromSources(...sources)
  );

  const previous = readLocalEmployeeAccounts().find((item) => {
    const sameId = item.id && employee.id && item.id === employee.id;
    const sameEmail = item.email.trim().toLowerCase() === email.trim().toLowerCase();
    const sameCompany = !companyVoen || item.voen === companyVoen || item.companyId === companyId;
    return (sameId || sameEmail) && sameCompany;
  });

  const previousMustChangePassword = previous
    ? previous.mustChangePassword ?? previous.isFirstLogin ?? previous.firstLogin
    : undefined;

  const passwordChangeCompleted = hasEmployeeCompletedPasswordChange(
    email,
    companyVoen,
    employee.id,
  );
  const passwordChangeRequired = hasEmployeePasswordChangeRequired(
    email,
    companyVoen,
    employee.id,
  );
  const explicitFirstLogin = readFirstLoginFlag(...sources);

  const resolvedFirstLogin = passwordChangeCompleted || previousMustChangePassword === false
    ? false
    : passwordChangeRequired || previousMustChangePassword === true
      ? true
      : explicitFirstLogin;

  if (resolvedFirstLogin !== undefined) {
    return {
      ...employee,
      mustChangePassword: resolvedFirstLogin,
      firstLogin: resolvedFirstLogin,
      isFirstLogin: resolvedFirstLogin,
      forcePasswordChange: resolvedFirstLogin,
    };
  }

  return employee;
};

export const clearStaleBackendSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('userId');
  localStorage.removeItem('id');
  localStorage.removeItem('user');

  runtimeStorage.removeItem('token');
  runtimeStorage.removeItem('accessToken');
  runtimeStorage.removeItem('userId');
  runtimeStorage.removeItem('id');
  runtimeStorage.removeItem('user');
  runtimeStorage.removeItem('isAuthenticated');

  cleanupLegacyAuthStorage();
};
