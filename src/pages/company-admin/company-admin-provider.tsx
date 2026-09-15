import {useCallback,useEffect, useState,type ReactNode,} from "react";
import { message } from "antd";
import axios from "axios";
import { analyticsActions } from "../../helpers/analytics.helper";
import { companyActions } from "../../helpers/company.helper";
import type { AddUserPayload, NormalizedCompanyInfo } from "../../types/company.type";
import { mapCompanyInfo, normalizeUser } from "../../mappers/company.mapper";
import { getSavedCompanyId, mapCompanyLogoResponse, resolveCompanyId, saveCompanyIdFromUnknown } from "../../storage/company.storage";
import { mergeNormalizedUsers } from "../../features/company/company-user-identity";
import { useAuthSelector } from "../../store/authStore";
import { getStoredUser } from "../../storage/auth.storage";
import { CompanyAdminContext } from "../../hooks/use-company-admin";
import {DEFAULT_COMPANY,type ActivityLog,type AddUserFormValues,type AnalyticsRankingRow,type AnalyticsScanLogRow,type AuditLogRow,type CompanyFormValues,type UserData,} from "../../types/company-admin.type";
import { normalizeAssetUrl, normalizeInlineImageData } from "../../utils/asset-url.utils";
import { pickPublicCardPhoto } from "../../features/public-card/public-card-shared";
import { savePublicCardProfilesFromUsers } from "../../features/public-card/public-card-profiles";
import { fileToImageDataUrl, imageAssetToDataUrl } from "../../utils/image-data-url.utils";
import { saveCompanyLogoToStorage } from "../../storage/company.storage";
import { companyLogoImageKey } from "../../storage/persistent-image-cache";

const normalizeText = (value?: string | number | null) => String(value ?? '').trim().toLowerCase();

const getPreservedEmployeePhoto = (...values: unknown[]) => pickPublicCardPhoto(...values);


const getRequestErrorMessage = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : '';
  }

  const data = error.response?.data;

  if (typeof data === 'string') return data.trim();
  if (!data || typeof data !== 'object') return error.message;

  const record = data as Record<string, unknown>;
  const directMessage = [record.message, record.detail, record.title, record.error]
    .find((value) => typeof value === 'string' && value.trim());

  if (typeof directMessage === 'string') return directMessage.trim();

  if (record.errors && typeof record.errors === 'object') {
    const validationMessages = Object.values(record.errors as Record<string, unknown>)
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));

    if (validationMessages.length > 0) return validationMessages.join(' ');
  }

  return error.message;
};

const toFiniteNumber = (value: unknown): number => {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const isSuperAdminUser = (user: Partial<UserData>) => {
  const role = normalizeText(user.role);
  const email = normalizeText(user.email);
  const jobTitle = normalizeText(user.jobTitle);
  const fullName = [user.firstName, user.lastName, user.middleName]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ');

  return (
    role === 'super-admin' ||
    role === 'superadmin' ||
    role === '2' ||
    email === 'admin@setclapp.com' ||
    (fullName.includes('super') && fullName.includes('admin')) ||
    (jobTitle.includes('system') && jobTitle.includes('admin'))
  );
};

const filterCompanyUsers = (users: UserData[]) => users.filter((user) => !isSuperAdminUser(user));

export function CompanyAdminProvider({ children }: { children: ReactNode }) {
  const authCompanyId = useAuthSelector((state) => state.companyId);
  const authUserId = useAuthSelector((state) => state.userId);
  const accountInfo = useAuthSelector((state) => state.accountInfo);

  const [companyId, setCompanyId] = useState(authCompanyId || getSavedCompanyId());
  const [company, setCompany] = useState<NormalizedCompanyInfo>(DEFAULT_COMPANY);

  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);

  const [analyticsCount, setAnalyticsCount] = useState(0);
  const [analyticsChart, setAnalyticsChart] = useState<unknown[]>([]);
  const [analyticsRanking, setAnalyticsRanking] = useState<AnalyticsRankingRow[]>([]);
  const [scanLogs, setScanLogs] = useState<AnalyticsScanLogRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);

  const activeCompanyId = companyId || company.id || authCompanyId || getSavedCompanyId() || "";
  const currentEmployeesCount = filterCompanyUsers(usersList).filter((user) => user.isActive !== false).length;
  const usagePercent = company.employeeLimit > 0
    ? Math.min(100, Math.round((currentEmployeesCount / company.employeeLimit) * 100))
    : 0;
  const isLimitReached = company.employeeLimit > 0 && currentEmployeesCount >= company.employeeLimit;

  const loadCompanyInfo = useCallback(async () => {
    try {
      const data = await companyActions.getCurrentCompany();
      const mapped = mapCompanyInfo(data);
      const foundId = mapped.id || saveCompanyIdFromUnknown(data) || await resolveCompanyId(data, accountInfo);
      const logoKey = companyLogoImageKey(foundId || mapped.id, mapped.voen);
      const inlineLogo = await imageAssetToDataUrl(mapped.logo, logoKey);
      const nextCompany = inlineLogo ? { ...mapped, logo: inlineLogo } : mapped;

      if (inlineLogo) {
        saveCompanyLogoToStorage(inlineLogo, foundId || mapped.id, mapped.voen);
      }

      setCompany(nextCompany);
      if (foundId) setCompanyId(foundId);

      return foundId || companyId || authCompanyId || getSavedCompanyId() || "";
    } catch {
      if (accountInfo) {
        const mapped = mapCompanyInfo(accountInfo);
        const foundId = mapped.id || await resolveCompanyId(accountInfo);
        const logoKey = companyLogoImageKey(foundId || mapped.id, mapped.voen);
      const inlineLogo = await imageAssetToDataUrl(mapped.logo, logoKey);
        const nextMapped = inlineLogo ? { ...mapped, logo: inlineLogo } : mapped;

        if (inlineLogo) {
          saveCompanyLogoToStorage(inlineLogo, foundId || mapped.id, mapped.voen);
        }

        setCompany((previous) => ({ ...previous, ...nextMapped, id: foundId || mapped.id }));
        if (foundId) setCompanyId(foundId);

        return foundId || companyId || authCompanyId || getSavedCompanyId() || "";
      }

      return companyId || authCompanyId || getSavedCompanyId() || "";
    }
  }, [accountInfo, authCompanyId, companyId]);

  const fetchUsers = useCallback(
    async (id?: string) => {
      const finalCompanyId = id || companyId || authCompanyId || getSavedCompanyId() || await resolveCompanyId(accountInfo);

      try {
        if (finalCompanyId && finalCompanyId !== companyId) setCompanyId(finalCompanyId);

        const users = await companyActions.getUsersByCompany(finalCompanyId);
        const normalizedUsers = Array.isArray(users) ? users : [];
        setUsersList((previous) => filterCompanyUsers(mergeNormalizedUsers(normalizedUsers, previous)));
        setRecentActivities([
          {
            user: "Admin",
            action: "İşçi siyahısı API-dən yükləndi",
            time: "İndi",
            color: "#4b9ada",
          },
        ]);
      } catch {
        message.error("İşçiləri gətirmək mümkün olmadı. Token və icazəni yoxlayın.");
      }
    },
    [accountInfo, authCompanyId, companyId]
  );

  const fetchAnalytics = useCallback(async () => {
    try {
      const [count, chart, ranking, logs] = await Promise.all([
        analyticsActions.getScansCount().catch(() => 0),
        analyticsActions.getScansChart().catch(() => []),
        analyticsActions.getEmployeesRanking().catch(() => []),
        analyticsActions.getScansLogs().catch(() => []),
      ]);

      const normalizedChart: Record<string, unknown>[] = Array.isArray(chart)
        ? chart.reduce((rows: Record<string, unknown>[], item: unknown) => {
            if (
              typeof item === "object" &&
              item !== null &&
              !Array.isArray(item)
            ) {
              rows.push(item as Record<string, unknown>);
            }

            return rows;
          }, [])
        : [];

      const normalizedRanking: AnalyticsRankingRow[] = Array.isArray(ranking)
        ? (ranking as AnalyticsRankingRow[])
        : [];

      const normalizedLogs: AnalyticsScanLogRow[] = Array.isArray(logs)
        ? (logs as AnalyticsScanLogRow[])
        : [];

      const countRow =
        typeof count === "object" && count !== null
          ? (count as Record<string, unknown>)
          : null;

      const countFromApi: number = countRow
        ? toFiniteNumber(
            countRow.count ??
              countRow.total ??
              countRow.totalScans ??
              countRow.totalScanCount ??
              countRow.scanCount ??
              countRow.scansCount ??
              countRow.value,
          )
        : toFiniteNumber(count);

      const countFromRanking: number = normalizedRanking.reduce<number>(
        (total, item) => {
          const row = item as unknown as Record<string, unknown>;
          const value =
            row.scanCount ??
            row.scans ??
            row.count ??
            row.total ??
            0;

          return total + toFiniteNumber(value);
        },
        0,
      );

      const countFromChart: number = normalizedChart.reduce<number>(
        (total, row) => {
          const value =
            row.count ??
            row.scanCount ??
            row.scans ??
            row.total ??
            row.value ??
            0;

          return total + toFiniteNumber(value);
        },
        0,
      );

      const resolvedCount: number =
        countFromApi > 0
          ? countFromApi
          : countFromRanking > 0
            ? countFromRanking
            : countFromChart > 0
              ? countFromChart
              : normalizedLogs.length;

      setAnalyticsCount(resolvedCount);
      setAnalyticsChart(normalizedChart);
      setAnalyticsRanking(normalizedRanking);
      setScanLogs(normalizedLogs);
    } catch (error) {
      console.error("Analitika məlumatları yüklənmədi:", error);

      setAnalyticsCount(0);
      setAnalyticsChart([]);
      setAnalyticsRanking([]);
      setScanLogs([]);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const logs = await companyActions.getLogs();
      setAuditLogs(Array.isArray(logs) ? (logs as AuditLogRow[]) : []);
    } catch {
      setAuditLogs([]);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      const resolvedCompanyId = await loadCompanyInfo();
      await Promise.all([
        fetchUsers(resolvedCompanyId),
        fetchAnalytics(),
      ]);
    };

    void loadAll();
  }, [loadCompanyInfo, fetchUsers, fetchAnalytics, fetchAuditLogs]);

  useEffect(() => {
    if (usersList.length === 0) return;

    const timeoutId = window.setTimeout(() => {
      savePublicCardProfilesFromUsers(usersList, company);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [usersList, company]);

  const addUser = async (values: AddUserFormValues) => {
    const resolvedCompanyId = activeCompanyId || await resolveCompanyId(accountInfo, company);

    if (!resolvedCompanyId) {
      message.error("Şirkət ID tapılmadı.");
      return;
    }

    try {
      if (resolvedCompanyId !== companyId) setCompanyId(resolvedCompanyId);

      const payload: AddUserPayload = {
        companyId: resolvedCompanyId,
        firstName: values.firstName,
        lastName: values.lastName,
        middleName: values.middleName || "",
        jobTitle: values.jobTitle,
        phone1: values.phone1,
        phone2: values.phone2 || "",
        extensionNumber: values.extensionNumber || "",
        whatsapp: values.whatsapp || "",
        linkedin: values.linkedin || "",
        facebook: values.facebook || "",
        instagram: values.instagram || "",
        photo: values.photo || "",
        photoUrl: values.photoUrl || values.photo || "",
        photoData: normalizeInlineImageData(values.photoData || values.photoUrl || values.photo),
        photoFile: values.photoFile,
        email: values.email,
        password: values.password,
        companyName: company.name,
        companyVoen: company.voen,
        role: 0,
        isActive: values.isActive ?? true,
        canEdit: values.canEdit ?? true,
        additionalInfo: values.additionalInfo,
        dateOfBirth: values.dateOfBirth,
        address: values.address,
        googleMapsUrl: values.googleMapsUrl,
        cardBackgroundUrl: values.cardBackgroundUrl,
        cardBackgroundFile: values.cardBackgroundFile,
        socialAccounts: values.socialAccounts,
      };

      const createdUser = await companyActions.addUser(payload);
      const createdNormalized = normalizeUser({
        ...payload,
        ...(createdUser && typeof createdUser === 'object' ? createdUser : {}),
      });

      setUsersList((previous) => filterCompanyUsers(mergeNormalizedUsers(previous, [createdNormalized])));

      if (values.photoFile && !normalizeAssetUrl(createdNormalized.photoUrl || createdNormalized.photo)) {
        message.warning("İşçi əlavə edildi, amma backend foto URL qaytarmadı. Şəkil backenddən gəlmədiyi üçün görünməyəcək.");
      } else {
        message.success("Yeni işçi uğurla əlavə edildi.");
      }
      await fetchUsers(resolvedCompanyId);
    } catch (error) {
      const reason = getRequestErrorMessage(error);
      message.error(reason
        ? `İşçi əlavə edilərkən xəta baş verdi: ${reason}`
        : "İşçi əlavə edilərkən xəta baş verdi.");
    }
  };


  const updateUser = async (id: string, values: Partial<AddUserFormValues>, beforeUser?: Partial<UserData>) => {
    const target = beforeUser || usersList.find((user) => user.id === id || user.email === id);

    if (!target) {
      message.error({ key: "employee-edit-save", content: "Redaktə ediləcək işçi tapılmadı." });
      return;
    }

    const preservedPhoto = getPreservedEmployeePhoto(
      values.photoData,
      values.photoUrl,
      values.photo,
      target.photoData,
      target.photoUrl,
      target.photo,
    );
    const optimisticUser = normalizeUser({
      ...target,
      ...values,
      photo: preservedPhoto,
      photoUrl: preservedPhoto,
      photoData: normalizeInlineImageData(values.photoData || values.photoUrl || values.photo || target.photoData || target.photo || target.photoUrl),
      id: target.id || id,
    });

    setUsersList((previous) => previous.map((user) => {
      if (user.id !== id && user.email !== id && user.id !== target.id && user.email !== target.email) return user;
      return { ...user, ...optimisticUser, id: user.id };
    }));

    try {
      const updated = await companyActions.updateUserProfile(id, values, target);
      const updatedRecord = updated && typeof updated === 'object'
        ? updated as unknown as Record<string, unknown>
        : {};
      const finalPhoto = getPreservedEmployeePhoto(
        updatedRecord.photoData,
        updatedRecord.photoUrl,
        updatedRecord.photo,
        preservedPhoto,
      );
      const normalizedUpdated = normalizeUser({
        ...target,
        ...values,
        ...updatedRecord,
        photo: finalPhoto,
        photoUrl: finalPhoto,
        photoData: normalizeInlineImageData(updatedRecord.photoData || values.photoData || values.photoUrl || values.photo || target.photoData || finalPhoto),
        id: target.id || id,
      });

      setUsersList((previous) => filterCompanyUsers(mergeNormalizedUsers(previous.map((user) => (
        user.id === id || user.email === id || user.id === target.id || user.email === target.email
          ? { ...user, ...normalizedUpdated, id: user.id || normalizedUpdated.id }
          : user
      )))));

      if (values.photoFile && !normalizeAssetUrl(normalizedUpdated.photoUrl || normalizedUpdated.photo)) {
        message.warning({ key: "employee-edit-save", content: "Məlumat yeniləndi, amma backend foto URL qaytarmadı." });
      } else {
        message.success({ key: "employee-edit-save", content: "İşçi məlumatları yeniləndi." });
      }
      void fetchUsers(activeCompanyId || target.companyId);
    } catch {
      setUsersList((previous) => previous.map((user) => {
        if (user.id !== id && user.email !== id && user.id !== target.id && user.email !== target.email) return user;
        return normalizeUser(target);
      }));
      message.error({ key: "employee-edit-save", content: "İşçi məlumatları yenilənmədi." });
    }
  };

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    const beforeUser = usersList.find((user) => user.id === id || user.email === id);

    const accountRecord = accountInfo && typeof accountInfo === "object"
      ? accountInfo as Record<string, unknown>
      : {};
    const storedUser = getStoredUser();
    const currentAdminKeys = new Set([
      authUserId,
      storedUser?.userId,
      storedUser?.id,
      storedUser?.email,
      accountRecord.userId,
      accountRecord.id,
      accountRecord.email,
      accountRecord.gmail,
    ].map((value) => normalizeText(value == null ? '' : String(value))).filter(Boolean));
    const targetKeys = [id, beforeUser?.id, beforeUser?.email]
      .map(normalizeText)
      .filter(Boolean);

    if (!nextStatus && targetKeys.some((key) => currentAdminKeys.has(key))) {
      message.warning("Company Admin öz hesabını deaktiv edə bilməz.");
      return;
    }

    setUsersList((previous) => previous.map((user) => {
      if (user.id !== id && user.email !== id) return user;
      return { ...user, isActive: nextStatus };
    }));

    try {
      await companyActions.updateUserStatus(id, nextStatus, beforeUser);
      message.success(nextStatus ? "İşçi arxivdən aktiv siyahıya qaytarıldı." : "İşçi deaktiv edildi və arxivə göndərildi.");
    } catch {
      setUsersList((previous) => previous.map((user) => {
        if (user.id !== id && user.email !== id) return user;
        return { ...user, isActive: currentStatus };
      }));
      message.error("Status yenilənmədi.");
    }
  };

  const toggleUserCanEdit = async (id: string, currentCanEdit: boolean) => {
    const nextCanEdit = !currentCanEdit;
    const beforeUser = usersList.find((user) => user.id === id || user.email === id);

    setUsersList((previous) => previous.map((user) => {
      if (user.id !== id && user.email !== id) return user;
      return { ...user, canEdit: nextCanEdit };
    }));

    try {
      await companyActions.updateUserCanEdit(id, nextCanEdit, beforeUser);
      message.success(nextCanEdit ? "Redaktə icazəsi verildi." : "Redaktə icazəsi bağlandı. Əməkdaş yenə daxil ola bilər, amma redaktə edə bilməz.");
    } catch {
      setUsersList((previous) => previous.map((user) => {
        if (user.id !== id && user.email !== id) return user;
        return { ...user, canEdit: currentCanEdit };
      }));
      message.error("Redaktə icazəsi yenilənmədi.");
    }
  };

  const resetUserPassword = async (id: string, newPassword: string, beforeUser?: Partial<UserData>) => {
    const target = beforeUser || usersList.find((user) => user.id === id || user.email === id);

    try {
      await companyActions.resetUserPassword(id, newPassword, target);
      message.success('İşçinin kodu/şifrəsi yeniləndi.');
      await fetchUsers(activeCompanyId || target?.companyId);
    } catch (error) {
      console.error('İşçi kodu yenilənmədi:', error);
      message.error('İşçinin kodu/şifrəsi yenilənmədi.');
      throw error;
    }
  };

  const saveCompany = async (values: CompanyFormValues) => {
    try {
      await companyActions.updateCurrentCompany(values);
      message.success("Şirkət məlumatı yeniləndi.");
      await loadCompanyInfo();
    } catch (error) {
      console.error("Şirkət məlumatı yenilənmədi:", error);
      message.error("Şirkət məlumatı yenilənmədi. Backend xətasını yoxlayın.");
    }
  };

const uploadCompanyLogo = async (file: File) => {
  let inlineLogo = '';
  const companyKey = activeCompanyId || company.id;

  try {
    inlineLogo = await fileToImageDataUrl(file);
    if (inlineLogo) setCompany((previous) => ({ ...previous, logo: inlineLogo }));

    const result = await companyActions.uploadCompanyLogo(file);
    const backendLogo = mapCompanyLogoResponse(result);

    if (!backendLogo) {
      throw new Error('Backend logoUrl qaytarmadı.');
    }
    saveCompanyLogoToStorage(backendLogo, companyKey, company.voen);
    setCompany((previous) => ({ ...previous, logo: backendLogo }));

    await loadCompanyInfo();
    saveCompanyLogoToStorage(backendLogo, companyKey, company.voen);
    setCompany((previous) => ({ ...previous, logo: backendLogo }));

    message.success('Loqo backend-ə yükləndi və backend logoUrl ilə saxlanıldı.');
  } catch {
    if (inlineLogo) {
      setCompany((previous) => ({ ...previous, logo: inlineLogo }));
    }
    message.error('Loqo backend-ə yüklənmədi və ya logoUrl qaytarılmadı.');
  }
};

  const activeUsersList = usersList.filter((user) => user.isActive !== false);

  const fallbackAnalyticsRanking: AnalyticsRankingRow[] = activeUsersList.map((user) => ({
    key: user.id || user.email,
    employee: `${user.firstName} ${user.lastName}`.trim() || user.email,
    employeeName: `${user.firstName} ${user.lastName}`.trim() || user.email,
    userName: `${user.firstName} ${user.lastName}`.trim() || user.email,
    user: user.email,
    scans: 0,
    scanCount: 0,
  }));

  const fallbackChart = activeUsersList.length > 0
    ? [{ date: new Date().toISOString().slice(0, 10), count: 0, scanCount: 0 }]
    : [];

  const fallbackScanLogs: AnalyticsScanLogRow[] = activeUsersList.map((user) => ({
    key: `scan-${user.id || user.email}`,
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    userName: `${user.firstName} ${user.lastName}`.trim() || user.email,
    user: user.email,
    details: "Vizitkart yaradıldı / skan məlumatı gözlənilir",
    cardId: user.id,
  }));

  const fallbackAuditLogs: AuditLogRow[] = activeUsersList.map((user) => ({
    key: `employee-${user.id || user.email}`,
    date: new Date().toISOString(),
    userName: user.email,
    actionType: "Employee Added",
    details: `${user.firstName} ${user.lastName}`.trim() || user.email,
  }));

  const visibleAnalyticsChart = analyticsChart.length > 0 ? analyticsChart : fallbackChart;
  const visibleAnalyticsRanking = analyticsRanking.length > 0 ? analyticsRanking : fallbackAnalyticsRanking;
  const visibleScanLogs = scanLogs.length > 0 ? scanLogs : fallbackScanLogs;
  const visibleAuditLogs = auditLogs.length > 0 ? auditLogs : fallbackAuditLogs;


  return (
    <CompanyAdminContext.Provider
      value={{
        company,
        usersList,
        recentActivities,
        analyticsCount,
        analyticsChart: visibleAnalyticsChart,
        analyticsRanking: visibleAnalyticsRanking,
        scanLogs: visibleScanLogs,
        auditLogs: visibleAuditLogs,
        activeCompanyId,
        currentEmployeesCount,
        usagePercent,
        isLimitReached,
        loadCompanyInfo,
        fetchUsers,
        fetchAnalytics,
        fetchAuditLogs,
        addUser,
        updateUser,
        toggleUserStatus,
        toggleUserCanEdit,
        resetUserPassword,
        saveCompany,
        uploadCompanyLogo,
      }}
    >
      {children}
    </CompanyAdminContext.Provider>
  );
}
