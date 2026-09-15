import { asNumber } from '../../utils/api.utils';
import { updateLocalEmployeeById } from '../../storage/local-auth/employee-local-auth';
import type { PublicCardProfile, PublicScanLog, ScanSource } from '../../types/public-card.type';
import { PUBLIC_SCAN_LOGS_KEY, getDeviceOS, getFullName, normalizeText, readStoredArray, saveStoredArray } from './public-card-shared';
import { savePublicCardProfile } from './public-card-profiles';

export const readPublicScanLogs = (companyId?: string, companyVoen?: string) => {
  const cleanCompanyId = normalizeText(companyId);
  const cleanVoen = normalizeText(companyVoen);
  const logs = readStoredArray<PublicScanLog>(PUBLIC_SCAN_LOGS_KEY);

  if (!cleanCompanyId && !cleanVoen) return logs;

  return logs.filter((log) => {
    return (cleanCompanyId && log.companyId === cleanCompanyId) || (cleanVoen && log.companyVoen === cleanVoen);
  });
};

export const recordPublicScan = async (profile: PublicCardProfile, source: ScanSource) => {
  const scanLog: PublicScanLog = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    employeeId: profile.employeeId || profile.id,
    employeeName: getFullName(profile),
    email: profile.email,
    companyId: profile.companyId,
    companyVoen: profile.companyVoen,
    source,
    os: getDeviceOS(),
    status: profile.isActive === false ? 'inactive' : 'active',
    details: `${source} keçidi — ${getDeviceOS()}`,
    cardId: profile.id,
  };

  const previousLogs = readPublicScanLogs();
  saveStoredArray(PUBLIC_SCAN_LOGS_KEY, [scanLog, ...previousLogs].slice(0, 1000));

  savePublicCardProfile({ ...profile, scans: asNumber(profile.scans, 0) + 1 });
  updateLocalEmployeeById(profile.employeeId || profile.id, { scans: asNumber(profile.scans, 0) + 1 });

  return scanLog;
};

export const getPublicScanAnalytics = (companyId?: string, companyVoen?: string) => {
  const logs = readPublicScanLogs(companyId, companyVoen);
  const chartMap = new Map<string, number>();
  const rankingMap = new Map<string, { name: string; email: string; scans: number; employeeId: string }>();

  logs.forEach((log) => {
    const day = log.date.slice(0, 10);
    chartMap.set(day, (chartMap.get(day) || 0) + 1);

    const key = log.employeeId || log.email || log.employeeName;
    const current = rankingMap.get(key) || { name: log.employeeName, email: log.email, scans: 0, employeeId: log.employeeId };
    current.scans += 1;
    rankingMap.set(key, current);
  });

  return {
    totalScans: logs.length,
    chart: Array.from(chartMap.entries()).map(([date, count]) => ({ date, count, scanCount: count })),
    ranking: Array.from(rankingMap.values())
      .sort((a, b) => b.scans - a.scans)
      .map((row) => ({
        key: row.employeeId,
        id: row.employeeId,
        employeeId: row.employeeId,
        employee: row.name,
        employeeName: row.name,
        userName: row.name,
        user: row.email,
        email: row.email,
        scans: row.scans,
        scanCount: row.scans,
      })),
    scanLogs: logs.map((log) => ({
      key: log.id,
      id: log.id,
      date: log.date,
      createdAt: log.date,
      userName: log.employeeName,
      employeeName: log.employeeName,
      user: log.email,
      email: log.email,
      employeeId: log.employeeId,
      cardId: log.cardId,
      scanType: log.source,
      source: log.source,
      os: log.os,
      deviceOs: log.os,
      status: log.status,
      details: log.details,
    })),
  };
};
