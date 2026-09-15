import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Upload } from 'antd';
import {BankOutlined,CheckCircleOutlined,EditOutlined,EyeOutlined,LockOutlined,MailOutlined,PhoneOutlined,PlusOutlined,ReloadOutlined,SaveOutlined,UploadOutlined,UserOutlined,} from '@ant-design/icons';
import type { ApiCompany, CompanyAdminFormValues, CompanyCreateFormValues, CompanyEditFormValues } from '../../../types/super.type';
import {getCompanyBusinessEmail,getCompanyEmail,getCompanyLimit,getCompanyLogo,getCompanyName,getCompanyPhone,} from '../../../features/super/super-admin';
import { CompanyLogo } from './company-logo';
import type { SuperAdminController } from '../../../hooks/use-super-admin-controller';

type SuperAdminHomeProps = {
  controller: SuperAdminController;
};

export function SuperAdminHome({ controller }: SuperAdminHomeProps) {
  const {
    adminForm,
    adminSubmitLoading,
    companies,
    companiesTableOpen,
    companyEditForm,
    companyEditLoading,
    companyForm,
    companyOptions,
    companySubmitLoading,
    createdAdminInfo,
    activeLoadingId,
    detailCompany,
    editLogoDataUrl,
    editLogoName,
    editingCompany,
    fetchCompanies,
    handleAdminCompanySelect,
    handleCreateAdmin,
    handleCreateCompany,
    handleToggleCompanyActive,
    handleLogoSelect,
    handleUpdateCompany,
    loading,
    openEditCompany,
    selectedAdminCompany,
    selectedLogoName,
    setCompaniesTableOpen,
    setDetailCompanyId,
    setEditLogoDataUrl,
    setEditLogoName,
    setEditingCompany,
    setSelectedLogoDataUrl,
    setSelectedLogoName,
    showCompanyInAutoAdminCard,
  } = controller;

  const renderCreatedInfoCard = () => {
    if (!createdAdminInfo) {
      return (
        <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 16, padding: 16, color: '#64748b' }}>
          Yeni şirkət yaradandan sonra şirkət məlumatları və Company Admin login məlumatı burada görünəcək.
        </div>
      );
    }

    const company = createdAdminInfo.company;

    return (
      <div className="super-created-info-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 14 }} align="start" wrap>
          <Space align="center" size={12}>
            <CompanyLogo company={company} size={56} />
            <div>
              <div style={{ color: '#166534', fontWeight: 900 }}>Son yaradılan şirkət və admin login məlumatı</div>
              <div style={{ color: '#15803d', fontSize: 13 }}>{createdAdminInfo.companyName}</div>
            </div>
          </Space>
          <Space wrap>
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditCompany(company)}>
              Redaktə et
            </Button>
            <Button
              size="small"
              loading={activeLoadingId === company.id}
              onClick={() => void handleToggleCompanyActive(company)}
            >
              {company.isActive === false ? 'Aktiv et' : 'Deaktiv et'}
            </Button>
          </Space>
        </Space>

        <div className="super-created-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <div><strong>Şirkət:</strong> {createdAdminInfo.companyName}</div>
          <div><strong>VÖEN:</strong> {createdAdminInfo.voen || '-'}</div>
          <div><strong>Ünvan:</strong> {createdAdminInfo.address || '-'}</div>
          <div><strong>Email:</strong> {createdAdminInfo.companyEmail || '-'}</div>
          <div><strong>Telefon:</strong> {createdAdminInfo.phone || createdAdminInfo.contact || '-'}</div>
          <div><strong>Limit:</strong> {createdAdminInfo.limit || 0}</div>
          <div><strong>Logo:</strong> {getCompanyLogo(company) ? 'Backend-dən gəldi' : createdAdminInfo.logoName || 'Backend qaytarmadı'}</div>
          <div><strong>Admin email:</strong> {createdAdminInfo.email || 'Backend qaytarmadı'}</div>
          <div><strong>İlkin şifrə:</strong> {createdAdminInfo.password || 'Backend qaytarmadı'}</div>
        </div>
      </div>
    );
  };

  const companyFormFields = (
    <>
      <Form.Item
        name="companyName"
        label="Şirkət adı"
        rules={[
          { required: true, message: 'Şirkət adı tələb olunur' },
          { max: 50, message: 'Şirkət adı maksimum 50 simvol olmalıdır' },
        ]}
      >
        <Input placeholder="Məsələn, Yeni Şirkət MMC" maxLength={50} showCount />
      </Form.Item>

      <Form.Item
        name="voen"
        label="VÖEN"
        rules={[
          { required: true, message: 'VÖEN tələb olunur' },
          { pattern: /^\d{10}$/, message: 'VÖEN 10 rəqəmdən ibarət olmalıdır' },
        ]}
      >
        <Input placeholder="1234567890" style={{ fontFamily: 'monospace' }} maxLength={10} showCount />
      </Form.Item>

      <div className="super-home-logo-limit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, alignItems: 'start' }}>
        <div
          style={{
            border: '1px dashed #cbd5e1',
            borderRadius: 12,
            padding: '10px 12px',
            color: '#64748b',
            background: '#f8fafc',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: '#334155', display: 'block', marginBottom: 8 }}>Logo şəkli</strong>
          <Upload
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            maxCount={1}
            showUploadList={false}
            beforeUpload={(file) => {
              handleLogoSelect(file as File, setSelectedLogoName, setSelectedLogoDataUrl);
              return false;
            }}
            onRemove={() => {
              setSelectedLogoName('');
              setSelectedLogoDataUrl('');
              return true;
            }}
          >
            <Button icon={<UploadOutlined />} size="small" style={{ borderRadius: 8 }}>
              JPG/PNG seç
            </Button>
          </Upload>
          {selectedLogoName ? (
            <div style={{ marginTop: 8, color: '#334155', fontWeight: 700, overflowWrap: 'anywhere' }}>
              Seçildi: {selectedLogoName}
            </div>
          ) : null}
        </div>

        <Form.Item
          name="employeeLimit"
          label="Limit"
          rules={[
            { required: true, message: 'Limit tələb olunur' },
            { type: 'number', min: 1, max: 50, message: 'Limit 1-50 arası olmalıdır' },
          ]}
        >
          <InputNumber min={1} max={50} style={{ width: '100%' }} />
        </Form.Item>
      </div>

      <Form.Item
        name="address"
        label="Ünvan"
        rules={[{ max: 150, message: 'Ünvan maksimum 150 simvol olmalıdır' }]}
      >
        <Input placeholder="Bakı, Azərbaycan" maxLength={150} showCount />
      </Form.Item>

      <div className="super-home-form-two-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { type: 'email', message: 'Düzgün email yazın' },
            { max: 50, message: 'Email maksimum 50 simvol olmalıdır' },
          ]}
        >
          <Input placeholder="company@example.com" maxLength={50} showCount allowClear />
        </Form.Item>

        <Form.Item
          name="phone"
          label="Telefon"
          rules={[{ max: 50, message: 'Telefon maksimum 50 simvol olmalıdır' }]}
        >
          <Input placeholder="+994..." maxLength={50} showCount allowClear />
        </Form.Item>
      </div>
    </>
  );


  return (
        <>
          <div
            className="super-home-hero"
            style={{
              background: 'linear-gradient(135deg,#eff8ff 0%,#ffffff 55%,#e4f3ff 100%)',
              borderRadius: 24,
              padding: '28px 30px',
              color: '#263445',
              position: 'relative',
              overflow: 'hidden',
              marginBottom: 22,
              boxShadow: '0 18px 42px rgba(71,120,153,0.12)', border: '1px solid #d5e8f4',
            }}
          >
            <div style={{ position: 'absolute', right: -45, top: -45, width: 190, height: 190, borderRadius: '50%', background: 'rgba(90,168,232,0.16)' }} />
            <div style={{ position: 'absolute', right: 100, bottom: -60, width: 160, height: 160, borderRadius: '50%', background: 'rgba(90,168,232,0.10)' }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <Tag color="blue" style={{ borderRadius: 999, marginBottom: 10 }}>Super Admin</Tag>
                <h1 style={{ margin: 0, color: '#263445', fontSize: 30, fontWeight: 900 }}>Şirkət idarəetməsi</h1>
                <p style={{ margin: '8px 0 0', color: '#607f94', maxWidth: 760 }}>
                  Şirkət yaradılan kimi backend Company Admin hesabını avtomatik yaratmalı və adminEmail/defaultPassword qaytarmalıdır.
                </p>
              </div>
              <Button icon={<ReloadOutlined />} onClick={() => void fetchCompanies()} loading={loading} style={{ height: 42, borderRadius: 12, fontWeight: 700 }}>
                Yenilə
              </Button>
            </div>
          </div>

          <div className="super-home-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(340px, 0.95fr)', gap: 24, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <Card className="super-home-card" style={{ borderRadius: 22, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }} styles={{ body: { padding: 24 } }}>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 18 }} wrap>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, color: '#0f172a', fontWeight: 900 }}>Şirkətlər</h2>
                    <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                      Şirkəti seçib məlumatlarına baxın, redaktə edin və aktiv/deaktiv statusunu idarə edin.
                    </p>
                  </div>
                  <Tag color="blue" style={{ borderRadius: 999, paddingInline: 12, lineHeight: '28px' }}>Silmə bağlıdır · status idarəsi aktivdir</Tag>
                </Space>

                <Space style={{ width: '100%', justifyContent: 'space-between', margin: companiesTableOpen ? '4px 0 18px' : '4px 0 0' }} wrap>
                  <Button type="primary" icon={<BankOutlined />} onClick={() => setCompaniesTableOpen((previous) => !previous)} style={{ borderRadius: 12, height: 42, fontWeight: 800 }}>
                    {companiesTableOpen ? 'Şirkətləri gizlət' : 'Şirkətləri göstər'}
                  </Button>
                </Space>

                {companiesTableOpen && (
                  <Table<ApiCompany>
                    loading={loading}
                    dataSource={companies}
                    rowKey={(record) => record.id}
                    pagination={{ pageSize: 8, showSizeChanger: true, pageSizeOptions: [8, 10, 20, 50] }}
                    scroll={{ x: 900 }}
                    locale={{ emptyText: 'Hələ şirkət yoxdur. Sağdakı formadan yeni şirkət yaradın.' }}
                    columns={[
                      {
                        title: 'Şirkət',
                        key: 'company',
                        width: 280,
                        render: (_value: unknown, company) => {
                          const displayName = getCompanyName(company);
                          return (
                            <Space align="center" size={12} style={{ minWidth: 0 }}>
                              <CompanyLogo company={company} size={44} />
                              <div style={{ minWidth: 0 }}>
                                <div title={displayName} style={{ color: '#0f172a', fontWeight: 900, maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {displayName}
                                </div>
                                <div style={{ color: '#94a3b8', fontSize: 12 }}>{company.address || 'Şirkət profili'}</div>
                              </div>
                            </Space>
                          );
                        },
                      },
                      {
                        title: 'VÖEN',
                        dataIndex: 'voen',
                        width: 140,
                        render: (value: string) => <span style={{ fontFamily: 'monospace', color: '#334155' }}>{value || 'Yoxdur'}</span>,
                      },
                      {
                        title: 'Admin emaili',
                        key: 'email',
                        width: 220,
                        render: (_value: unknown, company) => getCompanyEmail(company) || 'Təyin olunmayıb',
                      },
                      {
                        title: 'Ünvan / Email / Telefon',
                        key: 'address',
                        width: 220,
                        render: (_value: unknown, company) => (
                          <div>
                            <div>{company.address || '-'}</div>
                            <div style={{ color: '#64748b', fontSize: 12, overflowWrap: 'anywhere' }}>{getCompanyBusinessEmail(company) || '-'}</div>
                            <div style={{ color: '#64748b', fontSize: 12 }}>{getCompanyPhone(company) || '-'}</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Limit',
                        key: 'limit',
                        width: 100,
                        render: (_value: unknown, company) => <Tag color="blue">{getCompanyLimit(company)}</Tag>,
                      },
                      {
                        title: 'Status',
                        key: 'status',
                        width: 145,
                        render: (_value: unknown, company) => (
                          <Space size={8}>
                            <Switch
                              size="small"
                              checked={company.isActive !== false}
                              loading={activeLoadingId === company.id}
                              onChange={() => void handleToggleCompanyActive(company)}
                            />
                            <Tag color={company.isActive !== false ? 'success' : 'default'} style={{ margin: 0 }}>
                              {company.isActive !== false ? 'Aktiv' : 'Deaktiv'}
                            </Tag>
                          </Space>
                        ),
                      },
                      {
                        title: 'Əməliyyat',
                        key: 'action',
                        fixed: 'right',
                        width: 190,
                        render: (_value: unknown, company) => (
                          <Space size={8}>
                            <Button
                              className="super-company-action-icon"
                              type="text"
                              icon={<EyeOutlined />}
                              aria-label="Şirkət məlumatlarına bax"
                              title="Bax"
                              onClick={() => {
                                showCompanyInAutoAdminCard(company, createdAdminInfo);
                                setDetailCompanyId(company.id);
                              }}
                            />
                            <Button
                              className="super-company-action-icon"
                              type="text"
                              icon={<EditOutlined />}
                              aria-label="Şirkəti redaktə et"
                              title="Redaktə et"
                              onClick={() => openEditCompany(company)}
                            />
                          </Space>
                        ),
                      },
                    ]}
                  />
                )}
              </Card>

              <Card className="super-home-card" style={{ borderRadius: 22, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }} styles={{ body: { padding: 24 } }}>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 20 }} wrap>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, color: '#1e293b', fontWeight: 900 }}>Company Admin hesabı</h2>
                  </div>
                  <Tag color="orange">Manual / Redaktə</Tag>
                </Space>

                <Form<CompanyAdminFormValues>
                  form={adminForm}
                  layout="vertical"
                  onFinish={handleCreateAdmin}
                  autoComplete="off"
                >
                  <input type="text" name="fake-user-name" autoComplete="username" style={{ display: 'none' }} />
                  <input type="password" name="fake-password" autoComplete="new-password" style={{ display: 'none' }} />
                  <Form.Item name="companyId" label="Şirkət" rules={[{ required: true, message: 'Şirkət seçin' }]}>
                    <Select
                      placeholder="Şirkət seçin"
                      options={companyOptions}
                      showSearch
                      optionFilterProp="label"
                      onChange={handleAdminCompanySelect}
                    />
                  </Form.Item>

                  <Form.Item
                    name="adminName"
                    label="Ad və soyad"
                    rules={[
                      { required: true, message: 'Ad və soyad tələb olunur' },
                      { max: 50, message: 'Ad və soyad maksimum 50 simvol olmalıdır' },
                    ]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="Məsələn, Aysel Məmmədova" maxLength={50} showCount allowClear />
                  </Form.Item>

                  <Form.Item
                    name="gmail"
                    label="Admin emaili"
                    rules={[
                      { required: true, message: 'Admin emaili tələb olunur' },
                      { type: 'email', message: 'Düzgün email yazın' },
                      { max: 50, message: 'Email maksimum 50 simvol olmalıdır' },
                    ]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="admin@company.az" autoComplete="new-email" inputMode="email" maxLength={50} showCount allowClear />
                  </Form.Item>

                  <Form.Item
                    name="phone"
                    label="Telefon"
                    rules={[{ pattern: /^\d*$/, message: 'Telefon yalnız rəqəmlərdən ibarət olmalıdır' }]}
                    getValueFromEvent={(event) => event.target.value.replace(/\D/g, '')}
                  >
                    <Input type="number" prefix={<PhoneOutlined />} placeholder="994501234567" autoComplete="off" inputMode="numeric" allowClear />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="İlkin şifrə / kod"
                    extra="Bu şifrə ilə CompanyAdmin Gmail + şifrə/kod + VÖEN yazıb daxil olmalıdır."
                    rules={[{ required: true, message: 'Şifrə/kod tələb olunur' }]}
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="Company Admin giriş şifrəsi / kodu" autoComplete="new-password" allowClear />
                  </Form.Item>

                  <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} loading={adminSubmitLoading}>
                    {selectedAdminCompany?.gmail || selectedAdminCompany?.email || selectedAdminCompany?.adminEmail ? 'Admin hesabını yenilə' : 'Admin hesabı yarat'}
                  </Button>
                </Form>
              </Card>

              <Card className="super-home-card" style={{ borderRadius: 22, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }} styles={{ body: { padding: 24 } }}>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 14 }} wrap>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, color: '#1e293b', fontWeight: 900 }}>Company Admin avtomatik yaranır</h2>
                  </div>
                  <Tag color="green">Auto</Tag>
                </Space>
                {renderCreatedInfoCard()}
              </Card>
            </div>

            <Card className="super-home-card super-home-sticky-card" style={{ borderRadius: 22, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15,23,42,0.06)', position: 'sticky', top: 88 }} styles={{ body: { padding: 24 } }}>
              <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 18 }}>
                <h2 style={{ margin: 0, fontSize: 20, color: '#1e293b', fontWeight: 900 }}>Yeni şirkət</h2>
                <Tag color="orange">Super Admin</Tag>
              </Space>

              <Form<CompanyCreateFormValues> form={companyForm} layout="vertical" onFinish={handleCreateCompany} initialValues={{ employeeLimit: 10 }}>
                {companyFormFields}
                <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={companySubmitLoading} block>
                  Şirkət yarat
                </Button>
              </Form>
            </Card>
          </div>

          <Modal title="Şirkəti redaktə et" open={Boolean(editingCompany)} onCancel={() => { setEditingCompany(null); setEditLogoName(''); setEditLogoDataUrl(''); }} footer={null} width={640} destroyOnHidden forceRender>
            <Form<CompanyEditFormValues> form={companyEditForm} layout="vertical" onFinish={handleUpdateCompany} initialValues={{ employeeLimit: 10 }}>
              <Form.Item name="companyName" label="Şirkət adı" rules={[{ required: true, message: 'Şirkət adı tələb olunur' }, { max: 50, message: 'Şirkət adı maksimum 50 simvol olmalıdır' }]}>
                <Input maxLength={50} showCount />
              </Form.Item>
              <Form.Item name="voen" label="VÖEN" tooltip="VÖEN dəyişdirilə bilməz">
                <Input disabled style={{ fontFamily: 'monospace', color: '#64748b' }} />
              </Form.Item>
              <Form.Item name="employeeLimit" label="Limit" rules={[{ required: true, message: 'Limit tələb olunur' }, { type: 'number', min: 1, max: 50, message: 'Limit 1-50 arası olmalıdır' }]}>
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="address" label="Ünvan" rules={[{ max: 150, message: 'Ünvan maksimum 150 simvol olmalıdır' }]}>
                <Input maxLength={150} showCount />
              </Form.Item>
              <div className="super-home-form-two-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Düzgün email yazın' }, { max: 50, message: 'Email maksimum 50 simvol olmalıdır' }]}>
                  <Input maxLength={50} showCount allowClear />
                </Form.Item>
                <Form.Item name="phone" label="Telefon" rules={[{ max: 50, message: 'Telefon maksimum 50 simvol olmalıdır' }]}>
                  <Input maxLength={50} showCount allowClear />
                </Form.Item>
              </div>
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12, padding: 12, color: '#64748b', marginBottom: 14 }}>
                <strong style={{ color: '#334155', display: 'block', marginBottom: 8 }}>Loqonu dəyiş</strong>
                <Space align="center" wrap>
                  {editLogoDataUrl ? <img src={editLogoDataUrl} alt="Loqo" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 12, border: '1px solid #e2e8f0' }} /> : null}
                  <Upload
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    maxCount={1}
                    showUploadList={false}
                    beforeUpload={(file) => {
                      handleLogoSelect(file as File, setEditLogoName, setEditLogoDataUrl);
                      return false;
                    }}
                    onRemove={() => {
                      setEditLogoName('');
                      setEditLogoDataUrl(editingCompany ? getCompanyLogo(editingCompany) : '');
                      return true;
                    }}
                  >
                    <Button icon={<UploadOutlined />} size="small" style={{ borderRadius: 8 }}>
                      Yeni JPG/PNG seç
                    </Button>
                  </Upload>
                  <span style={{ fontWeight: 700, color: '#334155', overflowWrap: 'anywhere' }}>
                    {editLogoName || 'Loqo seçilməyib'}
                  </span>
                </Space>
              </div>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => setEditingCompany(null)}>Ləğv et</Button>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={companyEditLoading}>Yadda saxla</Button>
              </Space>
            </Form>
          </Modal>

          <Modal
            className="super-company-view-modal"
            title="Şirkət məlumatları"
            open={Boolean(detailCompany)}
            onCancel={() => setDetailCompanyId('')}
            footer={null}
            width={640}
            destroyOnHidden
          >
            {detailCompany && (
              <div className="super-company-view-form">
                <div className="super-company-view-status">
                  <Space align="center" size={12} wrap>
                    <CompanyLogo company={detailCompany} size={58} />
                    <div>
                      <strong>{getCompanyName(detailCompany)}</strong>
                      <span>{detailCompany.voen || 'VÖEN yoxdur'}</span>
                    </div>
                  </Space>
                  <Space align="center" size={10}>
                    <Tag color={detailCompany.isActive !== false ? 'success' : 'default'} style={{ margin: 0, borderRadius: 999 }}>
                      {detailCompany.isActive !== false ? 'Aktiv' : 'Deaktiv'}
                    </Tag>
                    <Switch
                      checked={detailCompany.isActive !== false}
                      loading={activeLoadingId === detailCompany.id}
                      onChange={() => void handleToggleCompanyActive(detailCompany)}
                      aria-label="Şirkətin aktiv statusunu dəyiş"
                    />
                  </Space>
                </div>

                <div className="super-company-view-grid">
                  <label>
                    <span>Şirkət adı</span>
                    <Input value={getCompanyName(detailCompany)} readOnly />
                  </label>
                  <label>
                    <span>VÖEN</span>
                    <Input value={detailCompany.voen || ''} readOnly />
                  </label>
                  <label>
                    <span>Company Admin emaili</span>
                    <Input value={getCompanyEmail(detailCompany) || ''} readOnly />
                  </label>
                  <label>
                    <span>Limit</span>
                    <InputNumber value={getCompanyLimit(detailCompany)} readOnly controls={false} style={{ width: '100%' }} />
                  </label>
                  <label className="super-company-view-wide">
                    <span>Ünvan</span>
                    <Input value={detailCompany.address || ''} readOnly />
                  </label>
                  <label>
                    <span>Email</span>
                    <Input value={getCompanyBusinessEmail(detailCompany) || ''} readOnly />
                  </label>
                  <label>
                    <span>Telefon</span>
                    <Input value={getCompanyPhone(detailCompany) || ''} readOnly />
                  </label>
                </div>

                <div className="super-company-view-note">
                  Bu baxış rejimidir. Məlumat sahələri dəyişdirilmir; şirkətin aktiv/deaktiv statusunu yuxarıdakı switch ilə idarə edə bilərsiniz.
                </div>
              </div>
            )}
          </Modal>
        </>
  );
}
