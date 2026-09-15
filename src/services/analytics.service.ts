import { axiosInstance as apiClient } from '../api/client';

export interface AnalyticsQueryParams {
  companyId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ScanLogParams extends AnalyticsQueryParams {
  page?: number;
  pageSize?: number;
}

export const analyticsService = {
  getScansCount: (params?: AnalyticsQueryParams) =>
    apiClient.get('/api/Analytics/scans/count', { params }),

  getScansChart: (params?: AnalyticsQueryParams) =>
    apiClient.get('/api/Analytics/scans/chart', { params }),

  getEmployeesRanking: (params?: AnalyticsQueryParams) =>
    apiClient.get('/api/Analytics/employees/ranking', { params }),

  getScansLogs: (params?: ScanLogParams) =>
    apiClient.get('/api/Analytics/scans/logs', { params }),
};
