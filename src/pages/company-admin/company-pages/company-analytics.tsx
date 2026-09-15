import { useCallback, useMemo, useState } from "react";
import { Avatar, Button, Empty, message, Space, Table, Tag } from "antd";
import { BarChartOutlined, ClockCircleOutlined, EyeOutlined, ReloadOutlined, RiseOutlined, TeamOutlined, TrophyOutlined } from "@ant-design/icons";
import { useCompanyAdmin } from "../../../hooks/use-company-admin";
import type { AnalyticsRankingRow, AnalyticsScanLogRow } from "../../../types/company-admin.type";

type MonthChartRow = {
  key: string;
  month: string;
  count: number;
};

const AZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
  "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

const readNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
};

const readString = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const readLogField = (record: AnalyticsScanLogRow, keys: string[]): string => {
  const raw = record as Record<string, unknown>;

  for (const key of keys) {
    const value = raw[key];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
};

const getLogUser = (record: AnalyticsScanLogRow): string =>
  readLogField(record, [
    "userName", "employeeName", "fullName", "employee",
    "user", "email", "userEmail", "employeeEmail",
  ]) || "-";

const getLogDate = (record: AnalyticsScanLogRow): string =>
  readLogField(record, [
    "date", "createdAt", "updatedAt", "timestamp",
    "scannedAt", "scanDate", "createdDate", "time",
  ]);

const getRankingName = (record: AnalyticsRankingRow): string =>
  record.employeeName ||
  record.employee ||
  record.userName ||
  record.user ||
  record.fullName ||
  `${record.firstName || ""} ${record.lastName || ""}`.trim() ||
  record.email ||
  "-";

const getRankingScans = (record: AnalyticsRankingRow): number =>
  readNumber(record.scanCount ?? record.scans ?? record.count ?? record.total ?? 0);

const getMonthInfo = (
  value: unknown,
  fallbackIndex: number,
): { key: string; label: string } => {
  const rawValue = readString(value);
  const fallbackMonth = (fallbackIndex % 12) + 1;
  const fallback = {
    key: `0000-${String(fallbackMonth).padStart(2, "0")}`,
    label: AZ_MONTHS[fallbackMonth - 1],
  };

  if (!rawValue || /^s[əe]tir\s*\d*$/i.test(rawValue) || /^row\s*\d*$/i.test(rawValue)) {
    return fallback;
  }

  const monthOnlyMatch = rawValue.match(/^M?(\d{1,2})$/i);

  if (monthOnlyMatch) {
    const month = Number(monthOnlyMatch[1]);

    if (month >= 1 && month <= 12) {
      return {
        key: `0000-${String(month).padStart(2, "0")}`,
        label: AZ_MONTHS[month - 1],
      };
    }
  }

  const yearMonthMatch = rawValue.match(/^(\d{4})\s*[-/\s]?\s*M?(\d{1,2})$/i);

  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1]);
    const month = Number(yearMonthMatch[2]);

    if (month >= 1 && month <= 12) {
      return {
        key: `${year}-${String(month).padStart(2, "0")}`,
        label: `${AZ_MONTHS[month - 1]} ${year}`,
      };
    }
  }

  const fullDateMatch = rawValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);

  if (fullDateMatch) {
    const year = Number(fullDateMatch[1]);
    const month = Number(fullDateMatch[2]);

    if (month >= 1 && month <= 12) {
      return {
        key: `${year}-${String(month).padStart(2, "0")}`,
        label: `${AZ_MONTHS[month - 1]} ${year}`,
      };
    }
  }

  const normalizedValue = rawValue.toLocaleLowerCase("az-AZ");

  for (let index = 0; index < AZ_MONTHS.length; index += 1) {
    const monthName = AZ_MONTHS[index];
    const normalizedMonth = monthName.toLocaleLowerCase("az-AZ");

    if (normalizedValue === normalizedMonth) {
      return {
        key: `0000-${String(index + 1).padStart(2, "0")}`,
        label: monthName,
      };
    }

    const monthWithYear = normalizedValue.match(
      new RegExp(`^${normalizedMonth}\\s+(\\d{4})$`, "i"),
    );

    if (monthWithYear) {
      const year = Number(monthWithYear[1]);

      return {
        key: `${year}-${String(index + 1).padStart(2, "0")}`,
        label: `${monthName} ${year}`,
      };
    }
  }

  return fallback;
};

export default function CompanyAnalytics() {
  const {
    analyticsCount,
    analyticsChart,
    analyticsRanking,
    scanLogs,
    usersList,
    currentEmployeesCount,
    fetchAnalytics,
  } = useCompanyAdmin();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    const key = "company-analytics-refresh";
    setRefreshing(true);
    message.loading({ key, content: "Analitika məlumatları yenilənir...", duration: 0 });

    try {
      await fetchAnalytics();
      message.success({ key, content: "Analitika məlumatları yeniləndi." });
    } catch {
      message.error({ key, content: "Analitika məlumatları yenilənmədi." });
    } finally {
      setRefreshing(false);
    }
  };

  const getEmployeeByLog = useCallback(
    (record: AnalyticsScanLogRow) => {
      const userName = getLogUser(record).toLowerCase();
      const email = String(record.email || record.user || "").toLowerCase();
      const employeeId = String(record.employeeId || record.cardId || "");

      return usersList.find((user) => {
        const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim().toLowerCase();

        return (
          user.id === employeeId ||
          String(user.email || "").toLowerCase() === email ||
          Boolean(fullName && userName.includes(fullName))
        );
      });
    },
    [usersList],
  );

  const rankingFromLogs = useMemo<AnalyticsRankingRow[]>(() => {
    const map = new Map<string, AnalyticsRankingRow>();

    scanLogs.forEach((log) => {
      const employee = getEmployeeByLog(log);
      const key = employee?.id || log.employeeId || log.cardId || log.email || getLogUser(log);

      const current = map.get(String(key)) || {
        key: String(key),
        id: String(key),
        employeeId: String(key),
        employeeName: employee
          ? `${employee.firstName || ""} ${employee.lastName || ""}`.trim()
          : getLogUser(log),
        user: employee?.email || log.email || log.user,
        email: employee?.email || log.email,
        status: log.status || (employee?.isActive === false ? "inactive" : "active"),
        scans: 0,
        scanCount: 0,
      };

      const nextCount = getRankingScans(current) + 1;
      current.scans = nextCount;
      current.scanCount = nextCount;
      map.set(String(key), current);
    });

    return Array.from(map.values()).sort(
      (a, b) => getRankingScans(b) - getRankingScans(a),
    );
  }, [scanLogs, getEmployeeByLog]);

  const rankingSource = useMemo(
    () => analyticsRanking.length > 0 ? analyticsRanking : rankingFromLogs,
    [analyticsRanking, rankingFromLogs],
  );

  const visibleRanking = useMemo<AnalyticsRankingRow[]>(() => {
    const activeUsers = usersList.filter((user) => user.isActive !== false);

    return activeUsers
      .map((user) => {
        const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
        const userEmail = String(user.email || '').trim().toLowerCase();
        const userId = String(user.id || '').trim();
        const ranking = rankingSource.find((row) => {
          const rowId = String(row.employeeId || row.id || row.key || '').trim();
          const rowEmail = String(row.email || row.user || '').trim().toLowerCase();
          const rowName = getRankingName(row).trim().toLowerCase();

          return Boolean(
            (userId && rowId && userId === rowId) ||
            (userEmail && rowEmail && userEmail === rowEmail) ||
            (userName && rowName && userName === rowName)
          );
        });

        return {
          ...(ranking || {}),
          key: ranking?.key || user.id || user.email,
          id: ranking?.id || user.id,
          employeeId: ranking?.employeeId || user.id,
          employeeName: getRankingName(ranking || {}) !== '-' ? getRankingName(ranking || {}) : `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          email: ranking?.email || user.email,
          user: ranking?.user || user.email,
          status: 'active',
          scans: ranking ? getRankingScans(ranking) : 0,
          scanCount: ranking ? getRankingScans(ranking) : 0,
        } as AnalyticsRankingRow;
      })
      .sort((left, right) => getRankingScans(right) - getRankingScans(left));
  }, [rankingSource, usersList]);

  const chartRows = useMemo<MonthChartRow[]>(() => {
    const grouped = new Map<string, MonthChartRow>();

    if (analyticsChart.length > 0) {
      analyticsChart.forEach((item, index) => {
        const row = toRecord(item);
        const year = readNumber(row.year ?? row.scanYear, 0);
        const monthIndex = readNumber(row.monthIndex, -1);
        const monthNumber = readNumber(
          row.monthNumber ?? row.monthNo ?? row.month,
          0,
        );

        let monthValue: unknown;

        if (monthIndex >= 0 && monthIndex <= 11) {
          const month = monthIndex + 1;
          monthValue =
            year > 0
              ? `${year}-${String(month).padStart(2, "0")}`
              : month;
        } else if (monthNumber >= 1 && monthNumber <= 12) {
          monthValue =
            year > 0
              ? `${year}-${String(monthNumber).padStart(2, "0")}`
              : monthNumber;
        } else {
          monthValue =
            row.period ??
            row.date ??
            row.createdAt ??
            row.scanDate ??
            row.day ??
            row.monthLabel ??
            row.label ??
            row.name ??
            row.key ??
            "";
        }

        const month = getMonthInfo(monthValue, index);
        const current = grouped.get(month.key) || {
          key: month.key,
          month: month.label,
          count: 0,
        };

        current.count += readNumber(
          row.count ?? row.scanCount ?? row.scans ?? row.total ?? row.value,
          0,
        );

        grouped.set(month.key, current);
      });
    } else {
      scanLogs.forEach((log, index) => {
        const month = getMonthInfo(getLogDate(log), index);
        const current = grouped.get(month.key) || {
          key: month.key,
          month: month.label,
          count: 0,
        };

        current.count += 1;
        grouped.set(month.key, current);
      });
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.key.localeCompare(b.key),
    );
  }, [analyticsChart, scanLogs]);

  const rankingTotal = visibleRanking.reduce<number>(
    (sum, row) => sum + getRankingScans(row),
    0,
  );

  const chartTotal = chartRows.reduce<number>(
    (sum, row) => sum + row.count,
    0,
  );

  const totalScans =
    analyticsCount > 0
      ? analyticsCount
      : rankingTotal > 0
        ? rankingTotal
        : chartTotal > 0
          ? chartTotal
          : scanLogs.length;

  const activeCards = usersList.filter(
    (user) => user.isActive !== false,
  ).length;

  const maxChartCount = Math.max(
    1,
    ...chartRows.map((row) => row.count),
  );

  const topEmployee =
    visibleRanking.length > 0
      ? visibleRanking[0]
      : null;

  const topEmployeeScans = topEmployee
    ? getRankingScans(topEmployee)
    : 0;

  const averageScan =
    currentEmployeesCount > 0
      ? Math.round(totalScans / currentEmployeesCount)
      : 0;

  const statCards = [
    { label: "Ümumi skan", value: totalScans, icon: <EyeOutlined />, tone: "#4b9ada", bg: "linear-gradient(135deg,#e6f4ff,#ffffff)", note: "Ümumi göstərici" },
    { label: "Aktiv vizitkart", value: activeCards, icon: <TeamOutlined />, tone: "#5aa8e8", bg: "linear-gradient(135deg,#f6fbff,#ffffff)", note: `${currentEmployeesCount} əməkdaşdan` },
    { label: "Ortalama skan", value: averageScan, icon: <RiseOutlined />, tone: "#5aa8e8", bg: "linear-gradient(135deg,#f6fbff,#ffffff)", note: "1 əməkdaşa düşən" },
    { label: "Skan log sayı", value: scanLogs.length, icon: <ClockCircleOutlined />, tone: "#4b9ada", bg: "linear-gradient(135deg,#f6fbff,#ffffff)", note: "Ayrıca səhifədə göstərilir" },
  ];

  return (
    <div className="pro-page pro-analytics-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <section className="pro-hero" style={{ background: "linear-gradient(135deg,#eaf6ff 0%,#ffffff 100%)", borderRadius: 20, padding: 28, color: "#263445", boxShadow: "0 12px 28px rgba(71,120,153,0.14)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", right: -90, top: -110, background: "rgba(90,168,232,0.12)" }} />
        <div style={{ position: "absolute", width: 170, height: 170, borderRadius: "50%", left: "42%", bottom: -120, background: "rgba(90,168,232,0.10)" }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <Tag style={{ border: "1px solid #cde6f8", background: "#ffffff", color: "#527086", marginBottom: 12 }}>
              Company Analytics
            </Tag>

            <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: -0.6 }}>
              Analitika paneli
            </h2>

            <p style={{ margin: "9px 0 0", color: "#6d7f8d", maxWidth: 720, lineHeight: 1.6 }}>
              Skan statistikası, aylıq bar qrafiki və əməkdaş reytinqi. Skan logları ayrıca səhifədə göstərilir.
            </p>
          </div>

          <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void handleRefresh()} style={{ height: 42, borderRadius: 12, fontWeight: 700 }}>
            Yenilə
          </Button>
        </div>
      </section>

      <div className="analytics-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {statCards.map((card) => (
          <div className="pro-stat-card" key={card.label} style={{ background: card.bg, border: "1px solid #e2e8f0", borderRadius: 18, padding: 20, boxShadow: "0 10px 28px rgba(15,23,42,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>{card.label}</div>
                <div style={{ color: "#263445", fontSize: 34, fontWeight: 900, marginTop: 6 }}>{card.value}</div>
              </div>

              <div style={{ width: 44, height: 44, borderRadius: 14, background: `${card.tone}16`, color: card.tone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21 }}>
                {card.icon}
              </div>
            </div>

            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 10 }}>{card.note}</div>
          </div>
        ))}
      </div>

      <div className="analytics-main-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18, alignItems: "stretch" }}>
        <section className="analytics-chart-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 22, boxShadow: "0 10px 30px rgba(15,23,42,0.05)" }}>
          <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, color: "#263445", fontSize: 19 }}>Aylıq skan qrafiki</h3>
              <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13 }}>Aylar üzrə sütun qrafiki</p>
            </div>

            <BarChartOutlined style={{ color: "#4b9ada", fontSize: 24 }} />
          </Space>

          {chartRows.length === 0 ? (
            <Empty description="Qrafik məlumatı yoxdur" />
          ) : (
            <div className="analytics-chart-scroll" style={{ height: 285, border: "1px solid #e6f4ff", borderRadius: 18, background: "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)", padding: "18px 16px 12px 42px", position: "relative", overflowX: "auto", overflowY: "hidden" }}>
              <div style={{ position: "absolute", left: 12, top: 20, bottom: 46, width: 1, background: "#e2e8f0" }} />
              <div style={{ position: "absolute", left: 4, top: 20, color: "#94a3b8", fontSize: 11, fontWeight: 800 }}>{maxChartCount}</div>
              <div style={{ position: "absolute", left: 8, bottom: 47, color: "#94a3b8", fontSize: 11, fontWeight: 800 }}>0</div>
              <div style={{ position: "absolute", left: 42, right: 16, bottom: 46, height: 1, background: "#e2e8f0" }} />

              <div style={{ minWidth: Math.max(chartRows.length * 86, 420), height: "100%", display: "flex", alignItems: "flex-end", gap: 16 }}>
                {chartRows.map((row) => {
                  const barHeight = Math.max(
                    12,
                    Math.round((row.count / maxChartCount) * 180),
                  );

                  return (
                    <div key={row.key} style={{ width: 70, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                      <div style={{ color: "#4b9ada", fontWeight: 900, fontSize: 13, marginBottom: 8 }}>{row.count}</div>

                      <div
                        title={`${row.month}: ${row.count} skan`}
                        style={{
                          width: 42,
                          height: barHeight,
                          borderRadius: "12px 12px 6px 6px",
                          background: "linear-gradient(180deg,#5aa8e8 0%,#4b9ada 100%)",
                          boxShadow: "0 10px 22px rgba(90,168,232,0.18)",
                        }}
                      />

                      <div title={row.month} style={{ minHeight: 34, marginTop: 10, color: "#40566b", fontSize: 12, fontWeight: 800, textAlign: "center", lineHeight: 1.15, maxWidth: 80 }}>
                        {row.month}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="analytics-top-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 22, boxShadow: "0 10px 30px rgba(15,23,42,0.05)" }}>
          <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, color: "#263445", fontSize: 19 }}>Top əməkdaş</h3>
              <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13 }}>Ən çox skan olunan kart</p>
            </div>

            <TrophyOutlined style={{ color: "#5aa8e8", fontSize: 25 }} />
          </Space>

          {topEmployee ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <Avatar size={54} style={{ background: "linear-gradient(135deg,#5aa8e8,#6d7f8d)", fontSize: 22, fontWeight: 900 }}>
                  {getRankingName(topEmployee)[0]}
                </Avatar>

                <div>
                  <div style={{ color: "#263445", fontWeight: 900, fontSize: 17 }}>{getRankingName(topEmployee)}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {topEmployee.user || topEmployee.email || "Email yoxdur"}
                  </div>
                </div>
              </div>

              <div style={{ background: "#f6fbff", border: "1px solid #cde6f8", borderRadius: 16, padding: 16 }}>
                <div style={{ color: "#527086", fontWeight: 700, fontSize: 13 }}>Toplam skan</div>
                <div style={{ color: "#263445", fontWeight: 900, fontSize: 34 }}>{topEmployeeScans}</div>
              </div>
            </div>
          ) : (
            <Empty description="Reytinq məlumatı yoxdur" />
          )}
        </section>
      </div>

      <section className="analytics-ranking-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 22, boxShadow: "0 10px 30px rgba(15,23,42,0.05)" }}>
        <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }} wrap>
          <div>
            <h3 style={{ margin: 0, color: "#263445", fontSize: 19 }}>İşçi reytinqi</h3>
            <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13 }}>Vizitkart skanlarına görə sıralama</p>
          </div>

          <Tag color="blue">{visibleRanking.length} sətir</Tag>
        </Space>

        <Table<AnalyticsRankingRow>
          className="analytics-ranking-table-no-scroll"
          rowKey={(record) =>
            String(
              record.key ||
                record.id ||
                record.employeeId ||
                record.email ||
                record.employee ||
                record.user ||
                record.userName ||
                `${record.firstName || ""}-${record.lastName || ""}-${
                  record.scans ||
                  record.scanCount ||
                  record.count ||
                  0
                }`,
            )
          }
          columns={[
            {
              title: "İşçi",
              render: (_value, record) => (
                <Space>
                  <Avatar style={{ background: "#e6f4ff", color: "#4b9ada" }}>
                    {getRankingName(record)[0]}
                  </Avatar>

                  <div>
                    <div style={{ fontWeight: 800, color: "#263445" }}>
                      {getRankingName(record)}
                    </div>

                    <div style={{ color: "#94a3b8", fontSize: 12 }}>
                      {record.user || record.email || ""}
                    </div>
                  </div>
                </Space>
              ),
            },
            {
              title: "Skan",
              width: 78,
              render: (_value, record) => (
                <Tag color="blue" style={{ fontWeight: 800 }}>
                  {getRankingScans(record)}
                </Tag>
              ),
            },
          ]}
          dataSource={visibleRanking}
          pagination={{
            pageSize: 5,
            showLessItems: false,
            placement: ["bottomCenter"],
          }}
        />
      </section>
    </div>
  );
}
