import { axiosInstance as apiClient } from '../api/client';
import type { AddUserPayload, CompanyInfo, UpdateUserPayload } from '../types/company.type';

export const companyService = {
  getCurrentCompany: () =>
    apiClient.get('/api/CompanyAdmin/company'),

  updateCurrentCompany: (data: Partial<CompanyInfo>) =>
    apiClient.put('/api/CompanyAdmin/company', data),

  uploadCompanyLogo: (data: FormData) =>
    apiClient.post('/api/CompanyAdmin/company/logo', data),

  getUsersByCompany: (companyId: string, page = 1, pageSize = 1000) =>
    apiClient.get(`/api/CompanyAdmin/users/company/${encodeURIComponent(companyId)}`, {
      params: { page, pageSize },
    }),

  addUser: (data: AddUserPayload) =>
    apiClient.post('/api/CompanyAdmin/users', data),

  updateUserProfile: (userId: string, data: UpdateUserPayload) =>
    apiClient.put(`/api/CompanyAdmin/users/${encodeURIComponent(userId)}`, data),

  updateUserStatus: (userId: string, isActive: boolean) =>
    apiClient.put(`/api/CompanyAdmin/users/${encodeURIComponent(userId)}/active`, null, {
      params: { isActive },
    }),

  updateUserCanEdit: (userId: string, canEdit: boolean) =>
    apiClient.put(`/api/CompanyAdmin/users/${encodeURIComponent(userId)}/canedit`, null, {
      params: { canEdit },
    }),

  resetUserPassword: (userId: string, newPassword: string) =>
    apiClient.post(`/api/CompanyAdmin/users/${encodeURIComponent(userId)}/reset-password`, {
      newPassword,
    }),
};
