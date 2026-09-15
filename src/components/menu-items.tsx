import {BankOutlined,BarChartOutlined,FileTextOutlined,IdcardOutlined,InfoCircleOutlined,QrcodeOutlined,ClockCircleOutlined,} from "@ant-design/icons";
import type { AppRole, RoleConfig } from "../types/layout.type";

export const ROLE_CONFIG: Record<AppRole, RoleConfig> = {
  "super-admin": {
    brand: "SuperAdmin",
    brandSub: "v2.0",
    logo: "S",
    userTitle: "Super Admin",
    userStatus: "● Tam Səlahiyyət",
    userTag: "Tam Səlahiyyət",
    tagColor: "orange",
    menu: [
      { key: "statistics", label: "Statistika", path: "/admin/statistics", icon: <BarChartOutlined /> },
      { key: "companies", label: "Şirkətlər", path: "/admin/companies", icon: <BankOutlined /> },
      { key: "audit-log", label: "Audit Log", path: "/admin/audit-log", icon: <FileTextOutlined /> },
      { key: "info", label: "Info", path: "/admin/info", icon: <InfoCircleOutlined /> },
    ],
  },
  "company-admin": {
    brand: "CompanyAdmin",
    brandSub: "İdarəetmə",
    logo: "C",
    userTitle: "CompanyAdmin",
    userStatus: "● Aktiv",
    userTag: "CompanyAdmin",
    tagColor: "green",
    menu: [
      { key: "company", label: "Şirkət Məlumatı", path: "/company-admin/company", icon: <BankOutlined /> },
      { key: "business-card", label: "Vizitkart", path: "/company-admin/business-card", icon: <IdcardOutlined /> },
      { key: "qr-codes", label: "QR kodlar", path: "/company-admin/qr-codes", icon: <QrcodeOutlined /> },
      { key: "analytics", label: "Analitika", path: "/company-admin/analytics", icon: <BarChartOutlined /> },
      { key: "scan-logs", label: "Skan logları", path: "/company-admin/scan-logs", icon: <ClockCircleOutlined /> },
    ],
  },
  employee: {
    brand: "Employee",
    brandSub: "Dashboard",
    logo: "E",
    userTitle: "Əməkdaş",
    userStatus: "● Employee",
    userTag: "Əməkdaş",
    tagColor: "blue",
    menu: [
      { key: "business-card", label: "Vizitkart", path: "/employee/business-card", icon: <IdcardOutlined /> },
    ],
  },
};
