import { runtimeStorage } from '../../storage/runtime.storage';
import { employeeToRecord, getLocalEmployeesForCompany } from '../../storage/local-auth/employee-local-auth';
import { getSavedCompanyId, getSavedCompanyVoen } from '../../storage/company.storage';
import { normalizeUser, normalizeUserWithLocalOverride } from '../../mappers/company.mapper';
import type { NormalizedUser } from '../../types/company.type';
import {filterCompanyUsers,normalizeEmailIdentity,normalizeIdentityPart,hasSameName,hasSamePhone,uniq,} from './company-user-identity';

export const COMPANY_USERS_CACHE_PREFIX = 'companyUsersCache:';

export const getCompanyUsersCacheKey = (companyId?: string, companyVoen?: string) => {
  const key = companyId || companyVoen || 'unknown-company';
  return `${COMPANY_USERS_CACHE_PREFIX}${key}`;
};

export const readCompanyUsersCache = (companyId?: string, companyVoen?: string): NormalizedUser[] => {
  try {
    const raw = runtimeStorage.getItem(getCompanyUsersCacheKey(companyId, companyVoen)) || localStorage.getItem(getCompanyUsersCacheKey(companyId, companyVoen));
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return Array.isArray(parsed)
      ? filterCompanyUsers(parsed.map((row) => normalizeUserWithLocalOverride(row, companyId, companyVoen)))
      : [];
  } catch {
    return [];
  }
};

export const saveCompanyUsersCache = (companyId: string, companyVoen: string, users: NormalizedUser[]) => {
  try {
    runtimeStorage.setItem(getCompanyUsersCacheKey(companyId, companyVoen), JSON.stringify(filterCompanyUsers(users)));
    localStorage.removeItem(getCompanyUsersCacheKey(companyId, companyVoen));
  } catch {
    // Cache yazılmasa da əsas iş axını pozulmasın.
  }
};

export const isSameCacheUser = (user: NormalizedUser, target: Partial<NormalizedUser>) => {
  const userId = normalizeIdentityPart(user.id);
  const targetId = normalizeIdentityPart(target.id);
  const userEmail = normalizeEmailIdentity(user.email);
  const targetEmail = normalizeEmailIdentity(target.email);

  if (userId && targetId && userId === targetId) return true;
  if (userEmail && targetEmail && userEmail === targetEmail) return true;

  const sameName = hasSameName(user, target);
  return Boolean(sameName && hasSamePhone(user, target));
};

export const patchCompanyUsersCache = (patch: Partial<NormalizedUser>) => {
  const companyId = patch.companyId || getSavedCompanyId();
  const companyVoen = patch.companyVoen || getSavedCompanyVoen();
  const keys = uniq([
    getCompanyUsersCacheKey(companyId, companyVoen),
    getCompanyUsersCacheKey(companyId, ''),
    getCompanyUsersCacheKey('', companyVoen),
    getCompanyUsersCacheKey(undefined, undefined),
  ]);

  for (const key of keys) {
    try {
      const raw = runtimeStorage.getItem(key) || localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;

      const users = parsed.map(normalizeUser);
      const hasTarget = users.some((user) => isSameCacheUser(user, patch));
      if (!hasTarget) continue;

      const nextUsers = users.map((user) => (
        isSameCacheUser(user, patch)
          ? { ...user, ...patch, id: user.id, email: user.email || patch.email || '' }
          : user
      ));

      runtimeStorage.setItem(key, JSON.stringify(filterCompanyUsers(nextUsers)));
      localStorage.removeItem(key);
    } catch {
      // Cache yenilənməsə UI state və override əsas mənbə kimi qalır.
    }
  }
};

export const toLocalUsers = () => {
  const companyId = getSavedCompanyId();
  const companyVoen = getSavedCompanyVoen();
  return filterCompanyUsers(getLocalEmployeesForCompany(companyId, companyVoen).map(employeeToRecord).map(normalizeUser));
};
