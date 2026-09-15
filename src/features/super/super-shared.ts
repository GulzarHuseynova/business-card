import { runtimeStorage } from '../../storage/runtime.storage';
import axios from 'axios';
import { API_BASE_URL } from '../../api/client';
import { asBoolean, asNumber, asString, extractCompanyId, findDeep, findStringDeep, type AnyRecord } from '../../utils/api.utils';
import type { ApiCompany, CreateCompanyAdminPayload, CreateCompanyPayload } from '../../types/super.type';
export const cleanObject = (data: Record<string, unknown>) => {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
};

export const stripCompanyLogoFields = <T,>(value: T): T => value;

export const readAppStorage = (key: string) => runtimeStorage.getItem(key) || localStorage.getItem(key);
export const writeAppStorage = (key: string, value: string) => {
  runtimeStorage.setItem(key, value);
  localStorage.removeItem(key);
};

export const uniq = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as unknown;

    if (typeof data === 'string') return data;

    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (typeof record.message === 'string') return record.message;
      if (typeof record.error === 'string') return record.error;
      if (Array.isArray(record.errors)) return record.errors.join(', ');
      if (record.errors && typeof record.errors === 'object') {
        return Object.values(record.errors as Record<string, unknown>).flat().join(', ');
      }
    }

    return error.message;
  }

  return error instanceof Error ? error.message : 'Naməlum xəta';
};


export const isAbsoluteAsset = (value: string) => {
  const lower = value.toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:') || lower.startsWith('blob:');
};

export const looksLikeImageAsset = (value: string) => {
  const raw = value.trim();
  if (!raw) return false;
  if (isAbsoluteAsset(raw) || raw.startsWith('//')) return true;

  const lower = raw.toLowerCase();
  const hasImageExtension = /\.(png|jpe?g|webp|gif|svg|bmp|ico)(\?.*)?$/.test(lower);
  const looksLikeUploadPath = lower.includes('/uploads/') || lower.includes('uploads/') || lower.includes('/files/') || lower.includes('files/') || lower.includes('/images/') || lower.includes('images/') || lower.includes('/logos/') || lower.includes('logos/');

  return raw.startsWith('/') || hasImageExtension || looksLikeUploadPath;
};

export const toPublicAssetUrl = (value: unknown) => {
  const raw = asString(value);
  if (!raw || !looksLikeImageAsset(raw)) return '';
  if (isAbsoluteAsset(raw)) return raw;
  if (raw.startsWith('//')) return `${window.location.protocol}${raw}`;

  const base = API_BASE_URL.replace(/\/+$/, '');
  return `${base}/${raw.replace(/^\/+/, '')}`;
};


const COMPANY_LOGO_STORAGE_PREFIXES = ['companyLogo', 'companyLogo:', 'companyLogoVoen:'];
export const isCompanyLogoStorageKey = (key: string) =>
  COMPANY_LOGO_STORAGE_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix));

export const cleanupLegacyGlobalLogo = () => {
  const clean = (storage: Storage) => {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key && isCompanyLogoStorageKey(key)) storage.removeItem(key);
    }
  };

  try {
    clean(localStorage);
    clean(runtimeStorage);
  } catch {
    // Storage cleanup is best-effort only.
  }
};


export const getCompanyIdCandidates = (raw: unknown) => {
  const item = (raw || {}) as AnyRecord;
  const companyObject = (item.company && typeof item.company === 'object' ? item.company : {}) as AnyRecord;

  return uniq([
    extractCompanyId(item, companyObject),
    findStringDeep(item, ['companyId', 'companyID', 'company_id', 'id']),
    findStringDeep(companyObject, ['companyId', 'companyID', 'company_id', 'id']),
    asString(item.id),
    asString(item.Id),
    asString(item.ID),
    asString(item.companyId),
    asString(item.CompanyId),
    asString(item.companyID),
    asString(item.CompanyID),
    asString(item.company_id),
    asString(companyObject.id),
    asString(companyObject.Id),
    asString(companyObject.ID),
    asString(companyObject.companyId),
    asString(companyObject.CompanyId),
    asString(companyObject.companyID),
    asString(companyObject.CompanyID),
    asString(companyObject.company_id),
  ]);
};

export const getLimitUpdateCandidates = (company: ApiCompany | string) => {
  if (typeof company === 'string') return uniq([company]);
  return uniq([
    ...(company.idCandidates || []),
    company.apiId || '',
    company.id || '',
    company.voen || '',
  ]);
};

export const getCompanyWriteIds = (company: ApiCompany | string) => {
  if (typeof company === 'string') return uniq([company]);
  return uniq([
    ...(company.idCandidates || []),
    company.apiId || '',
    company.id || '',
  ]);
};


export const companyLimitStorageKeys = (companyId?: string, voen?: string) => [
  companyId ? `companyLimit:${companyId}` : '',
  voen ? `companyLimitVoen:${voen}` : '',
].filter(Boolean);

export const getSavedCompanyLimit = (companyId?: string, voen?: string) => {
  for (const key of companyLimitStorageKeys(companyId, voen)) {
    try {
      const value = readAppStorage(key);
      if (value !== null && value !== '') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {
      // Ignore unavailable local storage entries.
    }
  }

  return undefined;
};

export const saveCompanyLimitToStorage = (companyId: string, voen: string, limit: number) => {
  companyLimitStorageKeys(companyId, voen).forEach((key) => {
    try {
      writeAppStorage(key, String(limit));
    } catch {
      // Ignore unavailable local storage entries.
    }
  });
};


export const normalizeCompany = (raw: unknown): ApiCompany => {
  const item = (raw || {}) as AnyRecord;
  const companyObject = (item.company && typeof item.company === 'object' ? item.company : {}) as AnyRecord;
  const userObject = (item.user && typeof item.user === 'object' ? item.user : {}) as AnyRecord;
  const adminObject = ((item.admin || item.companyAdmin || item.createdAdmin || item.adminUser || item.user) && typeof (item.admin || item.companyAdmin || item.createdAdmin || item.adminUser || item.user) === 'object' ? (item.admin || item.companyAdmin || item.createdAdmin || item.adminUser || item.user) : {}) as AnyRecord;

  const companyName =
    asString(item.companyName || item.name || item.title || companyObject.companyName || companyObject.name) || 'Şirkət';

  const adminName = asString(
    item.adminName ||
      item.fullName ||
      item.userName ||
      item.ownerName ||
      userObject.fullName ||
      userObject.name ||
      userObject.userName ||
      findDeep(item, ['adminName', 'fullName', 'userName', 'ownerName'])
  );

  const adminEmail = asString(
    item.adminEmail ||
      item.companyAdminEmail ||
      item.defaultAdminEmail ||
      item.createdAdminEmail ||
      item.loginEmail ||
      item.userEmail ||
      adminObject.adminEmail ||
      adminObject.loginEmail ||
      adminObject.userEmail ||
      adminObject.email ||
      adminObject.gmail ||
      userObject.email ||
      userObject.gmail ||
      findDeep(item, ['adminEmail', 'companyAdminEmail', 'defaultAdminEmail', 'createdAdminEmail', 'loginEmail', 'userEmail'])
  );

  const defaultPassword = asString(
    item.defaultPassword ||
      item.adminPassword ||
      item.generatedPassword ||
      item.generatedAdminPassword ||
      item.initialPassword ||
      item.temporaryPassword ||
      item.tempPassword ||
      item.defaultCode ||
      item.password ||
      item.code ||
      adminObject.defaultPassword ||
      adminObject.adminPassword ||
      adminObject.generatedPassword ||
      adminObject.initialPassword ||
      adminObject.temporaryPassword ||
      adminObject.tempPassword ||
      adminObject.password ||
      adminObject.code ||
      findDeep(item, ['defaultPassword', 'adminPassword', 'generatedPassword', 'generatedAdminPassword', 'initialPassword', 'temporaryPassword', 'tempPassword', 'defaultCode', 'password', 'code'])
  );

  const businessEmail = asString(item.email || companyObject.email || item.companyEmail || companyObject.companyEmail);

  const gmail = asString(
    item.gmail ||
      adminEmail ||
      adminObject.gmail ||
      adminObject.email ||
      userObject.gmail ||
      userObject.email ||
      findDeep(item, ['adminEmail', 'companyAdminEmail', 'loginEmail', 'userEmail'])
  );

  const employeeLimit = asNumber(
    item.employeeLimit ?? item.limit ?? item.userLimit ?? item.UserLimit ?? companyObject.employeeLimit ?? companyObject.limit ?? companyObject.userLimit ?? companyObject.UserLimit,
    0
  );
  const idCandidates = getCompanyIdCandidates(item);
  const voen = asString(item.voen || item.companyVoen || item.taxId || companyObject.voen || companyObject.companyVoen);
  const apiId = idCandidates[0] || '';
  cleanupLegacyGlobalLogo();
  const savedLimit = getSavedCompanyLimit(apiId, voen);
  const finalEmployeeLimit = savedLimit ?? employeeLimit;
  const apiLogo = toPublicAssetUrl(item.logoUrl || item.logo || item.logoPath || companyObject.logoUrl || companyObject.logo || companyObject.logoPath);
  const logo = apiLogo;

  return {
    id: apiId || voen || crypto.randomUUID(),
    apiId,
    idCandidates: uniq([...idCandidates, voen]),
    name: companyName,
    companyName,
    adminName,
    gmail,
    email: businessEmail || gmail,
    companyEmail: businessEmail,
    adminEmail: adminEmail || gmail,
    defaultPassword,
    phone: asString(item.phone || item.adminPhone || companyObject.phone || userObject.phone || userObject.phone1),
    voen,
    logo,
    logoUrl: logo,
    address: asString(item.address || item.location || companyObject.address || companyObject.location),
    contact: asString(item.contact || item.phone || companyObject.contact || companyObject.phone || item.email || companyObject.email),
    limit: finalEmployeeLimit,
    employeeLimit: finalEmployeeLimit,
    userLimit: finalEmployeeLimit,
    UserLimit: finalEmployeeLimit,
    activeEmployees: asNumber(item.activeEmployees ?? item.employeeCount ?? item.employeesCount ?? item.activeCards ?? item.activeUsers ?? companyObject.activeEmployees ?? companyObject.employeeCount, 0),
    scanCount: asNumber(item.scanCount ?? item.scansCount ?? item.totalScans ?? item.totalScanCount ?? companyObject.scanCount ?? companyObject.totalScans, 0),
    isActive: asBoolean(item.isActive ?? item.active ?? companyObject.isActive ?? companyObject.active, true),
    status: asString(item.status || companyObject.status) || (asBoolean(item.isActive ?? item.active ?? companyObject.isActive ?? companyObject.active, true) ? 'Aktiv' : 'Deaktiv'),
  };
};


export const buildCreateCompanyPayloads = (payload: CreateCompanyPayload): Record<string, unknown>[] => {
  const companyName = (payload.companyName || payload.name || '').trim();
  const voen = (payload.voen || '').trim();
  const address = payload.address?.trim();
  const contact = payload.contact?.trim();
  const email = payload.email?.trim();
  const rawLimit = payload.userLimit ?? payload.UserLimit ?? payload.employeeLimit ?? payload.limit;
  const limit = Number(rawLimit || 0);

  // Swagger CreateCompanyDto yalnız bu field-ləri qəbul edir:
  // name, voen, logoUrl, address, email, phone, userLimit.
  // Logo faylı/base64 bu endpointə göndərilmir, çünki 413 yaradır.
  const logoUrl = (payload.logoUrl || payload.logo || '').trim();

  return [
    cleanObject({
      name: companyName,
      voen,
      logoUrl,
      address,
      email,
      phone: contact || payload.phone?.trim(),
      userLimit: limit,
    }),
  ];
};

export const buildUpdateCompanyPayload = (payload: CreateCompanyPayload): Record<string, unknown> => {
  const companyName = (payload.companyName || payload.name || '').trim();
  const voen = (payload.voen || '').trim();
  const address = payload.address?.trim();
  const contact = payload.contact?.trim();
  const email = payload.email?.trim();
  const rawLimit = payload.userLimit ?? payload.UserLimit ?? payload.employeeLimit ?? payload.limit;
  const limit = Number(rawLimit || 0);

  // UpdateCompanyDto: name, voen, address, email, phone, logoUrl, userLimit.
  // Base64/file göndərmirik. Əgər backend özü logoUrl qaytarırsa onu saxlayırıq.
  const logoUrl = (payload.logoUrl || payload.logo || '').trim();

  return cleanObject({
    name: companyName,
    voen,
    logoUrl,
    address,
    email,
    phone: contact || payload.phone?.trim(),
    userLimit: limit,
  });
};

export const splitFullName = (fullName: string) => {
  const parts = fullName.split(' ').filter(Boolean);
  return {
    firstName: parts[0] || fullName,
    lastName: parts.slice(1).join(' ') || '-',
  };
};

export const buildAdminPayloads = (payload: CreateCompanyAdminPayload): Record<string, unknown>[] => {
  const adminName = payload.adminName.trim();
  const gmail = payload.gmail.trim();
  const password = payload.password.trim();
  const phone = payload.phone?.trim() || '';
  const { firstName, lastName } = splitFullName(adminName);

  const baseUser = {
    companyId: payload.companyId,
    firstName,
    lastName,
    middleName: '',
    jobTitle: 'Company Admin',
    phone1: phone,
    phone2: '',
    whatsappPhone: phone,
    extensionNumber: '',
    additionalInfo: 'Company Admin hesabı Super Admin tərəfindən yaradılıb.',
    email: gmail,
    password,
    role: 1,
    isActive: true,
    linkedinUrl: '',
    facebookUrl: '',
    instagramUrl: '',
  };

  return [cleanObject(baseUser)];
};
