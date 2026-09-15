import { asString, findDeep, isRecord, type AnyRecord } from '../../utils/api.utils';

export const stringifyAuditValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const normalizeAuditLog = (raw: unknown) => {
  const item = (isRecord(raw) ? raw : {}) as AnyRecord;

  const beforeRaw =
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

  const afterRaw =
    item.newValues ||
    item.afterValue ||
    item.newValue ||
    item.newData ||
    item.currentValue ||
    item.nextValue ||
    item.after ||
    findDeep(item, [
      'newValues',
      'afterValue',
      'newValue',
      'newData',
      'currentValue',
      'nextValue',
      'after',
    ]);

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
      item.tableName ||
      item.table ||
      item.object ||
      item.objectName ||
      item.module ||
      findDeep(item, ['entity', 'entityName', 'tableName', 'table', 'object', 'objectName', 'module'])
  );

  const details = asString(
    item.details ||
      item.description ||
      item.message ||
      item.note ||
      findDeep(item, ['details', 'description', 'message', 'note'])
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

  const userId = asString(
    item.userId ||
      item.userID ||
      item.actorId ||
      item.createdById ||
      findDeep(item, ['userId', 'userID', 'actorId', 'createdById'])
  );

  const id = asString(item.id || item.logId || item.auditLogId || item.key) || crypto.randomUUID();

  return {
    key: id,
    id,
    date: asString(
      item.date ||
        item.createdAt ||
        item.updatedAt ||
        item.time ||
        item.createdDate ||
        item.timestamp ||
        findDeep(item, ['date', 'createdAt', 'updatedAt', 'time', 'createdDate', 'timestamp'])
    ),
    userId,
    userName: userName || userId || 'Sistem',
    actionType: actionType || 'Hadisə',
    entity: entity || 'Sistem',
    beforeValue: stringifyAuditValue(beforeRaw),
    afterValue: stringifyAuditValue(afterRaw),
    details,
    companyId: asString(item.companyId || findDeep(item, ['companyId'])),
    companyVoen: asString(item.companyVoen || item.voen || findDeep(item, ['companyVoen', 'voen'])),
  };
};
