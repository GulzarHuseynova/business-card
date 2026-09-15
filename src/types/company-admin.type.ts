import type {
  NormalizedCompanyInfo,
  NormalizedUser,
} from "./company.type";

export const DEFAULT_COMPANY: NormalizedCompanyInfo = {
  id: "",
  name: "Şirkət",
  employeeLimit: 0,
  logo: "",
  industry: "-",
  status: "Aktiv",
  voen: "",
  address: "",
  contact: "",
  email: "",
  phone: "",
  nfcBaseUrl: "",
};

export type UserData = NormalizedUser;

export interface AddUserFormValues {
  firstName: string;
  lastName: string;
  middleName?: string;
  jobTitle: string;
  email: string;
  password?: string;
  phone1: string;
  phone2?: string;
  extensionNumber?: string;
  whatsapp?: string;
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  photo?: string;
  photoUrl?: string;
  photoData?: string;
  photoFile?: File;
  isActive?: boolean;
  canEdit?: boolean;
  additionalInfo?: string;
  dateOfBirth?: string;
  address?: string;
  googleMapsUrl?: string;
  cardBackgroundUrl?: string;
  cardBackgroundFile?: File;
  socialAccounts?: Array<{ platformName?: string; profileUrl?: string; iconUrl?: string }>;
}

export interface CompanyFormValues {
  name: string;
  industry: string;
  address?: string;
  contact?: string;
  email?: string;
  phone?: string;
  nfcBaseUrl?: string;
}

export interface ActivityLog {
  user: string;
  action: string;
  time: string;
  color: string;
}

export interface AuditLogRow {
  key?: string | number;
  id?: string | number;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  timestamp?: string;
  scannedAt?: string;
  scanDate?: string;
  time?: string;
  user?: string;
  userName?: string;
  userId?: string;
  userEmail?: string;
  email?: string;
  action?: string;
  actionType?: string;
  type?: string;
  method?: string;
  entity?: string;
  tableName?: string;
  entityName?: string;
  beforeValue?: string;
  afterValue?: string;
  oldValues?: string;
  newValues?: string;
  details?: string;
  description?: string;
  message?: string;
  companyId?: string;
  companyVoen?: string;
  logId?: string | number;
  recordId?: string | number;
}

export interface AnalyticsRankingRow {
  key?: string | number;
  id?: string | number;
  employee?: string;
  employeeName?: string;
  user?: string;
  userName?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  employeeId?: string;
  status?: string;
  scans?: number;
  scanCount?: number;
  count?: number;
  total?: number;
}

export interface AnalyticsScanLogRow {
  key?: string | number;
  id?: string | number;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  timestamp?: string;
  scannedAt?: string;
  scanDate?: string;
  user?: string;
  userName?: string;
  employeeName?: string;
  fullName?: string;
  email?: string;
  userEmail?: string;
  employeeEmail?: string;
  details?: string;
  description?: string;
  cardId?: string;
  employeeId?: string;
  scanType?: string;
  source?: string;
  os?: string;
  deviceOs?: string;
  deviceOS?: string;
  device?: string;
  browser?: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  status?: string;
}


export interface CompanyAdminContextValue {
  company: NormalizedCompanyInfo;
  usersList: UserData[];
  recentActivities: ActivityLog[];

  analyticsCount: number;
  analyticsChart: unknown[];
  analyticsRanking: AnalyticsRankingRow[];
  scanLogs: AnalyticsScanLogRow[];
  auditLogs: AuditLogRow[];

  activeCompanyId: string;
  currentEmployeesCount: number;
  usagePercent: number;
  isLimitReached: boolean;

  loadCompanyInfo: () => Promise<string>;
  fetchUsers: (id?: string) => Promise<void>;
  fetchAnalytics: () => Promise<void>;
  fetchAuditLogs: () => Promise<void>;

  addUser: (values: AddUserFormValues) => Promise<void>;
  updateUser: (id: string, values: Partial<AddUserFormValues>, beforeUser?: Partial<UserData>) => Promise<void>;
  toggleUserStatus: (id: string, currentStatus: boolean) => Promise<void>;
  toggleUserCanEdit: (id: string, currentCanEdit: boolean) => Promise<void>;
  resetUserPassword: (id: string, newPassword: string, beforeUser?: Partial<UserData>) => Promise<void>;
  saveCompany: (values: CompanyFormValues) => Promise<void>;
  uploadCompanyLogo: (file: File) => Promise<void>;
}

export interface CompanyAdminProps {
  onLogout?: () => void;
}
