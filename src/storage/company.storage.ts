import { runtimeStorage } from './runtime.storage';
import { API_BASE_URL, axiosInstance } from '../api/client';
import {asNumber,asString,extractCompanyId,extractCompanyVoen,findDeep,findObjectDeep,isRecord,normalizeArray,unwrapData,type AnyRecord,} from '../utils/api.utils';
import { updateLocalCompanyAdminCompany } from './local-auth/company-admin-local-auth';
import { getStoredUser, isLocalCompanyAdminToken, patchStoredUser } from './auth.storage';
import type { CompanyInfo } from '../types/company.type';

export const DEFAULT_COMPANY_LOGO = (name: string) => {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'SC';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="32" fill="%236365f1"/><text x="80" y="98" text-anchor="middle" font-family="Arial,sans-serif" font-size="54" font-weight="700" fill="white">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const isAbsoluteAsset = (value: string) => {
  const lower = value.toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:') || lower.startsWith('blob:');
};

const looksLikeImageAsset = (value: string) => {
  const raw = value.trim();

  if (!raw) return false;
  if (isAbsoluteAsset(raw) || raw.startsWith('//')) return true;

  const lower = raw.toLowerCase();
  const hasImageExtension = /\.(png|jpe?g|webp|gif|svg|bmp|ico)(\?.*)?$/.test(lower);
  const looksLikeUploadPath =
    lower.includes('/uploads/') ||
    lower.includes('uploads/') ||
    lower.includes('/files/') ||
    lower.includes('files/') ||
    lower.includes('/images/') ||
    lower.includes('images/') ||
    lower.includes('/logos/') ||
    lower.includes('logos/');

  return raw.startsWith('/') || hasImageExtension || looksLikeUploadPath;
};

const toPublicAssetUrl = (value: unknown) => {
  const raw = asString(value);

  if (!raw || !looksLikeImageAsset(raw)) return '';
  if (isAbsoluteAsset(raw)) return raw;
  if (raw.startsWith('//')) return `${window.location.protocol}${raw}`;

  const base = API_BASE_URL.replace(/\/+$/, '');
  return `${base}/${raw.replace(/^\/+/, '')}`;
};

const companyLogoStorageKeys = (companyId?: string, voen?: string) => [
  companyId ? `companyLogo:${companyId}` : '',
  voen ? `companyLogoVoen:${voen}` : '',
].filter(Boolean);

export const cleanupCompanyLogoStorage = () => {
  try {
    localStorage.removeItem('companyLogo');
    runtimeStorage.removeItem('companyLogo');
  } catch (error) {
    void error;
  }
};

const stripCompanyLogoFields = <T,>(value: T): T => value;

const readAppStorage = (key: string) => {
  const runtimeValue = runtimeStorage.getItem(key);
  if (runtimeValue !== null) return runtimeValue;

  const legacyValue = localStorage.getItem(key);
  if (legacyValue !== null) {
    runtimeStorage.setItem(key, legacyValue);
    localStorage.removeItem(key);
  }

  return legacyValue;
};

const writeAppStorage = (key: string, value: string) => {
  runtimeStorage.setItem(key, value);
  localStorage.setItem(key, value);
};

export const getSavedCompanyLogo = (companyId?: string, voen?: string) => {
  cleanupCompanyLogoStorage();

  for (const key of companyLogoStorageKeys(companyId, voen)) {
    const saved = readAppStorage(key);
    const logo = toPublicAssetUrl(saved);
    if (logo) return logo;
  }

  return '';
};

export const saveCompanyLogoToStorage = (logoValue: unknown, companyId?: string, voen?: string) => {
  cleanupCompanyLogoStorage();
  const logo = toPublicAssetUrl(logoValue);
  if (!logo) return '';

  for (const key of companyLogoStorageKeys(companyId, voen)) {
    writeAppStorage(key, logo);
  }

  return logo;
};

const companyLimitStorageKeys = (companyId?: string, voen?: string) => [
  companyId ? `companyLimit:${companyId}` : '',
  voen ? `companyLimitVoen:${voen}` : '',
].filter(Boolean);

export const getSavedCompanyLimit = (companyId?: string, voen?: string) => {
  for (const key of companyLimitStorageKeys(companyId, voen)) {
    const saved = readAppStorage(key);

    if (saved !== null && saved !== '') {
      const parsed = asNumber(saved, 0);

      if (parsed > 0) return parsed;
    }
  }

  return undefined;
};

export const pickCompanyObject = (data: unknown) => {
  const unwrapped = unwrapData(data);
  const company = findObjectDeep(unwrapped, ['company', 'currentCompany', 'companyInfo']);

  return company || (isRecord(unwrapped) ? unwrapped : {});
};

export const mapCompanyLogoResponse = (data: unknown) => {
  const unwrapped = unwrapData(data);
  const logo =
    typeof unwrapped === 'string'
      ? unwrapped
      : findDeep(unwrapped, [
          'logoUrl',
          'logo',
          'logoPath',
          'url',
          'path',
          'filePath',
          'imageUrl',
          'fileUrl',
          'downloadUrl',
          'fileName',
          'storedFileName',
        ]);

  return toPublicAssetUrl(logo);
};

export const isLocalCompanyAdminSession = () => {
  return isLocalCompanyAdminToken();
};

export const getSavedCompanyName = () => {
  const accountInfo = getStoredUser()?.accountInfo;
  const company = pickCompanyObject(accountInfo);

  return asString(company.name || company.companyName || findDeep(accountInfo, ['companyName', 'name'])) || 'Şirkət';
};

export const getSavedCompanyId = () => {
  const storedUser = getStoredUser();
  return storedUser?.companyId || extractCompanyId(storedUser?.accountInfo) || '';
};

const getAccountInfoFromStorage = (): unknown => {
  return getStoredUser()?.accountInfo || null;
};

export const getCompanyObjectFromAccountInfo = () => {
  const accountInfo = getStoredUser()?.accountInfo;
  return accountInfo ? pickCompanyObject(accountInfo) : null;
};

export const getSavedCompanyVoen = () => {
  const storedUser = getStoredUser();
  return storedUser?.companyVoen || extractCompanyVoen(storedUser?.accountInfo) || '';
};


const companyInfoStorageKeys = (companyId?: string, voen?: string) => [
  companyId ? `companyInfo:${companyId}` : '',
  voen ? `companyInfoVoen:${voen}` : '',
].filter(Boolean);

const readCompanyInfoStorage = (key: string): AnyRecord | null => {
  try {
    const raw = readAppStorage(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const hasMeaningfulCompanyData = (company: unknown) => {
  if (!isRecord(company)) return false;

  return Boolean(
    asString(company.id || company.companyId) ||
    asString(company.name || company.companyName || company.title) ||
    asString(company.voen || company.companyVoen || company.taxId || company.taxNumber) ||
    asString(company.address) ||
    asString(company.contact || company.phone || company.email) ||
    asString(company.logo || company.logoUrl || company.logoPath),
  );
};

export const getSavedCompanySnapshot = (companyId?: string, voen?: string) => {
  const effectiveCompanyId = companyId || getSavedCompanyId();
  const effectiveVoen = voen || getSavedCompanyVoen();

  for (const key of companyInfoStorageKeys(effectiveCompanyId, effectiveVoen)) {
    const saved = readCompanyInfoStorage(key);
    if (hasMeaningfulCompanyData(saved)) return saved;
  }

  const accountCompany = getCompanyObjectFromAccountInfo();
  if (hasMeaningfulCompanyData(accountCompany)) return accountCompany;

  const savedLogo = getSavedCompanyLogo(effectiveCompanyId, effectiveVoen);
  return savedLogo
    ? { id: effectiveCompanyId, companyId: effectiveCompanyId, voen: effectiveVoen, companyVoen: effectiveVoen, logo: savedLogo, logoUrl: savedLogo }
    : null;
};

export const saveCompanyInfoToStorage = (
  updates: Partial<CompanyInfo>,
  companyId?: string,
  voen?: string,
): CompanyInfo => {
  const storedUser = getStoredUser();
  const parsedAccountInfo = storedUser?.accountInfo || null;

  const storedCompany = getSavedCompanySnapshot(companyId, voen) || (isRecord(parsedAccountInfo) ? pickCompanyObject(parsedAccountInfo) : {});
  const cleanUpdates = stripCompanyLogoFields(Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as AnyRecord);

  const nextCompany: AnyRecord = {
    ...(isRecord(storedCompany) ? storedCompany : {}),
    ...cleanUpdates,
  };

  const effectiveCompanyId =
    asString(nextCompany.id || nextCompany.companyId) ||
    asString(companyId) ||
    getSavedCompanyId();
  const effectiveVoen =
    asString(nextCompany.voen || nextCompany.companyVoen || nextCompany.taxId || nextCompany.taxNumber) ||
    asString(voen) ||
    getSavedCompanyVoen();
  const effectiveName =
    asString(nextCompany.companyName || nextCompany.name || nextCompany.title) ||
    getSavedCompanyName();

  if (effectiveCompanyId) {
    nextCompany.id = effectiveCompanyId;
    nextCompany.companyId = effectiveCompanyId;
    patchStoredUser({ companyId: effectiveCompanyId });
  }

  if (effectiveVoen) {
    nextCompany.voen = effectiveVoen;
    nextCompany.companyVoen = effectiveVoen;
    patchStoredUser({ companyVoen: effectiveVoen });
  }

  if (effectiveName) {
    nextCompany.name = effectiveName;
    nextCompany.companyName = effectiveName;
  }

  const effectiveLogo = asString(nextCompany.logoUrl || nextCompany.logo || nextCompany.logoPath);
  if (effectiveLogo) {
    const savedLogo = saveCompanyLogoToStorage(effectiveLogo, effectiveCompanyId, effectiveVoen);
    if (savedLogo) {
      nextCompany.logo = savedLogo;
      nextCompany.logoUrl = savedLogo;
    }
  }

  for (const key of companyInfoStorageKeys(effectiveCompanyId, effectiveVoen)) {
    try {
      writeAppStorage(key, JSON.stringify(nextCompany));
    } catch (error) {
      void error;
    }
  }

  try {
    const nextAccountInfo = isRecord(parsedAccountInfo)
      ? {
          ...parsedAccountInfo,
          companyId: effectiveCompanyId || asString(parsedAccountInfo.companyId),
          companyVoen: effectiveVoen || asString(parsedAccountInfo.companyVoen || parsedAccountInfo.voen),
          voen: effectiveVoen || asString(parsedAccountInfo.voen || parsedAccountInfo.companyVoen),
          company: nextCompany,
        }
      : {
          companyId: effectiveCompanyId,
          companyVoen: effectiveVoen,
          voen: effectiveVoen,
          company: nextCompany,
        };

    patchStoredUser({
      companyId: effectiveCompanyId || storedUser?.companyId || '',
      companyVoen: effectiveVoen || storedUser?.companyVoen || '',
      accountInfo: nextAccountInfo,
    });
  } catch (error) {
    void error;
  }

  try {
    updateLocalCompanyAdminCompany(effectiveCompanyId, effectiveVoen, {
      companyName: effectiveName,
      address: asString(nextCompany.address),
      contact: asString(nextCompany.contact || nextCompany.phone || nextCompany.email),
      logo: asString(nextCompany.logo || nextCompany.logoUrl || nextCompany.logoPath),
      logoUrl: asString(nextCompany.logoUrl || nextCompany.logo || nextCompany.logoPath),
      employeeLimit: asNumber(nextCompany.employeeLimit || nextCompany.limit || nextCompany.userLimit, 0),
    });
  } catch (error) {
    void error;
  }

  return nextCompany as CompanyInfo;
};

export const saveCompanyIdFromUnknown = (data: unknown) => {
  const id = extractCompanyId(data) || asString(findDeep(data, ['id']));

  if (id) patchStoredUser({ companyId: id });

  return id;
};

const saveResolvedCompanyId = (id: string) => {
  if (id) patchStoredUser({ companyId: id });

  return id;
};

const findCompanyIdFromCompanies = (companiesData: unknown, voen: string) => {
  const companies = normalizeArray(companiesData);
  const normalizedVoen = voen.trim();

  if (!normalizedVoen) return '';

  const match = companies.find((item) => {
    if (!isRecord(item)) return false;

    const row = item as AnyRecord;
    const itemVoen = asString(row.voen || row.companyVoen || row.taxId || row.taxNumber);

    return itemVoen === normalizedVoen;
  });

  return match ? extractCompanyId(match) || asString((match as AnyRecord).id) : '';
};

export const resolveCompanyId = async (...sources: unknown[]) => {
  const savedId = getSavedCompanyId();

  if (savedId) return savedId;

  const storedAccountInfo = getAccountInfoFromStorage();
  const immediateId = extractCompanyId(...sources, storedAccountInfo);

  if (immediateId) return saveResolvedCompanyId(immediateId);

  try {
    const accountResponse = await axiosInstance.get('/api/Auth/account-info');
    const accountId = extractCompanyId(accountResponse.data);

    if (accountId) return saveResolvedCompanyId(accountId);
  } catch (error) {
    void error;
  }

  try {
    const companyResponse = await axiosInstance.get('/api/CompanyAdmin/company');
    const companyId = extractCompanyId(companyResponse.data) || asString(findDeep(companyResponse.data, ['id']));

    if (companyId) return saveResolvedCompanyId(companyId);
  } catch (error) {
    void error;
  }

  const voen = getSavedCompanyVoen() || extractCompanyVoen(...sources, storedAccountInfo);

  if (voen) {
    try {
      const companiesResponse = await axiosInstance.get('/api/SuperAdmin/companies');
      const companyId = findCompanyIdFromCompanies(companiesResponse.data, voen);

      if (companyId) return saveResolvedCompanyId(companyId);
    } catch (error) {
      void error;
    }
  }

  return '';
};
