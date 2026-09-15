export type MockRole = 'super-admin' | 'company-admin' | 'employee';

export interface MockCompany {
  id: string;
  companyId: string;
  name: string;
  companyName: string;
  voen: string;
  industry: string;
  address: string;
  contact: string;
  email: string;
  phone: string;
  employeeLimit: number;
  userLimit: number;
  limit: number;
  UserLimit: number;
  isActive: boolean;
  status: string;
  scanCount: number;
  logo?: string;
  logoUrl?: string;
  nfcBaseUrl?: string;
}

export interface MockUser {
  id: string;
  userId: string;
  employeeId: string;
  companyId: string;
  companyName: string;
  companyVoen: string;
  voen: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  fullName: string;
  jobTitle: string;
  email: string;
  gmail: string;
  password: string;
  role: MockRole;
  phone1: string;
  phone2?: string;
  whatsapp?: string;
  extensionNumber?: string;
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  address?: string;
  additionalInfo?: string;
  googleMapsUrl?: string;
  photo?: string;
  photoUrl?: string;
  photoData?: string;
  cardBackgroundUrl?: string;
  isActive: boolean;
  canEdit: boolean;
  scans: number;
  scanCount: number;
  qrUid: string;
  mustChangePassword: boolean;
  firstLogin: boolean;
  isFirstLogin: boolean;
}

export interface MockAccount {
  email: string;
  password: string;
  role: MockRole;
  companyId?: string;
  companyVoen?: string;
  userId: string;
}

export interface MockDatabase {
  companies: MockCompany[];
  users: MockUser[];
  accounts: MockAccount[];
  auditLogs: Array<Record<string, unknown>>;
  scanLogs: Array<Record<string, unknown>>;
}

const avatar = (initials: string, bg = '5b5ce2') =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <rect width="240" height="240" rx="120" fill="#${bg}"/>
    <text x="120" y="139" text-anchor="middle" font-family="Arial, sans-serif" font-size="78" font-weight="700" fill="white">${initials}</text>
  </svg>`)}`;

const companyLogo = (text: string, bg = '111827') =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120">
    <rect width="320" height="120" rx="24" fill="#${bg}"/>
    <text x="160" y="72" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="white">${text}</text>
  </svg>`)}`;

export const MOCK_COMPANIES: MockCompany[] = [
  {
    id: 'company-setclapp-demo',
    companyId: 'company-setclapp-demo',
    name: 'SetClapp Demo MMC',
    companyName: 'SetClapp Demo MMC',
    voen: '1234567891',
    industry: 'İnformasiya texnologiyaları',
    address: 'Bakı şəhəri, Azərbaycan',
    contact: '+994 12 555 01 01',
    email: 'info@setclapp-demo.az',
    phone: '+994 12 555 01 01',
    employeeLimit: 25,
    userLimit: 25,
    limit: 25,
    UserLimit: 25,
    isActive: true,
    status: 'Aktiv',
    scanCount: 184,
    logo: companyLogo('SETCLAPP'),
    logoUrl: companyLogo('SETCLAPP'),
    nfcBaseUrl: '/card/',
  },
  {
    id: 'company-caspian-demo',
    companyId: 'company-caspian-demo',
    name: 'Caspian Studio',
    companyName: 'Caspian Studio',
    voen: '9876543210',
    industry: 'Dizayn və media',
    address: 'Bakı şəhəri, Nərimanov',
    contact: '+994 12 555 02 02',
    email: 'hello@caspian-demo.az',
    phone: '+994 12 555 02 02',
    employeeLimit: 12,
    userLimit: 12,
    limit: 12,
    UserLimit: 12,
    isActive: true,
    status: 'Aktiv',
    scanCount: 92,
    logo: companyLogo('CASPIAN', '0f766e'),
    logoUrl: companyLogo('CASPIAN', '0f766e'),
    nfcBaseUrl: '/card/',
  },
];

export const MOCK_USERS: MockUser[] = [
  {
    id: 'admin-001', userId: 'admin-001', employeeId: 'admin-001',
    companyId: 'company-setclapp-demo', companyName: 'SetClapp Demo MMC', companyVoen: '1234567891', voen: '1234567891',
    firstName: 'Aysel', lastName: 'Məmmədova', fullName: 'Aysel Məmmədova', jobTitle: 'Company Admin',
    email: 'admin@setclapp.az', gmail: 'admin@setclapp.az', password: '123456', role: 'company-admin',
    phone1: '+994 50 555 11 11', phone2: '+994 55 555 11 11', whatsapp: '+994505551111', extensionNumber: '101',
    linkedin: 'https://linkedin.com', instagram: 'https://instagram.com',
    address: 'Bakı şəhəri', additionalInfo: 'SetClapp demo şirkət administratoru', googleMapsUrl: 'https://maps.google.com',
    photo: avatar('AM'), photoUrl: avatar('AM'), photoData: avatar('AM'),
    isActive: true, canEdit: true, scans: 32, scanCount: 32, qrUid: '11111111-1111-4111-a111-111111111111',
    mustChangePassword: false, firstLogin: false, isFirstLogin: false,
  },
  {
    id: 'employee-001', userId: 'employee-001', employeeId: 'employee-001',
    companyId: 'company-setclapp-demo', companyName: 'SetClapp Demo MMC', companyVoen: '1234567891', voen: '1234567891',
    firstName: 'Gülzar', lastName: 'Hüseynova', fullName: 'Gülzar Hüseynova', jobTitle: 'Frontend Developer',
    email: 'employee@setclapp.az', gmail: 'employee@setclapp.az', password: '123456', role: 'employee',
    phone1: '+994 50 555 22 22', phone2: '+994 70 555 22 22', whatsapp: '+994505552222', extensionNumber: '202',
    linkedin: 'https://linkedin.com', instagram: 'https://instagram.com', facebook: 'https://facebook.com',
    address: 'Bakı şəhəri', additionalInfo: 'React / TypeScript frontend developer', googleMapsUrl: 'https://maps.google.com',
    photo: avatar('GH', '7c3aed'), photoUrl: avatar('GH', '7c3aed'), photoData: avatar('GH', '7c3aed'),
    isActive: true, canEdit: true, scans: 74, scanCount: 74, qrUid: '22222222-2222-4222-a222-222222222222',
    mustChangePassword: false, firstLogin: false, isFirstLogin: false,
  },
  {
    id: 'employee-002', userId: 'employee-002', employeeId: 'employee-002',
    companyId: 'company-setclapp-demo', companyName: 'SetClapp Demo MMC', companyVoen: '1234567891', voen: '1234567891',
    firstName: 'Nigar', lastName: 'Əliyeva', fullName: 'Nigar Əliyeva', jobTitle: 'UI/UX Designer',
    email: 'nigar@setclapp.az', gmail: 'nigar@setclapp.az', password: '123456', role: 'employee',
    phone1: '+994 51 555 33 33', whatsapp: '+994515553333', extensionNumber: '203',
    address: 'Bakı şəhəri', additionalInfo: 'Product designer',
    photo: avatar('NA', 'db2777'), photoUrl: avatar('NA', 'db2777'), photoData: avatar('NA', 'db2777'),
    isActive: true, canEdit: true, scans: 48, scanCount: 48, qrUid: '33333333-3333-4333-a333-333333333333',
    mustChangePassword: false, firstLogin: false, isFirstLogin: false,
  },
  {
    id: 'employee-003', userId: 'employee-003', employeeId: 'employee-003',
    companyId: 'company-caspian-demo', companyName: 'Caspian Studio', companyVoen: '9876543210', voen: '9876543210',
    firstName: 'Murad', lastName: 'Quliyev', fullName: 'Murad Quliyev', jobTitle: 'Art Director',
    email: 'murad@caspian-demo.az', gmail: 'murad@caspian-demo.az', password: '123456', role: 'employee',
    phone1: '+994 50 444 44 44', whatsapp: '+994504444444',
    address: 'Bakı şəhəri, Nərimanov', additionalInfo: 'Creative team',
    photo: avatar('MQ', '0f766e'), photoUrl: avatar('MQ', '0f766e'), photoData: avatar('MQ', '0f766e'),
    isActive: true, canEdit: true, scans: 92, scanCount: 92, qrUid: '44444444-4444-4444-a444-444444444444',
    mustChangePassword: false, firstLogin: false, isFirstLogin: false,
  },
];

export const MOCK_ACCOUNTS: MockAccount[] = [
  { email: 'superadmin@setclapp.az', password: '123456', role: 'super-admin', userId: 'super-admin-001' },
  { email: 'admin@setclapp.az', password: '123456', role: 'company-admin', companyId: 'company-setclapp-demo', companyVoen: '1234567891', userId: 'admin-001' },
  { email: 'employee@setclapp.az', password: '123456', role: 'employee', companyId: 'company-setclapp-demo', companyVoen: '1234567891', userId: 'employee-001' },
  { email: 'nigar@setclapp.az', password: '123456', role: 'employee', companyId: 'company-setclapp-demo', companyVoen: '1234567891', userId: 'employee-002' },
  { email: 'murad@caspian-demo.az', password: '123456', role: 'employee', companyId: 'company-caspian-demo', companyVoen: '9876543210', userId: 'employee-003' },
];

const now = new Date();
const isoDaysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();

export const createDefaultMockDatabase = (): MockDatabase => ({
  companies: structuredClone(MOCK_COMPANIES),
  users: structuredClone(MOCK_USERS),
  accounts: structuredClone(MOCK_ACCOUNTS),
  auditLogs: [
    { id: 'audit-1', date: isoDaysAgo(0), createdAt: isoDaysAgo(0), userId: 'super-admin-001', userName: 'Super Admin', actionType: 'View', entity: 'Dashboard', beforeValue: '', afterValue: '', details: 'Mock dashboard açıldı.' },
    { id: 'audit-2', date: isoDaysAgo(1), createdAt: isoDaysAgo(1), userId: 'admin-001', userName: 'Aysel Məmmədova', actionType: 'Update', entity: 'Company', beforeValue: 'Köhnə məlumat', afterValue: 'Yeni məlumat', details: 'Şirkət məlumatları yeniləndi.', companyId: 'company-setclapp-demo', companyVoen: '1234567891' },
    { id: 'audit-3', date: isoDaysAgo(2), createdAt: isoDaysAgo(2), userId: 'admin-001', userName: 'Aysel Məmmədova', actionType: 'Create', entity: 'Employee', beforeValue: '', afterValue: 'Nigar Əliyeva', details: 'Yeni əməkdaş yaradıldı.', companyId: 'company-setclapp-demo', companyVoen: '1234567891' },
  ],
  scanLogs: [
    { id: 'scan-1', employeeId: 'employee-001', userName: 'Gülzar Hüseynova', email: 'employee@setclapp.az', companyId: 'company-setclapp-demo', date: isoDaysAgo(0), createdAt: isoDaysAgo(0), status: 'active' },
    { id: 'scan-2', employeeId: 'employee-002', userName: 'Nigar Əliyeva', email: 'nigar@setclapp.az', companyId: 'company-setclapp-demo', date: isoDaysAgo(1), createdAt: isoDaysAgo(1), status: 'active' },
    { id: 'scan-3', employeeId: 'employee-001', userName: 'Gülzar Hüseynova', email: 'employee@setclapp.az', companyId: 'company-setclapp-demo', date: isoDaysAgo(3), createdAt: isoDaysAgo(3), status: 'active' },
    { id: 'scan-4', employeeId: 'employee-003', userName: 'Murad Quliyev', email: 'murad@caspian-demo.az', companyId: 'company-caspian-demo', date: isoDaysAgo(2), createdAt: isoDaysAgo(2), status: 'active' },
  ],
});

export const MOCK_LOGIN_HELP = [
  { label: 'Super Admin', email: 'superadmin@setclapp.az', password: '123456', voen: '' },
  { label: 'Company Admin', email: 'admin@setclapp.az', password: '123456', voen: '1234567891' },
  { label: 'Employee', email: 'employee@setclapp.az', password: '123456', voen: '1234567891' },
] as const;
