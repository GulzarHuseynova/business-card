import { useCallback, useEffect, useMemo, useState } from 'react';
import { Form, message, Modal } from 'antd';
import { superAdminActions } from '../helpers/super-admin.helper';
import type { ApiCompany, CompanyAdminFormValues, CompanyCreateFormValues, CompanyEditFormValues, CompanyScanRankingRow, SuperAdminProps } from '../types/super.type';
import { authSessionStorage } from '../storage/auth-session.storage';
import {fileToLogoDataUrl,getCompanyBusinessEmail,getCompanyContact,getCompanyEmail,getCompanyLimit,getCompanyLogo,getCompanyName,getCompanyPhone,normalizeCompanyForUi,type CreatedAdminInfo,} from '../features/super/super-admin';

export function useSuperAdminController(onLogout?: SuperAdminProps['onLogout']) {
  const [companyForm] = Form.useForm<CompanyCreateFormValues>();
  const [companyEditForm] = Form.useForm<CompanyEditFormValues>();
  const [adminForm] = Form.useForm<CompanyAdminFormValues>();
  const [companies, setCompanies] = useState<ApiCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [companySubmitLoading, setCompanySubmitLoading] = useState(false);
  const [companyEditLoading, setCompanyEditLoading] = useState(false);
  const [adminSubmitLoading, setAdminSubmitLoading] = useState(false);
  const [limitLoadingId, setLimitLoadingId] = useState<string | null>(null);
  const [activeLoadingId, setActiveLoadingId] = useState<string | null>(null);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [companyScanRanking, setCompanyScanRanking] = useState<CompanyScanRankingRow[]>([]);
  const [limitDrafts, setLimitDrafts] = useState<Record<string, number>>({});
  const [detailCompanyId, setDetailCompanyId] = useState<string>('');
  const [selectedAdminCompanyId, setSelectedAdminCompanyId] = useState<string>('');
  const [editingCompany, setEditingCompany] = useState<ApiCompany | null>(null);
  const [companiesTableOpen, setCompaniesTableOpen] = useState(false);
  const [createdAdminInfo, setCreatedAdminInfo] = useState<CreatedAdminInfo | null>(null);
  const [selectedLogoName, setSelectedLogoName] = useState('');
  const [selectedLogoDataUrl, setSelectedLogoDataUrl] = useState('');
  const [editLogoName, setEditLogoName] = useState('');
  const [editLogoDataUrl, setEditLogoDataUrl] = useState('');


  const replaceCompanyInState = useCallback((updatedCompany: ApiCompany) => {
    setCompanies((previous) => {
      const normalized = normalizeCompanyForUi(updatedCompany);
      const exists = previous.some((item) => item.id === normalized.id || item.apiId === normalized.apiId || (item.voen && item.voen === normalized.voen));

      if (!exists) return [normalized, ...previous];

      return previous.map((item) => {
        const same = item.id === normalized.id || item.apiId === normalized.apiId || (item.voen && item.voen === normalized.voen);
        return same ? { ...item, ...normalized } : item;
      });
    });

    setLimitDrafts((previous) => ({
      ...previous,
      [updatedCompany.id]: getCompanyLimit(updatedCompany),
    }));
  }, []);

  const handleLogout = () => {
    Modal.confirm({
      title: 'Çıxış etmək istəyirsiniz?',
      content: 'Sistemdən çıxış edəcəksiniz.',
      okText: 'Bəli',
      cancelText: 'Xeyr',
      okButtonProps: { danger: true },
      onOk: () => {
        authSessionStorage.clear();

        if (onLogout) {
          onLogout();
        } else {
          window.location.href = '/login';
        }
      },
    });
  };

  const loadCompanyStatistics = useCallback(async (sourceCompanies: ApiCompany[]) => {
    setStatisticsLoading(true);
    try {
      const ranking = await superAdminActions.getCompanyScanRanking(sourceCompanies);
      setCompanyScanRanking(ranking);
    } catch (error) {
      console.warn('[SuperAdmin] statistics load error:', error);
      setCompanyScanRanking(sourceCompanies.map((company) => ({
        key: company.id,
        companyId: company.id,
        companyName: getCompanyName(company),
        voen: company.voen || '',
        logo: getCompanyLogo(company),
        scanCount: Number(company.scanCount || 0),
        isActive: company.isActive !== false,
      })).sort((left, right) => right.scanCount - left.scanCount));
    } finally {
      setStatisticsLoading(false);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const data = await superAdminActions.getCompanies();
      setCompanies(data);

      const initialLimits = data.reduce<Record<string, number>>((acc, company) => {
        acc[company.id] = getCompanyLimit(company);
        return acc;
      }, {});
      setLimitDrafts(initialLimits);
      void loadCompanyStatistics(data);
    } catch (error) {
      message.error('Şirkətlər yüklənmədi. Token və Super Admin icazəsini yoxlayın.');
      console.error('[SuperAdmin] companies load error:', error);
    }
  }, [loadCompanyStatistics]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchCompanies();
      setLoading(false);
    };

    void load();
  }, [fetchCompanies]);

  const companyOptions = useMemo(() => {
    return companies.map((company) => ({
      value: company.id,
      label: `${getCompanyName(company)} — ${company.voen || 'VÖEN yoxdur'}`,
    }));
  }, [companies]);

  const selectedAdminCompany = useMemo(() => {
    return companies.find((company) => company.id === selectedAdminCompanyId) || null;
  }, [companies, selectedAdminCompanyId]);

  const detailCompany = useMemo(() => {
    return companies.find((company) => company.id === detailCompanyId) || null;
  }, [companies, detailCompanyId]);

  const detailLimit = detailCompany ? getCompanyLimit(detailCompany) : 0;
  const detailDraftLimit = detailCompany ? limitDrafts[detailCompany.id] ?? detailLimit : 1;
  const detailActiveEmployees = detailCompany?.activeEmployees ?? 0;
  const detailUsedPercent = detailLimit > 0 ? Math.min(100, Math.round((detailActiveEmployees / detailLimit) * 100)) : 0;
  const detailChanged = detailCompany ? Number(detailDraftLimit) !== Number(detailLimit) : false;

  const handleLogoSelect = useCallback((file: File, setName: (name: string) => void, setDataUrl: (dataUrl: string) => void) => {
    const isValidType = file.type === 'image/jpeg' || file.type === 'image/png' || /\.(jpe?g|png)$/i.test(file.name);
    if (!isValidType) {
      message.error('Yalnız JPG və PNG loqo seçilə bilər.');
      return;
    }

    setName(file.name);
    void fileToLogoDataUrl(file)
      .then(setDataUrl)
      .catch((error) => {
        setName('');
        setDataUrl('');
        message.error(error instanceof Error ? error.message : 'Loqo oxunmadı.');
      });
  }, []);

  const sameCompany = useCallback((left?: ApiCompany | null, right?: ApiCompany | null) => {
    if (!left || !right) return false;

    return Boolean(
      (left.id && right.id && left.id === right.id) ||
        (left.apiId && right.apiId && left.apiId === right.apiId) ||
        (left.voen && right.voen && left.voen === right.voen),
    );
  }, []);

  const showCompanyInAutoAdminCard = useCallback((company: ApiCompany, existingInfo?: CreatedAdminInfo | null) => {
    const shouldKeepPassword = existingInfo ? sameCompany(existingInfo.company, company) : false;

    setCreatedAdminInfo({
      company,
      companyName: getCompanyName(company),
      voen: company.voen || '',
      email: getCompanyEmail(company),
      password: shouldKeepPassword ? existingInfo?.password || company.defaultPassword || '' : company.defaultPassword || '',
      address: company.address || '',
      contact: getCompanyContact(company),
      companyEmail: getCompanyBusinessEmail(company),
      phone: getCompanyPhone(company),
      limit: getCompanyLimit(company),
      logoName: company.logo || company.logoUrl ? 'Backend-dən gəldi' : shouldKeepPassword ? existingInfo?.logoName || '' : '',
    });
  }, [sameCompany]);

  const replaceEditedCompanyInState = useCallback((originalCompany: ApiCompany, updatedCompany: ApiCompany) => {
    setCompanies((previous) => previous.map((item) => {
      const isSame = Boolean(
        (item.id && originalCompany.id && item.id === originalCompany.id) ||
          (item.apiId && originalCompany.apiId && item.apiId === originalCompany.apiId) ||
          (item.voen && originalCompany.voen && item.voen === originalCompany.voen) ||
          (item.id && updatedCompany.id && item.id === updatedCompany.id) ||
          (item.apiId && updatedCompany.apiId && item.apiId === updatedCompany.apiId) ||
          (item.voen && updatedCompany.voen && item.voen === updatedCompany.voen),
      );

      return isSame ? { ...item, ...updatedCompany } : item;
    }));
  }, []);

  const dashboardStats = useMemo(() => {
    const activeCompanies = companies.filter((company) => company.isActive !== false).length;
    const inactiveCompanies = companies.length - activeCompanies;
    const totalScans = companyScanRanking.reduce((sum, company) => sum + company.scanCount, 0);

    return [
      { label: 'Şirkət sayı', value: companies.length },
      { label: 'Aktiv şirkət', value: activeCompanies },
      { label: 'Deaktiv şirkət', value: inactiveCompanies },
      { label: 'Ümumi skan', value: totalScans },
    ];
  }, [companies, companyScanRanking]);

  const fetchStatistics = useCallback(async () => {
    await loadCompanyStatistics(companies);
  }, [companies, loadCompanyStatistics]);

  const handleAdminCompanySelect = (companyId: string) => {
    setSelectedAdminCompanyId(companyId);

    const selectedCompany = companies.find((company) => company.id === companyId);
    if (!selectedCompany) return;

    adminForm.setFieldsValue({
      companyId,
      adminName: selectedCompany.adminName || '',
      gmail: getCompanyEmail(selectedCompany),
      phone: selectedCompany.phone || '',
      password: '',
    });

    showCompanyInAutoAdminCard(selectedCompany, createdAdminInfo);
  };

  const handleCreateAdmin = async (values: CompanyAdminFormValues) => {
    const selectedCompany = companies.find((company) => company.id === values.companyId);

    if (!selectedCompany) {
      message.error('Şirkət seçilməyib.');
      return;
    }

    setAdminSubmitLoading(true);

    try {
      const adminName = values.adminName.trim();
      const gmail = values.gmail.trim().toLowerCase();
      const phone = values.phone?.trim() || '';

      await superAdminActions.createCompanyAdminAccount({
        companyId: selectedCompany.id,
        companyName: getCompanyName(selectedCompany),
        voen: selectedCompany.voen,
        adminName,
        gmail,
        phone,
        password: values.password,
        address: selectedCompany.address,
        contact: getCompanyContact(selectedCompany),
        employeeLimit: getCompanyLimit(selectedCompany),
        logo: selectedCompany.logo || selectedCompany.logoUrl,
        logoUrl: selectedCompany.logoUrl || selectedCompany.logo,
      });

      const updatedCompany: ApiCompany = {
        ...selectedCompany,
        adminName,
        gmail,
        email: gmail,
        adminEmail: gmail,
        phone,
        defaultPassword: values.password,
      };

      replaceEditedCompanyInState(selectedCompany, updatedCompany);
      replaceCompanyInState(updatedCompany);
      setSelectedAdminCompanyId(selectedCompany.id);
      setCreatedAdminInfo({
        company: updatedCompany,
        companyName: getCompanyName(updatedCompany),
        voen: updatedCompany.voen || '',
        email: gmail,
        password: values.password,
        address: updatedCompany.address || '',
        contact: getCompanyContact(updatedCompany),
        companyEmail: getCompanyBusinessEmail(updatedCompany),
        phone: getCompanyPhone(updatedCompany),
        limit: getCompanyLimit(updatedCompany),
        logoName: updatedCompany.logo || updatedCompany.logoUrl ? 'Backend-dən gəldi' : '',
      });

      message.success('Company Admin hesabı yadda saxlanıldı. Gmail + şifrə/kod + VÖEN ilə giriş yoxlanıla bilər.');
      adminForm.setFieldsValue({
        ...values,
        adminName,
        gmail,
        phone,
        password: '',
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Company Admin hesabı yaratmaq mümkün olmadı.';
      message.error(text);
      console.error('[SuperAdmin] create company admin error:', error);
    } finally {
      setAdminSubmitLoading(false);
    }
  };

  const handleCreateCompany = async (values: CompanyCreateFormValues) => {
    setCompanySubmitLoading(true);

    try {
      const createdCompanyResponse = await superAdminActions.createCompany({
        companyName: values.companyName,
        name: values.companyName,
        voen: values.voen,
        employeeLimit: Number(values.employeeLimit),
        limit: Number(values.employeeLimit),
        userLimit: Number(values.employeeLimit),
        UserLimit: Number(values.employeeLimit),
        address: values.address,
        email: values.email,
        contact: values.phone,
        phone: values.phone,
        logo: selectedLogoDataUrl,
        logoUrl: selectedLogoDataUrl,
      });

      const createdCompany = normalizeCompanyForUi(createdCompanyResponse, {
        ...values,
        voen: values.voen,
        contact: values.phone,
        logo: selectedLogoDataUrl,
        logoUrl: selectedLogoDataUrl,
      });
      const adminEmail = getCompanyEmail(createdCompany);
      const defaultPassword = createdCompany.defaultPassword || '';
      const logoName = selectedLogoName;

      replaceCompanyInState(createdCompany);
      setDetailCompanyId(createdCompany.id);
      setCreatedAdminInfo({
        company: createdCompany,
        companyName: getCompanyName(createdCompany),
        voen: createdCompany.voen || values.voen,
        email: adminEmail,
        password: defaultPassword,
        address: createdCompany.address || values.address || '',
        contact: getCompanyContact(createdCompany) || values.phone || values.contact || '',
        companyEmail: getCompanyBusinessEmail(createdCompany) || values.email || '',
        phone: getCompanyPhone(createdCompany) || values.phone || '',
        limit: getCompanyLimit(createdCompany) || Number(values.employeeLimit || 0),
        logoName,
      });

      if (adminEmail && defaultPassword) {
        Modal.success({
          title: 'Şirkət və Company Admin avtomatik yaradıldı',
          content: (
            <div>
              <p style={{ marginBottom: 8 }}>Bu məlumatları qeyd edin:</p>
              <p><strong>Email:</strong> {adminEmail}</p>
              <p><strong>İlkin şifrə:</strong> {defaultPassword}</p>
              <p><strong>VÖEN:</strong> {createdCompany.voen || values.voen}</p>
            </div>
          ),
          okText: 'Bağla',
        });
      } else {
        message.warning('Şirkət yaradıldı, amma backend create response-da adminEmail/defaultPassword qaytarmadı. Bu məlumat backend-dən gəlməlidir.');
      }

      companyForm.resetFields();
      setSelectedLogoName('');
      setSelectedLogoDataUrl('');
      setCompaniesTableOpen(true);
      await fetchCompanies();
      replaceCompanyInState(createdCompany);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Şirkət yaratmaq mümkün olmadı.';
      message.error(text);
      console.error('[SuperAdmin] create company error:', error);
    } finally {
      setCompanySubmitLoading(false);
    }
  };

  const openEditCompany = (company: ApiCompany) => {
    setCreatedAdminInfo((previous) => {
      const shouldKeepPassword = previous ? sameCompany(previous.company, company) : false;

      return {
        company,
        companyName: getCompanyName(company),
        voen: company.voen || '',
        email: getCompanyEmail(company),
        password: shouldKeepPassword ? previous?.password || company.defaultPassword || '' : company.defaultPassword || '',
        address: company.address || '',
        contact: getCompanyContact(company),
        companyEmail: getCompanyBusinessEmail(company),
        phone: getCompanyPhone(company),
        limit: getCompanyLimit(company),
        logoName: company.logo || company.logoUrl ? 'Backend-dən gəldi' : shouldKeepPassword ? previous?.logoName || '' : '',
      };
    });
    setEditLogoName(getCompanyLogo(company) ? 'Mövcud loqo' : '');
    setEditLogoDataUrl(getCompanyLogo(company));
    setEditingCompany(company);
    companyEditForm.setFieldsValue({
      companyName: getCompanyName(company),
      voen: company.voen,
      employeeLimit: getCompanyLimit(company) || 1,
      address: company.address || '',
      email: getCompanyBusinessEmail(company),
      phone: getCompanyPhone(company),
      contact: getCompanyContact(company),
    });
  };

  const handleUpdateCompany = async (values: CompanyEditFormValues) => {
    if (!editingCompany) return;

    setCompanyEditLoading(true);

    try {
      const updatedResponse = await superAdminActions.updateCompany(editingCompany, {
        companyName: values.companyName,
        name: values.companyName,
        voen: editingCompany.voen,
        employeeLimit: Number(values.employeeLimit),
        limit: Number(values.employeeLimit),
        userLimit: Number(values.employeeLimit),
        UserLimit: Number(values.employeeLimit),
        address: values.address,
        email: values.email,
        contact: values.phone,
        phone: values.phone,
        logo: editLogoDataUrl || getCompanyLogo(editingCompany),
        logoUrl: editLogoDataUrl || getCompanyLogo(editingCompany),
      });
      const updatedCompany = normalizeCompanyForUi(updatedResponse, {
        ...values,
        voen: editingCompany.voen,
        contact: values.phone,
        logo: editLogoDataUrl || getCompanyLogo(editingCompany),
        logoUrl: editLogoDataUrl || getCompanyLogo(editingCompany),
      });

      replaceEditedCompanyInState(editingCompany, updatedCompany);
      setLimitDrafts((previous) => ({
        ...previous,
        [editingCompany.id]: getCompanyLimit(updatedCompany),
        [updatedCompany.id]: getCompanyLimit(updatedCompany),
      }));
      if (detailCompanyId === editingCompany.id || detailCompanyId === updatedCompany.id) setDetailCompanyId(updatedCompany.id);
      showCompanyInAutoAdminCard(updatedCompany, createdAdminInfo);

      message.success('Şirkət məlumatları yeniləndi.');
      setEditingCompany(null);
      setEditLogoName('');
      setEditLogoDataUrl('');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Şirkət məlumatları yenilənmədi.';
      message.error(text);
      console.error('[SuperAdmin] update company error:', error);
    } finally {
      setCompanyEditLoading(false);
    }
  };

  const handleToggleCompanyActive = async (company: ApiCompany) => {
    const nextActive = company.isActive === false;
    const previousActive = company.isActive !== false;
    const optimisticCompany = {
      ...company,
      isActive: nextActive,
      status: nextActive ? 'Aktiv' : 'Deaktiv',
    };

    const syncCreatedInfo = (updatedCompany: ApiCompany) => {
      setCreatedAdminInfo((previous) => {
        if (!previous || !sameCompany(previous.company, company)) return previous;
        return { ...previous, company: { ...previous.company, ...updatedCompany } };
      });
    };

    setActiveLoadingId(company.id);
    replaceCompanyInState(optimisticCompany);
    syncCreatedInfo(optimisticCompany);

    try {
      const updated = await superAdminActions.setCompanyActive(company, nextActive);
      const confirmedCompany = { ...optimisticCompany, ...updated };
      replaceCompanyInState(confirmedCompany);
      syncCreatedInfo(confirmedCompany);
      setCompanyScanRanking((previous) => previous.map((row) =>
        row.companyId === company.id ? { ...row, isActive: nextActive } : row,
      ));
      message.success(nextActive ? 'Şirkət aktiv edildi.' : 'Şirkət deaktiv edildi.');
    } catch (error) {
      const restoredCompany = {
        ...company,
        isActive: previousActive,
        status: previousActive ? 'Aktiv' : 'Deaktiv',
      };
      replaceCompanyInState(restoredCompany);
      syncCreatedInfo(restoredCompany);
      const text = error instanceof Error ? error.message : 'Şirkətin statusu yenilənmədi.';
      message.error(text);
      console.error('[SuperAdmin] company status error:', error);
    } finally {
      setActiveLoadingId(null);
    }
  };

  const handleLimitChange = async (company: ApiCompany) => {
    const companyId = company.id;
    const limit = Number(limitDrafts[companyId]);

    if (!limit || Number.isNaN(limit) || limit < 1) {
      message.warning('Limit 1 və ya daha böyük olmalıdır.');
      return;
    }

    setLimitLoadingId(companyId);

    try {
      await superAdminActions.updateCompanyLimit(company, limit);
      const updated = { ...company, employeeLimit: limit, limit, userLimit: limit, UserLimit: limit };
      replaceCompanyInState(updated);
      setCreatedAdminInfo((previous) => {
        if (!previous) return previous;
        const same = previous.company.id === company.id || previous.company.voen === company.voen;
        return same ? { ...previous, company: updated, limit } : previous;
      });
      message.success('Əməkdaş limiti yeniləndi.');
    } catch (error) {
      message.error('Əməkdaş limiti yenilənmədi.');
      console.warn('[SuperAdmin] limit update error:', error);
    } finally {
      setLimitLoadingId(null);
    }
  };


  return {
    activeLoadingId,
    adminForm,
    adminSubmitLoading,
    companies,
    companiesTableOpen,
    companyEditForm,
    companyEditLoading,
    companyForm,
    companyOptions,
    companyScanRanking,
    companySubmitLoading,
    createdAdminInfo,
    dashboardStats,
    detailActiveEmployees,
    detailChanged,
    detailCompany,
    detailDraftLimit,
    detailLimit,
    detailUsedPercent,
    editLogoDataUrl,
    editLogoName,
    editingCompany,
    fetchCompanies,
    fetchStatistics,
    handleAdminCompanySelect,
    handleCreateAdmin,
    handleCreateCompany,
    handleToggleCompanyActive,
    handleLimitChange,
    handleLogoSelect,
    handleLogout,
    handleUpdateCompany,
    limitLoadingId,
    loading,
    openEditCompany,
    selectedAdminCompany,
    statisticsLoading,
    selectedLogoDataUrl,
    selectedLogoName,
    setCompaniesTableOpen,
    setDetailCompanyId,
    setEditLogoDataUrl,
    setEditLogoName,
    setEditingCompany,
    setLimitDrafts,
    setSelectedLogoDataUrl,
    setSelectedLogoName,
    showCompanyInAutoAdminCard,
  };
}

export type SuperAdminController = ReturnType<typeof useSuperAdminController>;
