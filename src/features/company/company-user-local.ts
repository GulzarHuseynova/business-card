import { findLocalEmployeeById, saveLocalEmployeeAccount, updateLocalEmployeeById } from '../../storage/local-auth/employee-local-auth';
import { asString, isRecord } from '../../utils/api.utils';
import { cleanObject } from './api-fallback';
import { normalizeAssetUrl } from '../../utils/asset-url.utils';
import {getCompanyObjectFromAccountInfo,getSavedCompanyId,getSavedCompanyName,getSavedCompanySnapshot,getSavedCompanyVoen,saveCompanyInfoToStorage,} from '../../storage/company.storage';
import type { AddUserPayload, CompanyInfo, NormalizedUser } from '../../types/company.type';

export const createLocalEmployee = (
  payload: AddUserPayload,
  companyId: string,
  companyVoen: string,
  companyName: string,
  createdId: string
) => {
  saveLocalEmployeeAccount({
    id: createdId,
    companyId,
    companyName,
    voen: companyVoen,
    firstName: payload.firstName,
    lastName: payload.lastName,
    middleName: payload.middleName,
    jobTitle: payload.jobTitle,
    email: payload.email,
    password: payload.password || '',
    phone1: payload.phone1,
    phone2: payload.phone2,
    extensionNumber: payload.extensionNumber,
    whatsapp: payload.whatsapp,
    linkedin: payload.linkedin,
    facebook: payload.facebook,
    instagram: payload.instagram,
    photo: payload.photo,
    photoUrl: payload.photoUrl || payload.photo,
    cardBackground: payload.cardBackgroundUrl,
    cardBackgroundUrl: payload.cardBackgroundUrl,
    additionalInfo: payload.additionalInfo,
    dateOfBirth: payload.dateOfBirth,
    address: payload.address,
    googleMapsUrl: payload.googleMapsUrl,
    socialAccounts: payload.socialAccounts,
    isActive: payload.isActive,
    canEdit: payload.canEdit ?? true,
    mustChangePassword: true,
    firstLogin: true,
    isFirstLogin: true,
    forcePasswordChange: true,
  });
};

export const getCreatedEmployeeId = (createdUser: unknown, fallbackEmail: string, companyId: string) => {
  if (!isRecord(createdUser)) return fallbackEmail || crypto.randomUUID();

  const candidates = [
    asString(createdUser.userId),
    asString(createdUser.employeeId),
    asString(createdUser.cardId),
    asString(createdUser.id),
  ];

  return candidates.find((candidate) => candidate && candidate !== companyId) || fallbackEmail || crypto.randomUUID();
};

export const getEmployeeBeforeState = (userId: string, email?: string) => {
  return findLocalEmployeeById(userId) || findLocalEmployeeById(email || '');
};

export const updateEmployeeLocalState = (
  userId: string,
  patch: Partial<NormalizedUser>,
  userSnapshot?: Partial<NormalizedUser>
) => {
  const byId = updateLocalEmployeeById(userId, patch);
  return byId || updateLocalEmployeeById(userSnapshot?.email || '', patch);
};


export const buildLocalCompanyFallback = (): CompanyInfo => {
  const snapshot = getSavedCompanySnapshot();
  if (snapshot) return snapshot as CompanyInfo;

  const fallbackCompany = getCompanyObjectFromAccountInfo();
  if (fallbackCompany && Object.keys(fallbackCompany).length > 0) return fallbackCompany as CompanyInfo;

  const companyId = getSavedCompanyId();
  const companyVoen = getSavedCompanyVoen();
  const companyName = getSavedCompanyName();

  return {
    id: companyId,
    companyId,
    name: companyName,
    companyName,
    voen: companyVoen,
    companyVoen,
    status: 'Aktiv',
    isActive: true,
  };
};

export const persistCompanyInfo = (payload: Partial<CompanyInfo>) => {
  return saveCompanyInfoToStorage(payload, getSavedCompanyId(), getSavedCompanyVoen());
};

export const buildCurrentCompanyUpdatePayload = (payload: Partial<CompanyInfo>) => {
  const current = buildLocalCompanyFallback();
  const rawLimit = payload.userLimit ?? payload.employeeLimit ?? current.userLimit ?? current.employeeLimit ?? current.limit;
  const userLimit = Number(rawLimit || 0);

  return cleanObject({
    name: asString(payload.name || payload.companyName || current.name || current.companyName),
    voen: asString(payload.voen || payload.companyVoen || current.voen || current.companyVoen),
    address: asString(payload.address ?? current.address),
    email: asString(payload.email ?? current.email),
    phone: asString(payload.phone || payload.contact || current.phone || current.contact),
    logoUrl: normalizeAssetUrl(payload.logoUrl || payload.logo || current.logoUrl || current.logo),
    userLimit: userLimit > 0 ? userLimit : undefined,
    nfcBaseUrl: asString(payload.nfcBaseUrl ?? current.nfcBaseUrl),
  });
};
