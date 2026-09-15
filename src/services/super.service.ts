import { axiosInstance as apiClient } from '../api/client';
import type { CreateCompanyAdminPayload, CreateCompanyPayload, SuperAuditLogQuery } from '../types/super.type';

type CompanyWritePayload = CreateCompanyPayload | Record<string, unknown>;
type CompanyAdminWritePayload = CreateCompanyAdminPayload | Record<string, unknown>;

export const superAdminService = {
  getCompanies: () =>
    apiClient.get('/api/SuperAdmin/companies'),

  createCompany: (data: CompanyWritePayload) =>
    apiClient.post('/api/SuperAdmin/companies', data),

  updateCompany: (companyId: string, data: CompanyWritePayload) =>
    apiClient.put(`/api/SuperAdmin/companies/${encodeURIComponent(companyId)}`, data, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }),

  setCompanyActive: (companyId: string, isActive: boolean) =>
    apiClient.put(`/api/SuperAdmin/companies/${encodeURIComponent(companyId)}/active`, null, {
      params: { isActive },
    }),

  getCompanyScansCount: (companyId: string) =>
    apiClient.get('/api/Analytics/scans/count', {
      params: { companyId },
    }),

  createCompanyAdminAccount: (data: CompanyAdminWritePayload) =>
    apiClient.post('/api/CompanyAdmin/users', data),

  updateCompanyLimit: (companyId: string, limit: number) =>
    apiClient.put(`/api/SuperAdmin/companies/${encodeURIComponent(companyId)}/limit`, limit, {
      headers: { 'Content-Type': 'application/json' },
    }),

  getAuditLogs: (params?: SuperAuditLogQuery) =>
    apiClient.get('/api/AuditLog', { params }),
};
