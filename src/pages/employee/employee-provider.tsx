import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { message } from "antd";
import { userActions } from "../../helpers/user.helper";
import { authSessionStorage } from "../../storage/auth-session.storage";
import { useAuthSelector } from "../../store/authStore";
import type { CardData } from "../../types/employee.type";
import {canEditEmployeeCard,canOpenEmployeePage,EMPTY_CARD,mapUserToCard,} from "../../features/employee/employee-card";
import { EmployeeContext } from "../../hooks/use-employee";
import { findStringDeep } from "../../utils/api.utils";
import { normalizeAssetUrl } from "../../utils/asset-url.utils";
import { getSavedCompanyLogo } from "../../storage/company.storage";
import { getSavedCompanyCardBackgroundAsync } from "../../features/company/company-card-theme";
import { fetchPublicCardProfile, findPublicCardProfile, savePublicCardProfile } from "../../features/public-card/public-card";
import { findLocalEmployeeById, findLocalEmployeeOverride } from "../../storage/local-auth/employee-local-auth";

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const userId = useAuthSelector((state) => state.userId);
  const accountInfo = useAuthSelector((state) => state.accountInfo);
  const role = useAuthSelector((state) => state.role);
  const companyId = useAuthSelector((state) => state.companyId);
  const companyVoen = useAuthSelector((state) => state.companyVoen);

  const isEmployee = role === "employee";
  const [loading, setLoading] = useState(isEmployee);
  const [editing, setEditing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [card, setCard] = useState<CardData>(EMPTY_CARD);
  const [draft, setDraft] = useState<CardData>(EMPTY_CARD);
  const [canEditCard, setCanEditCard] = useState(false);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const backgroundFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
   if (!isEmployee) {
  return;
}

    const applyEmployeeData = async (data: unknown) => {
      if (!canOpenEmployeePage(data)) {
        authSessionStorage.clear();
        setLoadError("Bu əməkdaş deaktiv edilib. Employee səhifəsinə giriş icazəsi yoxdur. CompanyAdmin ilə əlaqə saxlayın.");
        message.error("Employee hesabı deaktiv edilib.");
        return;
      }

      let fallbackCard = accountInfo ? mapUserToCard(accountInfo, EMPTY_CARD) : EMPTY_CARD;

      if (userId) {
        const storedPublicProfile = findPublicCardProfile(userId);
        if (storedPublicProfile) fallbackCard = mapUserToCard(storedPublicProfile, fallbackCard);

        try {
          const publicProfile = await fetchPublicCardProfile(userId, "Direct");
          if (publicProfile) fallbackCard = mapUserToCard(publicProfile, fallbackCard);
        } catch {
          // Şəxsi profil endpoint-i əlçatan olmasa belə backend/login keşindən kartı göstəririk.
        }
      }

      let mapped = mapUserToCard(data, fallbackCard);
      const resolvedCompanyId = findStringDeep(data, ["companyId", "companyID", "company_id"]) || companyId;
      const resolvedCompanyVoen = findStringDeep(data, ["companyVoen", "voen", "taxId", "taxNumber"]) || companyVoen;
      const savedCompanyLogo = getSavedCompanyLogo(resolvedCompanyId, resolvedCompanyVoen);
      const sharedCompanyBackground = await getSavedCompanyCardBackgroundAsync(resolvedCompanyId, resolvedCompanyVoen);

      if (!mapped.companyLogo && savedCompanyLogo) {
        mapped = { ...mapped, companyLogo: savedCompanyLogo };
      }
      if (!mapped.cardBackground && sharedCompanyBackground) {
        mapped = { ...mapped, cardBackground: sharedCompanyBackground };
      }

      const employeeEmail = findStringDeep(data, ["email", "email1", "gmail", "mail", "emailAddress"])
        || findStringDeep(accountInfo, ["email", "email1", "gmail", "mail", "emailAddress"]);
      const localEmployee = userId
        ? findLocalEmployeeById(userId) || findLocalEmployeeById(employeeEmail)
        : findLocalEmployeeById(employeeEmail);
      const permissionOverride = findLocalEmployeeOverride({
        id: userId || localEmployee?.id || "",
        email: employeeEmail || localEmployee?.email || "",
        companyId: resolvedCompanyId || localEmployee?.companyId || "",
        companyVoen: resolvedCompanyVoen || localEmployee?.voen || "",
      });
      const editAllowed = permissionOverride?.canEdit
        ?? localEmployee?.canEdit
        ?? canEditEmployeeCard(data);
      setCard(mapped);
      setDraft(mapped);
      setCanEditCard(editAllowed);
      if (!editAllowed) setEditing(false);
    };

    const loadEmployeeCard = async () => {
      setLoading(true);
      setLoadError("");

      try {
        if (userId) {
          try {
            const data = await userActions.getUserById(userId);
            await applyEmployeeData(data);
            return;
          } catch {
            if (accountInfo) {
              await applyEmployeeData(accountInfo);
              return;
            }
            throw new Error("Employee məlumatı yüklənmədi.");
          }
        }

        if (accountInfo) {
          await applyEmployeeData(accountInfo);
          return;
        }

        setLoadError("Əməkdaş məlumatı tapılmadı. Yenidən login edin.");
      } catch {
        setLoadError("Vizitkart məlumatlarını yükləmək mümkün olmadı.");
        message.error("Vizitkart məlumatları yüklənmədi.");
      } finally {
        setLoading(false);
      }
    };

    void loadEmployeeCard();
}, [accountInfo, companyId, companyVoen, isEmployee, userId]);

  const currentCard = editing ? draft : card;
  const fullName = `${currentCard.lastName} ${currentCard.firstName} ${currentCard.middleName}`.replace(/\s+/g, " ").trim() || "Əməkdaş";

  const setField = <K extends keyof CardData>(key: K, value: CardData[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const listOps = <T,>(key: "phones" | "socials" | "extras") => ({
    add: (item: T) => setDraft((previous) => ({ ...previous, [key]: [...(previous[key] as T[]), item] })),
    remove: (index: number) => setDraft((previous) => ({ ...previous, [key]: (previous[key] as T[]).filter((_, currentIndex) => currentIndex !== index) })),
    update: (index: number, field: keyof T, value: string) => {
      setDraft((previous) => ({
        ...previous,
        [key]: (previous[key] as T[]).map((item, currentIndex) => currentIndex === index ? { ...item, [field]: value } : item),
      }));
    },
  });

  const phoneOps = useMemo(() => listOps<CardData["phones"][0]>("phones"), []);
  const socialOps = useMemo(() => listOps<CardData["socials"][0]>("socials"), []);
  const extraOps = useMemo(() => listOps<CardData["extras"][0]>("extras"), []);

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = ev => {
      img.src = ev.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(220 / img.width, 220 / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setField("photo", canvas.toDataURL("image/jpeg", 0.86));
      };
    };

    reader.readAsDataURL(file);
  };


  const handleCardBackground = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      message.error("Kart fonu üçün şəkil faylı seçin.");
      return;
    }

    try {
      setBackgroundUploading(true);
      const response = await userActions.uploadCardBackground(file);
      let cardBackground = normalizeAssetUrl(
        findStringDeep(response, [
          "cardBackgroundUrl",
          "cardBackgroundURL",
          "cardBackground",
          "backgroundUrl",
          "backgroundImageUrl",
        ])
      );

      if (!cardBackground && userId) {
        const refreshed = await userActions.getUserById(userId);
        cardBackground = mapUserToCard(refreshed, card).cardBackground;
      }

      if (!cardBackground) {
        throw new Error("Backend kart fonunun URL-ni qaytarmadı.");
      }

      setCard((previous) => ({ ...previous, cardBackground }));
      setDraft((previous) => ({ ...previous, cardBackground }));

      const existingPublicProfile = userId ? findPublicCardProfile(userId) : null;
      if (existingPublicProfile) {
        savePublicCardProfile({ ...existingPublicProfile, cardBackground });
      }

      message.success("Kart fonu yeniləndi.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      message.error(detail || "Kart fonu yüklənmədi.");
    } finally {
      setBackgroundUploading(false);
    }
  };

  const startEdit = () => {
    if (!canEditCard) {
      message.warning("Redaktə icazəniz bağlıdır. Kartı yalnız görə bilərsiniz.");
      return;
    }

    setDraft(card);
    setEditing(true);
  };

  const save = async () => {
    if (!canEditCard) {
      setEditing(false);
      message.warning("Redaktə icazəniz bağlıdır. Kartı yalnız görə bilərsiniz.");
      return;
    }

    try {
      await userActions.updateProfile(draft);
      setCard(draft);
      setEditing(false);
      message.success("Kart saxlanıldı!");
    } catch (error) {
      console.error("Profil saxlanmadı:", error);
      message.error("Profil saxlanmadı!");
    }
  };

  const cancel = () => {
    setDraft(card);
    setEditing(false);
  };

  const value = {
    editing,
    loading,
    loadError,
    card,
    draft,
    currentCard,
    fullName,
    canEditCard,
    fileRef,
    backgroundFileRef,
    backgroundUploading,
    setField,
    phoneOps,
    socialOps,
    extraOps,
    handlePhoto,
    handleCardBackground,
    startEdit,
    save,
    cancel,
  };

  return <EmployeeContext.Provider value={value}>{children}</EmployeeContext.Provider>;
}
