import { axiosInstance as apiClient } from '../api/client';
import type { QrDownloadFormat } from '../types/public-card.type';

const blobConfig = { responseType: 'blob' as const };

export const exportImportService = {
  downloadVcf: (userId: string) =>
    apiClient.get(`/api/ExportImport/vcf/${encodeURIComponent(userId)}`, blobConfig),

  getQr: (userId: string, format: QrDownloadFormat = 'png') =>
    apiClient.get(`/api/ExportImport/qr/${encodeURIComponent(userId)}`, {
      ...blobConfig,
      params: { format },
    }),

  exportExcel: (companyId: string) =>
    apiClient.get(`/api/ExportImport/excel/${encodeURIComponent(companyId)}`, blobConfig),

  exportSelectedExcel: (userIds: string[]) =>
    apiClient.post('/api/ExportImport/excel/export-selected', userIds, {
      ...blobConfig,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/octet-stream,*/*',
      },
    }),

  downloadTemplate: () =>
    apiClient.get('/api/ExportImport/excel/template', blobConfig),

  importExcel: (companyId: string, data: FormData) =>
    apiClient.post(`/api/ExportImport/excel/import/${encodeURIComponent(companyId)}`, data),

  exportHtml: (companyId: string) =>
    apiClient.get(`/api/ExportImport/html/${encodeURIComponent(companyId)}`, blobConfig),

  exportHtmlUser: (userId: string) =>
    apiClient.get(`/api/ExportImport/html/user/${encodeURIComponent(userId)}`, blobConfig),
};
