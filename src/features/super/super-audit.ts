import { superAdminService } from '../../services/super.service';
import { asNumber, asString, findDeep, isRecord, normalizeArray } from '../../utils/api.utils';
import type { ApiCompany, SuperAuditLogResult, SuperAuditLogRow } from '../../types/super.type';
import { getLimitUpdateCandidates } from './super-shared';
const SENSITIVE_AUDIT_KEYS = new Set([
  'password',
  'passwordhash',
  'passwordsalt',
  'securitystamp',
  'concurrencystamp',
  'token',
  'refreshtoken',
  'accesstoken',
]);

export const normalizeAuditKey = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();

export const sanitizeAuditValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (!value || typeof value !== 'object') return value;

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, item]) => {
    const normalized = normalizeAuditKey(key);
    if (SENSITIVE_AUDIT_KEYS.has(normalized) || normalized.includes('passwordhash') || normalized.includes('password') || normalized.includes('token')) {
      return acc;
    }
    acc[key] = sanitizeAuditValue(item);
    return acc;
  }, {});
};

export const isGuidLike = (value?: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test((value || '').trim());

export const stringifyChangeValue = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return JSON.stringify(sanitizeAuditValue(parsed));
    } catch {
      return trimmed.replace(/Password\s*Hash[^,;}\n]*/gi, '').replace(/passwordHash[^,;}\n]*/gi, '');
    }
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  try {
    return JSON.stringify(sanitizeAuditValue(value));
  } catch {
    return '';
  }
};

export const normalizeSuperAuditLog = (raw: unknown): SuperAuditLogRow => {
  const item = isRecord(raw) ? raw : {};

  const beforeValue =
    item.oldValues ||
    item.beforeValue ||
    item.oldValue ||
    item.oldData ||
    item.previousValue ||
    item.previousState ||
    item.before ||
    findDeep(item, [
      'oldValues',
      'beforeValue',
      'oldValue',
      'oldData',
      'previousValue',
      'previousState',
      'before',
    ]);

  const afterValue =
    item.newValues ||
    item.afterValue ||
    item.newValue ||
    item.newData ||
    item.nextValue ||
    item.currentValue ||
    item.after ||
    findDeep(item, [
      'newValues',
      'afterValue',
      'newValue',
      'newData',
      'nextValue',
      'currentValue',
      'after',
    ]);

  const id = asString(item.id || item.logId || item.auditLogId || item.key) || crypto.randomUUID();
  const userId = asString(
    item.userId || item.userID || item.actorId || item.createdById || findDeep(item, ['userId', 'actorId', 'createdById'])
  );
  const userName = asString(
    item.userEmail ||
      item.userName ||
      item.user ||
      item.email ||
      item.createdBy ||
      item.performedBy ||
      item.actor ||
      findDeep(item, ['userEmail', 'userName', 'user', 'email', 'createdBy', 'performedBy', 'actor'])
  );
  const actionType = asString(
    item.actionType ||
      item.action ||
      item.type ||
      item.method ||
      item.operation ||
      findDeep(item, ['actionType', 'action', 'type', 'method', 'operation'])
  );
  const entity = asString(
    item.entity ||
      item.entityName ||
      item.object ||
      item.objectName ||
      item.tableName ||
      item.module ||
      findDeep(item, ['entity', 'entityName', 'object', 'objectName', 'tableName', 'module'])
  );

  const details = asString(
    item.details || item.description || item.message || item.note || findDeep(item, ['details', 'description', 'message', 'note'])
  );
  const beforeText = stringifyChangeValue(beforeValue);
  const afterText = stringifyChangeValue(afterValue);

  return {
    id,
    key: id,
    date: asString(
      item.date ||
        item.createdAt ||
        item.updatedAt ||
        item.time ||
        item.createdDate ||
        item.timestamp ||
        findDeep(item, ['date', 'createdAt', 'time', 'timestamp'])
    ),
    userId,
    userName: userName && !isGuidLike(userName) ? userName : 'Sistem / admin',
    actionType: actionType || 'Hadisə',
    entity: entity || (actionType.toLowerCase().includes('employee') ? 'Employee' : 'Sistem'),
    beforeValue: beforeText,
    afterValue: afterText,
    details,
    companyId: asString(item.companyId || findDeep(item, ['companyId'])),
    companyVoen: asString(item.companyVoen || item.voen || findDeep(item, ['companyVoen', 'voen'])),
  };
};

export const getAuditTotalFromResponse = (data: unknown, fallback: number) => {
  const total = asNumber(
    findDeep(data, [
      'totalCount',
      'totalItems',
      'totalRecords',
      'total',
      'count',
      'recordsTotal',
      'allCount',
    ]),
    fallback,
  );

  return total > 0 ? total : fallback;
};

export const uniqueAuditRows = (rows: SuperAuditLogRow[]) => {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const key = row.id || row.key || `${row.date}|${row.userId}|${row.actionType}|${row.entity}|${row.details}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const sortAuditRows = (rows: SuperAuditLogRow[]) => {
  return [...rows].sort((left, right) => {
    const leftTime = new Date(left.date || '').getTime();
    const rightTime = new Date(right.date || '').getTime();

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;

    return rightTime - leftTime;
  });
};

export const sliceAuditRows = (rows: SuperAuditLogRow[], page: number, pageSize: number) => {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
};

export const fetchAuditLogPage = async (page: number, pageSize: number): Promise<SuperAuditLogResult> => {
  const response = await superAdminService.getAuditLogs({ page, pageSize });
  const rows = normalizeArray(response.data).map(normalizeSuperAuditLog);
  const total = getAuditTotalFromResponse(response.data, rows.length);

  return {
    rows: sortAuditRows(uniqueAuditRows(rows)),
    total,
  };
};


export const putLimit = async (company: ApiCompany | string, limit: number) => {
  const ids = getLimitUpdateCandidates(company);
  const numericLimit = Number(limit);
  let lastError: unknown = null;

  if (ids.length === 0) {
    throw new Error('Limit endpoint üçün şirkət ID tapılmadı.');
  }

  for (const id of ids) {
    try {
      await superAdminService.updateCompanyLimit(id, numericLimit);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Limit yenilənmədi.');
};
