import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Avatar, Button, Dropdown, Modal, Pagination, Segmented, Space, Switch, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {CalendarOutlined,ContactsOutlined,DownloadOutlined,DownOutlined,EditOutlined,EnvironmentOutlined,EyeOutlined,FileExcelOutlined,FacebookOutlined,GlobalOutlined,Html5Outlined,ImportOutlined,KeyOutlined,LoadingOutlined,MailOutlined,InstagramOutlined,LinkedinOutlined,PhoneOutlined,QrcodeOutlined,SendOutlined,MessageOutlined,TeamOutlined,UserOutlined,WhatsAppOutlined,YoutubeOutlined,} from '@ant-design/icons';
import type { UserData } from '../../../../types/company-admin.type';
import { stripSocialLinksFromAdditionalInfo } from '../../../../features/profile/profile-info';
import { getEmployeePhotoFromRecord } from '../../../../features/public-card/public-card-shared';
import type {BusinessCardTableRow,EmployeeStatusTab,ExportLoadingType,TablePaginationState,} from '../../../../types/business-card.type';

const customLinkIcon = (platformName?: string, iconUrl?: string) => {
  if (iconUrl) return <img src={iconUrl} alt="" />;

  const key = String(platformName || '').trim().toLowerCase();
  if (key.includes('linkedin')) return <LinkedinOutlined />;
  if (key.includes('facebook')) return <FacebookOutlined />;
  if (key.includes('instagram')) return <InstagramOutlined />;
  if (key.includes('youtube')) return <YoutubeOutlined />;
  if (key.includes('whatsapp')) return <WhatsAppOutlined />;
  if (key.includes('telegram')) return <SendOutlined />;
  if (key.includes('mesaj') || key.includes('message') || key.includes('sms')) return <MessageOutlined />;
  if (key.includes('email') || key.includes('mail')) return <MailOutlined />;
  if (key.includes('telefon') || key.includes('phone') || key.includes('tel')) return <PhoneOutlined />;
  return <GlobalOutlined />;
};

interface BusinessCardToolbarProps {
  activeUsersCount: number;
  archivedUsersCount: number;
  currentEmployeesCount: number;
  employeeLimit: number;
  isLimitReached: boolean;
  exportLoading: ExportLoadingType;
  onOpenImport: () => void;
  onOpenAdd: () => void;
  onExportExcel: () => void | Promise<void>;
  onOpenHtmlExport: () => void;
}

export function BusinessCardToolbar({
  activeUsersCount,
  archivedUsersCount,
  currentEmployeesCount,
  employeeLimit,
  isLimitReached,
  exportLoading,
  onOpenImport,
  onOpenAdd,
  onExportExcel,
  onOpenHtmlExport,
}: BusinessCardToolbarProps) {
  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'excel',
      icon: exportLoading === 'excel' ? <LoadingOutlined /> : <FileExcelOutlined style={{ color: '#5aa8e8' }} />,
      label: 'Excel ixrac (.xlsx)',
      onClick: onExportExcel,
      disabled: exportLoading !== null,
    },
    {
      key: 'html',
      icon: exportLoading === 'html' ? <LoadingOutlined /> : <Html5Outlined style={{ color: '#5aa8e8' }} />,
      label: 'HTML ixrac (.html)',
      onClick: onOpenHtmlExport,
      disabled: exportLoading !== null,
    },
  ];

  return (
    <Space className="business-card-toolbar" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
      <div>
        <h2 style={{ margin: 0 }}>Vizit kartlar</h2>
        <p style={{ margin: 0, color: '#64748b' }}>
          Aktiv: {activeUsersCount} / Deaktiv: {archivedUsersCount} / Limit: {currentEmployeesCount}/{employeeLimit}
        </p>
      </div>

      <Space className="business-card-toolbar-actions" wrap>
        <Button className="ca-white-action-button" icon={<ImportOutlined />} onClick={onOpenImport}>
          İdxal
        </Button>

        <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
          <Button className="ca-white-action-button" icon={<DownloadOutlined />} loading={exportLoading !== null}>
            İxrac <DownOutlined />
          </Button>
        </Dropdown>

        <Tooltip title={isLimitReached ? `Limit aşılıb. Maksimum ${employeeLimit} işçi ola bilər.` : ''}>
          <Button type="primary" icon={<TeamOutlined />} disabled={isLimitReached} onClick={onOpenAdd}>
            Yeni işçi əlavə et
          </Button>
        </Tooltip>
      </Space>
    </Space>
  );
}

interface EmployeesTableProps {
  employeeStatusTab: EmployeeStatusTab;
  activeUsersCount: number;
  archivedUsersCount: number;
  visibleUsersLength: number;
  safeCurrent: number;
  tablePagination: TablePaginationState;
  tableRows: BusinessCardTableRow[];
  companyName: string;
  companyLogo?: string;
  companyCardBackground?: string;
  protectedAdminKeys: string[];
  vcfLoadingId: string | null;
  qrLoadingId: string | null;
  setTablePagination: Dispatch<SetStateAction<TablePaginationState>>;
  onStatusTabChange: (value: string | number) => void;
  onOpenEditUser: (user: UserData) => void;
  onToggleUserStatus: (id: string, currentStatus: boolean) => void | Promise<void>;
  onToggleUserCanEdit: (id: string, currentCanEdit: boolean) => void | Promise<void>;
  onDownloadVcf: (user: UserData) => void | Promise<void>;
  onDownloadQr: (user: UserData) => void | Promise<void>;
  onViewPublicCard: (user: UserData) => void;
  onOpenResetPassword: (user: UserData) => void;
}

const cleanText = (value?: string) => {
  const text = String(value || '').trim();
  return text && text.toLowerCase() !== 'string' ? text : '';
};

const employeeHref = (value?: string, platformName?: string) => {
  const text = cleanText(value);
  const platform = cleanText(platformName).toLowerCase();
  if (!text || /^(https?:\/\/|mailto:|tel:|sms:)/i.test(text)) return text;

  if (platform.includes('telefon') || platform.includes('phone')) return `tel:${text}`;
  if (platform.includes('email') || platform.includes('mail')) return `mailto:${text}`;
  if (platform.includes('mesaj') || platform.includes('message') || platform.includes('sms')) return `sms:${text}`;
  if (platform.includes('whatsapp')) return `https://wa.me/${text.replace(/\D/g, '')}`;
  if (platform.includes('telegram') && text.startsWith('@')) return `https://t.me/${text.slice(1)}`;

  return `https://${text}`;
};

const isPrimarySocialLink = (platformName?: string, profileUrl?: string) => {
  const marker = `${cleanText(platformName)} ${cleanText(profileUrl)}`.toLowerCase();
  return ['linkedin', 'facebook', 'instagram'].some((key) => marker.includes(key));
};

const employeeName = (user: UserData) => {
  const fullName = [cleanText(user.firstName), cleanText(user.lastName)].filter(Boolean).join(' ');
  return fullName || cleanText(user.email) || 'İşçi';
};

const formatBirthDate = (value?: string) => {
  const text = cleanText(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : text;
};

const employeeInitials = (user: UserData) => {
  const first = cleanText(user.firstName).charAt(0);
  const last = cleanText(user.lastName).charAt(0);
  return `${first}${last}`.toUpperCase() || 'İ';
};

export function EmployeesTable({
  employeeStatusTab,
  activeUsersCount,
  archivedUsersCount,
  visibleUsersLength,
  safeCurrent,
  tablePagination,
  tableRows,
  companyName,
  companyCardBackground,
  protectedAdminKeys,
  vcfLoadingId,
  qrLoadingId,
  setTablePagination,
  onStatusTabChange,
  onOpenEditUser,
  onToggleUserStatus,
  onToggleUserCanEdit,
  onDownloadVcf,
  onDownloadQr,
  onViewPublicCard,
  onOpenResetPassword,
}: EmployeesTableProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<UserData | null>(null);

  const selectedStatus = selectedEmployee?.isActive !== false;
  const selectedCanEdit = selectedEmployee?.canEdit !== false;
  const normalizeIdentity = (value: unknown) => String(value || '').trim().toLowerCase();
  const isProtectedAdmin = (user?: UserData | null) => {
    if (!user) return false;
    const keys = [user.id, user.email].map(normalizeIdentity).filter(Boolean);
    return keys.some((key) => protectedAdminKeys.includes(key));
  };

  const selectedCompanyName = useMemo(
    () => cleanText(selectedEmployee?.companyName) || cleanText(companyName) || 'Şirkət',
    [companyName, selectedEmployee?.companyName],
  );

  const selectedCardBackground = cleanText(selectedEmployee?.cardBackgroundUrl) || cleanText(companyCardBackground);
  const selectedCustomLinks = useMemo(
    () => (selectedEmployee?.socialAccounts || []).filter((item) => (
      !isPrimarySocialLink(item.platformName, item.profileUrl)
    )),
    [selectedEmployee?.socialAccounts],
  );
  const selectedAdditionalInfo = stripSocialLinksFromAdditionalInfo(
    selectedEmployee?.additionalInfo,
    [selectedEmployee?.linkedin, selectedEmployee?.facebook, selectedEmployee?.instagram],
  );

  const closePreview = () => setSelectedEmployee(null);

  const openEditFromPreview = () => {
    if (!selectedEmployee) return;
    const employee = selectedEmployee;
    closePreview();
    onOpenEditUser(employee);
  };

  const openPasswordFromPreview = () => {
    if (!selectedEmployee) return;
    const employee = selectedEmployee;
    closePreview();
    onOpenResetPassword(employee);
  };

  const handleStatusChange = async () => {
    if (!selectedEmployee) return;
    if (selectedStatus && isProtectedAdmin(selectedEmployee)) return;
    await onToggleUserStatus(selectedEmployee.id, selectedStatus);
    setSelectedEmployee((previous) => previous ? { ...previous, isActive: !selectedStatus } : previous);
  };

  const handleListStatusChange = async (record: UserData, checked: boolean) => {
    const currentStatus = record.isActive !== false;
    if (checked === currentStatus) return;
    if (!checked && isProtectedAdmin(record)) return;
    await onToggleUserStatus(record.id, currentStatus);
  };

  const handleCanEditChange = async (checked: boolean) => {
    if (!selectedEmployee) return;
    await onToggleUserCanEdit(selectedEmployee.id, !checked);
    setSelectedEmployee((previous) => previous ? { ...previous, canEdit: checked } : previous);
  };

  return (
    <>
      <div className="employee-card-tabs">
        <Segmented
          value={employeeStatusTab}
          onChange={onStatusTabChange}
          options={[
            { label: `Aktiv (${activeUsersCount})`, value: 'active' },
            { label: `Deaktiv (${archivedUsersCount})`, value: 'inactive' },
          ]}
        />
      </div>

      {tableRows.length === 0 ? (
        <div className="employee-card-empty">
          {employeeStatusTab === 'active' ? 'Aktiv işçi tapılmadı' : 'Deaktiv işçi tapılmadı'}
        </div>
      ) : (
        <div className="employee-card-grid">
          {tableRows.map((record) => (
            <div
              key={record.__tableRowKey}
              className="employee-list-card"
              onClick={() => setSelectedEmployee(record)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') setSelectedEmployee(record);
              }}
              role="button"
              tabIndex={0}
            >
              <div className="employee-list-card-top">
                <Avatar
                  size={54}
                  src={getEmployeePhotoFromRecord(record as unknown as Record<string, unknown>) || undefined}
                  icon={<UserOutlined />}
                  className="employee-list-avatar"
                >
                  {employeeInitials(record)}
                </Avatar>

                <div className="employee-list-card-main">
                  <div className="employee-list-name-row">
                    <strong>{employeeName(record)}</strong>
                    <span className="employee-list-card-actions">
                      {!isProtectedAdmin(record) && (
                        <Tooltip title={record.isActive !== false ? 'Deaktiv et' : 'Aktiv et'}>
                          <Switch
                            size="small"
                            checked={record.isActive !== false}
                            onClick={(_checked, event) => event.stopPropagation()}
                            onChange={(checked, event) => {
                              event.stopPropagation();
                              void handleListStatusChange(record, checked);
                            }}
                          />
                        </Tooltip>
                      )}

                      <Tooltip title="Public card-a bax">
                        <Button
                          type="text"
                          shape="circle"
                          className="employee-public-view-button"
                          icon={<EyeOutlined />}
                          aria-label={`${employeeName(record)} public card-a bax`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onViewPublicCard(record);
                          }}
                        />
                      </Tooltip>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {visibleUsersLength > 0 && (
        <div className="employee-card-pagination">
          <Pagination
            current={safeCurrent}
            pageSize={tablePagination.pageSize}
            total={visibleUsersLength}
            showSizeChanger={false}
            showLessItems
            responsive
            pageSizeOptions={['5', '10', '20', '50']}
            showTotal={(total, range) => `${range[0]}-${range[1]} / ${total} əməkdaş`}
            onChange={(current, pageSize) => setTablePagination({ current, pageSize })}
          />
        </div>
      )}

      <Modal
        open={Boolean(selectedEmployee)}
        onCancel={closePreview}
        footer={null}
        destroyOnHidden
        width={460}
        centered
        className="employee-business-card-modal"
        title={null}
      >
        {selectedEmployee && (
          <div className="employee-business-card ca-admin-profile-card">
            <div
              className="ca-admin-profile-cover employee-business-card-cover"
              style={selectedCardBackground
                ? {
                    backgroundImage: `linear-gradient(180deg,rgba(255,255,255,.08),rgba(18,51,74,.18)),url("${selectedCardBackground.replace(/"/g, '%22')}")`,
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundColor: '#f4f8fb',
                  }
                : undefined}
            />

            <div className="ca-admin-profile-main employee-business-card-body">
              <div className="ca-admin-profile-avatar-wrap">
                <Avatar
                  size={112}
                  src={getEmployeePhotoFromRecord(selectedEmployee as unknown as Record<string, unknown>) || undefined}
                  icon={<UserOutlined />}
                  className="ca-admin-profile-avatar employee-preview-avatar"
                >
                  {employeeInitials(selectedEmployee)}
                </Avatar>
              </div>

              <Button type="primary" icon={<EditOutlined />} onClick={openEditFromPreview} className="ca-admin-profile-edit-main">
                Redaktə et
              </Button>

              <div className="ca-admin-profile-identity employee-preview-heading">
                <h1>{employeeName(selectedEmployee)}</h1>
                <p>{cleanText(selectedEmployee.jobTitle) || 'Vəzifə qeyd edilməyib'}</p>
                <strong>{selectedCompanyName}</strong>
              </div>

              {selectedAdditionalInfo && (
                <div className="ca-admin-profile-bio">{selectedAdditionalInfo}</div>
              )}

              {cleanText(selectedEmployee.dateOfBirth) && (
                <section className="ca-admin-card-section employee-preview-section">
                  <div className="ca-admin-business-links">
                    <div>
                      <span className="ca-admin-business-icon"><CalendarOutlined /></span>
                      <strong>Doğum tarixi: {formatBirthDate(selectedEmployee.dateOfBirth)}</strong>
                    </div>
                  </div>
                </section>
              )}

              <div className="ca-admin-profile-primary-actions employee-preview-primary-actions">
                <Button
                  className="ca-white-action-button"
                  icon={vcfLoadingId === selectedEmployee.id ? <LoadingOutlined /> : <ContactsOutlined />}
                  disabled={vcfLoadingId === selectedEmployee.id}
                  onClick={() => onDownloadVcf(selectedEmployee)}
                >
                  Kontakta əlavə et
                </Button>
                <Button
                  className="ca-white-action-button"
                  icon={<PhoneOutlined />}
                  href={cleanText(selectedEmployee.phone1)
                    ? `tel:${selectedEmployee.phone1}`
                    : cleanText(selectedEmployee.email)
                      ? `mailto:${selectedEmployee.email}`
                      : undefined}
                  disabled={!cleanText(selectedEmployee.phone1) && !cleanText(selectedEmployee.email)}
                >
                  Əlaqə
                </Button>
              </div>

              {(cleanText(selectedEmployee.phone1) || cleanText(selectedEmployee.email) || cleanText(selectedEmployee.whatsapp)) && (
                <section className="ca-admin-card-section employee-preview-section">
                  <h3>Əlaqə</h3>
                  <div className="ca-admin-contact-grid">
                    {cleanText(selectedEmployee.phone1) && <a href={`tel:${selectedEmployee.phone1}`} aria-label="Zəng et"><PhoneOutlined /></a>}
                    {cleanText(selectedEmployee.email) && <a href={`mailto:${selectedEmployee.email}`} aria-label="E-poçt"><MailOutlined /></a>}
                    {cleanText(selectedEmployee.whatsapp) && (
                      <a href={`https://wa.me/${selectedEmployee.whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                        <WhatsAppOutlined />
                      </a>
                    )}
                  </div>
                </section>
              )}

              {(cleanText(selectedEmployee.linkedin) || cleanText(selectedEmployee.facebook) || cleanText(selectedEmployee.instagram)) && (
                <section className="ca-admin-card-section employee-preview-section">
                  <h3>Sosial media</h3>
                  <div className="ca-admin-social-grid">
                    {cleanText(selectedEmployee.linkedin) && <a href={selectedEmployee.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn"><LinkedinOutlined /></a>}
                    {cleanText(selectedEmployee.facebook) && <a href={selectedEmployee.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><FacebookOutlined /></a>}
                    {cleanText(selectedEmployee.instagram) && <a href={selectedEmployee.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><InstagramOutlined /></a>}
                  </div>
                </section>
              )}

              {selectedCustomLinks.length > 0 && (
                <section className="ca-admin-card-section employee-preview-section">
                  <h3>Linklər</h3>
                  <div className="ca-admin-business-links">
                    {selectedCustomLinks.map((item, index) => (
                      <a key={`${item.platformName}-${index}`} href={employeeHref(item.profileUrl, item.platformName)} target="_blank" rel="noreferrer">
                        <span className="ca-admin-business-icon employee-custom-preview-icon">
                          {customLinkIcon(item.platformName, item.iconUrl)}
                        </span>
                        <strong>{item.platformName || 'Link'}</strong>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {cleanText(selectedEmployee.googleMapsUrl) && (
                <section className="ca-admin-card-section employee-preview-section">
                  <h3>Google Maps</h3>
                  <div className="ca-admin-business-links">
                    <a href={employeeHref(selectedEmployee.googleMapsUrl)} target="_blank" rel="noreferrer">
                      <span className="ca-admin-business-icon"><EnvironmentOutlined /></span>
                      <strong>{cleanText(selectedEmployee.address) || 'Google Maps ünvanı'}</strong>
                    </a>
                  </div>
                </section>
              )}

              <div className="employee-preview-settings">
                <div>
                  <span>Redaktə icazəsi</span>
                  <Switch checked={selectedCanEdit} onChange={handleCanEditChange} />
                </div>
                {!isProtectedAdmin(selectedEmployee) && (
                  <div>
                    <span>Status</span>
                    <Switch
                      checked={selectedStatus}
                      checkedChildren="Aktiv"
                      unCheckedChildren="Deaktiv"
                      onChange={() => void handleStatusChange()}
                    />
                  </div>
                )}
              </div>

              <div className="employee-preview-actions">
                <Button className="ca-white-action-button" icon={<KeyOutlined />} onClick={openPasswordFromPreview}>
                  Kodu dəyiş
                </Button>
                <Button
                  className="ca-white-action-button"
                  icon={qrLoadingId === selectedEmployee.id ? <LoadingOutlined /> : <QrcodeOutlined />}
                  disabled={qrLoadingId === selectedEmployee.id}
                  onClick={() => onDownloadQr(selectedEmployee)}
                >
                  QR kod
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
