import { superAdminService } from '../services/super.service';
import { asNumber, findDeep, normalizeArray, type AnyRecord } from '../utils/api.utils';
import { saveLocalCompanyAdminAccount, updateLocalCompanyAdminCompany } from '../storage/local-auth/company-admin-local-auth';
import { readLocalAuditLogs } from '../storage/local-auth/employee-local-auth';
import type { ApiCompany, CompanyScanRankingRow, CreateCompanyAdminPayload, CreateCompanyPayload, SuperAuditLogQuery, SuperAuditLogResult } from '../types/super.type';
import { fetchAuditLogPage, normalizeSuperAuditLog, putLimit, sliceAuditRows, sortAuditRows, uniqueAuditRows } from '../features/super/super-audit';
import { localAdminCompanies, mergeCompanies, readCompaniesCache, saveAutoCreatedCompanyAdminFallback, saveCompaniesCache, saveCompanyToCache, updateCompanyActiveInCache, updateCompanyInCache, updateCompanyLimitInCache } from '../features/super/super-storage';
import { buildAdminPayloads, buildCreateCompanyPayloads, buildUpdateCompanyPayload, getCompanyWriteIds, getErrorMessage, normalizeCompany, saveCompanyLimitToStorage } from '../features/super/super-shared';

export type { ApiCompany, CompanyScanRankingRow, CreateCompanyAdminPayload, CreateCompanyPayload, SuperAuditLogQuery, SuperAuditLogResult, SuperAuditLogRow } from '../types/super.type';

export const superAdminActions = {
  getCompanies: async (): Promise<ApiCompany[]> => {
    const cached = mergeCompanies(readCompaniesCache(), localAdminCompanies());

    try {
      const response = await superAdminService.getCompanies();
      const apiCompanies = normalizeArray(response.data).map(normalizeCompany);
      const companies = mergeCompanies(cached, localAdminCompanies(), apiCompanies);
      saveCompaniesCache(companies);
      return companies;
    } catch {
      // Cache is fallback only; API request is always attempted first and appears in Network.
      return cached;
    }
  },

  createCompany: async (payload: CreateCompanyPayload): Promise<ApiCompany> => {
    let lastError: unknown = null;

    for (const candidate of buildCreateCompanyPayloads(payload)) {
      try {
        const response = await superAdminService.createCompany(candidate);
        const responseData = response.data && typeof response.data === 'object' ? response.data as AnyRecord : {};
        const company = normalizeCompany({ ...candidate, ...responseData });

        const requestedLimit = payload.employeeLimit ?? payload.limit;
        if (requestedLimit !== undefined && company.id) {
          saveCompanyLimitToStorage(company.id, company.voen, requestedLimit);
          company.employeeLimit = requestedLimit;
          company.limit = requestedLimit;
          company.userLimit = requestedLimit;
          company.UserLimit = requestedLimit;
        }

        saveAutoCreatedCompanyAdminFallback(company, payload);
        saveCompanyToCache(company);
        return company;
      } catch (error) {
        lastError = error;
        console.warn('[SuperAdmin] create company payload failed:', candidate, getErrorMessage(error));
      }
    }

    throw new Error(getErrorMessage(lastError) || 'Şirkət backend-də yaradılmadı.');
  },

  updateCompany: async (company: ApiCompany | string, payload: CreateCompanyPayload): Promise<ApiCompany> => {
    const ids = getCompanyWriteIds(company);
    if (ids.length === 0) throw new Error('Şirkət ID tapılmadı.');

    const body = buildUpdateCompanyPayload(payload);
    let lastError: unknown = null;

    for (const id of ids) {
      try {
        const response = await superAdminService.updateCompany(id, body);

        const responseData = response.data && typeof response.data === 'object' ? response.data : {};
        const updated = normalizeCompany({
          ...(typeof company === 'string' ? {} : company),
          ...responseData,
          ...body,
          companyName: body.name,
          userLimit: body.userLimit,
          employeeLimit: body.userLimit,
          limit: body.userLimit,
          UserLimit: body.userLimit,
        });

        if (body.userLimit !== undefined && updated.id) {
          saveCompanyLimitToStorage(updated.id, updated.voen, Number(body.userLimit));
        }

        updateCompanyInCache(company, updated);
        updateLocalCompanyAdminCompany(updated.id, updated.voen, {
          companyName: updated.companyName,
          address: updated.address,
          contact: updated.contact,
          logo: updated.logo || updated.logoUrl,
          logoUrl: updated.logoUrl || updated.logo,
          employeeLimit: updated.employeeLimit,
        });
        return updated;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(getErrorMessage(lastError) || 'Şirkət məlumatları yenilənmədi.');
  },

  setCompanyActive: async (company: ApiCompany | string, isActive: boolean): Promise<ApiCompany> => {
    const ids = getCompanyWriteIds(company);
    if (ids.length === 0) throw new Error('Şirkət ID tapılmadı.');

    let lastError: unknown = null;

    for (const id of ids) {
      try {
        await superAdminService.setCompanyActive(id, isActive);

        const updated = normalizeCompany({
          ...(typeof company === 'string' ? { id } : company),
          id,
          isActive,
          status: isActive ? 'Aktiv' : 'Deaktiv',
        });

        updateCompanyActiveInCache(company, isActive);
        return updated;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(getErrorMessage(lastError) || 'Şirkətin statusu yenilənmədi.');
  },

  getCompanyScanRanking: async (companies: ApiCompany[]): Promise<CompanyScanRankingRow[]> => {
    const readCount = (data: unknown) => asNumber(
      findDeep(data, ['count', 'total', 'totalScans', 'totalScanCount', 'scanCount', 'scansCount', 'value']),
      typeof data === 'number' ? data : 0,
    );

    const rows = await Promise.all(companies.map(async (company) => {
      const companyId = company.apiId || company.idCandidates?.find(Boolean) || company.id;
      let scanCount = Number(company.scanCount || 0);

      if (companyId) {
        try {
          const response = await superAdminService.getCompanyScansCount(companyId);
          scanCount = readCount(response.data);
        } catch {
          // Some backends include the count in the companies/dashboard response.
          // Keep that value as a safe fallback when per-company analytics is unavailable.
        }
      }

      return {
        key: company.id,
        companyId: company.id,
        companyName: company.companyName || company.name || 'Şirkət',
        voen: company.voen || '',
        logo: company.logoUrl || company.logo,
        scanCount,
        isActive: company.isActive !== false,
      } satisfies CompanyScanRankingRow;
    }));

    return rows.sort((left, right) => right.scanCount - left.scanCount || left.companyName.localeCompare(right.companyName));
  },

  createCompanyAdminAccount: async (payload: CreateCompanyAdminPayload): Promise<void> => {
    let lastError: unknown = null;
    const adminPayloads = buildAdminPayloads(payload);

    for (const body of adminPayloads) {
      try {
        await superAdminService.createCompanyAdminAccount(body);
        saveLocalCompanyAdminAccount({
          companyId: payload.companyId,
          companyName: payload.companyName,
          voen: payload.voen,
          adminName: payload.adminName,
          gmail: payload.gmail,
          phone: payload.phone,
          password: payload.password,
          logo: payload.logo,
          logoUrl: payload.logoUrl,
          address: payload.address,
          contact: payload.contact,
          employeeLimit: payload.employeeLimit,
          mustChangePassword: true,
          firstLogin: true,
          isFirstLogin: true,
        });
        saveCompanyToCache(normalizeCompany({
          id: payload.companyId,
          companyId: payload.companyId,
          companyName: payload.companyName,
          name: payload.companyName,
          voen: payload.voen,
          adminName: payload.adminName,
          gmail: payload.gmail,
          adminEmail: payload.gmail,
          companyEmail: payload.gmail,
          email: payload.gmail,
          phone: payload.phone,
          logo: payload.logo,
          logoUrl: payload.logoUrl || payload.logo,
          address: payload.address,
          contact: payload.contact,
          employeeLimit: payload.employeeLimit,
          userLimit: payload.employeeLimit,
          UserLimit: payload.employeeLimit,
          isActive: true,
          status: 'Aktiv',
        }));
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(getErrorMessage(lastError) || 'Company Admin hesabı backend-də yaradılmadı.');
  },


  updateCompanyLimit: async (company: ApiCompany | string, limit: number): Promise<void> => {
    const id = typeof company === 'string' ? company : company.id;
    const voen = typeof company === 'string' ? '' : company.voen;

    await putLimit(company, limit);
    saveCompanyLimitToStorage(id, voen, limit);
    updateCompanyLimitInCache(company, limit);
    updateLocalCompanyAdminCompany(id, voen, { employeeLimit: limit });
  },

  getAuditLogs: async (query: SuperAuditLogQuery = {}): Promise<SuperAuditLogResult> => {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.max(1, Number(query.pageSize || 8));
    const localLogs = sortAuditRows(uniqueAuditRows(readLocalAuditLogs().map(normalizeSuperAuditLog)));

    try {
      return await fetchAuditLogPage(page, pageSize);
    } catch (error) {
      console.warn('[SuperAdmin] AuditLog API fallback:', getErrorMessage(error));
      return {
        rows: sliceAuditRows(localLogs, page, pageSize),
        total: localLogs.length,
      };
    }
  },
};
