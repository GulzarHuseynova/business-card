import { companyService } from '../services/company.service';
import { getStoredUser, isLocalCompanyAdminToken } from '../storage/auth.storage';
import { asString, findStringDeep, isRecord, normalizeArray } from '../utils/api.utils';
import {addLocalAuditLog,employeeToRecord,getLocalEmployeesForCompany,readLocalAuditLogs,saveLocalEmployeeOverride,updateLocalEmployeeById,updateLocalEmployeePassword,} from '../storage/local-auth/employee-local-auth';
import { normalizeAssetUrl, normalizeInlineImageData } from '../utils/asset-url.utils';
import { imageAssetToDataUrl } from '../utils/image-data-url.utils';
import { employeeBackgroundImageKey, employeePhotoImageKey, writePersistentImage } from '../storage/persistent-image-cache';
import { normalizeAuditLog, stringifyAuditValue } from '../features/company/audit';
import {getSavedCompanyId,getSavedCompanyName,getSavedCompanyVoen,mapCompanyLogoResponse,resolveCompanyId,saveCompanyIdFromUnknown,saveCompanyLogoToStorage,} from '../storage/company.storage';
import { markEmployeePasswordChangeRequired } from '../features/auth/auth-login.helpers';
import { normalizeUser, normalizeUserWithLocalOverride } from '../mappers/company.mapper';
import { filterCompanyUsers, mergeNormalizedUsers, uniq } from '../features/company/company-user-identity';
import {patchCompanyUsersCache,readCompanyUsersCache,saveCompanyUsersCache,toLocalUsers,} from '../features/company/company-users-cache';
import {buildBaseUserPayload,buildUpdateUserPayload,getUploadedPhotoUrl, postUserWithOptionalPhoto,putUserWithOptionalPhoto,} from '../features/company/company-user-payloads';
import { buildCurrentCompanyUpdatePayload,buildLocalCompanyFallback,createLocalEmployee, getCreatedEmployeeId, getEmployeeBeforeState,persistCompanyInfo, updateEmployeeLocalState,} from '../features/company/company-user-local';
import type { AddUserPayload, CompanyInfo, NormalizedUser, UpdateUserPayload } from '../types/company.type';

export { findStringDeep, normalizeArray };
export { mapCompanyInfo, normalizeUser, normalizeUserWithLocalOverride } from '../mappers/company.mapper';
export {getSavedCompanyId,mapCompanyLogoResponse,resolveCompanyId,saveCompanyIdFromUnknown,} from '../storage/company.storage';
export { mergeNormalizedUsers } from '../features/company/company-user-identity';
export type { AddUserPayload, CompanyInfo, NormalizedCompanyInfo, NormalizedUser, UpdateUserPayload } from '../types/company.type';


const hydrateUsersWithPersistentPhotoData = async (
  users: NormalizedUser[],
  companyId: string,
  companyVoen: string,
) => {
  const hydrated = [...users];
  const pending = users
    .map((user, index) => ({ user, index }))
    .filter(({ user }) => (
      !normalizeInlineImageData(user.photoData || user.photo || user.photoUrl)
    ));

  const concurrency = 4;

  for (let offset = 0; offset < pending.length; offset += concurrency) {
    const batch = pending.slice(offset, offset + concurrency);
    const results = await Promise.all(batch.map(async ({ user, index }) => {
      const [photoData, cardBackgroundUrl] = await Promise.all([
        imageAssetToDataUrl(
          user.photoUrl || user.photo,
          employeePhotoImageKey(companyId, user.id, user.email),
        ),
        imageAssetToDataUrl(
          user.cardBackgroundUrl,
          employeeBackgroundImageKey(companyId, user.id, user.email),
        ),
      ]);

      return { index, user, photoData, cardBackgroundUrl };
    }));

    results.forEach(({ index, user, photoData, cardBackgroundUrl }) => {
      if (!photoData && !cardBackgroundUrl) return;

      const patch: Partial<NormalizedUser> = {
        id: user.id,
        email: user.email,
        companyId: user.companyId || companyId,
        companyVoen: user.companyVoen || companyVoen,
        ...(photoData ? { photo: photoData, photoUrl: photoData, photoData } : {}),
        ...(cardBackgroundUrl ? { cardBackgroundUrl } : {}),
      };

      hydrated[index] = { ...user, ...patch };
      saveLocalEmployeeOverride(patch);
      patchCompanyUsersCache(patch);
    });
  }

  return hydrated;
};

export const companyActions = {
  getCurrentCompany: async () => {
    const localCompany = buildLocalCompanyFallback();

    if (isLocalCompanyAdminToken() && localCompany) {
      return localCompany;
    }

    try {
      const response = await companyService.getCurrentCompany();
      saveCompanyIdFromUnknown(response.data);
      persistCompanyInfo(response.data as Partial<CompanyInfo>);
      return response.data as CompanyInfo;
    } catch (error) {
      if (localCompany) return localCompany;
      throw error;
    }
  },

  updateCurrentCompany: async (payload: Partial<CompanyInfo>) => {
    const localBefore = buildLocalCompanyFallback();
    const body = buildCurrentCompanyUpdatePayload(payload);

    if (isLocalCompanyAdminToken()) {
      return persistCompanyInfo({ ...localBefore, ...payload });
    }

    const response = await companyService.updateCurrentCompany(body);
    const data = (response.data || body) as Partial<CompanyInfo>;
    return persistCompanyInfo({ ...localBefore, ...payload, ...data });
  },

  uploadCompanyLogo: async (file: File) => {
    if (isLocalCompanyAdminToken()) {
      return { fileName: file.name, skippedBackendUpload: true };
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await companyService.uploadCompanyLogo(formData);
    const uploadedLogo = mapCompanyLogoResponse(response.data);
    if (uploadedLogo) saveCompanyLogoToStorage(uploadedLogo, getSavedCompanyId(), getSavedCompanyVoen());
    return response.data;
  },

  getUsersByCompany: async (companyId?: string, page = 1, pageSize = 1000) => {
    const fallbackId = await resolveCompanyId({ companyId });
    const companyVoen = getSavedCompanyVoen();
    const effectiveCompanyId = fallbackId || companyId || getSavedCompanyId() || '';
    const localUsers = filterCompanyUsers(
      getLocalEmployeesForCompany(effectiveCompanyId, companyVoen)
        .map(employeeToRecord)
        .map(normalizeUser)
    );

    const cachedUsers = readCompanyUsersCache(effectiveCompanyId, companyVoen);
    const fallbackUsers = filterCompanyUsers(mergeNormalizedUsers(cachedUsers, localUsers));

    if (isLocalCompanyAdminToken()) return fallbackUsers;

    const candidates = uniq([companyId || '', fallbackId, effectiveCompanyId]);
    if (candidates.length === 0) return fallbackUsers;

    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const response = await companyService.getUsersByCompany(candidate, page, pageSize);
        const apiUsers = filterCompanyUsers(
          normalizeArray(response.data).map((row) =>
            normalizeUserWithLocalOverride(row, candidate || effectiveCompanyId, companyVoen)
          )
        );
        const mergedUsers = filterCompanyUsers(mergeNormalizedUsers(apiUsers, fallbackUsers));
        const hydratedUsers = await hydrateUsersWithPersistentPhotoData(
          mergedUsers,
          effectiveCompanyId || candidate,
          companyVoen,
        );

        saveCompanyUsersCache(effectiveCompanyId || candidate, companyVoen, hydratedUsers);
        return hydratedUsers;
      } catch (error) {
        lastError = error;
      }
    }

    if (fallbackUsers.length > 0) return fallbackUsers;

    throw lastError;
  },

  addUser: async (payload: AddUserPayload) => {
    const fullName = `${payload.firstName} ${payload.lastName}`.trim();
    const companyId = payload.companyId || getSavedCompanyId();
    const companyVoen = payload.companyVoen || getSavedCompanyVoen();
    const companyName = payload.companyName || getSavedCompanyName();
    const localId = asString(payload.email) || crypto.randomUUID();
    const basePayload = buildBaseUserPayload(payload, companyId);
    const localFallbackUser = { ...basePayload, id: localId };

    const saveLocal = (createdUser: unknown, backendPhotoUrl = '') => {
      const selectedPhotoData = normalizeInlineImageData(payload.photoData || payload.photoUrl || payload.photo);
      if (selectedPhotoData) {
        void writePersistentImage(employeePhotoImageKey(companyId, localId, payload.email), selectedPhotoData);
      }
      const selectedBackgroundData = normalizeInlineImageData(payload.cardBackgroundUrl);
      if (selectedBackgroundData) {
        void writePersistentImage(employeeBackgroundImageKey(companyId, localId, payload.email), selectedBackgroundData);
      }
      const selectedPhoto = normalizeAssetUrl(payload.photoUrl || payload.photo);
      const remotePhoto = normalizeAssetUrl(backendPhotoUrl) || (!selectedPhotoData ? selectedPhoto : '');
      const displayPhoto = selectedPhotoData || remotePhoto || selectedPhoto;
      const createdPayload = {
        ...payload,
        photo: displayPhoto,
        photoUrl: remotePhoto || displayPhoto,
        photoData: selectedPhotoData,
      };
      const createdId = getCreatedEmployeeId(createdUser, localId, companyId);
      markEmployeePasswordChangeRequired(payload.email, companyVoen, createdId);
      const created = normalizeUser({
        ...(createdUser && typeof createdUser === 'object' ? createdUser : {}),
        ...createdPayload,
        id: createdId,
        email: payload.email,
        gmail: payload.email,
        companyId,
        companyVoen,
      });

      createLocalEmployee(createdPayload, companyId, companyVoen, companyName, created.id || createdId);
      saveLocalEmployeeOverride({
        id: created.id || createdId,
        email: payload.email,
        companyId,
        companyVoen,
        firstName: payload.firstName,
        lastName: payload.lastName,
        middleName: payload.middleName,
        jobTitle: payload.jobTitle,
        phone1: payload.phone1,
        phone2: payload.phone2,
        whatsapp: payload.whatsapp,
        extensionNumber: payload.extensionNumber,
        linkedin: payload.linkedin,
        facebook: payload.facebook,
        instagram: payload.instagram,
        socialAccounts: payload.socialAccounts || [],
        additionalInfo: payload.additionalInfo,
        dateOfBirth: payload.dateOfBirth,
        address: payload.address,
        googleMapsUrl: payload.googleMapsUrl,
        photo: createdPayload.photo,
        photoUrl: createdPayload.photoUrl,
        photoData: createdPayload.photoData,
        cardBackground: createdPayload.cardBackgroundUrl,
        cardBackgroundUrl: createdPayload.cardBackgroundUrl,
        isActive: payload.isActive ?? true,
        canEdit: payload.canEdit ?? true,
      });
      const createdForCache = {
        ...created,
        id: created.id || createdId,
        email: payload.email,
        companyId,
        companyVoen,
        linkedin: payload.linkedin,
        facebook: payload.facebook,
        instagram: payload.instagram,
      };

      patchCompanyUsersCache(createdForCache);
      saveCompanyUsersCache(
        companyId,
        companyVoen,
        mergeNormalizedUsers(
          readCompanyUsersCache(companyId, companyVoen),
          [createdForCache],
        ),
      );

      addLocalAuditLog({
        userName: 'Company Admin',
        actionType: 'Employee Added',
        entity: 'Employee',
        beforeValue: stringifyAuditValue({ status: 'Əvvəl qeyd yox idi', employee: payload.email }),
        afterValue: stringifyAuditValue(created),
        details: `${fullName || payload.email} işçisi əlavə edildi`,
        companyId,
        companyVoen,
      });

      return created;
    };

    if (isLocalCompanyAdminToken()) {
      return saveLocal(localFallbackUser);
    }

    try {
      const createdUser = await postUserWithOptionalPhoto(basePayload, payload.photoFile, payload.cardBackgroundFile);
      const backendPhotoUrl = getUploadedPhotoUrl(createdUser);

      return saveLocal(createdUser, backendPhotoUrl);
    } catch (error) {
      if (isLocalCompanyAdminToken() && companyId && companyVoen && payload.email && payload.password) return saveLocal(localFallbackUser);
      throw error;
    }
  },


  updateUserProfile: async (userId: string, payload: UpdateUserPayload, userSnapshot?: Partial<NormalizedUser>) => {
    const companyId = userSnapshot?.companyId || getSavedCompanyId();
    const companyVoen = userSnapshot?.companyVoen || getSavedCompanyVoen();
    const before = getEmployeeBeforeState(userId, userSnapshot?.email);
    const { photoFile, cardBackgroundFile, ...profilePayload } = payload;
    const apiPayload = buildUpdateUserPayload(profilePayload);
    const snapshotPhotoData = normalizeInlineImageData(userSnapshot?.photoData || userSnapshot?.photo || userSnapshot?.photoUrl);
    const payloadPhotoData = normalizeInlineImageData(profilePayload.photoData || profilePayload.photoUrl || profilePayload.photo);
    const snapshotPhoto = normalizeAssetUrl(userSnapshot?.photoUrl || userSnapshot?.photo);
    const payloadPhoto = normalizeAssetUrl(profilePayload.photoUrl || profilePayload.photo);
    const localPhotoData = payloadPhotoData || snapshotPhotoData;
    const patch: Partial<NormalizedUser> = {
      ...profilePayload,
      id: userId || userSnapshot?.id || userSnapshot?.email,
      email: userSnapshot?.email,
      companyId,
      companyVoen,
      photoUrl: payloadPhoto || snapshotPhoto,
      photo: localPhotoData || payloadPhoto || snapshotPhoto,
      photoData: localPhotoData,
    };

    const updateLocal = (apiData?: unknown) => {
      const normalizedApiData = apiData && typeof apiData === 'object' ? normalizeUser(apiData) : undefined;
      const responsePhoto = getUploadedPhotoUrl(apiData) || normalizeAssetUrl(normalizedApiData?.photoUrl || normalizedApiData?.photo);
      const existingPhoto = normalizeAssetUrl(patch.photoUrl || patch.photo) || snapshotPhoto;
      // Foto dəyişdirilməyibsə sosial şəbəkə update response-i mövcud şəkli
      // boş və ya köhnə dəyərlə əvəz etməməlidir. Yeni foto seçiləndə isə
      // formadakı seçilmiş şəkil backend-in köhnə cavabından üstün tutulur.
      // Yeni fayl seçiləndə həmin fayldan hazırlanmış data URL lokal əsas mənbədir.
      // Yeni foto ayrıca employee photo endpointinə yüklənir. Upload cavabındakı
      // backend photoUrl lokal preview-dən üstün saxlanılır ki, QR/VCF başqa cihazda da
      // həmin server şəklindən istifadə edə bilsin.
      const selectedPhotoData = photoFile ? (payloadPhotoData || localPhotoData) : localPhotoData;
      if (selectedPhotoData) {
        void writePersistentImage(employeePhotoImageKey(companyId, userId, userSnapshot?.email), selectedPhotoData);
      }
      const selectedBackgroundData = normalizeInlineImageData(profilePayload.cardBackgroundUrl);
      if (selectedBackgroundData) {
        void writePersistentImage(employeeBackgroundImageKey(companyId, userId, userSnapshot?.email), selectedBackgroundData);
      }
      const finalRemotePhoto = responsePhoto || (!selectedPhotoData ? payloadPhoto || existingPhoto : normalizeAssetUrl(normalizedApiData?.photoUrl));
      const finalPhoto = selectedPhotoData || finalRemotePhoto || existingPhoto;
      const finalBackground = normalizeAssetUrl(normalizedApiData?.cardBackgroundUrl) || normalizeAssetUrl(patch.cardBackgroundUrl);
      const localPatch: Partial<NormalizedUser> = {
        ...(normalizedApiData || {}),
        ...patch,
        id: userId || normalizedApiData?.id || userSnapshot?.id || userSnapshot?.email || '',
        email: userSnapshot?.email || normalizedApiData?.email || patch.email || '',
        companyId: patch.companyId || normalizedApiData?.companyId || companyId,
        companyVoen: patch.companyVoen || normalizedApiData?.companyVoen || companyVoen,
        photoUrl: finalRemotePhoto || finalPhoto,
        photo: finalPhoto,
        photoData: selectedPhotoData,
        cardBackgroundUrl: finalBackground,
      };

      const updated = updateEmployeeLocalState(userId, localPatch, userSnapshot);
      const effective = updated
        ? normalizeUser(employeeToRecord(updated))
        : normalizeUser({ ...(userSnapshot || {}), ...localPatch });

      saveLocalEmployeeOverride(localPatch);
      patchCompanyUsersCache(localPatch);

      const fullName = `${effective.firstName} ${effective.lastName}`.trim() || effective.email || userId;

      addLocalAuditLog({
        userName: 'Company Admin',
        userId: getStoredUser()?.userId || 'Company Admin',
        actionType: 'Employee Updated',
        entity: 'Employee',
        beforeValue: stringifyAuditValue(before ? employeeToRecord(before) : userSnapshot || { id: userId }),
        afterValue: stringifyAuditValue(effective),
        details: `${fullName} məlumatları redaktə edildi`,
        companyId: effective.companyId || companyId,
        companyVoen: effective.companyVoen || companyVoen,
      });

      return effective;
    };

    if (isLocalCompanyAdminToken()) {
      return updateLocal();
    }

    const responseData = await putUserWithOptionalPhoto(userId, apiPayload, photoFile, cardBackgroundFile);
    const backendPhotoUrl = getUploadedPhotoUrl(responseData);

    return updateLocal(backendPhotoUrl ? { ...(isRecord(responseData) ? responseData : {}), photoUrl: backendPhotoUrl, photo: backendPhotoUrl } : responseData);
  },

  updateUserStatus: async (userId: string, isActive: boolean, userSnapshot?: Partial<NormalizedUser>) => {
    const updateLocal = () => {
      const before = getEmployeeBeforeState(userId, userSnapshot?.email);
      const updated = updateEmployeeLocalState(userId, { isActive }, userSnapshot);
      const effective = updated
        ? normalizeUser(employeeToRecord(updated))
        : normalizeUser({ ...(userSnapshot || {}), id: userId, isActive });

      const patch = {
        id: userId || userSnapshot?.id || userSnapshot?.email,
        email: userSnapshot?.email,
        companyId: userSnapshot?.companyId || getSavedCompanyId(),
        companyVoen: userSnapshot?.companyVoen || getSavedCompanyVoen(),
        isActive,
      };

      saveLocalEmployeeOverride(patch);
      patchCompanyUsersCache(patch);

      const fullName = `${effective.firstName} ${effective.lastName}`.trim() || effective.email || userId;

      addLocalAuditLog({
        userName: 'Company Admin',
        userId: getStoredUser()?.userId || 'Company Admin',
        actionType: isActive ? 'Employee Activated' : 'Employee Archived',
        entity: 'Employee',
        beforeValue: stringifyAuditValue(
          before ? employeeToRecord(before) : { ...(userSnapshot || {}), id: userId, isActive: !isActive }
        ),
        afterValue: stringifyAuditValue({ ...effective, isActive }),
        details: isActive
          ? `${fullName} arxivdən aktiv siyahıya qaytarıldı`
          : `${fullName} deaktiv edildi və arxivə göndərildi`,
        companyId: effective.companyId || userSnapshot?.companyId || getSavedCompanyId(),
        companyVoen: effective.companyVoen || userSnapshot?.companyVoen || getSavedCompanyVoen(),
      });

      return { ...effective, isActive };
    };

    if (isLocalCompanyAdminToken()) {
      return updateLocal();
    }

    const response = await companyService.updateUserStatus(userId, isActive);
    updateLocal();
    return response.data;
  },

  updateUserCanEdit: async (userId: string, canEdit: boolean, userSnapshot?: Partial<NormalizedUser>) => {
    const updateLocal = () => {
      const before = getEmployeeBeforeState(userId, userSnapshot?.email);
      const updated = updateEmployeeLocalState(userId, { canEdit }, userSnapshot);
      const effective = updated
        ? normalizeUser(employeeToRecord(updated))
        : normalizeUser({ ...(userSnapshot || {}), id: userId, canEdit });

      const patch = {
        id: userId || userSnapshot?.id || userSnapshot?.email,
        email: userSnapshot?.email,
        companyId: userSnapshot?.companyId || getSavedCompanyId(),
        companyVoen: userSnapshot?.companyVoen || getSavedCompanyVoen(),
        canEdit,
      };

      saveLocalEmployeeOverride(patch);
      patchCompanyUsersCache(patch);

      const fullName = `${effective.firstName} ${effective.lastName}`.trim() || effective.email || userId;

      addLocalAuditLog({
        userName: 'Company Admin',
        userId: getStoredUser()?.userId || 'Company Admin',
        actionType: 'Employee Edit Permission Updated',
        entity: 'Employee',
        beforeValue: stringifyAuditValue(
          before ? employeeToRecord(before) : { ...(userSnapshot || {}), id: userId, canEdit: !canEdit }
        ),
        afterValue: stringifyAuditValue({ ...effective, canEdit }),
        details: canEdit ? `${fullName} üçün redaktə icazəsi verildi` : `${fullName} üçün redaktə icazəsi bağlandı`,
        companyId: effective.companyId || userSnapshot?.companyId || getSavedCompanyId(),
        companyVoen: effective.companyVoen || userSnapshot?.companyVoen || getSavedCompanyVoen(),
      });

      return { ...effective, canEdit };
    };

    if (isLocalCompanyAdminToken()) {
      return updateLocal();
    }

    const response = await companyService.updateUserCanEdit(userId, canEdit);
    updateLocal();
    return response.data;
  },

  resetUserPassword: async (userId: string, newPassword: string, userSnapshot?: Partial<NormalizedUser>) => {
    const cleanPassword = String(newPassword || '').trim();
    if (!cleanPassword || cleanPassword.length < 6) {
      throw new Error('Yeni kod/şifrə ən azı 6 simvol olmalıdır.');
    }

    const companyId = userSnapshot?.companyId || getSavedCompanyId();
    const companyVoen = userSnapshot?.companyVoen || getSavedCompanyVoen();
    const before = getEmployeeBeforeState(userId, userSnapshot?.email);

    const updateLocal = () => {
      const passwordUpdated = updateLocalEmployeePassword(userId || userSnapshot?.email || '', companyVoen, cleanPassword);
      const updated = passwordUpdated
        ? updateLocalEmployeeById(passwordUpdated.id, {
            mustChangePassword: true,
            firstLogin: true,
            isFirstLogin: true,
            forcePasswordChange: true,
          })
        : null;
      markEmployeePasswordChangeRequired(userSnapshot?.email || '', companyVoen, userId);
      const effective = updated
        ? normalizeUser(employeeToRecord(updated))
        : normalizeUser({ ...(userSnapshot || {}), id: userId, password: undefined });

      addLocalAuditLog({
        userName: 'Company Admin',
        userId: getStoredUser()?.userId || 'Company Admin',
        actionType: 'Employee Password Reset',
        entity: 'Employee',
        beforeValue: stringifyAuditValue(before ? { ...employeeToRecord(before), password: undefined } : { id: userId }),
        afterValue: stringifyAuditValue({ id: userId, email: userSnapshot?.email, status: 'Kod dəyişdirildi' }),
        details: `${effective.firstName || ''} ${effective.lastName || ''}`.trim() || userSnapshot?.email || userId,
        companyId,
        companyVoen,
      });

      return effective;
    };

    if (isLocalCompanyAdminToken()) {
      return updateLocal();
    }

    const response = await companyService.resetUserPassword(userId, cleanPassword);

    updateLocal();
    return response.data;
  },

  getLogs: async () => {
    const companyId = getSavedCompanyId();
    const companyVoen = getSavedCompanyVoen();
    const localLogs = readLocalAuditLogs(companyId, companyVoen).map(normalizeAuditLog);

    // Company Admin tokeni ilə backend-də /api/AuditLog endpointləri icazəsizdir (403),
    // /api/CompanyAdmin/audit-logs və /api/CompanyAdmin/logs isə mövcud deyil (404).
    // Bu endpointləri hər səhifə açılışında çağırmaq DevTools-da qırmızı error yaradırdı.
    // Ona görə Company Admin panelində yalnız mövcud lokal audit qeydləri göstərilir.
    return localLogs;
  },

  getLocalUsers: async () => toLocalUsers(),
};
