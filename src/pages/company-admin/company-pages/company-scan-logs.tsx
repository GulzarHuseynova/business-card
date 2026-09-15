import { useEffect, useState } from "react";
import { Avatar, Button, Empty, message, Space, Table, Tag } from "antd";
import { ClockCircleOutlined, ReloadOutlined } from "@ant-design/icons";

import { useCompanyAdmin } from "../../../hooks/use-company-admin";
import type { AnalyticsScanLogRow } from "../../../types/company-admin.type";

const readLogField = (record: AnalyticsScanLogRow, keys: string[]) => {
  const raw = record as Record<string, unknown>;

  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }

  return "";
};

const getLogDate = (record: AnalyticsScanLogRow) =>
  readLogField(record, ["date", "createdAt", "updatedAt", "timestamp", "scannedAt", "scanDate", "createdDate", "time"]);

const getLogUser = (record: AnalyticsScanLogRow) => {
  return (
    readLogField(record, ["userName", "employeeName", "fullName", "employee", "user", "email", "userEmail", "employeeEmail"]) ||
    "-"
  );
};

const formatDateTime = (value?: string) => {
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

export default function CompanyScanLogs() {
  const { scanLogs, fetchAnalytics } = useCompanyAdmin();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    const key = "company-scan-logs-refresh";
    setRefreshing(true);
    message.loading({ key, content: "Skan logları yenilənir...", duration: 0 });

    try {
      await fetchAnalytics();
      message.success({ key, content: "Skan logları yeniləndi." });
    } catch {
      message.error({ key, content: "Skan logları yenilənmədi." });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (scanLogs.length === 0) {
      void fetchAnalytics();
    }
  }, [fetchAnalytics, scanLogs.length]);

  return (
    <div className="pro-page pro-scan-logs-page" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section className="pro-hero" style={{ background: "linear-gradient(135deg,#eaf6ff 0%,#ffffff 100%)", borderRadius: 20, padding: 26, color: "#263445", boxShadow: "0 12px 28px rgba(71,120,153,0.14)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", right: -90, top: -100, background: "rgba(90,168,232,0.12)" }} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <Tag style={{ border: "1px solid #cde6f8", background: "#ffffff", color: "#527086", marginBottom: 12 }}>Scan Logs</Tag>
            <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>Skan logları</h2>
            <p style={{ margin: "8px 0 0", color: "#6d7f8d", maxWidth: 680 }}>
              Public vizitkart keçidlərinin yalnız tarix/saat və əməkdaş məlumatları.
            </p>
          </div>

          <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void handleRefresh()} style={{ height: 42, borderRadius: 12, fontWeight: 700 }}>
            Yenilə
          </Button>
        </div>
      </section>

      <section className="pro-panel" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 22, boxShadow: "0 10px 30px rgba(15,23,42,0.05)" }}>
        <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }} wrap>
          <div>
            <h3 style={{ margin: 0, color: "#263445", fontSize: 19 }}>Skan tarixçəsi</h3>
            <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13 }}>Cədvəldə yalnız tarix və əməkdaş göstərilir</p>
          </div>
          <Tag color="green">{scanLogs.length} log</Tag>
        </Space>

        {scanLogs.length === 0 ? <Empty description="Skan logu yoxdur" /> : (
          <Table<AnalyticsScanLogRow>
            rowKey={(record) => String(
              record.key
              || record.id
              || `${getLogDate(record) || "no-date"}-${record.employeeId || record.cardId || record.email || record.user || "scan"}`,
            )}
            columns={[
              {
                title: "Tarix və saat",
                width: 220,
                render: (_value, record) => (
                  <Space>
                    <ClockCircleOutlined style={{ color: "#4b9ada" }} />
                    <span style={{ color: "#263445", fontWeight: 800 }}>{formatDateTime(getLogDate(record))}</span>
                  </Space>
                ),
              },
              {
                title: "Əməkdaş",
                render: (_value, record) => {
                  const user = getLogUser(record);
                  return (
                    <Space>
                      <Avatar style={{ background: "#e6f4ff", color: "#4b9ada", fontWeight: 800 }}>{user[0] || "Ə"}</Avatar>
                      <span style={{ color: "#263445", fontWeight: 800 }}>{user}</span>
                    </Space>
                  );
                },
              },
            ]}
            dataSource={scanLogs}
            pagination={{ pageSize: 8, showLessItems: false, placement: ["bottomCenter"] }}
          />
        )}
      </section>
    </div>
  );
}
