import { readLocalCompanyAdminAccounts, saveLocalCompanyAdminAccount } from '../../storage/local-auth/company-admin-local-auth';
import type { ApiCompany, CreateCompanyPayload } from '../../types/super.type';
import { normalizeCompany, readAppStorage, stripCompanyLogoFields, writeAppStorage } from './super-shared';
const SUPER_COMPANIES_CACHE_KEY = 'superAdminCompaniesCache';

export const readCompaniesCache = (): ApiCompany[] => {
  try {
    const raw = readAppStorage(SUPER_COMPANIES_CACHE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const normalized = stripCompanyLogoFields(parsed)
      .filter((item): item is ApiCompany => Boolean(item && typeof item === 'object'))
      .map((item) => normalizeCompany(item));

    writeAppStorage(SUPER_COMPANIES_CACHE_KEY, JSON.stringify(stripCompanyLogoFields(normalized)));
    return normalized;
  } catch {
    return [];
  }
};

export const saveCompaniesCache = (companies: ApiCompany[]) => {
  try {
    writeAppStorage(SUPER_COMPANIES_CACHE_KEY, JSON.stringify(stripCompanyLogoFields(companies)));
  } catch {
    // Cache is optional. If storage is full/unavailable, API data still works.
  }
};

export const localAdminCompanies = (): ApiCompany[] => {
  return readLocalCompanyAdminAccounts().map((account) => normalizeCompany({
    id: account.companyId || account.voen,
    companyId: account.companyId,
    companyName: account.companyName,
    name: account.companyName,
    voen: account.voen,
    adminName: account.adminName,
    gmail: account.gmail,
    email: account.gmail,
    phone: account.phone,
    logo: account.logo,
    logoUrl: account.logoUrl || account.logo,
    address: account.address,
    contact: account.contact,
    employeeLimit: account.employeeLimit,
    userLimit: account.employeeLimit,
    UserLimit: account.employeeLimit,
    isActive: true,
    status: 'Aktiv',
  }));
};

export const mergeCompanies = (...groups: ApiCompany[][]): ApiCompany[] => {
  const result: ApiCompany[] = [];

  groups.flat().forEach((company) => {
    const key = company.apiId || company.id || company.voen;
    const existingIndex = result.findIndex((item) => {
      return Boolean(
        (key && (item.apiId === key || item.id === key || item.voen === key)) ||
          (company.voen && item.voen === company.voen)
      );
    });

    if (existingIndex >= 0) {
      result[existingIndex] = { ...result[existingIndex], ...company };
    } else {
      result.push(company);
    }
  });

  return result;
};

export const saveCompanyToCache = (company: ApiCompany) => {
  const next = mergeCompanies(readCompaniesCache(), [company]);
  saveCompaniesCache(next);
};

export const updateCompanyLimitInCache = (company: ApiCompany | string, limit: number) => {
  const id = typeof company === 'string' ? company : company.id;
  const voen = typeof company === 'string' ? '' : company.voen;
  const next = readCompaniesCache().map((item) => {
    const sameCompany = Boolean(
      (id && (item.id === id || item.apiId === id || item.idCandidates?.includes(id))) ||
        (voen && item.voen === voen)
    );

    return sameCompany ? { ...item, employeeLimit: limit, limit, userLimit: limit, UserLimit: limit } : item;
  });

  saveCompaniesCache(next);
};

export const updateCompanyInCache = (company: ApiCompany | string, updates: ApiCompany) => {
  const id = typeof company === 'string' ? company : company.id;
  const voen = typeof company === 'string' ? '' : company.voen;
  const next = mergeCompanies(
    readCompaniesCache().map((item) => {
      const sameCompany = Boolean(
        (id && (item.id === id || item.apiId === id || item.idCandidates?.includes(id))) ||
          (voen && item.voen === voen) ||
          (updates.voen && item.voen === updates.voen)
      );

      return sameCompany ? { ...item, ...updates } : item;
    }),
    [updates],
  );

  saveCompaniesCache(next);
};

export const removeCompanyFromCache = (company: ApiCompany | string) => {
  const id = typeof company === 'string' ? company : company.id;
  const voen = typeof company === 'string' ? '' : company.voen;

  saveCompaniesCache(
    readCompaniesCache().filter((item) => {
      return !(
        (id && (item.id === id || item.apiId === id || item.idCandidates?.includes(id))) ||
        (voen && item.voen === voen)
      );
    })
  );
};


export const saveAutoCreatedCompanyAdminFallback = (company: ApiCompany, payload: CreateCompanyPayload) => {
  const adminEmail = (company.adminEmail || company.gmail || company.email || '').trim().toLowerCase();
  const defaultPassword = (company.defaultPassword || '').trim();
  const voen = (company.voen || payload.voen || '').trim();

  if (!adminEmail || !defaultPassword || !voen) return;

  const limit = Number(payload.employeeLimit ?? payload.limit ?? payload.userLimit ?? payload.UserLimit ?? company.employeeLimit ?? company.limit ?? 0);
  const companyId = company.apiId || company.id || voen;

  saveLocalCompanyAdminAccount({
    companyId,
    companyName: company.companyName || company.name || payload.companyName || payload.name || 'Şirkət',
    voen,
    adminName: company.adminName || 'Company Admin',
    gmail: adminEmail,
    phone: company.phone || payload.phone || payload.contact || '',
    password: defaultPassword,
    address: company.address || payload.address || '',
    contact: company.contact || payload.contact || payload.phone || '',
    logo: company.logo || company.logoUrl || payload.logo || payload.logoUrl || '',
    logoUrl: company.logoUrl || company.logo || payload.logoUrl || payload.logo || '',
    employeeLimit: limit,
    mustChangePassword: true,
    firstLogin: true,
    isFirstLogin: true,
  });
};

export const updateCompanyActiveInCache = (company: ApiCompany | string, isActive: boolean) => {
  const id = typeof company === 'string' ? company : company.id;
  const voen = typeof company === 'string' ? '' : company.voen;
  const next = readCompaniesCache().map((item) => {
    const sameCompany = Boolean(
      (id && (item.id === id || item.apiId === id || item.idCandidates?.includes(id))) ||
        (voen && item.voen === voen),
    );

    return sameCompany
      ? { ...item, isActive, status: isActive ? 'Aktiv' : 'Deaktiv' }
      : item;
  });

  saveCompaniesCache(next);
};
