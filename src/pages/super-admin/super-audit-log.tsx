import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Empty, Modal, Space, Table, Tag } from 'antd';
import {AuditOutlined,ClockCircleOutlined,DatabaseOutlined,EyeOutlined,ReloadOutlined,UserOutlined} from '@ant-design/icons';
import { superAdminActions, type SuperAuditLogRow } from '../../helpers/super-admin.helper';

const ACTION_MAP: Record<string, string> = {
  added: 'Əlavə edildi',
  add: 'Əlavə edildi',
  created: 'Yaradıldı',
  create: 'Yaradıldı',
  inserted: 'Əlavə edildi',
  insert: 'Əlavə edildi',
  modified: 'Dəyişdirildi',
  modify: 'Dəyişdirildi',
  edited: 'Dəyişdirildi',
  edit: 'Dəyişdirildi',
  updated: 'Dəyişdirildi',
  update: 'Dəyişdirildi',
  deleted: 'Silindi',
  delete: 'Silindi',
  removed: 'Silindi',
  remove: 'Silindi',
  login: 'Sistemə giriş',
  logout: 'Sistemdən çıxış',
};

const ENTITY_MAP: Record<string, string> = {
  companies: 'Şirkət',
  company: 'Şirkət',
  appusers: 'İstifadəçi',
  appuser: 'İstifadəçi',
  users: 'İstifadəçi',
  user: 'İstifadəçi',
  employees: 'Əməkdaş',
  employee: 'Əməkdaş',
  businesscards: 'Vizitkart',
  businesscard: 'Vizitkart',
  cardscanlogs: 'QR skanı',
  cardscanlog: 'QR skanı',
  qrcodes: 'QR kod',
  qrcode: 'QR kod',
  usercontactinfos: 'Əlaqə məlumatı',
  usercontactinfo: 'Əlaqə məlumatı',
  contactinfos: 'Əlaqə məlumatı',
  contactinfo: 'Əlaqə məlumatı',
  usersociallinks: 'Sosial şəbəkə məlumatı',
  usersociallink: 'Sosial şəbəkə məlumatı',
  sociallinks: 'Sosial şəbəkə məlumatı',
  sociallink: 'Sosial şəbəkə məlumatı',
  useraddresses: 'Ünvan məlumatı',
  useraddress: 'Ünvan məlumatı',
  addresses: 'Ünvan məlumatı',
  address: 'Ünvan məlumatı',
  useridentifiers: 'Şəxsi məlumat',
  useridentifier: 'Şəxsi məlumat',
  userprofiles: 'Profil məlumatı',
  userprofile: 'Profil məlumatı',
  auditlog: 'Audit jurnalı',
  auditlogs: 'Audit jurnalı',
};

const FIELD_LABELS: Record<string, string> = {
  companyname: 'Şirkət adı',
  name: 'Ad',
  firstname: 'Ad',
  lastname: 'Soyad',
  fullname: 'Ad və soyad',
  adminname: 'Admin adı',
  gmail: 'Email',
  email: 'Email',
  emailaddress: 'Email',
  phone: 'Telefon nömrəsi',
  phone1: 'Əsas telefon nömrəsi',
  phone2: 'Əlavə telefon nömrəsi',
  phonenumber: 'Telefon nömrəsi',
  whatsapp: 'WhatsApp nömrəsi',
  whatsappnumber: 'WhatsApp nömrəsi',
  internalnumber: 'Daxili nömrə',
  contact: 'Əlaqə məlumatı',
  address: 'Ünvan',
  location: 'Məkan',
  voen: 'VÖEN',
  employeelimit: 'Əməkdaş limiti',
  userlimit: 'İstifadəçi limiti',
  limit: 'Limit',
  activeemployees: 'Aktiv əməkdaş sayı',
  isactive: 'Status',
  status: 'Status',
  position: 'Vəzifə',
  department: 'Şöbə',
  website: 'Veb-sayt',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  telegram: 'Telegram',
  photo: 'Profil şəkli',
  photourl: 'Profil şəkli',
  image: 'Şəkil',
  imageurl: 'Şəkil',
  logo: 'Loqo',
  logourl: 'Loqo',
  backgroundimage: 'Fon şəkli',
  backgroundimageurl: 'Fon şəkli',
  birthdate: 'Doğum tarixi',
  dateofbirth: 'Doğum tarixi',
  note: 'Qeyd',
  description: 'Açıqlama',
  scantype: 'Skan növü',
  scannedat: 'Skan vaxtı',
};

const IGNORED_DETAIL_KEYS = new Set([
  'id',
  'key',
  'actiontype',
  'entity',
  'details',
  'table',
  'tablename',
  'module',
  'object',
  'objectname',
  'entityname',
  'recordid',
  'userid',
  'companyid',
  'updatedbyid',
  'createdbyid',
  'modifiedbyid',
  'deletedbyid',
  'createdby',
  'updatedby',
  'modifiedby',
  'deletedby',
  'password',
  'passwordhash',
  'passwordsalt',
  'securitystamp',
  'concurrencystamp',
  'token',
  'refreshtoken',
  'accesstoken',
  'updatedat',
  'createdat',
  'modifiedat',
  'deletedat',
  'timestamp',
  'ipaddress',
  'useragent',
  'isdeleted',
]);

const formatDate = (value: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('az-AZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeWordKey = (value?: string) => (value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const getLeafKey = (value: string) => normalizeWordKey(value.split('.').pop() || value);
const isGuidLike = (value?: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test((value || '').trim());

const displayActor = (record: SuperAuditLogRow) => {
  const userName = (record.userName || '').trim();
  if (userName && !isGuidLike(userName)) return userName;
  return 'Sistem';
};

const toTitle = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : '');

const translateAction = (value?: string) => {
  const text = (value || '').trim();
  if (!text) return '-';
  return ACTION_MAP[normalizeWordKey(text)] || toTitle(text);
};

const translateEntity = (value?: string) => {
  const text = (value || '').trim();
  if (!text) return 'Sistem məlumatı';
  return ENTITY_MAP[normalizeWordKey(text)] || toTitle(text);
};

const humanizeKey = (key: string) => {
  const lastPart = key.split('.').pop() || key;
  const normalized = normalizeWordKey(lastPart);
  if (FIELD_LABELS[normalized]) return FIELD_LABELS[normalized];

  return lastPart
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
};

const humanizeValue = (key: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Bəli' : 'Xeyr';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length ? value.map((item) => humanizeValue(key, item)).join(', ') : '—';
  if (typeof value === 'object') return 'Məlumat dəyişdirildi';

  const text = String(value).trim();
  if (!text) return '—';

  const normalizedKey = getLeafKey(key);
  if (normalizedKey === 'entity') return translateEntity(text);
  if (normalizedKey === 'actiontype') return translateAction(text);
  if (normalizedKey === 'isactive' || normalizedKey === 'status') {
    const lower = text.toLowerCase();
    if (['true', 'active', 'aktiv', '1'].includes(lower)) return 'Aktiv';
    if (['false', 'inactive', 'deaktiv', 'passive', '0'].includes(lower)) return 'Deaktiv';
  }
  if (normalizedKey.endsWith('at') || normalizedKey.includes('date') || normalizedKey.includes('time')) {
    const formatted = formatDate(text);
    if (formatted !== text || !Number.isNaN(new Date(text).getTime())) return formatted;
  }

  return text;
};

const parseObject = (raw?: string): Record<string, unknown> | null => {
  const text = (raw || '').trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
};

const flattenObject = (input: Record<string, unknown>, parent = ''): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  Object.entries(input).forEach(([key, value]) => {
    const nextKey = parent ? `${parent}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, nextKey));
      return;
    }

    result[nextKey] = value;
  });

  return result;
};

interface AuditChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

const shouldIgnoreDetailKey = (key: string) => {
  const leafKey = getLeafKey(key);
  const fullKey = normalizeWordKey(key);

  return (
    IGNORED_DETAIL_KEYS.has(leafKey) ||
    IGNORED_DETAIL_KEYS.has(fullKey) ||
    leafKey.includes('password') ||
    leafKey.includes('token') ||
    leafKey.endsWith('byid')
  );
};

const getComparableFields = (record: SuperAuditLogRow): AuditChange[] => {
  const beforeObj = parseObject(record.beforeValue);
  const afterObj = parseObject(record.afterValue);
  const beforeFlat = beforeObj ? flattenObject(beforeObj) : {};
  const afterFlat = afterObj ? flattenObject(afterObj) : {};

  return Array.from(new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)]))
    .filter((key) => !shouldIgnoreDetailKey(key))
    .map((key) => {
      const beforeText = humanizeValue(key, beforeFlat[key]);
      const afterText = humanizeValue(key, afterFlat[key]);

      if (beforeText === '—' && afterText === '—') return null;
      if (beforeText === afterText) return null;

      return {
        key,
        label: humanizeKey(key),
        before: beforeText,
        after: afterText,
      };
    })
    .filter(Boolean) as AuditChange[];
};

type AuditActionKind = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'scan' | 'other';

const getActionKind = (record: SuperAuditLogRow): AuditActionKind => {
  const action = normalizeWordKey(record.actionType);
  const entity = normalizeWordKey(record.entity);

  if (entity === 'cardscanlogs' || entity === 'cardscanlog') return 'scan';
  if (action.includes('login')) return 'login';
  if (action.includes('logout')) return 'logout';
  if (['added', 'add', 'created', 'create', 'inserted', 'insert'].includes(action)) return 'create';
  if (['deleted', 'delete', 'removed', 'remove'].includes(action)) return 'delete';
  if (['modified', 'modify', 'edited', 'edit', 'updated', 'update'].includes(action)) return 'update';
  return 'other';
};

const formatFieldList = (changes: AuditChange[]) => {
  const labels = Array.from(new Set(changes.map((item) => item.label))).slice(0, 4);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} və ${labels[labels.length - 1]}`;
};

const getAuditSummary = (record: SuperAuditLogRow) => {
  const kind = getActionKind(record);
  const entity = translateEntity(record.entity);
  const changes = getComparableFields(record);
  const fields = formatFieldList(changes);

  if (kind === 'scan') return 'QR kod skan edildi.';
  if (kind === 'login') return `${displayActor(record)} sistemə daxil oldu.`;
  if (kind === 'logout') return `${displayActor(record)} sistemdən çıxdı.`;

  const fieldText = fields ? ` Dəyişən məlumatlar: ${fields}.` : '';

  if (kind === 'create') return `${entity} əlavə edildi.${fieldText}`;
  if (kind === 'update') return `${entity} dəyişdirildi.${fieldText}`;
  if (kind === 'delete') return `${entity} silindi.${fieldText}`;

  return `${entity} üzrə əməliyyat aparıldı.${fieldText}`;
};

const getActionColor = (action: string) => {
  const value = action.toLowerCase();
  if (value.includes('create') || value.includes('add') || value.includes('yarad') || value.includes('əlavə')) return 'green';
  if (value.includes('delete') || value.includes('remove') || value.includes('sil')) return 'red';
  if (value.includes('update') || value.includes('edit') || value.includes('yenil') || value.includes('modif') || value.includes('dəyiş')) return 'blue';
  if (value.includes('login') || value.includes('giriş')) return 'purple';
  return 'default';
};

const ChangeValueCard = ({ label, value, tone }: { label: string; value: string; tone: 'before' | 'after' }) => {
  const labelColor = tone === 'before' ? '#991b1b' : '#166534';

  return (
    <div style={{ background: 'rgba(255,255,255,0.82)', borderRadius: 12, padding: 12 }}>
      <div style={{ color: labelColor, fontSize: 12, fontWeight: 800, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#334155', lineHeight: 1.6, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
};

function SuperAuditLog() {
  const [logs, setLogs] = useState<SuperAuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalLogs, setTotalLogs] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 8 });
  const [selectedLog, setSelectedLog] = useState<SuperAuditLogRow | null>(null);
  const requestSequence = useRef(0);

  const safeTotal = useMemo(() => (totalLogs > 0 ? totalLogs : logs.length), [totalLogs, logs.length]);

  const loadLogs = useCallback(async (page: number, pageSize: number) => {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setLoading(true);

    try {
      const data = await superAdminActions.getAuditLogs({ page, pageSize });
      if (requestId !== requestSequence.current) return;

      const rows = Array.isArray(data.rows) ? data.rows : [];
      const total = Number(data.total || rows.length);

      setLogs(rows);
      setTotalLogs(Math.max(total, rows.length));
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      console.error('[SuperAuditLog] load error:', error);
      setLogs([]);
      setTotalLogs(0);
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, []);

  // NOTE: loadLogs synchronously calls setLoading(true) before its first await.
  // Calling it directly in the effect body trips react-hooks/set-state-in-effect,
  // so the call is deferred to a microtask/macrotask outside the effect body itself.
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLogs(pagination.current, pagination.pageSize);
    }, 0);

    return () => clearTimeout(timer);
  }, [loadLogs, pagination]);

  const stats = useMemo(() => {
    const users = new Set(logs.map((log) => log.userName || log.userId).filter(Boolean));
    const entities = new Set(logs.map((log) => translateEntity(log.entity)).filter(Boolean));
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = logs.filter((log) => log.date.slice(0, 10) === today).length;

    return [
      { title: 'Ümumi log', value: totalLogs || logs.length, icon: <AuditOutlined />, color: '#4f46e5' },
      { title: 'Bu səhifədə bugünkü hadisə', value: todayCount, icon: <ClockCircleOutlined />, color: '#059669' },
      { title: 'Bu səhifədə istifadəçi', value: users.size, icon: <UserOutlined />, color: '#dc2626' },
      { title: 'Bu səhifədə obyekt tipi', value: entities.size, icon: <DatabaseOutlined />, color: '#9333ea' },
    ];
  }, [logs, totalLogs]);

  const selectedChanges = useMemo(() => (selectedLog ? getComparableFields(selectedLog) : []), [selectedLog]);
  const selectedActionKind = useMemo(() => (selectedLog ? getActionKind(selectedLog) : 'other'), [selectedLog]);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'hidden' }}>        <div>
        <h1 style={{ margin: 0, color: '#1e293b', fontSize: 28, fontWeight: 800 }}>Audit Log</h1>
        <p style={{ margin: '8px 0 0', color: '#64748b' }}>
          Sistemdə edilən dəyişikliklər sadə və anlaşılan formada göstərilir.
        </p>
      </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
          {stats.map((item) => (
            <Card key={item.title} style={{ borderRadius: 16, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 18 } }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700 }}>{item.title}</div>
                  <div style={{ color: '#0f172a', fontSize: 28, fontWeight: 900, marginTop: 4 }}>{item.value}</div>
                </div>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    background: `${item.color}16`,
                    color: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}
                >
                  {item.icon}
                </div>
              </Space>
            </Card>
          ))}
        </div>

        <Card style={{ borderRadius: 18, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 20 } }}>
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
            <div>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: 20 }}>Sistem audit jurnalı</h2>
            </div>
            <Button icon={<ReloadOutlined />} onClick={() => void loadLogs(pagination.current, pagination.pageSize)} loading={loading}>
              Yenilə
            </Button>
          </Space>

          <Table<SuperAuditLogRow>
            loading={loading}
            dataSource={logs}
            rowKey={(record) => record.key || record.id}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: safeTotal,
              showSizeChanger: true,
              pageSizeOptions: [8, 10, 20, 50],
              showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}`,
              placement: ['bottomCenter'],
            }}
            onChange={(nextPagination) => {
              const nextPageSize = nextPagination.pageSize || pagination.pageSize;
              const pageSizeChanged = nextPageSize !== pagination.pageSize;

              setSelectedLog(null);
              setPagination({
                current: pageSizeChanged ? 1 : nextPagination.current || 1,
                pageSize: nextPageSize,
              });
            }}
            tableLayout="fixed"
            columns={[
              {
                title: 'Tarix və saat',
                dataIndex: 'date',
                width: 165,
                render: (value: string) => <strong style={{ color: '#334155' }}>{formatDate(value)}</strong>,
              },
              {
                title: 'İstifadəçi',
                dataIndex: 'userName',
                width: 180,
                render: (_value: string, record) => displayActor(record),
              },
              {
                title: 'Hərəkətin növü',
                dataIndex: 'actionType',
                width: 155,
                render: (value: string) => <Tag color={getActionColor(value)}>{translateAction(value)}</Tag>,
              },
              {
                title: 'Obyekt növü',
                dataIndex: 'entity',
                width: 165,
                render: (value: string) => <Tag>{translateEntity(value)}</Tag>,
              },
              {
                title: 'Nə baş verdi?',
                key: 'detailsAction',
                render: (_value: unknown, record) => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                    <span style={{ color: '#334155', lineHeight: 1.5, whiteSpace: 'normal', overflowWrap: 'anywhere', minWidth: 0 }}>
                      {getAuditSummary(record)}
                    </span>
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      onClick={() => setSelectedLog(record)}
                      style={{ paddingInline: 0, fontWeight: 700, flexShrink: 0 }}
                    >
                      Ətraflı bax
                    </Button>
                  </div>
                ),
              },
            ]}
            locale={{ emptyText: <Empty description="Audit log tapılmadı" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          />
        </Card>
      </div>

      <Modal
        open={Boolean(selectedLog)}
        onCancel={() => setSelectedLog(null)}
        footer={null}
        width={920}
        title={<span style={{ fontWeight: 800, color: '#0f172a' }}>Dəyişiklik haqqında məlumat</span>}
      >
        {selectedLog ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            <div
              style={{
                border: '1px solid #bfdbfe',
                borderRadius: 16,
                background: '#eff6ff',
                padding: 18,
              }}
            >
              <div style={{ color: '#1d4ed8', fontSize: 12, fontWeight: 800, marginBottom: 6 }}>NƏ BAŞ VERDİ?</div>
              <div style={{ color: '#172554', fontSize: 18, fontWeight: 800, lineHeight: 1.55 }}>{getAuditSummary(selectedLog)}</div>
            </div>

            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                background: '#f8fafc',
                padding: 16,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>Tarix və saat</div>
                  <div style={{ color: '#0f172a', fontWeight: 700, marginTop: 4 }}>{formatDate(selectedLog.date)}</div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>Dəyişikliyi edən</div>
                  <div style={{ color: '#0f172a', fontWeight: 700, marginTop: 4 }}>{displayActor(selectedLog)}</div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>Dəyişiklik edilən bölmə</div>
                  <div style={{ color: '#0f172a', fontWeight: 700, marginTop: 4 }}>{translateEntity(selectedLog.entity)}</div>
                </div>
              </div>
            </div>

            {selectedActionKind === 'create' && selectedChanges.length > 0 ? (
              <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 18, padding: 16 }}>
                <div style={{ color: '#15803d', fontWeight: 900, fontSize: 18, marginBottom: 14 }}>Əlavə edilən məlumatlar</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {selectedChanges
                    .filter((item) => item.after !== '—')
                    .map((item) => (
                      <ChangeValueCard key={`created-${item.key}`} label={item.label} value={item.after} tone="after" />
                    ))}
                </div>
              </div>
            ) : null}

            {selectedActionKind === 'delete' && selectedChanges.length > 0 ? (
              <div style={{ border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 18, padding: 16 }}>
                <div style={{ color: '#b91c1c', fontWeight: 900, fontSize: 18, marginBottom: 14 }}>Silinən məlumatlar</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {selectedChanges
                    .filter((item) => item.before !== '—')
                    .map((item) => (
                      <ChangeValueCard key={`deleted-${item.key}`} label={item.label} value={item.before} tone="before" />
                    ))}
                </div>
              </div>
            ) : null}

            {(selectedActionKind === 'update' || selectedActionKind === 'other') && selectedChanges.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: 16,
                  alignItems: 'start',
                }}
              >
                <div style={{ border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 18, padding: 16 }}>
                  <div style={{ color: '#b91c1c', fontWeight: 900, fontSize: 18, marginBottom: 14 }}>Dəyişiklikdən əvvəl</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {selectedChanges.map((item) => (
                      <ChangeValueCard key={`before-${item.key}`} label={item.label} value={item.before} tone="before" />
                    ))}
                  </div>
                </div>

                <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 18, padding: 16 }}>
                  <div style={{ color: '#15803d', fontWeight: 900, fontSize: 18, marginBottom: 14 }}>Dəyişiklikdən sonra</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {selectedChanges.map((item) => (
                      <ChangeValueCard key={`after-${item.key}`} label={item.label} value={item.after} tone="after" />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {(['scan', 'login', 'logout'].includes(selectedActionKind) || selectedChanges.length === 0) ? (
              <div style={{ border: '1px solid #dbeafe', background: '#f8fafc', borderRadius: 16, padding: 18, color: '#475569' }}>
                Bu hadisə üçün əlavə texniki məlumat göstərilmir. Əsas məlumat yuxarıdakı “Nə baş verdi?” bölməsində verilib.
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export default SuperAuditLog;