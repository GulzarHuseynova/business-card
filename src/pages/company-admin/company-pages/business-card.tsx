import { useMemo, useState } from 'react';
import { Button, Checkbox, Form, Input, Modal, Space, message } from 'antd';
import { exportImportActions } from '../../../helpers/export-import.helper';
import {downloadQrByFormat,downloadVCard,getPublicCardUrl,normalizeUserToPublicProfile,savePublicCardProfilesFromUsers,} from '../../../features/public-card/public-card';
import { useCompanyAdmin } from '../../../hooks/use-company-admin';
import { DownloadOutlined, FileExcelOutlined, KeyOutlined } from '@ant-design/icons';
import type { AddUserFormValues, UserData } from '../../../types/company-admin.type';
import { BusinessCardToolbar, EmployeesTable } from './business-card/business-card-sections';
import { AddEmployeeModal, EditEmployeeModal, HtmlExportModal, ImportEmployeesModal } from './business-card/business-card-modals';
import type { BusinessCardTableRow, EmployeeStatusTab, ExportLoadingType, ImportResultState } from '../../../types/business-card.type';
import {buildSwaggerExportCsv,buildTemplateCsv,downloadTextFile,employeeDedupKey,employeeRowKey,fileToDataUrl,isSuperAdminRow,parseEmployeesCsv,userIdentity,validateImportedEmployee,} from '../../../features/company-admin/business-card';
import { stripSocialLinksFromAdditionalInfo } from '../../../features/profile/profile-info';
import { normalizePhoneForBackend, normalizePhoneForInput } from '../../../utils/phone.utils';
import { getSavedCompanyCardBackground } from '../../../features/company/company-card-theme';
import { readRuntimeCompanyAdminProfile } from '../../../features/company-admin/runtime-profile';
import { getEmployeePhotoFromRecord } from '../../../features/public-card/public-card-shared';
import { normalizeInlineImageData } from '../../../utils/asset-url.utils';
import { useAuthSelector } from '../../../store/authStore';
import { getStoredUser } from '../../../storage/auth.storage';

export default function BusinessCard() {
  const {
    company,
    usersList,
    activeCompanyId,
    currentEmployeesCount,
    isLimitReached,
    addUser,
    updateUser,
    fetchUsers,
    toggleUserStatus,
    toggleUserCanEdit,
    resetUserPassword,
  } = useCompanyAdmin();
  const authUserId = useAuthSelector((state) => state.userId);
  const accountInfo = useAuthSelector((state) => state.accountInfo);

  const [form] = Form.useForm<AddUserFormValues>();
  const [editForm] = Form.useForm<Partial<AddUserFormValues>>();
  const [resetPasswordForm] = Form.useForm<{ newPassword: string }>();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState<ExportLoadingType>(null);
  const [qrLoadingId, setQrLoadingId] = useState<string | null>(null);
  const [vcfLoadingId, setVcfLoadingId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [employeeStatusTab, setEmployeeStatusTab] = useState<EmployeeStatusTab>('active');
  const [tablePagination, setTablePagination] = useState({ current: 1, pageSize: 10 });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResultState | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEditUserId, setSelectedEditUserId] = useState('');
  const [editSubmitLoading, setEditSubmitLoading] = useState(false);
  const [editPhotoPreview, setEditPhotoPreview] = useState('');
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [isHtmlExportModalOpen, setIsHtmlExportModalOpen] = useState(false);
  const [selectedHtmlExportIds, setSelectedHtmlExportIds] = useState<string[]>([]);
  const [isExcelExportModalOpen, setIsExcelExportModalOpen] = useState(false);
  const [selectedExcelExportIds, setSelectedExcelExportIds] = useState<string[]>([]);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserData | null>(null);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  const companyCardBackground = getSavedCompanyCardBackground(
    activeCompanyId || company.id,
    company.voen,
  ) || readRuntimeCompanyAdminProfile().cardBackgroundUrl || '';

  const protectedAdminKeys = useMemo(() => {
    const stored = getStoredUser();
    const accountRecord = accountInfo && typeof accountInfo === 'object'
      ? accountInfo as Record<string, unknown>
      : {};

    return [
      authUserId,
      stored?.userId,
      stored?.id,
      stored?.email,
      accountRecord.userId,
      accountRecord.id,
      accountRecord.email,
      accountRecord.gmail,
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
  }, [accountInfo, authUserId]);

  const companyUsers = useMemo(
    () => usersList.filter((user) => !isSuperAdminRow(user)),
    [usersList],
  );

  const activeUsers = useMemo(
    () => companyUsers.filter((user) => user.isActive !== false),
    [companyUsers],
  );

  const archivedUsers = useMemo(
    () => companyUsers.filter((user) => user.isActive === false),
    [companyUsers],
  );

  const visibleUsersRaw = employeeStatusTab === 'active' ? activeUsers : archivedUsers;
  const visibleUsers = useMemo(() => {
    const seen = new Set<string>();

    return visibleUsersRaw.filter((user) => {
      const key = employeeDedupKey(user);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [visibleUsersRaw]);

  const exportableUsers = companyUsers.filter((user) => Boolean(userIdentity(user)));

  const selectedEditUser = useMemo(() => {
    return companyUsers.find((user) => userIdentity(user) === selectedEditUserId);
  }, [companyUsers, selectedEditUserId]);

  const totalPages = Math.max(1, Math.ceil(visibleUsers.length / tablePagination.pageSize));
  const safeCurrent = Math.min(tablePagination.current, totalPages);

  const pagedUsers = visibleUsers.slice(
    (safeCurrent - 1) * tablePagination.pageSize,
    safeCurrent * tablePagination.pageSize,
  );

  const tableRows: BusinessCardTableRow[] = pagedUsers.map((user, index) => ({
    ...user,
    __tableRowKey: [
      employeeRowKey(user) || 'employee',
      safeCurrent,
      index,
      user.email || 'no-email',
      user.phone1 || 'no-phone',
    ].join('-'),
  }));

  const handlePhotoSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('Zəhmət olmasa şəkil faylı seçin.');
      return false;
    }

    try {
      const photoUrl = await fileToDataUrl(file);
      setPhotoFile(file);
      setPhotoPreview(photoUrl);
      form.setFieldsValue({ photo: photoUrl, photoUrl });
      message.success('Foto seçildi və məlumat yenilənəndə saxlanacaq.');
    } catch {
      message.error('Şəkli oxumaq mümkün olmadı.');
    }

    return false;
  };

  const openAddModal = () => {
    form.resetFields();
    setPhotoFile(null);
    setPhotoPreview('');
    setIsModalOpen(true);
  };

  const closeAddModal = () => {
    setIsModalOpen(false);
    form.resetFields();
    setPhotoFile(null);
    setPhotoPreview('');
  };


  const normalizeBirthDateForBackend = (value?: string) => {
    const text = String(value || '').trim();
    if (!text) return '';

    const displayMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (displayMatch) return `${displayMatch[3]}-${displayMatch[2]}-${displayMatch[1]}`;

    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return isoMatch ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` : text;
  };

  const handleAddUser = async (values: AddUserFormValues) => {
    try {
      setSubmitLoading(true);
      await addUser({
        ...values,
        phone1: normalizePhoneForBackend(values.phone1),
        phone2: normalizePhoneForBackend(values.phone2),
        whatsapp: normalizePhoneForBackend(values.whatsapp),
        photo: photoPreview || values.photo || '',
        photoUrl: photoPreview || values.photoUrl || '',
        photoData: normalizeInlineImageData(photoPreview || values.photoData || values.photoUrl || values.photo),
        photoFile: photoFile || undefined,
        dateOfBirth: normalizeBirthDateForBackend(values.dateOfBirth),
      });
      closeAddModal();
    } finally {
      setSubmitLoading(false);
    }
  };

  const openExcelExportModal = () => {
    setSelectedExcelExportIds([]);
    setIsExcelExportModalOpen(true);
  };

  const handleExportSelectedExcel = async () => {
    if (selectedExcelExportIds.length === 0) {
      message.warning('Ən azı bir işçi seçin.');
      return;
    }

    const selectedUsers = companyUsers.filter((user) => selectedExcelExportIds.includes(userIdentity(user)));

    setExportLoading('excelSelected');

    try {
      await exportImportActions.exportSelectedExcel(selectedExcelExportIds);
      message.success('Seçilmiş işçilər Excel (.xlsx) kimi yükləndi.');
      setIsExcelExportModalOpen(false);
    } catch {
      downloadTextFile(buildSwaggerExportCsv(selectedUsers, company.name), `selected-users-${activeCompanyId || 'company'}.csv`);
      message.warning('Backend seçilmiş Excel yüklənmədi, ehtiyat CSV yaradıldı.');
    } finally {
      setExportLoading(null);
    }
  };

  const openHtmlExportModal = () => {
    setSelectedHtmlExportIds([]);
    setIsHtmlExportModalOpen(true);
  };

  const handleExportSelectedHtml = async () => {
    if (selectedHtmlExportIds.length === 0) {
      message.warning('Ən azı bir işçi seçin.');
      return;
    }

    const selectedUsers = companyUsers.filter((user) => selectedHtmlExportIds.includes(userIdentity(user)));

    setExportLoading('htmlSelected');

    try {
      if (selectedHtmlExportIds.length === 1) {
        await exportImportActions.exportHtmlUser(selectedHtmlExportIds[0], selectedUsers[0]);
      } else {
        await exportImportActions.exportSelectedHtml(selectedHtmlExportIds, selectedUsers);
      }

      message.success('Seçilmiş işçilərin offline HTML faylı yükləndi.');
      setIsHtmlExportModalOpen(false);
    } catch {
      message.error('Swagger seçilmiş HTML endpointi fayl qaytarmadı. Lokal fərqli template yaradılmadı.');
    } finally {
      setExportLoading(null);
    }
  };

  const preserveExistingValue = <T,>(nextValue: T | undefined, currentValue: T | undefined) => {
    if (nextValue === undefined || nextValue === null) return currentValue;
    if (typeof nextValue === 'string' && nextValue.trim() === '') return currentValue;
    return nextValue;
  };

  const socialValueFromAdditionalInfo = (value: unknown, key: 'linkedin' | 'facebook' | 'instagram') => {
    const text = String(value || '');
    const row = text.split(/[;\n]+/).find((part) => part.toLowerCase().includes(key));
    if (!row) return '';
    const [, ...rest] = row.split(':');
    return rest.join(':').trim();
  };

  const socialValueFromUser = (user: UserData, key: 'linkedin' | 'facebook' | 'instagram') => {
    const record = user as unknown as Record<string, unknown>;
    if (key === 'linkedin') return String(record.linkedin || record.linkedinUrl || record.linkedInUrl || socialValueFromAdditionalInfo(record.additionalInfo, key) || '');
    if (key === 'facebook') return String(record.facebook || record.facebookUrl || socialValueFromAdditionalInfo(record.additionalInfo, key) || '');
    return String(record.instagram || record.instagramUrl || socialValueFromAdditionalInfo(record.additionalInfo, key) || '');
  };

  const normalizeBirthDateForInput = (value?: string) => {
    const text = String(value || '').trim();
    if (!text) return '';

    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    const dottedMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (dottedMatch) {
      const day = dottedMatch[1].padStart(2, '0');
      const month = dottedMatch[2].padStart(2, '0');
      const year = dottedMatch[3];
      return `${year}-${month}-${day}`;
    }

    return text;
  };

  const openEditUser = (user: UserData) => {
    setSelectedEditUserId(userIdentity(user));
    setEditPhotoFile(null);
    setEditPhotoPreview(getEmployeePhotoFromRecord(user as unknown as Record<string, unknown>));
    editForm.setFieldsValue({
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      jobTitle: user.jobTitle,
      email: user.email,
      phone1: normalizePhoneForInput(user.phone1),
      phone2: normalizePhoneForInput(user.phone2),
      extensionNumber: user.extensionNumber,
      whatsapp: normalizePhoneForInput(user.whatsapp),
      linkedin: socialValueFromUser(user, 'linkedin'),
      facebook: socialValueFromUser(user, 'facebook'),
      instagram: socialValueFromUser(user, 'instagram'),
      photo: getEmployeePhotoFromRecord(user as unknown as Record<string, unknown>),
      photoUrl: user.photoUrl || user.photo,
      photoData: user.photoData || normalizeInlineImageData(user.photo || user.photoUrl),
      additionalInfo: stripSocialLinksFromAdditionalInfo(user.additionalInfo, [
        socialValueFromUser(user, 'linkedin'),
        socialValueFromUser(user, 'facebook'),
        socialValueFromUser(user, 'instagram'),
      ]),
      dateOfBirth: normalizeBirthDateForInput(user.dateOfBirth),
      address: user.address,
      googleMapsUrl: user.googleMapsUrl,
      cardBackgroundUrl: user.cardBackgroundUrl,
      socialAccounts: user.socialAccounts || [],
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedEditUserId('');
    setEditPhotoFile(null);
    setEditPhotoPreview('');
    editForm.resetFields();
  };

  const handleEditPhotoSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('Zəhmət olmasa şəkil faylı seçin.');
      return false;
    }

    try {
      const photoUrl = await fileToDataUrl(file);
      setEditPhotoFile(file);
      setEditPhotoPreview(photoUrl);
      editForm.setFieldsValue({ photo: photoUrl, photoUrl });
      message.success('Foto seçildi və məlumat yenilənəndə saxlanacaq.');
    } catch {
      message.error('Şəkli oxumaq mümkün olmadı.');
    }

    return false;
  };

  const handleEditUser = async (values: Partial<AddUserFormValues>) => {
    if (!selectedEditUser) {
      message.warning('Əvvəlcə işçi seçin.');
      return;
    }

    const userId = selectedEditUser.id || selectedEditUser.email;

    try {
      setEditSubmitLoading(true);
      message.loading({ key: 'employee-edit-save', content: 'Məlumatlar yadda saxlanılır...', duration: 0 });
      const mergedValues = {
        firstName: preserveExistingValue(values.firstName, selectedEditUser.firstName),
        lastName: preserveExistingValue(values.lastName, selectedEditUser.lastName),
        middleName: preserveExistingValue(values.middleName, selectedEditUser.middleName),
        jobTitle: preserveExistingValue(values.jobTitle, selectedEditUser.jobTitle),
        phone1: preserveExistingValue(values.phone1, normalizePhoneForInput(selectedEditUser.phone1)),
        phone2: preserveExistingValue(values.phone2, normalizePhoneForInput(selectedEditUser.phone2)),
        whatsapp: preserveExistingValue(values.whatsapp, normalizePhoneForInput(selectedEditUser.whatsapp)),
        extensionNumber: preserveExistingValue(values.extensionNumber, selectedEditUser.extensionNumber),
        linkedin: preserveExistingValue(values.linkedin, socialValueFromUser(selectedEditUser, 'linkedin')),
        facebook: preserveExistingValue(values.facebook, socialValueFromUser(selectedEditUser, 'facebook')),
        instagram: preserveExistingValue(values.instagram, socialValueFromUser(selectedEditUser, 'instagram')),
        photo: editPhotoPreview || preserveExistingValue(values.photo, selectedEditUser.photo || selectedEditUser.photoUrl),
        photoUrl: preserveExistingValue(values.photoUrl, selectedEditUser.photoUrl || selectedEditUser.photo),
        photoData: normalizeInlineImageData(editPhotoPreview || values.photoData || values.photo || selectedEditUser.photoData || selectedEditUser.photo),
        additionalInfo: stripSocialLinksFromAdditionalInfo(
          preserveExistingValue(values.additionalInfo, selectedEditUser.additionalInfo),
          [
            preserveExistingValue(values.linkedin, socialValueFromUser(selectedEditUser, 'linkedin')),
            preserveExistingValue(values.facebook, socialValueFromUser(selectedEditUser, 'facebook')),
            preserveExistingValue(values.instagram, socialValueFromUser(selectedEditUser, 'instagram')),
          ],
        ),
        dateOfBirth: normalizeBirthDateForBackend(preserveExistingValue(values.dateOfBirth, selectedEditUser.dateOfBirth)),
        address: preserveExistingValue(values.address, selectedEditUser.address),
        googleMapsUrl: preserveExistingValue(values.googleMapsUrl, selectedEditUser.googleMapsUrl),
        cardBackgroundUrl: preserveExistingValue(values.cardBackgroundUrl, selectedEditUser.cardBackgroundUrl),
        cardBackgroundFile: values.cardBackgroundFile,
        socialAccounts: values.socialAccounts ?? selectedEditUser.socialAccounts ?? [],
      };

      await updateUser(userId, {
        ...mergedValues,
        phone1: normalizePhoneForBackend(mergedValues.phone1),
        phone2: normalizePhoneForBackend(mergedValues.phone2),
        whatsapp: normalizePhoneForBackend(mergedValues.whatsapp),
        photoFile: editPhotoFile || undefined,
      }, selectedEditUser);
      closeEditModal();
    } finally {
      setEditSubmitLoading(false);
    }
  };

  const openResetPasswordModal = (user: UserData) => {
    setResetPasswordUser(user);
    resetPasswordForm.resetFields();
  };

  const closeResetPasswordModal = () => {
    setResetPasswordUser(null);
    setResetPasswordLoading(false);
    resetPasswordForm.resetFields();
  };

  const handleResetPassword = async (values: { newPassword: string }) => {
    if (!resetPasswordUser) {
      message.warning('Əvvəlcə işçi seçin.');
      return;
    }

    try {
      setResetPasswordLoading(true);
      await resetUserPassword(resetPasswordUser.id || resetPasswordUser.email, values.newPassword, resetPasswordUser);
      closeResetPasswordModal();
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleDownloadVcf = async (user: UserData) => {
    try {
      setVcfLoadingId(user.id);
      await exportImportActions.downloadVcf(user.id);
      message.success('VCF kontakt faylı yükləndi.');
    } catch {
      const profile = normalizeUserToPublicProfile(user, company);
      await downloadVCard(profile);
      message.info('API VCF vermədi, lokal VCF yaradıldı.');
    } finally {
      setVcfLoadingId(null);
    }
  };

  const handleDownloadQr = async (user: UserData) => {
    try {
      setQrLoadingId(user.id);
      await exportImportActions.downloadQr(user.id);
      message.success('QR kod açıldı.');
    } catch {
      const profile = normalizeUserToPublicProfile(user, company);
      await downloadQrByFormat(profile, 'png');
      message.info('API QR vermədi, lokal PNG QR yaradıldı.');
    } finally {
      setQrLoadingId(null);
    }
  };


  const handleViewPublicCard = (user: UserData) => {
    const identity = user.id || user.email;
    if (!identity) {
      message.warning('İşçinin public card ID-si tapılmadı.');
      return;
    }

    savePublicCardProfilesFromUsers([user], company);
    const publicUrl = getPublicCardUrl(identity, 'Direct');
    window.open(publicUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadTemplate = async () => {
    setTemplateLoading(true);

    try {
      await exportImportActions.downloadTemplate();
      message.success('Backend şablonu yükləndi.');
    } catch {
      downloadTextFile(buildTemplateCsv(), 'employees-template.csv');
      message.warning('Backend şablonu yüklənmədi, ehtiyat CSV şablonu yaradıldı.');
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!activeCompanyId) {
      message.error('Şirkət ID tapılmadı.');
      return;
    }

    if (!importFile) {
      message.warning('Zəhmət olmasa fayl seçin.');
      return;
    }

    if (isLimitReached) {
      message.error(`Limit aşılıb. Maksimum ${company.employeeLimit} işçi ola bilər.`);
      return;
    }

    try {
      setImportLoading(true);
      const isCsv = importFile.name.toLowerCase().endsWith('.csv') || importFile.type.includes('csv') || importFile.type.includes('text');

      if (!isCsv) {
        await exportImportActions.importExcel(activeCompanyId, importFile);
        setImportResult({ success: 0, errors: [] });
        message.success('Fayl backend vasitəsilə idxal edildi.');
        await fetchUsers();
        return;
      }

      const parsedEmployees = await parseEmployeesCsv(importFile);
      const rowErrors = parsedEmployees.flatMap((employee, index) => validateImportedEmployee(employee, index + 2));

      if (rowErrors.length > 0) {
        setImportResult({ success: 0, errors: rowErrors });
        message.error('CSV faylında boş məcburi xanalar var.');
        return;
      }

      let success = 0;
      const errors: string[] = [];

      for (const [index, employee] of parsedEmployees.entries()) {
        try {
          await addUser(employee);
          success += 1;
        } catch {
          errors.push(`${index + 2}. sətir idxal edilmədi: ${employee.email || employee.firstName}`);
        }
      }

      setImportResult({ success, errors });
      message.success(`${success} işçi CSV-dən idxal edildi.`);
      await fetchUsers();
    } finally {
      setImportLoading(false);
    }
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportFile(null);
    setImportResult(null);
  };

  const handleStatusTabChange = (value: string | number) => {
    setEmployeeStatusTab(value as EmployeeStatusTab);
    setTablePagination((previous) => ({ ...previous, current: 1 }));
  };

  const openImportModal = () => {
    setImportFile(null);
    setImportResult(null);
    setIsImportModalOpen(true);
  };

  return (
    <>
      <div className="business-card-shell pro-page pro-business-card-page" style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <BusinessCardToolbar
          activeUsersCount={activeUsers.length}
          archivedUsersCount={archivedUsers.length}
          currentEmployeesCount={currentEmployeesCount}
          employeeLimit={company.employeeLimit}
          isLimitReached={isLimitReached}
          exportLoading={exportLoading}
          onOpenImport={openImportModal}
          onOpenAdd={openAddModal}
          onExportExcel={openExcelExportModal}
          onOpenHtmlExport={openHtmlExportModal}
        />

        <EmployeesTable
          employeeStatusTab={employeeStatusTab}
          activeUsersCount={activeUsers.length}
          archivedUsersCount={archivedUsers.length}
          visibleUsersLength={visibleUsers.length}
          safeCurrent={safeCurrent}
          tablePagination={tablePagination}
          tableRows={tableRows}
          companyName={company.name}
          companyLogo={company.logo}
          companyCardBackground={companyCardBackground}
          protectedAdminKeys={protectedAdminKeys}
          vcfLoadingId={vcfLoadingId}
          qrLoadingId={qrLoadingId}
          setTablePagination={setTablePagination}
          onStatusTabChange={handleStatusTabChange}
          onOpenEditUser={openEditUser}
          onToggleUserStatus={toggleUserStatus}
          onToggleUserCanEdit={toggleUserCanEdit}
          onDownloadVcf={handleDownloadVcf}
          onDownloadQr={handleDownloadQr}
          onViewPublicCard={handleViewPublicCard}
          onOpenResetPassword={openResetPasswordModal}
        />
      </div>

      <AddEmployeeModal
        form={form}
        isOpen={isModalOpen}
        submitLoading={submitLoading}
        photoPreview={photoPreview}
        onClose={closeAddModal}
        onSubmit={handleAddUser}
        onPhotoSelect={handlePhotoSelect}
      />

      <EditEmployeeModal
        form={editForm}
        isOpen={isEditModalOpen}
        companyUsers={companyUsers}
        selectedEditUser={selectedEditUser}
        selectedEditUserId={selectedEditUserId}
        editPhotoPreview={editPhotoPreview}
        editSubmitLoading={editSubmitLoading}
        onClose={closeEditModal}
        onSubmit={handleEditUser}
        onPhotoSelect={handleEditPhotoSelect}
        onOpenUser={openEditUser}
      />


      <Modal
        title={
          <div>
            <FileExcelOutlined style={{ marginRight: 8, color: '#5aa8e8' }} />
            Excel ixracı
          </div>
        }
        open={isExcelExportModalOpen}
        onCancel={() => setIsExcelExportModalOpen(false)}
        footer={null}
        destroyOnHidden
        centered
        width={640}
      >
        <Space style={{ marginBottom: 12 }} wrap>
          <Button onClick={() => setSelectedExcelExportIds(exportableUsers.map(userIdentity))}>Hamısını seç</Button>
          <Button onClick={() => setSelectedExcelExportIds([])}>Seçimi təmizlə</Button>
        </Space>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, maxHeight: 260, overflow: 'auto', marginBottom: 16 }}>
          <Checkbox.Group
            style={{ display: 'grid', gap: 8 }}
            value={selectedExcelExportIds}
            onChange={(values) => setSelectedExcelExportIds(values.map(String))}
          >
            {exportableUsers.map((user) => {
              const identity = userIdentity(user);
              return (
                <Checkbox key={identity} value={identity}>
                  <strong>{`${user.firstName} ${user.lastName}`.trim() || user.email}</strong> <span style={{ color: '#94a3b8' }}>— {user.jobTitle || user.email}</span>
                </Checkbox>
              );
            })}
          </Checkbox.Group>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button onClick={() => setIsExcelExportModalOpen(false)}>Bağla</Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exportLoading === 'excelSelected'}
            disabled={selectedExcelExportIds.length === 0}
            onClick={handleExportSelectedExcel}
          >
            Seçilənləri yüklə
          </Button>
        </div>
      </Modal>

      <Modal
        title={
          <div>
            <KeyOutlined style={{ marginRight: 8, color: '#4b9ada' }} />
            İşçinin kodunu dəyiş
          </div>
        }
        open={Boolean(resetPasswordUser)}
        onCancel={closeResetPasswordModal}
        footer={null}
        destroyOnHidden
        forceRender
      >
        <p style={{ color: '#64748b', marginTop: 0 }}>
          {resetPasswordUser ? `${resetPasswordUser.firstName} ${resetPasswordUser.lastName}`.trim() || resetPasswordUser.email : ''} üçün yeni kod/şifrə təyin edin.
        </p>
        <Form form={resetPasswordForm} layout="vertical" onFinish={handleResetPassword}>
          <Form.Item
            name="newPassword"
            label="Yeni kod/şifrə"
            rules={[{ required: true, message: 'Yeni kod/şifrə mütləqdir' }, { min: 6, message: 'Ən azı 6 simvol olmalıdır' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={closeResetPasswordModal}>Ləğv et</Button>
            <Button type="primary" htmlType="submit" loading={resetPasswordLoading}>
              Kodu dəyiş
            </Button>
          </div>
        </Form>
      </Modal>

      <HtmlExportModal
        isOpen={isHtmlExportModalOpen}
        exportableUsers={exportableUsers}
        selectedHtmlExportIds={selectedHtmlExportIds}
        exportLoading={exportLoading}
        setSelectedHtmlExportIds={setSelectedHtmlExportIds}
        onClose={() => setIsHtmlExportModalOpen(false)}
        onExportSelectedHtml={handleExportSelectedHtml}
      />

      <ImportEmployeesModal
        isOpen={isImportModalOpen}
        importFile={importFile}
        importResult={importResult}
        importLoading={importLoading}
        templateLoading={templateLoading}
        isLimitReached={isLimitReached}
        currentEmployeesCount={currentEmployeesCount}
        employeeLimit={company.employeeLimit}
        setImportFile={setImportFile}
        setImportResult={setImportResult}
        onClose={closeImportModal}
        onDownloadTemplate={handleDownloadTemplate}
        onImportSubmit={handleImportSubmit}
      />
    </>
  );
}