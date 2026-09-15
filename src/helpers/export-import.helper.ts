import { exportImportService } from '../services/export-import.service';
import type { HtmlExportEmployee } from '../types/export-import.type';
import type { QrDownloadFormat } from '../types/public-card.type';
import { getSavedCompanyId } from '../storage/company.storage';
import { patchExportedHtml } from '../features/export/html-export';

const resolveCompanyId = (companyId?: string) => companyId || getSavedCompanyId();

const getFileName = (header: unknown, fallback: string) => {
  const value = typeof header === 'string' ? header : '';
  const match = value.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);

  return match ? decodeURIComponent(match[1].replace(/"/g, '').trim()) : fallback;
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => window.URL.revokeObjectURL(url), 3000);
};

export const downloadTextFile = (
  content: string,
  fileName: string,
  mime = 'text/csv;charset=utf-8',
) => {
  downloadBlob(new Blob([content], { type: mime }), fileName);
};

const getBlob = async (
  request: Promise<{ data: unknown; headers?: unknown }>,
  fallbackName: string,
) => {
  const response = await request;
  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data as BlobPart]);
  const headers = response.headers && typeof response.headers === 'object'
    ? response.headers as Record<string, unknown>
    : {};

  return {
    blob,
    fileName: getFileName(headers['content-disposition'], fallbackName),
  };
};

const createCrc32Table = () => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let current = index;

    for (let bit = 0; bit < 8; bit += 1) {
      current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    }

    table[index] = current >>> 0;
  }

  return table;
};

const CRC32_TABLE = createCrc32Table();
const textEncoder = new TextEncoder();

const getCrc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;

  data.forEach((byte) => {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });

  return (crc ^ 0xffffffff) >>> 0;
};

const getDosDateTime = (date = new Date()) => {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  return { dosDate, dosTime };
};

const pushUint16 = (target: number[], value: number) => {
  target.push(value & 0xff, (value >>> 8) & 0xff);
};

const pushUint32 = (target: number[], value: number) => {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
};

const concatBytes = (parts: Uint8Array[]) => {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;

  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });

  return result;
};

const blobToBytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

const toZipSafeFileName = (fileName: string, fallback: string) => {
  const cleaned = (fileName || fallback)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || fallback;
};

const createZipBlob = async (files: { fileName: string; blob: Blob }[]) => {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const { dosDate, dosTime } = getDosDateTime();

  for (const file of files) {
    const data = await blobToBytes(file.blob);
    const fileNameBytes = textEncoder.encode(file.fileName);
    const crc = getCrc32(data);
    const localHeader: number[] = [];

    pushUint32(localHeader, 0x04034b50);
    pushUint16(localHeader, 20);
    pushUint16(localHeader, 0x0800);
    pushUint16(localHeader, 0);
    pushUint16(localHeader, dosTime);
    pushUint16(localHeader, dosDate);
    pushUint32(localHeader, crc);
    pushUint32(localHeader, data.length);
    pushUint32(localHeader, data.length);
    pushUint16(localHeader, fileNameBytes.length);
    pushUint16(localHeader, 0);

    const localRecord = concatBytes([new Uint8Array(localHeader), fileNameBytes, data]);
    localParts.push(localRecord);

    const centralHeader: number[] = [];
    pushUint32(centralHeader, 0x02014b50);
    pushUint16(centralHeader, 20);
    pushUint16(centralHeader, 20);
    pushUint16(centralHeader, 0x0800);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, dosTime);
    pushUint16(centralHeader, dosDate);
    pushUint32(centralHeader, crc);
    pushUint32(centralHeader, data.length);
    pushUint32(centralHeader, data.length);
    pushUint16(centralHeader, fileNameBytes.length);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint32(centralHeader, 0);
    pushUint32(centralHeader, offset);

    centralParts.push(concatBytes([new Uint8Array(centralHeader), fileNameBytes]));
    offset += localRecord.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endRecord: number[] = [];
  pushUint32(endRecord, 0x06054b50);
  pushUint16(endRecord, 0);
  pushUint16(endRecord, 0);
  pushUint16(endRecord, files.length);
  pushUint16(endRecord, files.length);
  pushUint32(endRecord, centralDirectory.length);
  pushUint32(endRecord, offset);
  pushUint16(endRecord, 0);

  return new Blob([concatBytes([...localParts, centralDirectory, new Uint8Array(endRecord)])], {
    type: 'application/zip',
  });
};

const createUniqueZipFiles = (files: { fileName: string; blob: Blob }[]) => {
  const nameCounts = new Map<string, number>();

  return files.map((file, index) => {
    const safeName = toZipSafeFileName(file.fileName, `employee-${index + 1}.html`);
    const dotIndex = safeName.lastIndexOf('.');
    const base = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
    const extension = dotIndex > 0 ? safeName.slice(dotIndex) : '';
    const currentCount = nameCounts.get(safeName) || 0;
    nameCounts.set(safeName, currentCount + 1);

    return {
      blob: file.blob,
      fileName: currentCount === 0 ? safeName : `${base}-${currentCount + 1}${extension}`,
    };
  });
};

const patchEmployeeHtmlBlob = async (blob: Blob, employee?: HtmlExportEmployee) => patchExportedHtml(
  blob,
  employee ? [employee] : [],
);

const buildSelectedHtmlZip = async (userIds: string[], employees: HtmlExportEmployee[]) => {
  const files: { fileName: string; blob: Blob }[] = [];

  // Hər HTML ayrıca və ardıcıl hazırlanır. Beləliklə bir işçinin endpoint
  // cavabı və şəkli başqa işçinin faylına qarışmır.
  for (const userId of userIds) {
    const employee = employees.find((item) => item.id === userId);
    const { blob, fileName } = await getBlob(
      exportImportService.exportHtmlUser(userId),
      `employee-${userId}.html`,
    );

    files.push({
      fileName,
      blob: await patchEmployeeHtmlBlob(blob, employee),
    });
  }

  return createZipBlob(createUniqueZipFiles(files));
};

export const exportImportActions = {
  downloadVcf: async (userId: string) => {
    const { blob, fileName } = await getBlob(
      exportImportService.downloadVcf(userId),
      `contact-${userId}.vcf`,
    );

    downloadBlob(blob, fileName);
  },

  getQrBlob: async (userId: string, format: QrDownloadFormat = 'png') => {
    const safeFormat: QrDownloadFormat = ['png', 'svg', 'pdf'].includes(format)
      ? format
      : 'png';
    return getBlob(
      exportImportService.getQr(userId, safeFormat),
      `qr-${userId}.${safeFormat}`,
    );
  },

  downloadQr: async (userId: string, format: QrDownloadFormat = 'png') => {
    const { blob, fileName } = await exportImportActions.getQrBlob(userId, format);
    downloadBlob(blob, fileName);
  },

  exportExcel: async (companyId?: string) => {
    const finalCompanyId = resolveCompanyId(companyId);
    if (!finalCompanyId) throw new Error('Şirkət ID tapılmadı.');

    const { blob, fileName } = await getBlob(
      exportImportService.exportExcel(finalCompanyId),
      `employees-${finalCompanyId}.xlsx`,
    );

    downloadBlob(blob, fileName);
  },

  exportSelectedExcel: async (userIds: string[]) => {
    const cleanIds = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));
    if (cleanIds.length === 0) {
      throw new Error('Excel ixrac üçün ən azı bir işçi seçilməlidir.');
    }

    const { blob, fileName } = await getBlob(
      exportImportService.exportSelectedExcel(cleanIds),
      cleanIds.length === 1 ? `employee-${cleanIds[0]}.xlsx` : 'selected-employees.xlsx',
    );

    downloadBlob(blob, fileName);
  },

  downloadTemplate: async () => {
    const { blob, fileName } = await getBlob(
      exportImportService.downloadTemplate(),
      'employees-template.xlsx',
    );

    downloadBlob(blob, fileName);
  },

  importExcel: async (companyId: string, file: File) => {
    const finalCompanyId = resolveCompanyId(companyId);
    if (!finalCompanyId) throw new Error('Şirkət ID tapılmadı.');

    const formData = new FormData();
    formData.append('file', file);

    const response = await exportImportService.importExcel(finalCompanyId, formData);
    return response.data;
  },

  exportHtml: async (companyId?: string, employees: HtmlExportEmployee[] = []) => {
    const finalCompanyId = resolveCompanyId(companyId);
    if (!finalCompanyId) throw new Error('Şirkət ID tapılmadı.');

    const { blob, fileName } = await getBlob(
      exportImportService.exportHtml(finalCompanyId),
      `employees-${finalCompanyId}.html`,
    );

    downloadBlob(await patchExportedHtml(blob, employees), fileName);
  },

  exportHtmlUser: async (userId: string, employee?: HtmlExportEmployee) => {
    const { blob, fileName } = await getBlob(
      exportImportService.exportHtmlUser(userId),
      `employee-${userId}.html`,
    );

    downloadBlob(await patchEmployeeHtmlBlob(blob, employee), fileName);
  },

  exportSelectedHtml: async (userIds: string[], employees: HtmlExportEmployee[] = []) => {
    const cleanIds = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));
    if (cleanIds.length === 0) {
      throw new Error('HTML ixrac üçün ən azı bir işçi seçilməlidir.');
    }

    if (cleanIds.length === 1) {
      const employee = employees.find((item) => item.id === cleanIds[0]);
      await exportImportActions.exportHtmlUser(cleanIds[0], employee);
      return;
    }

    const zipBlob = await buildSelectedHtmlZip(cleanIds, employees);
    downloadBlob(zipBlob, 'selected-employees-html.zip');
  },
};

export { prepareHtmlExportEmployees } from '../features/export/photo-export';
