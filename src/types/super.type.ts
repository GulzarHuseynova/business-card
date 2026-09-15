export interface ApiCompany {
  id: string;
  name: string;
  companyName: string;
  adminName?: string;
  gmail?: string;
  email?: string;
  companyEmail?: string;
  phone?: string;
  voen: string;
  logo?: string;
  logoUrl?: string;
  address?: string;
  contact?: string;
  limit?: number;
  employeeLimit?: number;
  userLimit?: number;
  UserLimit?: number;
  apiId?: string;
  idCandidates?: string[];
  activeEmployees?: number;
  isActive?: boolean;
  status?: string;
  scanCount?: number;
  adminEmail?: string;
  defaultPassword?: string;
}

export interface CompanyScanRankingRow {
  key: string;
  companyId: string;
  companyName: string;
  voen: string;
  logo?: string;
  scanCount: number;
  isActive: boolean;
}

export interface CreateCompanyPayload {
  name?: string;
  companyName?: string;
  voen: string;
  logo?: string;
  logoUrl?: string;
  address?: string;
  contact?: string;
  limit?: number;
  employeeLimit?: number;
  userLimit?: number;
  UserLimit?: number;
  adminName?: string;
  gmail?: string;
  email?: string;
  phone?: string;
  password?: string;
  code?: string;
}


export interface CreateCompanyAdminPayload {
  companyId: string;
  companyName: string;
  voen: string;
  adminName: string;
  gmail: string;
  phone?: string;
  password: string;
  logo?: string;
  logoUrl?: string;
  address?: string;
  contact?: string;
  employeeLimit?: number;
}

export interface SuperAuditLogRow {
  id: string;
  key: string;
  date: string;
  userId: string;
  userName: string;
  actionType: string;
  entity: string;
  beforeValue: string;
  afterValue: string;
  details: string;
  companyId?: string;
  companyVoen?: string;
}

export interface SuperAuditLogQuery {
  page?: number;
  pageSize?: number;
}

export interface SuperAuditLogResult {
  rows: SuperAuditLogRow[];
  total: number;
}

export interface SuperAdminProps {
  onLogout?: () => void;
}

export interface CompanyCreateFormValues {
  companyName: string;
  voen: string;
  employeeLimit: number;
  address?: string;
  email?: string;
  phone?: string;
  contact?: string;
  logo?: string;
  logoUrl?: string;
}

export interface CompanyEditFormValues {
  companyName: string;
  voen: string;
  employeeLimit: number;
  address?: string;
  email?: string;
  phone?: string;
  contact?: string;
  logo?: string;
  logoUrl?: string;
}

export interface CompanyAdminFormValues {
  companyId: string;
  adminName: string;
  gmail: string;
  phone?: string;
  password: string;
}
