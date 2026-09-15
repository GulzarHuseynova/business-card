import { useMemo, useState } from "react";
import { Button, Card, Empty, message, Space, Table, Tag, Typography } from "antd";
import {AuditOutlined,CalendarOutlined,DatabaseOutlined,ReloadOutlined,TeamOutlined,} from "@ant-design/icons";
import { useCompanyAdmin } from "../../../hooks/use-company-admin";
import type { AuditLogRow } from "../../../types/company-admin.type";

const ACTION_MAP: Record<string, string> = {
  added: "Əlavə edildi",
  add: "Əlavə edildi",
  created: "Yaradıldı",
  create: "Yaradıldı",
  modified: "Redaktə edildi",
  modify: "Redaktə edildi",
  updated: "Yeniləndi",
  update: "Yeniləndi",
  edited: "Redaktə edildi",
  edit: "Redaktə edildi",
  deleted: "Silindi",
  delete: "Silindi",
  removed: "Silindi",
  remove: "Silindi",
  employeeadded: "İşçi əlavə edildi",
  employeearchived: "İşçi deaktiv edildi",
  employeeactivated: "İşçi aktiv edildi",
  employeeeditpermissionupdated: "Redaktə icazəsi yeniləndi",
};

const ENTITY_MAP: Record<string, string> = {
  appusers: "İstifadəçilər",
  appuser: "İstifadəçi",
  companies: "Şirkətlər",
  company: "Şirkət",
  employee: "Əməkdaş",
  employees: "Əməkdaşlar",
  users: "İstifadəçilər",
  user: "İstifadəçi",
  businesscard: "Vizitkart",
  businesscards: "Vizitkartlar",
  system: "Sistem",
};

const FIELD_LABELS: Record<string, string> = {
  isactive: "Status",
  canedit: "Redaktə icazəsi",
  firstname: "Ad",
  lastname: "Soyad",
  middlename: "Ata adı",
  fullname: "Ad və soyad",
  employeename: "Əməkdaş",
  username: "İstifadəçi",
  useremail: "Email",
  email: "Email",
  gmail: "Gmail",
  phone: "Telefon",
  phone1: "Telefon",
  phone2: "Əlavə telefon",
  jobtitle: "Vəzifə",
  position: "Vəzifə",
  employeelimit: "Əməkdaş limiti",
  userlimit: "İstifadəçi limiti",
  limit: "Limit",
  voen: "VÖEN",
  companyname: "Şirkət adı",
  address: "Ünvan",
  contact: "Əlaqə",
};

const IGNORED_KEYS = new Set([
  "id",
  "key",
  "logid",
  "recordid",
  "userid",
  "companyid",
  "createdat",
  "updatedat",
  "timestamp",
  "action",
  "actiontype",
  "tablename",
  "table",
  "entity",
  "details",
  "description",
  "message",
]);

type ChangeRow = { key: string; label: string; before: string; after: string };

type AuditLogTableRow = AuditLogRow & { __rowKey: string };

const normalizeKey = (value?: string) => (value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();

const formatDate = (value?: string) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("az-AZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const translateAction = (value?: string) => {
  const text = String(value || "").trim();
  if (!text) return "Hadisə";
  return ACTION_MAP[normalizeKey(text)] || text;
};

const translateEntity = (value?: string) => {
  const text = String(value || "").trim();
  if (!text) return "Sistem";
  return ENTITY_MAP[normalizeKey(text)] || text;
};

const getActionColor = (value?: string) => {
  const action = normalizeKey(value);

  if (action.includes("add") || action.includes("create") || action.includes("yarad") || action.includes("elav")) return "green";
  if (action.includes("delete") || action.includes("remove") || action.includes("sil")) return "red";
  if (action.includes("update") || action.includes("edit") || action.includes("modified") || action.includes("status")) return "blue";
  if (action.includes("login") || action.includes("giris")) return "purple";

  return "default";
};

const parseObject = (value?: string): Record<string, unknown> | null => {
  const text = String(value || "").trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  return null;
};

const flattenObject = (input: Record<string, unknown>, parent = "") => {
  const result: Record<string, unknown> = {};

  Object.entries(input).forEach(([key, value]) => {
    const nextKey = parent ? `${parent}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, nextKey));
      return;
    }

    result[nextKey] = value;
  });

  return result;
};

const isIgnoredKey = (key: string) => {
  const lastPart = key.split(".").pop() || key;
  return IGNORED_KEYS.has(normalizeKey(lastPart));
};

const humanizeKey = (key: string) => {
  const lastPart = key.split(".").pop() || key;
  const normalized = normalizeKey(lastPart);
  if (FIELD_LABELS[normalized]) return FIELD_LABELS[normalized];

  return lastPart
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
};

const humanizeValue = (key: string, value: unknown) => {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Aktiv" : "Deaktiv";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
  if (typeof value === "object") return "Məlumat var";

  const text = String(value).trim();
  if (!text) return "-";

  const normalized = normalizeKey(key);
  const lower = text.toLowerCase();

  if (normalized === "isactive" || normalized === "status") {
    if (["true", "active", "aktiv"].includes(lower)) return "Aktiv";
    if (["false", "inactive", "deaktiv", "passive"].includes(lower)) return "Deaktiv";
  }

  if (normalized === "canedit") {
    if (["true", "yes", "bəli"].includes(lower)) return "İcazə var";
    if (["false", "no", "xeyr"].includes(lower)) return "İcazə yoxdur";
  }

  return text;
};

const pickDate = (record: AuditLogRow) =>
  record.date || record.createdAt || record.updatedAt || record.timestamp || record.time || "";

const pickUser = (record: AuditLogRow) =>
  record.userEmail || record.userName || record.user || record.email || record.userId || "-";

const pickAction = (record: AuditLogRow) =>
  record.actionType || record.action || record.type || record.method || "Hadisə";

const pickEntity = (record: AuditLogRow) =>
  record.entity || record.entityName || record.tableName || "Sistem";

const pickDetails = (record: AuditLogRow) =>
  record.details || record.description || record.message || "";

const getChangeRows = (record: AuditLogRow): ChangeRow[] => {
  const beforeText = record.beforeValue || record.oldValues || "";
  const afterText = record.afterValue || record.newValues || "";
  const beforeObject = parseObject(beforeText);
  const afterObject = parseObject(afterText);

  if (beforeObject || afterObject) {
    const beforeFlat = beforeObject ? flattenObject(beforeObject) : {};
    const afterFlat = afterObject ? flattenObject(afterObject) : {};
    const keys = Array.from(new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)])).filter((key) => !isIgnoredKey(key));

    return keys
      .map((key) => {
        const before = humanizeValue(key, beforeFlat[key]);
        const after = humanizeValue(key, afterFlat[key]);
        if (before === after) return null;
        if (before === "-" && after === "-") return null;
        return { key, label: humanizeKey(key), before, after };
      })
      .filter(Boolean) as ChangeRow[];
  }

  if (beforeText || afterText) {
    return [{ key: "plain", label: "Məlumat", before: beforeText || "-", after: afterText || "-" }];
  }

  return [];
};

const renderChangeList = (rows: ChangeRow[], side: "before" | "after") => {
  if (rows.length === 0) return <span style={{ color: "#94a3b8" }}>-</span>;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {rows.slice(0, 3).map((row) => (
        <div key={`${side}-${row.key}`}>
          <div style={{ fontSize: 11, fontWeight: 800, color: side === "before" ? "#991b1b" : "#047857" }}>
            {row.label}
          </div>
          <Typography.Paragraph style={{ margin: 0, color: "#40566b", maxWidth: 170 }} ellipsis={{ rows: 2, expandable: true, symbol: "daha çox" }}>
            {side === "before" ? row.before : row.after}
          </Typography.Paragraph>
        </div>
      ))}
    </div>
  );
};

const compactText = (value?: string, width = 260) => {
  if (!value) return <span style={{ color: "#94a3b8" }}>-</span>;

  return (
    <Typography.Paragraph
      style={{ margin: 0, maxWidth: width, color: "#475569" }}
      ellipsis={{ rows: 2, expandable: true, symbol: "daha çox" }}
    >
      {value}
    </Typography.Paragraph>
  );
};

export default function CompanyLogs() {
  const { auditLogs, fetchAuditLogs } = useCompanyAdmin();
  const [refreshing, setRefreshing] = useState(false);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 8,
  });

  const handleRefresh = async () => {
    const key = "company-audit-refresh";
    setRefreshing(true);
    message.loading({ key, content: "Loqlar yenilənir...", duration: 0 });

    try {
      await fetchAuditLogs();
      message.success({ key, content: "Loqlar yeniləndi." });
    } catch {
      message.error({ key, content: "Loqlar yenilənmədi." });
    } finally {
      setRefreshing(false);
    }
  };

  const maxPage = useMemo(() => {
    return Math.max(1, Math.ceil(auditLogs.length / pagination.pageSize));
  }, [auditLogs.length, pagination.pageSize]);

  const currentPage = Math.min(pagination.current, maxPage);

  const tableData = useMemo<AuditLogTableRow[]>(() => {
    return auditLogs.map((record, index) => ({
      ...record,
      __rowKey: String(
        record.key ||
          record.id ||
          record.logId ||
          `${pickDate(record) || "no-date"}-${pickUser(record)}-${pickAction(record)}-${pickEntity(record)}-${index}`,
      ),
    }));
  }, [auditLogs]);

  const stats = useMemo(() => {
    const users = new Set(auditLogs.map(pickUser).filter(Boolean));
    const entities = new Set(auditLogs.map((record) => translateEntity(pickEntity(record))).filter(Boolean));
    const today = new Date().toISOString().slice(0, 10);

    const todayCount = auditLogs.filter((record) => {
      const recordDate = pickDate(record);
      return recordDate.slice(0, 10) === today;
    }).length;

    return [
      { title: "Ümumi log", value: auditLogs.length, icon: <AuditOutlined />, color: "#4b9ada" },
      { title: "Bugünkü hadisə", value: todayCount, icon: <CalendarOutlined />, color: "#5aa8e8" },
      { title: "İştirakçı", value: users.size, icon: <TeamOutlined />, color: "#dc2626" },
      { title: "Obyekt", value: entities.size, icon: <DatabaseOutlined />, color: "#9333ea" },
    ];
  }, [auditLogs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          background: "linear-gradient(135deg,#eaf6ff 0%,#ffffff 100%)",
          borderRadius: 22,
          padding: "26px 28px",
          color: "#263445",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 22px 48px rgba(15,23,42,0.24)",
        }}
      >
        <div style={{ position: "absolute", right: -42, top: -42, width: 190, height: 190, borderRadius: "50%", background: "rgba(129,140,248,0.18)" }} />
        <div style={{ position: "absolute", right: 120, bottom: -70, width: 170, height: 170, borderRadius: "50%", background: "rgba(56,189,248,0.1)" }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <Tag color="blue" style={{ borderRadius: 999, marginBottom: 10 }}>Company Admin</Tag>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#263445" }}>Loqlar</h1>
            <p style={{ margin: "8px 0 0", color: "#6d7f8d", maxWidth: 760 }}>
              Şirkət daxilində işçi əlavə edilməsi, status/redaktə icazəsi və işçinin öz vizitkartında etdiyi dəyişikliklər burada görünür.
            </p>
          </div>

          <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void handleRefresh()} style={{ borderRadius: 12, height: 42, fontWeight: 700 }}>
            Yenilə
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        {stats.map((item) => (
          <Card key={item.title} style={{ borderRadius: 18, border: "1px solid #e2e8f0" }} styles={{ body: { padding: 18 } }}>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>{item.title}</div>
                <div style={{ color: "#263445", fontSize: 30, fontWeight: 900, marginTop: 4 }}>{item.value}</div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 16, background: `${item.color}16`, color: item.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                {item.icon}
              </div>
            </Space>
          </Card>
        ))}
      </div>

      <Card style={{ borderRadius: 22, border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }} styles={{ body: { padding: 22 } }}>
        <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }} wrap>
          <div>
            <h2 style={{ margin: 0, color: "#263445", fontSize: 20, fontWeight: 900 }}>Audit jurnalı</h2>
            <p style={{ margin: "5px 0 0", color: "#94a3b8", fontSize: 13 }}>Şirkətə aid son dəyişikliklər və istifadəçi fəaliyyəti</p>
          </div>
        </Space>

        <Table<AuditLogTableRow>
          rowKey="__rowKey"
          columns={[
            {
              title: "Tarix və saat",
              width: 170,
              render: (_value, record) => <strong style={{ color: "#40566b" }}>{formatDate(pickDate(record))}</strong>,
            },
            {
              title: "İstifadəçi",
              width: 210,
              render: (_value, record) => <div style={{ color: "#263445", fontWeight: 800 }}>{pickUser(record)}</div>,
            },
            {
              title: "Hərəkət tipi",
              width: 180,
              render: (_value, record) => <Tag color={getActionColor(pickAction(record))}>{translateAction(pickAction(record))}</Tag>,
            },
            {
              title: "Obyekt",
              width: 150,
              render: (_value, record) => <Tag>{translateEntity(pickEntity(record))}</Tag>,
            },
            {
              title: "Detallar",
              width: 260,
              render: (_value, record) => compactText(pickDetails(record), 260),
            },
            {
              title: "Əvvəlki → Sonrakı",
              width: 430,
              render: (_value, record) => {
                const changes = getChangeRows(record);

                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 10 }}>
                      <div style={{ color: "#991b1b", fontSize: 11, fontWeight: 900, marginBottom: 6 }}>Əvvəl</div>
                      {renderChangeList(changes, "before")}
                    </div>

                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 10 }}>
                      <div style={{ color: "#047857", fontSize: 11, fontWeight: 900, marginBottom: 6 }}>Sonra</div>
                      {renderChangeList(changes, "after")}
                    </div>
                  </div>
                );
              },
            },
          ]}
          dataSource={tableData}
          pagination={{
            current: currentPage,
            pageSize: pagination.pageSize,
            total: auditLogs.length,
            showSizeChanger: true,
            pageSizeOptions: [8, 10, 20, 50],
            showLessItems: false,
            showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} log`,
            placement: ["bottomCenter"],
          }}
          onChange={(nextPagination) => {
            const nextPageSize = nextPagination.pageSize || pagination.pageSize;
            const nextMaxPage = Math.max(1, Math.ceil(auditLogs.length / nextPageSize));

            setPagination({
              current: Math.min(nextPagination.current || 1, nextMaxPage),
              pageSize: nextPageSize,
            });
          }}
          scroll={{ x: 1240 }}
          locale={{ emptyText: <Empty description="Log tapılmadı" /> }}
        />
      </Card>
    </div>
  );
}
