import { useEffect, useMemo, useState } from "react";
import { Button, Form, Input, message, Modal } from "antd";
import { Navigate, Route, Routes } from "react-router";
import AppLayout from "../../components/Layout";
import { CompanyAdminProvider } from "./company-admin-provider";
import BusinessCard from "./company-pages/business-card";
import CompanyAnalytics from "./company-pages/company-analytics";
import CompanyInfo from "./company-pages/company-info";
import CompanyQrCodes from "./company-pages/company-qr-codes";
import CompanyScanLogs from "./company-pages/company-scan-logs";
import { authOperations } from "../../helpers/auth.helper";
import { authSessionStorage } from "../../storage/auth-session.storage";
import { userActions } from "../../helpers/user.helper";
import { useCompanyAdmin } from "../../hooks/use-company-admin";
import { authActions, useAuthSelector } from "../../store/authStore";
import { getStoredUser } from "../../storage/auth.storage";
import { getNormalizedImageAsset } from "../../utils/asset-url.utils";
import { getEmployeePhotoFromRecord } from "../../features/public-card/public-card-shared";
import { getSavedCompanyCardBackground, getSavedCompanyCardBackgroundAsync, saveCompanyCardBackground } from "../../features/company/company-card-theme";
import { fileToImageDataUrl, imageAssetToDataUrl } from "../../utils/image-data-url.utils";
import { companyAdminAvatarImageKey, companyAdminBackgroundImageKey, writePersistentImage } from "../../storage/persistent-image-cache";
import {clearRuntimeCompanyAdminProfile,mergeRuntimeCompanyAdminProfile,readRuntimeCompanyAdminAvatar,readRuntimeCompanyAdminProfile,setRuntimeCompanyAdminAvatar,} from "../../features/company-admin/runtime-profile";
import type { ChangePasswordRequest } from "../../types/auth.type";
import type { CompanyAdminProps } from "../../types/company-admin.type";
import type { EditableProfileValues } from "../../types/layout.type";

const findStringInObject = (source: unknown, keys: string[]) => {
  if (!source || typeof source !== "object") return "";

  const wanted = keys.map((key) => key.toLowerCase());
  const queue: unknown[] = [source];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || typeof current !== "object" || seen.has(current)) continue;

    seen.add(current);

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase().replace(/[\s_.-]/g, "");
      const isWanted = wanted.some(
        (wantedKey) => normalizedKey === wantedKey.toLowerCase().replace(/[\s_.-]/g, ""),
      );

      if (isWanted && (typeof value === "string" || typeof value === "number")) {
        return String(value).trim();
      }

      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return "";
};

const findArrayInObject = (source: unknown, keys: string[]) => {
  if (!source || typeof source !== "object") return [] as Record<string, unknown>[];

  const wanted = keys.map((key) => key.toLowerCase().replace(/[\s_.-]/g, ""));
  const queue: unknown[] = [source];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase().replace(/[\s_.-]/g, "");
      if (wanted.includes(normalizedKey) && Array.isArray(value)) {
        return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)));
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }

  return [] as Record<string, unknown>[];
};


const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cleanProfileText = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (["string", "null", "undefined", "-"].includes(text.toLowerCase())) return "";
  return text;
};

const mapEditableProfileValues = (source: unknown): EditableProfileValues => ({
  firstName: cleanProfileText(findStringInObject(source, ["firstName", "givenName", "ad"])),
  lastName: cleanProfileText(findStringInObject(source, ["lastName", "surname", "soyad"])),
  middleName: cleanProfileText(findStringInObject(source, ["middleName", "fatherName", "ataAdi"])),
  jobTitle: cleanProfileText(findStringInObject(source, ["jobTitle", "position", "title"])),
  phone1: cleanProfileText(findStringInObject(source, ["phone1", "phone", "phoneNumber"])),
  phone2: cleanProfileText(findStringInObject(source, ["phone2", "secondaryPhone"])),
  whatsappPhone: cleanProfileText(findStringInObject(source, ["whatsappPhone", "whatsapp"])),
  extensionNumber: cleanProfileText(findStringInObject(source, ["extensionNumber", "internalNumber"])),
  additionalInfo: cleanProfileText(findStringInObject(source, ["additionalInfo", "description", "details"])),
  photoUrl: source && typeof source === "object"
    ? getEmployeePhotoFromRecord(source as Record<string, unknown>)
    : "",
  googleMapsUrl: cleanProfileText(findStringInObject(source, ["googleMapsUrl", "mapsUrl", "mapUrl"])),
  linkedinUrl: cleanProfileText(findStringInObject(source, ["linkedinUrl", "linkedInUrl", "linkedin"])),
  facebookUrl: cleanProfileText(findStringInObject(source, ["facebookUrl", "facebook"])),
  instagramUrl: cleanProfileText(findStringInObject(source, ["instagramUrl", "instagram"])),
  cardBackgroundUrl: getNormalizedImageAsset(
    findStringInObject(source, ["cardBackgroundUrl", "cardBackground", "backgroundUrl", "backgroundImageUrl"]),
  ),
  socialAccounts: findArrayInObject(source, ["socialAccounts", "socials", "socialLinks"]).map((item) => ({
    platformName: cleanProfileText(item.platformName || item.platform || item.name || item.type),
    profileUrl: cleanProfileText(item.profileUrl || item.url || item.link || item.value),
    iconUrl: getNormalizedImageAsset(item.iconUrl || item.icon || item.imageUrl),
  })).filter((item) => item.platformName || item.profileUrl),
});


const compactProfilePatch = (values: EditableProfileValues): Partial<EditableProfileValues> => {
  const patch: Partial<EditableProfileValues> = {};

  (Object.keys(values) as Array<keyof EditableProfileValues>).forEach((key) => {
    const value = values[key];
    if (Array.isArray(value)) {
      if (value.length > 0) patch.socialAccounts = value.map((item) => ({ ...item }));
      return;
    }

    if (typeof value === "string" && value.trim()) {
      (patch as Record<string, unknown>)[key] = value.trim();
    }
  });

  return patch;
};

function CompanyAdminPages() {
  return (
    <Routes>
      <Route index element={<Navigate to="company" replace />} />
      <Route path="company" element={<CompanyInfo />} />
      <Route path="business-card" element={<BusinessCard />} />
      <Route path="qr-codes" element={<CompanyQrCodes />} />
      <Route path="analytics" element={<CompanyAnalytics />} />
      <Route path="scan-logs" element={<CompanyScanLogs />} />
      <Route path="*" element={<Navigate to="company" replace />} />
    </Routes>
  );
}

function CompanyAdminShell({ onLogout }: CompanyAdminProps) {
  const { company } = useCompanyAdmin();
  const [passwordForm] = Form.useForm<ChangePasswordRequest>();

  const accountInfo = useAuthSelector((state) => state.accountInfo);
  const companyVoen = useAuthSelector((state) => state.companyVoen);
  const userId = useAuthSelector((state) => state.userId);
  const role = useAuthSelector((state) => state.role);
  const storedUser = getStoredUser();

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordChangeCompleted, setPasswordChangeCompleted] = useState(false);
  const [profileOverride, setProfileOverride] = useState<Partial<EditableProfileValues>>(() => readRuntimeCompanyAdminProfile());
  const [avatarOverride, setAvatarOverride] = useState(() => readRuntimeCompanyAdminAvatar());

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      const stored = getStoredUser();
      const requestedId = cleanProfileText(
        userId || stored?.userId || stored?.id || localStorage.getItem("id"),
      );

      const [accountResult, profileResult] = await Promise.allSettled([
        authOperations.getAccountInfo(),
        UUID_PATTERN.test(requestedId)
          ? userActions.getOwnProfileById(requestedId)
          : Promise.resolve(null),
      ]);

      if (cancelled) return;

      const accountData = accountResult.status === "fulfilled" && accountResult.value && typeof accountResult.value === "object"
        ? accountResult.value as Record<string, unknown>
        : {};
      const profileData = profileResult.status === "fulfilled" && profileResult.value && typeof profileResult.value === "object"
        ? profileResult.value as Record<string, unknown>
        : {};
      const accountProfile = mapEditableProfileValues(accountData);
      const serverProfile = mapEditableProfileValues(profileData);
      const runtimeProfile = readRuntimeCompanyAdminProfile();
      const mergedProfile: Partial<EditableProfileValues> = {
        ...runtimeProfile,
        ...compactProfilePatch(accountProfile),
        ...compactProfilePatch(serverProfile),
        socialAccounts:
          (serverProfile.socialAccounts && serverProfile.socialAccounts.length > 0 ? serverProfile.socialAccounts : undefined) ??
          (accountProfile.socialAccounts && accountProfile.socialAccounts.length > 0 ? accountProfile.socialAccounts : undefined) ??
          runtimeProfile.socialAccounts,
      };
      const loadedAvatar = getNormalizedImageAsset(
        getEmployeePhotoFromRecord(profileData),
        getEmployeePhotoFromRecord(accountData),
        serverProfile.photoUrl,
        accountProfile.photoUrl,
        runtimeProfile.photoUrl,
        readRuntimeCompanyAdminAvatar(),
      );
      const profileEmail = cleanProfileText(
        findStringInObject(profileData, ["email", "gmail"]) ||
        findStringInObject(accountData, ["email", "gmail"]) ||
        stored?.email,
      );
      const avatarCacheKey = companyAdminAvatarImageKey(requestedId, profileEmail);
      const stableAvatar = await imageAssetToDataUrl(loadedAvatar, avatarCacheKey) || loadedAvatar;

      if (stableAvatar) {
        setAvatarOverride(stableAvatar);
        setRuntimeCompanyAdminAvatar(stableAvatar);
        mergedProfile.photoUrl = stableAvatar;
      }

      const effectiveCompanyId = company.id || stored?.companyId;
      const effectiveCompanyVoen = companyVoen || company.voen || stored?.companyVoen;
      const savedBackground = await getSavedCompanyCardBackgroundAsync(effectiveCompanyId, effectiveCompanyVoen);
      const backgroundCacheKey = companyAdminBackgroundImageKey(requestedId, profileEmail);
      const backendBackground = getNormalizedImageAsset(
        serverProfile.cardBackgroundUrl,
        accountProfile.cardBackgroundUrl,
      );
      const preferredBackground = backendBackground || runtimeProfile.cardBackgroundUrl || savedBackground;
      const stableBackground = await imageAssetToDataUrl(
        preferredBackground,
        backgroundCacheKey,
      ) || preferredBackground;

      if (stableBackground) {
        mergedProfile.cardBackgroundUrl = stableBackground;
        saveCompanyCardBackground(stableBackground, effectiveCompanyId, effectiveCompanyVoen);
      }

      setProfileOverride((current) => ({
        ...current,
        ...mergedProfile,
        socialAccounts: mergedProfile.socialAccounts ?? current.socialAccounts,
      }));

      authActions.setAccountInfo({
        ...accountData,
        ...profileData,
        ...mergedProfile,
      });
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [company.id, company.voen, companyVoen, userId]);

  const adminEmail = useMemo(() => {
    return (
      storedUser?.email ||
      findStringInObject(accountInfo, ["email", "gmail", "adminEmail"]) ||
      userId ||
      ""
    );
  }, [accountInfo, storedUser?.email, userId]);

  const activeVoen = useMemo(() => {
    return (
      companyVoen ||
      company.voen ||
      storedUser?.companyVoen ||
      findStringInObject(accountInfo, ["companyVoen", "voen", "taxId", "taxNumber"]) ||
      ""
    );
  }, [accountInfo, company.voen, companyVoen, storedUser?.companyVoen]);

  const backendProfileValues = useMemo<EditableProfileValues>(
    () => mapEditableProfileValues(accountInfo),
    [accountInfo],
  );

  const profileInitialValues = useMemo<EditableProfileValues>(() => {
    const savedBackground = getSavedCompanyCardBackground(company.id, activeVoen);

    return {
      ...backendProfileValues,
      ...profileOverride,
      cardBackgroundUrl: backendProfileValues.cardBackgroundUrl || profileOverride.cardBackgroundUrl || savedBackground,
      socialAccounts: profileOverride.socialAccounts ?? backendProfileValues.socialAccounts,
    };
  }, [activeVoen, backendProfileValues, company.id, profileOverride]);

  const adminFullName = useMemo(() => {
    const composed = [profileInitialValues.firstName, profileInitialValues.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    return (
      composed ||
      storedUser?.fullName ||
      [storedUser?.firstName, storedUser?.lastName].filter(Boolean).join(" ") ||
      findStringInObject(accountInfo, ["fullName", "adminName", "userName"]) ||
      "CompanyAdmin"
    );
  }, [accountInfo, profileInitialValues.firstName, profileInitialValues.lastName, storedUser?.firstName, storedUser?.fullName, storedUser?.lastName]);

  const adminAvatarSrc = useMemo(() => getNormalizedImageAsset(
    avatarOverride,
    profileInitialValues.photoUrl,
    accountInfo && typeof accountInfo === "object"
      ? getEmployeePhotoFromRecord(accountInfo as Record<string, unknown>)
      : "",
  ), [accountInfo, avatarOverride, profileInitialValues.photoUrl]);

  const profileDetails = useMemo(() => ([
    { label: "Ad Soyad", value: adminFullName },
    { label: "E-poçt", value: adminEmail },
    { label: "Vəzifə", value: profileInitialValues.jobTitle || "-" },
    { label: "Telefon", value: profileInitialValues.phone1 || "-" },
    { label: "WhatsApp", value: profileInitialValues.whatsappPhone || "-" },
    { label: "Rol", value: "CompanyAdmin" },
    { label: "Şirkət", value: company.name || "-" },
    { label: "VÖEN", value: activeVoen || "-" },
  ]), [activeVoen, adminEmail, adminFullName, company.name, profileInitialValues.jobTitle, profileInitialValues.phone1, profileInitialValues.whatsappPhone]);

  const handleSaveAdminProfile = async (values: EditableProfileValues) => {
    const mergedValues: EditableProfileValues = {
      ...profileInitialValues,
      ...values,
      firstName: String(values.firstName || profileInitialValues.firstName || "").trim(),
      lastName: String(values.lastName || profileInitialValues.lastName || "").trim(),
      phone1: String(
        values.phone1 ||
        profileInitialValues.phone1 ||
        company.phone ||
        findStringInObject(accountInfo, ["phone1", "phone", "phoneNumber"]) ||
        "",
      ).trim(),
      socialAccounts: values.socialAccounts ?? profileInitialValues.socialAccounts ?? [],
    };

    if (!mergedValues.phone1) {
      throw new Error("Telefon 1 mütləqdir. Telefon nömrəsini daxil edib yenidən saxlayın.");
    }

    const response = await userActions.updateOwnProfile(mergedValues);
    const responseRecord = response && typeof response === "object"
      ? response as Record<string, unknown>
      : {};
    const currentRecord = accountInfo && typeof accountInfo === "object"
      ? accountInfo as Record<string, unknown>
      : {};

    const runtimeProfile = mergeRuntimeCompanyAdminProfile(mergedValues);
    setProfileOverride(runtimeProfile);

    if (runtimeProfile.cardBackgroundUrl) {
      saveCompanyCardBackground(runtimeProfile.cardBackgroundUrl, company.id, activeVoen);
    }

    authActions.setAccountInfo({
      ...currentRecord,
      ...responseRecord,
      ...runtimeProfile,
    });

    const requestedId = cleanProfileText(
      userId || storedUser?.userId || storedUser?.id || localStorage.getItem("id"),
    );

    const [accountResult, profileResult] = await Promise.allSettled([
      authOperations.getAccountInfo(),
      UUID_PATTERN.test(requestedId)
        ? userActions.getOwnProfileById(requestedId)
        : Promise.resolve(null),
    ]);

    const refreshedAccount = accountResult.status === "fulfilled" && accountResult.value && typeof accountResult.value === "object"
      ? accountResult.value as Record<string, unknown>
      : {};
    const refreshedProfile = profileResult.status === "fulfilled" && profileResult.value && typeof profileResult.value === "object"
      ? profileResult.value as Record<string, unknown>
      : {};
    authActions.setAccountInfo({
      ...currentRecord,
      ...refreshedAccount,
      ...refreshedProfile,
      ...responseRecord,
      ...runtimeProfile,
    });
  };

  const handleUploadAdminPhoto = async (file: File) => {
    const inlinePhoto = await fileToImageDataUrl(file);
    const currentRecord = accountInfo && typeof accountInfo === "object"
      ? accountInfo as Record<string, unknown>
      : {};

    setAvatarOverride(inlinePhoto);
    setRuntimeCompanyAdminAvatar(inlinePhoto);
    void writePersistentImage(
      companyAdminAvatarImageKey(userId || storedUser?.userId || storedUser?.id, adminEmail),
      inlinePhoto,
    );
    const immediateProfile = mergeRuntimeCompanyAdminProfile({ photoUrl: inlinePhoto });
    setProfileOverride((current) => ({ ...current, ...immediateProfile, photoUrl: inlinePhoto }));
    authActions.setAccountInfo({
      ...currentRecord,
      photo: inlinePhoto,
      photoUrl: inlinePhoto,
      avatarUrl: inlinePhoto,
    });

    try {
      const response = await userActions.uploadProfilePhoto(file);
      const responseRecord = response && typeof response === "object"
        ? response as Record<string, unknown>
        : {};

      const phone1 = String(
        profileInitialValues.phone1 ||
        company.phone ||
        findStringInObject(accountInfo, ["phone1", "phone", "phoneNumber"]) ||
        "",
      ).trim();

      if (phone1) {
        try {
          await userActions.updateOwnProfile({
            ...profileInitialValues,
            phone1,
            photoUrl: getEmployeePhotoFromRecord(responseRecord) || inlinePhoto,
          });
        } catch {
          // Multipart upload uğurludursa profil PUT xətası lokal Base64 şəkli silmir.
        }
      }

      const backendPhoto = getNormalizedImageAsset(
        getEmployeePhotoFromRecord(responseRecord),
      );
      const resolvedPhoto = backendPhoto || inlinePhoto;

      setAvatarOverride(resolvedPhoto);
      setRuntimeCompanyAdminAvatar(resolvedPhoto);
      const uploadedProfile = mergeRuntimeCompanyAdminProfile({ photoUrl: resolvedPhoto });
      setProfileOverride((current) => ({ ...current, ...uploadedProfile, photoUrl: resolvedPhoto }));
      authActions.setAccountInfo({
        ...currentRecord,
        ...responseRecord,
        photo: resolvedPhoto,
        photoUrl: resolvedPhoto,
        avatarUrl: resolvedPhoto,
      });

      message.success("Profil şəkli backend-ə yükləndi və backend photoUrl ilə saxlanıldı.");
    } catch {
      message.warning("Profil şəkli üçün lokal preview saxlanıldı, amma backend upload cavabını yoxlayın.");
    }
  };

  const handleUploadAdminCardBackground = async (file: File) => {
    const inlineBackground = await fileToImageDataUrl(file);

    // Endpoint cavabı gələnə qədər yalnız preview göstərilir.
    setProfileOverride((current) => ({ ...current, cardBackgroundUrl: inlineBackground }));

    try {
      const response = await userActions.uploadCardBackground(file);
      const responseRecord = response && typeof response === 'object'
        ? response as Record<string, unknown>
        : {};
      const backendBackground = getNormalizedImageAsset(
        findStringInObject(responseRecord, [
          'cardBackgroundUrl',
          'cardBackgroundURL',
          'cardBackground',
          'backgroundUrl',
          'backgroundImageUrl',
        ]),
      );

      if (!backendBackground) {
        throw new Error('Backend cardBackgroundUrl qaytarmadı.');
      }

      const nextProfile = mergeRuntimeCompanyAdminProfile({ cardBackgroundUrl: backendBackground });
      saveCompanyCardBackground(backendBackground, company.id, activeVoen);
      setProfileOverride((current) => ({ ...current, ...nextProfile, cardBackgroundUrl: backendBackground }));
      authActions.setAccountInfo({
        ...(accountInfo && typeof accountInfo === 'object' ? accountInfo as Record<string, unknown> : {}),
        cardBackground: backendBackground,
        cardBackgroundUrl: backendBackground,
      });

      message.success('Kart fonu backend-ə yükləndi və backend cardBackgroundUrl ilə saxlanıldı.');
      return backendBackground;
    } catch (error) {
      // Backend uğursuz olduqda köhnə backend fonunu saxlayırıq; Base64-i əsas mənbə etmirik.
      setProfileOverride((current) => ({
        ...current,
        cardBackgroundUrl: backendProfileValues.cardBackgroundUrl || current.cardBackgroundUrl,
      }));
      message.error('Kart fonu backend-ə yüklənmədi və ya cardBackgroundUrl qaytarılmadı.');
      throw error;
    }
  };

  const handleUploadAdminSocialIcon = async (file: File) => {
    const response = await userActions.uploadSocialIcon(file);
    const iconUrl = getNormalizedImageAsset(
      findStringInObject(response, ["iconUrl", "socialIconUrl", "imageUrl", "url", "path"]),
    );

    if (!iconUrl) {
      throw new Error("Link ikonu URL-i server cavabında tapılmadı.");
    }

    return iconUrl;
  };

  const shouldOpenPasswordModal = useMemo(() => {
    if (role !== "company-admin") return false;
    if (passwordChangeCompleted) return false;

    const account = accountInfo && typeof accountInfo === "object"
      ? (accountInfo as Record<string, unknown>)
      : {};

    const mustChangeFromUser = Boolean(
      storedUser?.mustChangePassword === true ||
        storedUser?.firstLogin === true ||
        storedUser?.isFirstLogin === true ||
        storedUser?.forcePasswordChange === true
    );

    const mustChangeFromAccount = [
      "mustChangePassword",
      "firstLogin",
      "isFirstLogin",
      "forcePasswordChange",
    ].some((key) => account[key] === true || account[key] === "true");

    return mustChangeFromUser || mustChangeFromAccount;
  }, [accountInfo, passwordChangeCompleted, role, storedUser?.firstLogin, storedUser?.forcePasswordChange, storedUser?.isFirstLogin, storedUser?.mustChangePassword]);

  const handlePasswordChange = async (values: ChangePasswordRequest) => {
    try {
      setPasswordLoading(true);

      await authOperations.changePassword({
        ...values,
        email: adminEmail,
        companyVoen: activeVoen,
      });

      const nextAccountInfo = accountInfo && typeof accountInfo === "object"
        ? {
            ...accountInfo,
            mustChangePassword: false,
            firstLogin: false,
            isFirstLogin: false,
            forcePasswordChange: false,
          }
        : accountInfo;

      authActions.setAccountInfo(nextAccountInfo);
      passwordForm.resetFields();
      setPasswordChangeCompleted(true);
      message.success("Sifre teyin edildi. Yeni sifre ile daxil olun.");

      clearRuntimeCompanyAdminProfile();
      authSessionStorage.clear();

      if (onLogout) {
        onLogout();
      }

      window.location.replace("/login");
      return;
      message.success("Şifrə uğurla yeniləndi.");
    } catch {
      message.error("Şifrə dəyişdirilmədi. Köhnə kod/şifrəni və yeni şifrəni yoxlayın.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = () => {
    Modal.confirm({
      title: "Çıxış etmək istəyirsiniz?",
      content: "Sistemdən çıxış edəcəksiniz.",
      okText: "Bəli",
      cancelText: "Xeyr",
      okButtonProps: { danger: true },
      onOk: () => {
        clearRuntimeCompanyAdminProfile();
        authSessionStorage.clear();

        if (onLogout) {
          onLogout();
        } else {
          window.location.href = "/login";
        }
      },
    });
  };

  return (
    <>
      <AppLayout
        role="company-admin"
        onLogout={handleLogout}
        titleSuffix={company.name}
        userName="CompanyAdmin"
        avatarText="C"
        avatarSrc={adminAvatarSrc}
        notificationCount={3}
        profileDetails={profileDetails}
        profileInitialValues={profileInitialValues}
        onSaveProfile={handleSaveAdminProfile}
        onUploadProfilePhoto={handleUploadAdminPhoto}
        onUploadCardBackground={handleUploadAdminCardBackground}
        onUploadSocialIcon={handleUploadAdminSocialIcon}
        companyLogo={getNormalizedImageAsset(company.logo)}
        companyInfoPath="/company-admin/company"
      >
        <CompanyAdminPages />
      </AppLayout>

      <Modal
        title="İlk giriş üçün şifrəni dəyişin"
        open={shouldOpenPasswordModal}
        footer={null}
        closable={false}
        mask={{ closable: false }}
        keyboard={false}
        width={480}
      >
        <p style={{ color: "#64748b", marginTop: 0 }}>
          Super Admin tərəfindən verilən kod müvəqqətidir. Paneldən istifadə etmək üçün yeni şifrə təyin edin.
        </p>

        <Form<ChangePasswordRequest>
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordChange}
        >
          <Form.Item
            name="currentPassword"
            label="Köhnə kod / şifrə"
            rules={[{ required: true, message: "Köhnə kodu daxil edin" }]}
          >
            <Input.Password placeholder="Super Admin-in verdiyi kod" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="Yeni şifrə"
            rules={[
              { required: true, message: "Yeni şifrə daxil edin" },
              { min: 6, message: "Yeni şifrə ən azı 6 simvol olmalıdır" },
            ]}
          >
            <Input.Password placeholder="Yeni şifrə" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Yeni şifrəni təkrar yazın"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Yeni şifrəni təkrar yazın" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }

                  return Promise.reject(new Error("Şifrələr eyni deyil"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Yeni şifrə təkrar" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={passwordLoading} block>
            Şifrəni dəyiş
          </Button>
        </Form>
      </Modal>
    </>
  );
}

export default function CompanyAdmin({ onLogout }: CompanyAdminProps) {
  return (
    <CompanyAdminProvider>
      <CompanyAdminShell onLogout={onLogout} />
    </CompanyAdminProvider>
  );
}
