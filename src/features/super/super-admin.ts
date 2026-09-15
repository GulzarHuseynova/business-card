import type { ApiCompany, CompanyCreateFormValues, CompanyEditFormValues } from '../../types/super.type';

export type CreatedAdminInfo = {
  company: ApiCompany;
  companyName: string;
  voen: string;
  email: string;
  password: string;
  address: string;
  contact: string;
  companyEmail: string;
  phone: string;
  limit: number;
  logoName: string;
};

export const getCompanyInitials = (name: string) => {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'Ş'
  );
};

export const getCompanyName = (company: ApiCompany) => company.companyName || company.name || 'Şirkət';
export const getCompanyEmail = (company: ApiCompany) => company.adminEmail || company.gmail || company.email || '';
export const getCompanyBusinessEmail = (company: ApiCompany) => company.companyEmail || company.email || '';
export const getCompanyPhone = (company: ApiCompany) => company.phone || company.contact || '';
export const getCompanyContact = (company: ApiCompany) => company.contact || company.phone || company.email || '';
export const getCompanyLogo = (company: ApiCompany) => company.logoUrl || company.logo || '';
export const getCompanyLimit = (company: ApiCompany) => company.employeeLimit ?? company.limit ?? company.userLimit ?? company.UserLimit ?? 0;

export const fileToLogoDataUrl = (file: File, maxSize = 360) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  const image = new Image();

  reader.onerror = () => reject(new Error('Loqo oxunmadı.'));
  image.onerror = () => reject(new Error('Loqo şəkli yüklənmədi.'));

  reader.onload = (event) => {
    image.src = String(event.target?.result || '');
  };

  image.onload = () => {
    const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);

    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    resolve(canvas.toDataURL(mime, 0.86));
  };

  reader.readAsDataURL(file);
});

export const normalizeCompanyForUi = (company: ApiCompany, fallback?: CompanyCreateFormValues | CompanyEditFormValues): ApiCompany => {
  const limit = Number(company.employeeLimit ?? company.limit ?? company.userLimit ?? company.UserLimit ?? fallback?.employeeLimit ?? 0);

  return {
    ...company,
    name: getCompanyName(company) || fallback?.companyName || 'Şirkət',
    companyName: getCompanyName(company) || fallback?.companyName || 'Şirkət',
    voen: company.voen || fallback?.voen || '',
    address: company.address || fallback?.address || '',
    email: company.email || fallback?.email || '',
    companyEmail: company.companyEmail || fallback?.email || '',
    phone: company.phone || fallback?.phone || fallback?.contact || '',
    contact: getCompanyContact(company) || fallback?.phone || fallback?.contact || '',
    logo: getCompanyLogo(company) || fallback?.logoUrl || fallback?.logo || '',
    logoUrl: getCompanyLogo(company) || fallback?.logoUrl || fallback?.logo || '',
    employeeLimit: limit,
    limit,
    userLimit: limit,
    UserLimit: limit,
    isActive: company.isActive ?? true,
  };
};
