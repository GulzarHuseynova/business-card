import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { Avatar, Button, Checkbox, Form, Input, message, Modal, Space, Switch, Upload } from 'antd';
import type { FormInstance } from 'antd';
import {DeleteOutlined,DownloadOutlined,EditOutlined,FacebookOutlined,FileExcelOutlined,GlobalOutlined,Html5Outlined,ImportOutlined,InstagramOutlined,LinkedinOutlined,MailOutlined,MessageOutlined,PhoneOutlined,PlusOutlined,SendOutlined,UploadOutlined,UserOutlined,WhatsAppOutlined,YoutubeOutlined,} from '@ant-design/icons';
import type { AddUserFormValues, UserData } from '../../../../types/company-admin.type';
import type { ExportLoadingType, ImportResultState } from '../../../../types/business-card.type';
import { PhoneCountryInput } from '../../../../components/phone-country-input';
import { getEmployeeFullName, userIdentity } from '../../../../features/company-admin/business-card';

const EMPLOYEE_LINK_PRESETS = [
  { name: 'LinkedIn', icon: <LinkedinOutlined /> },
  { name: 'Facebook', icon: <FacebookOutlined /> },
  { name: 'Instagram', icon: <InstagramOutlined /> },
  { name: 'Website', icon: <GlobalOutlined /> },
  { name: 'Telefon', icon: <PhoneOutlined /> },
  { name: 'Email', icon: <MailOutlined /> },
  { name: 'WhatsApp', icon: <WhatsAppOutlined /> },
  { name: 'Telegram', icon: <SendOutlined /> },
  { name: 'Mesaj', icon: <MessageOutlined /> },
  { name: 'YouTube', icon: <YoutubeOutlined /> },
];

const readImageAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('İkon faylı oxunmadı'));
  reader.readAsDataURL(file);
});

const getPresetIcon = (platformName?: string) => {
  const normalized = String(platformName || '').trim().toLowerCase();
  return EMPLOYEE_LINK_PRESETS.find((preset) => preset.name.toLowerCase() === normalized)?.icon;
};

const directContactPlatform = (platformName?: string) => {
  const key = String(platformName || '').trim().toLowerCase();
  if (key.includes('telefon') || key.includes('phone') || key === 'tel') return 'phone';
  if (key.includes('email') || key.includes('mail')) return 'email';
  if (key.includes('mesaj') || key.includes('message') || key.includes('sms')) return 'message';
  if (key.includes('whatsapp')) return 'whatsapp';
  return '';
};

const linkPlaceholderForPlatform = (platformName?: string) => {
  const directType = directContactPlatform(platformName);
  if (directType === 'phone' || directType === 'message' || directType === 'whatsapp') return '+994 50 000 00 00';
  if (directType === 'email') return 'example@mail.com';
  if (String(platformName || '').toLowerCase().includes('telegram')) return '@istifadəçi_adı və ya t.me/...';
  return 'https://...';
};

const normalizeLinkValueForPlatform = (platformName: string, value?: string) => {
  const text = String(value || '').trim();
  const directType = directContactPlatform(platformName);
  if (!directType) return text;

  if (/^https?:\/\/?$/i.test(text)) return '';
  if (directType === 'phone') return text.replace(/^(https?:\/\/|tel:)/i, '');
  if (directType === 'email') return text.replace(/^(https?:\/\/|mailto:)/i, '');
  if (directType === 'message') return text.replace(/^(https?:\/\/|sms:)/i, '');
  return text.replace(/^https?:\/\//i, '');
};

type BirthDateInputProps = {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
};

const birthDateForDisplay = (value?: string) => {
  const text = String(value || '').trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  return text.replace(/\//g, '-');
};

const isValidBirthDate = (value?: string) => {
  const text = birthDateForDisplay(value);
  if (!text) return true;

  const match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return false;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    year >= 1900 &&
    year <= new Date().getFullYear() &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

function BirthDateInput({ id, value, onChange }: BirthDateInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    onChange?.(parts.join('-'));
  };

  return (
    <Input
      id={id}
      name={id || 'dateOfBirth'}
      aria-label="Doğum tarixi"
      value={birthDateForDisplay(value)}
      onChange={handleChange}
      placeholder="GG-AA-İİİİ"
      inputMode="numeric"
      maxLength={10}
      autoComplete="off"
    />
  );
}

function EmployeeCardFields() {
  const form = Form.useFormInstance<AddUserFormValues>();
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const watchedSocialAccounts = Form.useWatch('socialAccounts', form) || [];

  const chooseIcon = (platformName: string) => {
    if (pickerIndex === null) return;
    const accounts = [...(form.getFieldValue('socialAccounts') || [])];
    const current = accounts[pickerIndex] || {};
    accounts[pickerIndex] = {
      ...current,
      platformName,
      profileUrl: normalizeLinkValueForPlatform(platformName, current.profileUrl),
      iconUrl: '',
    };
    form.setFieldValue('socialAccounts', accounts);
    setPickerIndex(null);
  };

  const uploadCustomIcon = async (file: File) => {
    if (pickerIndex === null) return false;

    try {
      const iconUrl = await readImageAsDataUrl(file);
      const accounts = [...(form.getFieldValue('socialAccounts') || [])];
      accounts[pickerIndex] = {
        ...(accounts[pickerIndex] || {}),
        platformName: String(accounts[pickerIndex]?.platformName || '').trim() || 'Xüsusi link',
        iconUrl,
      };
      form.setFieldValue('socialAccounts', accounts);
      setPickerIndex(null);
      message.success('İkon əlavə edildi');
    } catch {
      message.error('İkon yüklənmədi');
    }

    return false;
  };

  return (
    <div className="employee-card-extra-fields">
      <Form.Item name="cardBackgroundUrl" hidden><Input /></Form.Item>
      <Form.Item name="cardBackgroundFile" hidden><Input /></Form.Item>

      <div className="employee-form-section-title">Əlavə məlumatlar</div>

      <Form.Item label="Arxa fon" className="employee-background-field">
        <Upload
          accept="image/png,image/jpeg,image/svg+xml"
          maxCount={1}
          showUploadList={false}
          beforeUpload={(file) => {
            form.setFieldValue('cardBackgroundFile', file as File);
            const reader = new FileReader();
            reader.onload = () => form.setFieldValue('cardBackgroundUrl', String(reader.result || ''));
            reader.readAsDataURL(file as File);
            return false;
          }}
        >
          <Button icon={<UploadOutlined />}>Fon seç</Button>
        </Upload>
      </Form.Item>

      <div className="employee-card-details-grid employee-social-fields-under-background">
        <Form.Item name="linkedin" label="LinkedIn">
          <Input prefix={<LinkedinOutlined />} placeholder="LinkedIn profil linki" />
        </Form.Item>
        <Form.Item name="facebook" label="Facebook">
          <Input prefix={<FacebookOutlined />} placeholder="Facebook profil linki" />
        </Form.Item>
        <Form.Item name="instagram" label="Instagram">
          <Input prefix={<InstagramOutlined />} placeholder="Instagram profil linki" />
        </Form.Item>
      </div>

      <div className="employee-card-details-grid">
        <Form.Item
          name="dateOfBirth"
          label="Doğum tarixi"
          rules={[
            {
              validator: async (_rule, value) => {
                if (isValidBirthDate(value)) return;
                throw new Error('Tarixi GG-AA-İİİİ formatında düzgün yazın');
              },
            },
          ]}
        >
          <BirthDateInput />
        </Form.Item>
        <Form.Item name="address" label="Ünvan">
          <Input placeholder="Məsələn: Bakı şəhəri, Nizami küçəsi 10" />
        </Form.Item>
      </div>

      <Form.Item name="googleMapsUrl" label="Google Maps ünvan linki">
        <Input prefix={<GlobalOutlined />} placeholder="Google Maps linkini daxil edin" />
      </Form.Item>
      <Form.Item name="additionalInfo" label="Haqqında / əlavə məlumat">
        <Input.TextArea rows={3} placeholder="Qısa məlumat yazın" />
      </Form.Item>

      <Form.List name="socialAccounts">
        {(fields, { add, remove }) => {
          const addNextLink = async () => {
            const accounts: NonNullable<AddUserFormValues['socialAccounts']> = form.getFieldValue('socialAccounts') || [];
            const incompleteIndex = accounts.findIndex((account: NonNullable<AddUserFormValues['socialAccounts']>[number]) => (
              !String(account?.platformName || '').trim() ||
              !String(account?.profileUrl || '').trim()
            ));

            if (incompleteIndex >= 0) {
              try {
                await form.validateFields([
                  ['socialAccounts', incompleteIndex, 'platformName'],
                  ['socialAccounts', incompleteIndex, 'profileUrl'],
                ]);
              } catch {
                message.warning('Əvvəlki linkin məcburi xanalarını doldurun.');
              }
              return;
            }

            const nextIndex = accounts.length;
            add({ platformName: '', profileUrl: '', iconUrl: '' });
            window.setTimeout(() => setPickerIndex(nextIndex), 0);
          };

          return (
            <div className="employee-custom-links">
              {fields.map(({ key, name, ...rest }) => {
                const iconUrl = String(watchedSocialAccounts[name]?.iconUrl || '');
                const platformName = String(watchedSocialAccounts[name]?.platformName || '');
                const presetIcon = getPresetIcon(platformName);
                const profileUrlPlaceholder = linkPlaceholderForPlatform(platformName);

                return (
                <div className="employee-custom-link-row" key={key}>
                  <Form.Item
                    {...rest}
                    name={[name, 'platformName']}
                    rules={[{ required: true, whitespace: true, message: 'Boş qalmamalıdır' }]}
                  >
                    <Input autoComplete="off" placeholder="Linkin adı" />
                  </Form.Item>
                  <Form.Item
                    {...rest}
                    name={[name, 'profileUrl']}
                    rules={[{ required: true, whitespace: true, message: 'Boş qalmamalıdır' }]}
                  >
                    <Input autoComplete="off" placeholder={profileUrlPlaceholder} />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, 'iconUrl']} hidden>
                    <Input />
                  </Form.Item>
                  <Button
                    className="employee-custom-link-icon-button"
                    icon={iconUrl
                      ? <img src={iconUrl} alt="" />
                      : (presetIcon || <UploadOutlined />)}
                    onClick={() => setPickerIndex(name)}
                    aria-label="İkon seç"
                  />
                  <Button danger icon={<DeleteOutlined />} onClick={() => remove(name)} aria-label="Linki sil" />
                </div>
                );
              })}
              <Button block type="dashed" icon={<PlusOutlined />} onClick={() => void addNextLink()}>
                Yeni link əlavə et
              </Button>
            </div>
          );
        }}
      </Form.List>

      <Modal title="Link ikonunu seç" open={pickerIndex !== null} onCancel={() => setPickerIndex(null)} footer={null} centered>
        <div className="ca-link-icon-grid">
          {EMPLOYEE_LINK_PRESETS.map((item) => (
            <button type="button" key={item.name} onClick={() => chooseIcon(item.name)}>
              <span>{item.icon}</span><strong>{item.name}</strong>
            </button>
          ))}
        </div>
        <Upload
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          maxCount={1}
          showUploadList={false}
          beforeUpload={(file) => {
            void uploadCustomIcon(file as File);
            return false;
          }}
        >
          <Button block icon={<UploadOutlined />} className="employee-custom-icon-upload">
            İstədiyin ikonu yüklə
          </Button>
        </Upload>
      </Modal>
    </div>
  );
}

interface AddEmployeeModalProps {
  form: FormInstance<AddUserFormValues>;
  isOpen: boolean;
  submitLoading: boolean;
  photoPreview: string;
  onClose: () => void;
  onSubmit: (values: AddUserFormValues) => void | Promise<void>;
  onPhotoSelect: (file: File) => Promise<boolean>;
}

export function AddEmployeeModal({
  form,
  isOpen,
  submitLoading,
  photoPreview,
  onClose,
  onSubmit,
  onPhotoSelect,
}: AddEmployeeModalProps) {
  return (
    <Modal
      title={
        <div>
          <UserOutlined style={{ marginRight: 8, color: '#4b9ada' }} />
          Yeni işçi əlavə et
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      forceRender
      width={760}
      rootClassName="employee-add-modal"
    >
      <Form className="employee-add-form" form={form} layout="vertical" onFinish={onSubmit} initialValues={{ isActive: true, canEdit: true }}>
        <div className="employee-add-photo-row">
          <Upload
            accept="image/*"
            listType="picture-circle"
            maxCount={1}
            showUploadList={false}
            beforeUpload={(file) => {
              void onPhotoSelect(file as File);
              return false;
            }}
          >
            {photoPreview ? (
              <Avatar src={photoPreview} size={96} style={{ border: '1px solid #e2e8f0' }} />
            ) : (
              <div>
                <UploadOutlined style={{ fontSize: 20, color: '#94a3b8' }} />
                <div style={{ marginTop: 8, fontSize: 12 }}>Foto yüklə</div>
              </div>
            )}
          </Upload>

          <div>
            <strong>Profil fotosu</strong>
          </div>
        </div>

        <div className="employee-form-section-title">Əsas məlumatlar</div>
        <div className="employee-add-fields">
          <Form.Item name="firstName" label="Ad" rules={[{ required: true, message: 'Mütləqdir' }]}>
            <Input />
          </Form.Item>

          <Form.Item name="lastName" label="Soyad" rules={[{ required: true, message: 'Mütləqdir' }]}>
            <Input />
          </Form.Item>

          <Form.Item name="middleName" label="Ata adı">
            <Input />
          </Form.Item>

          <Form.Item name="jobTitle" label="Vəzifə" rules={[{ required: true, message: 'Mütləqdir' }]}>
            <Input />
          </Form.Item>

          <Form.Item name="email" label="Gmail" rules={[{ required: true, message: 'Mütləqdir' }, { type: 'email', message: 'Email düzgün deyil' }]}>
            <Input />
          </Form.Item>

          <Form.Item name="password" label="Kod/Şifrə" rules={[{ required: true, message: 'Mütləqdir' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </div>

        <div className="employee-form-section-title">Əlaqə</div>
        <div className="employee-add-fields">
          <Form.Item name="phone1" label="İş telefonu" rules={[{ required: true, message: 'Mütləqdir' }]}>
            <PhoneCountryInput placeholder="İş telefonu" maxLength={20} />
          </Form.Item>

          <Form.Item name="phone2" label="Şəxsi telefon">
            <PhoneCountryInput placeholder="Şəxsi telefon" maxLength={20} />
          </Form.Item>

          <Form.Item name="whatsapp" label="WhatsApp">
            <PhoneCountryInput placeholder="WhatsApp nömrəsi" maxLength={20} />
          </Form.Item>

          <Form.Item name="extensionNumber" label="Daxili nömrə">
            <Input placeholder="400" maxLength={20} />
          </Form.Item>
        </div>

        <EmployeeCardFields />

        <Form.Item name="isActive" label="Status" valuePropName="checked" className="employee-status-field">
          <Switch checkedChildren="Aktiv" unCheckedChildren="Deaktiv" />
        </Form.Item>

        <div className="employee-add-actions">
          <Button onClick={onClose}>Ləğv et</Button>
          <Button type="primary" htmlType="submit" loading={submitLoading} icon={<EditOutlined />}>
            Yadda saxla
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

interface EditEmployeeModalProps {
  form: FormInstance<Partial<AddUserFormValues>>;
  isOpen: boolean;
  companyUsers: UserData[];
  selectedEditUser?: UserData;
  selectedEditUserId: string;
  editPhotoPreview: string;
  editSubmitLoading: boolean;
  onClose: () => void;
  onSubmit: (values: Partial<AddUserFormValues>) => void | Promise<void>;
  onPhotoSelect: (file: File) => Promise<boolean>;
  onOpenUser: (user: UserData) => void;
}

export function EditEmployeeModal({
  form,
  isOpen,
  companyUsers,
  selectedEditUser,
  selectedEditUserId,
  editPhotoPreview,
  editSubmitLoading,
  onClose,
  onSubmit,
  onPhotoSelect,
  onOpenUser,
}: EditEmployeeModalProps) {
  void companyUsers;
  void onOpenUser;

  return (
    <Modal
      rootClassName="employee-edit-modal"
      title={
        <div>
          <EditOutlined style={{ marginRight: 8, color: '#4b9ada' }} />
          Düzəliş et
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      forceRender
      width={760}
      centered
    >
      {!selectedEditUser ? (
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 14, padding: 24, color: '#64748b' }}>
          Redaktə üçün işçi seçin.
        </div>
      ) : (
        <Form key={selectedEditUserId || selectedEditUser.id || selectedEditUser.email} className="employee-edit-form" form={form} layout="vertical" onFinish={onSubmit}>
          <div className="employee-edit-summary">
            <Upload
              accept="image/*"
              listType="picture-circle"
              maxCount={1}
              showUploadList={false}
              beforeUpload={(file) => {
                void onPhotoSelect(file as File);
                return false;
              }}
            >
              {editPhotoPreview ? (
                <Avatar src={editPhotoPreview} size={88} style={{ border: '1px solid #e2e8f0' }} />
              ) : (
                <div>
                  <UploadOutlined style={{ fontSize: 20, color: '#94a3b8' }} />
                  <div style={{ marginTop: 8, fontSize: 12 }}>Foto yüklə</div>
                </div>
              )}
            </Upload>

            <div className="employee-edit-summary-text">
              <strong>{getEmployeeFullName(selectedEditUser)}</strong>
              <span>{selectedEditUser.jobTitle || 'Vəzifə yoxdur'}</span>
              <p>Email və şifrə burada dəyişmir. Seçilən foto işçi məlumatları ilə birlikdə saxlanılır.</p>
            </div>
          </div>

          <div className="employee-edit-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 16px' }}>
            <Form.Item name="firstName" label="Ad" rules={[{ required: true, message: 'Mütləqdir' }]}>
              <Input />
            </Form.Item>

            <Form.Item name="lastName" label="Soyad" rules={[{ required: true, message: 'Mütləqdir' }]}>
              <Input />
            </Form.Item>

            <Form.Item name="middleName" label="Ata adı">
              <Input />
            </Form.Item>

            <Form.Item name="jobTitle" label="Vəzifə" rules={[{ required: true, message: 'Mütləqdir' }]}>
              <Input />
            </Form.Item>

            <Form.Item name="email" label="Gmail">
              <Input disabled autoComplete="email" />
            </Form.Item>
          </div>

          <div className="employee-form-section-title">Əlaqə</div>
          <div className="employee-edit-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 16px' }}>
            <Form.Item name="phone1" label="İş telefonu" rules={[{ required: true, message: 'Mütləqdir' }]}>
              <PhoneCountryInput placeholder="İş telefonu" maxLength={20} />
            </Form.Item>

            <Form.Item name="phone2" label="Şəxsi telefon">
              <PhoneCountryInput placeholder="Şəxsi telefon" maxLength={20} />
            </Form.Item>

            <Form.Item name="whatsapp" label="WhatsApp">
              <PhoneCountryInput placeholder="WhatsApp nömrəsi" maxLength={20} />
            </Form.Item>

            <Form.Item name="extensionNumber" label="Daxili nömrə">
              <Input placeholder="400" maxLength={20} />
            </Form.Item>
          </div>

          <EmployeeCardFields />

          <div className="employee-edit-actions">
            <Button onClick={onClose}>Ləğv et</Button>
            <Button type="primary" htmlType="submit" loading={editSubmitLoading}>
               Yadda saxla
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}

interface HtmlExportModalProps {
  isOpen: boolean;
  exportableUsers: UserData[];
  selectedHtmlExportIds: string[];
  exportLoading: ExportLoadingType;
  setSelectedHtmlExportIds: Dispatch<SetStateAction<string[]>>;
  onClose: () => void;
  onExportSelectedHtml: () => void | Promise<void>;
}

export function HtmlExportModal({
  isOpen,
  exportableUsers,
  selectedHtmlExportIds,
  exportLoading,
  setSelectedHtmlExportIds,
  onClose,
  onExportSelectedHtml,
}: HtmlExportModalProps) {
  return (
    <Modal
      title={
        <div>
          <Html5Outlined style={{ marginRight: 8, color: '#5aa8e8' }} />
          Offline HTML ixracı
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      centered
      width={640}
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Button onClick={() => setSelectedHtmlExportIds(exportableUsers.map(userIdentity))}>Hamısını seç</Button>
        <Button onClick={() => setSelectedHtmlExportIds([])}>Seçimi təmizlə</Button>
      </Space>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, maxHeight: 260, overflow: 'auto', marginBottom: 16 }}>
        <Checkbox.Group
          style={{ display: 'grid', gap: 8 }}
          value={selectedHtmlExportIds}
          onChange={(values) => setSelectedHtmlExportIds(values.map(String))}
        >
          {exportableUsers.map((user) => {
            const identity = userIdentity(user);
            return (
              <Checkbox key={identity} value={identity}>
                <strong>{getEmployeeFullName(user)}</strong> <span style={{ color: '#94a3b8' }}>— {user.jobTitle || user.email}</span>
              </Checkbox>
            );
          })}
        </Checkbox.Group>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button onClick={onClose}>Bağla</Button>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={exportLoading === 'htmlSelected'}
          disabled={selectedHtmlExportIds.length === 0}
          onClick={onExportSelectedHtml}
        >
          Seçilənləri yüklə
        </Button>
      </div>
    </Modal>
  );
}

interface ImportEmployeesModalProps {
  isOpen: boolean;
  importFile: File | null;
  importResult: ImportResultState | null;
  importLoading: boolean;
  templateLoading: boolean;
  isLimitReached: boolean;
  currentEmployeesCount: number;
  employeeLimit: number;
  setImportFile: Dispatch<SetStateAction<File | null>>;
  setImportResult: Dispatch<SetStateAction<ImportResultState | null>>;
  onClose: () => void;
  onDownloadTemplate: () => void | Promise<void>;
  onImportSubmit: () => void | Promise<void>;
}

export function ImportEmployeesModal({
  isOpen,
  importFile,
  importResult,
  importLoading,
  templateLoading,
  isLimitReached,
  currentEmployeesCount,
  employeeLimit,
  setImportFile,
  setImportResult,
  onClose,
  onDownloadTemplate,
  onImportSubmit,
}: ImportEmployeesModalProps) {
  return (
    <Modal
      title={
        <div>
          <ImportOutlined style={{ marginRight: 8, color: '#4b9ada' }} />
          Kütləvi işçi idxalı (CSV/Excel)
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      centered
      width={520}
    >
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <strong>1. Boş şablonu yükləyin</strong>
        <br />
        <Button icon={<FileExcelOutlined style={{ color: '#5aa8e8' }} />} onClick={onDownloadTemplate} loading={templateLoading} style={{ marginTop: 10 }}>
          Şablonu yüklə
        </Button>
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <strong>2. Doldurulmuş CSV/Excel faylını seçin</strong>

        <Upload
          accept=".csv,.xlsx,.xls"
          maxCount={1}
          beforeUpload={(file) => {
            setImportFile(file);
            setImportResult(null);
            return false;
          }}
          onRemove={() => {
            setImportFile(null);
            setImportResult(null);
          }}
          fileList={importFile ? [{ uid: '-1', name: importFile.name, status: 'done' as const }] : []}
        >
          <Button icon={<UploadOutlined />} style={{ width: '100%', marginTop: 10 }}>
            CSV/Excel faylını seç
          </Button>
        </Upload>
      </div>

      {importResult && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 12, marginBottom: 16, color: '#15803d' }}>
          {importResult.success} işçi uğurla idxal edildi.

          {importResult.errors.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 16, color: '#6d7f8d' }}>
              {importResult.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={{ background: '#f6fbff', border: '1px solid #cde6f8', borderRadius: 8, padding: 12, marginBottom: 20, color: '#527086' }}>
        Şirkət limiti: <strong>{currentEmployeesCount}/{employeeLimit}</strong>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button onClick={onClose}>Ləğv et</Button>

        <Button
          type="primary"
          icon={<ImportOutlined />}
          loading={importLoading}
          disabled={!importFile || !!importResult || isLimitReached}
          onClick={onImportSubmit}
        >
          İdxal et
        </Button>
      </div>
    </Modal>
  );
}