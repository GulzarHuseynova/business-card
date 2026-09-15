import { analyticsService } from '../services/analytics.service';
import { asNumber, findDeep, normalizeArray, unwrapData } from '../utils/api.utils';
import { getLocalAnalytics } from '../storage/local-auth/employee-local-auth';
import { getSavedCompanyId, getSavedCompanyVoen } from '../storage/company.storage';
import { getPublicScanAnalytics } from '../features/public-card/public-card';
import { isLocalCompanyAdminToken } from '../storage/auth.storage';

const readCount = (data: unknown) => {
  const unwrapped = unwrapData(data);

  if (typeof unwrapped === "number") {
    return unwrapped;
  }

  if (typeof unwrapped === "string") {
    const parsed = Number(unwrapped);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return asNumber(
    findDeep(unwrapped, ["count","total","totalScans","totalScanCount","scanCount","scansCount","value","data","result",]),
    0,
  );
};

const getMergedLocalAnalytics = () => {
  const companyId = getSavedCompanyId();
  const companyVoen = getSavedCompanyVoen();
  const local = getLocalAnalytics();
  const publicAnalytics = getPublicScanAnalytics(companyId, companyVoen);

  return {
    totalScans: Math.max(local.totalScans, publicAnalytics.totalScans),
    chart: publicAnalytics.chart.length > 0 ? publicAnalytics.chart : local.chart,
    ranking: publicAnalytics.ranking.length > 0 ? publicAnalytics.ranking : local.ranking,
    scanLogs: publicAnalytics.scanLogs.length > 0 ? publicAnalytics.scanLogs : local.scanLogs,
  };
};

const getAnalyticsParams = () => {
  const companyId = getSavedCompanyId();
  return companyId ? { companyId } : undefined;
};

const shouldUseLocalAnalyticsOnly = () => {
  return isLocalCompanyAdminToken();
};

const safeGet = async <T>(
  request: () => Promise<{ data: unknown }>,
  fallback: T,
  mapper: (data: unknown) => T,
) => {
  const params = getAnalyticsParams();

  if (!params?.companyId || shouldUseLocalAnalyticsOnly()) return fallback;

  try {
    const response = await request();
    return mapper(response.data);
  } catch {
    return fallback;
  }
};

export const analyticsActions = {
  getScansCount: async () => {
    const local = getMergedLocalAnalytics();

    return safeGet(() => analyticsService.getScansCount(getAnalyticsParams()), local.totalScans, (data) => {
      const count = readCount(data);
      return count || local.totalScans;
    });
  },

  getScansChart: async () => {
    const local = getMergedLocalAnalytics();

    return safeGet(() => analyticsService.getScansChart(getAnalyticsParams()), local.chart, (data) => {
      const rows = normalizeArray(data);
      return rows.length > 0 ? rows : local.chart;
    });
  },

  getEmployeesRanking: async () => {
    const local = getMergedLocalAnalytics();

    return safeGet(() => analyticsService.getEmployeesRanking(getAnalyticsParams()), local.ranking, (data) => {
      const rows = normalizeArray(data);
      return rows.length > 0 ? rows : local.ranking;
    });
  },

  getScansLogs: async () => {
    const local = getMergedLocalAnalytics();

    return safeGet(() => analyticsService.getScansLogs(getAnalyticsParams()), local.scanLogs, (data) => {
      const rows = normalizeArray(data);
      return rows.length > 0 ? rows : local.scanLogs;
    });
  },
};
