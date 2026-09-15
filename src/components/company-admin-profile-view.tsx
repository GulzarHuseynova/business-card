import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Avatar, Button, Form, Input, message, Modal, QRCode } from "antd";
import {CameraOutlined,ContactsOutlined,DeleteOutlined,EditOutlined,EnvironmentOutlined,FacebookOutlined,GlobalOutlined,InstagramOutlined,LinkOutlined,LinkedinOutlined,MailOutlined,MessageOutlined,PhoneOutlined,PlusOutlined,SaveOutlined,SendOutlined,ShareAltOutlined,UploadOutlined,UserOutlined,WhatsAppOutlined,YoutubeOutlined,} from "@ant-design/icons";
import type { EditableProfileValues, ProfileSocialAccount } from "../types/layout.type";

interface CompanyAdminProfileViewProps {
  displayName: string;
  companyName?: string;
  companyLogo?: string;
  avatarSrc?: string;
  initials: string;
  profileDetails?: { label: string; value?: string }[];
  initialValues?: EditableProfileValues;
  onSave?: (values: EditableProfileValues) => Promise<void>;
  onUploadPhoto?: (file: File) => Promise<void>;
  onUploadCardBackground?: (file: File) => Promise<string>;
  onUploadSocialIcon?: (file: File) => Promise<string>;
}

const clean = (value?: string) => String(value || "").trim();

const normalizeHref = (value?: string) => {
  const text = clean(value);
  if (!text) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(text)) return text;
  return `https://${text}`;
};


const escapeVCardValue = (value?: string) =>
  clean(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const socialIcon = (platform?: string) => {
  const value = clean(platform).toLowerCase();
  if (value.includes("linkedin")) return <LinkedinOutlined />;
  if (value.includes("facebook")) return <FacebookOutlined />;
  if (value.includes("instagram")) return <InstagramOutlined />;
  if (value.includes("phone") || value.includes("telefon")) return <PhoneOutlined />;
  if (value.includes("email") || value.includes("mail")) return <MailOutlined />;
  if (value.includes("whatsapp")) return <WhatsAppOutlined />;
  if (value.includes("telegram")) return <SendOutlined />;
  if (value.includes("message") || value.includes("sms") || value.includes("mesaj")) return <MessageOutlined />;
  if (value.includes("youtube")) return <YoutubeOutlined />;
  if (value.includes("contact") || value.includes("kontakt")) return <ContactsOutlined />;
  if (value.includes("map") || value.includes("ünvan") || value.includes("address")) return <EnvironmentOutlined />;
  if (value.includes("site") || value.includes("web")) return <GlobalOutlined />;
  return <LinkOutlined />;
};

const isSocialPlatform = (platform?: string) => {
  const value = clean(platform).toLowerCase();
  return [
    "linkedin",
    "facebook",
    "instagram",
    "tiktok",
    "youtube",
    "twitter",
    "telegram",
    "threads",
  ].some((item) => value.includes(item));
};

const normalizePlatformKey = (platform?: string) => {
  const value = clean(platform).toLowerCase().replace(/[\s._-]+/g, "");
  if (value.includes("linkedin")) return "linkedin";
  if (value.includes("facebook") || value === "fb") return "facebook";
  if (value.includes("instagram") || value === "insta") return "instagram";
  if (value.includes("whatsapp")) return "whatsapp";
  if (value.includes("youtube")) return "youtube";
  if (value.includes("tiktok")) return "tiktok";
  if (value.includes("telegram")) return "telegram";
  if (value.includes("twitter") || value === "x") return "twitter";
  return value;
};

const normalizeUrlKey = (url?: string) =>
  clean(url)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");

const STANDARD_SOCIAL_KEYS = new Set(["linkedin", "facebook", "instagram"]);

const LINK_ICON_PRESETS = [
  { name: "Website", label: "Website", icon: <GlobalOutlined />, tone: "#4b9ada" },
  { name: "Telefon", label: "Telefon", icon: <PhoneOutlined />, tone: "#22c55e" },
  { name: "Email", label: "Email", icon: <MailOutlined />, tone: "#38bdf8" },
  { name: "WhatsApp", label: "WhatsApp", icon: <WhatsAppOutlined />, tone: "#16a34a" },
  { name: "Telegram", label: "Telegram", icon: <SendOutlined />, tone: "#229ed9" },
  { name: "Mesaj", label: "Mesaj", icon: <MessageOutlined />, tone: "#8b5cf6" },
  { name: "YouTube", label: "YouTube", icon: <YoutubeOutlined />, tone: "#ef4444" },
  { name: "Kontakt", label: "Kontakt", icon: <ContactsOutlined />, tone: "#64748b" },
];

const dedupeSocialAccounts = (items: ProfileSocialAccount[]) => {
  const seenPlatforms = new Set<string>();
  const seenUrls = new Set<string>();

  return items.filter((item) => {
    const platformKey = normalizePlatformKey(item.platformName);
    const urlKey = normalizeUrlKey(item.profileUrl);
    if (!urlKey) return false;

    if (platformKey && seenPlatforms.has(platformKey)) return false;
    if (seenUrls.has(urlKey)) return false;

    if (platformKey) seenPlatforms.add(platformKey);
    seenUrls.add(urlKey);
    return true;
  });
};

const customOnlySocialAccounts = (items: ProfileSocialAccount[]) =>
  dedupeSocialAccounts(items).filter(
    (item) => !STANDARD_SOCIAL_KEYS.has(normalizePlatformKey(item.platformName)),
  );

export default function CompanyAdminProfileView({
  displayName,
  companyName,
  companyLogo,
  avatarSrc,
  initials,
  profileDetails = [],
  initialValues,
  onSave,
  onUploadPhoto,
  onUploadCardBackground,
}: CompanyAdminProfileViewProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [iconPickerIndex, setIconPickerIndex] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [form] = Form.useForm<EditableProfileValues>();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;

    form.setFieldsValue({
      firstName: "",
      lastName: "",
      ...(initialValues || {}),
      socialAccounts: customOnlySocialAccounts(
        (initialValues?.socialAccounts || []).map((item) => ({ ...item })),
      ),
    });
  }, [editing, form, initialValues]);

  const details = useMemo(() => {
    const map = new Map(profileDetails.map((item) => [item.label.toLowerCase(), clean(item.value)]));
    return {
      email: map.get("e-poçt") || map.get("email") || "",
      role: map.get("rol") || "CompanyAdmin",
      voen: map.get("vöen") || map.get("voen") || "",
    };
  }, [profileDetails]);

  const customLinks = useMemo(
    () => customOnlySocialAccounts(initialValues?.socialAccounts || []),
    [initialValues?.socialAccounts],
  );

  const businessLinks = useMemo(
    () => customLinks.filter((item) => !isSocialPlatform(item.platformName)),
    [customLinks],
  );

  const socialLinks = useMemo(() => {
    const standard: ProfileSocialAccount[] = [
      { platformName: "LinkedIn", profileUrl: initialValues?.linkedinUrl },
      { platformName: "Facebook", profileUrl: initialValues?.facebookUrl },
      { platformName: "Instagram", profileUrl: initialValues?.instagramUrl },
    ].filter((item) => clean(item.profileUrl));

    return dedupeSocialAccounts([
      ...standard,
      ...customLinks.filter((item) => isSocialPlatform(item.platformName)),
    ]);
  }, [customLinks, initialValues?.facebookUrl, initialValues?.instagramUrl, initialValues?.linkedinUrl]);

  const fullName = [initialValues?.firstName, initialValues?.lastName].filter(Boolean).join(" ").trim() || displayName;
  const phone = clean(initialValues?.phone1);
  const whatsapp = clean(initialValues?.whatsappPhone);
  const info = clean(initialValues?.additionalInfo);
  const backgroundUrl = clean(initialValues?.cardBackgroundUrl);
  const shareQrPayload = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCardValue(initialValues?.lastName)};${escapeVCardValue(initialValues?.firstName)};;;`,
    `FN:${escapeVCardValue(fullName)}`,
    companyName ? `ORG:${escapeVCardValue(companyName)}` : "",
    initialValues?.jobTitle ? `TITLE:${escapeVCardValue(initialValues.jobTitle)}` : "",
    phone ? `TEL;TYPE=WORK:${phone}` : "",
    clean(initialValues?.phone2) ? `TEL;TYPE=CELL:${clean(initialValues?.phone2)}` : "",
    whatsapp ? `TEL;TYPE=CELL;TYPE=VOICE:${whatsapp}` : "",
    details.email ? `EMAIL;TYPE=WORK:${details.email}` : "",
    clean(initialValues?.googleMapsUrl) ? `URL:${escapeVCardValue(initialValues?.googleMapsUrl)}` : "",
    "END:VCARD",
  ].filter(Boolean).join("\r\n");

  const startEdit = () => setEditing(true);

  const saveProfile = async (values: EditableProfileValues) => {
    if (!onSave) return;

    try {
      setSaving(true);
      const cleanedValues: EditableProfileValues = {
        ...values,
        socialAccounts: customOnlySocialAccounts(values.socialAccounts || []),
      };
      await onSave(cleanedValues);
      setEditing(false);
      message.success("CompanyAdmin məlumatları yeniləndi.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      message.error(detail || "CompanyAdmin məlumatları yenilənmədi.");
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onUploadPhoto) return;

    if (!file.type.startsWith("image/")) {
      message.error("Yalnız şəkil faylı seçin.");
      return;
    }

    try {
      setPhotoUploading(true);
      await onUploadPhoto(file);
      message.success("Profil şəkli yeniləndi.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      message.error(detail || "Profil şəkli yüklənmədi.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const uploadBackground = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onUploadCardBackground) return;

    if (!file.type.startsWith("image/")) {
      message.error("Yalnız şəkil faylı seçin.");
      return;
    }

    try {
      setBackgroundUploading(true);
      const url = await onUploadCardBackground(file);
      if (editing) form.setFieldValue("cardBackgroundUrl", url);
      message.success("Kart fonu yeniləndi.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      message.error(detail || "Kart fonu yüklənmədi.");
    } finally {
      setBackgroundUploading(false);
    }
  };

  const selectLinkIcon = (name: string) => {
    if (iconPickerIndex === null) return;
    const accounts = [...(form.getFieldValue("socialAccounts") || [])];
    accounts[iconPickerIndex] = {
      ...(accounts[iconPickerIndex] || {}),
      platformName: name,
      iconUrl: "",
    };
    form.setFieldValue("socialAccounts", accounts);
    setIconPickerIndex(null);
  };

  const downloadContact = () => {
    const rows = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${fullName}`,
      `N:${clean(initialValues?.lastName)};${clean(initialValues?.firstName)};;;`,
      companyName ? `ORG:${companyName}` : "",
      initialValues?.jobTitle ? `TITLE:${initialValues.jobTitle}` : "",
      phone ? `TEL;TYPE=CELL:${phone}` : "",
      details.email ? `EMAIL:${details.email}` : "",
      "END:VCARD",
    ].filter(Boolean);

    const blob = new Blob([rows.join("\r\n")], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fullName || "company-admin"}.vcf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const renderLinkIcon = (item: ProfileSocialAccount) => (
    item.iconUrl
      ? <img src={item.iconUrl} alt="" />
      : socialIcon(item.platformName)
  );

  if (editing) {
    return (
      <div className="ca-admin-profile-page ca-admin-profile-edit-page">
        <div className="ca-admin-profile-page-head">
          <div>
            <span>CompanyAdmin profili</span>
            <h2>Məlumatları redaktə et</h2>
          </div>
          <Button className="ca-admin-profile-cancel-button" onClick={() => setEditing(false)}>Ləğv et</Button>
        </div>

        <Form<EditableProfileValues>
          form={form}
          layout="vertical"
          onFinish={saveProfile}
          className="ca-admin-profile-form"
        >
          <Form.Item name="cardBackgroundUrl" hidden><Input /></Form.Item>

          <div className="ca-admin-profile-media-editor">
            <div
              className="ca-admin-profile-media-preview"
              style={backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : undefined}
            >
              {companyLogo && <img src={companyLogo} alt={companyName || "Şirkət"} />}
            </div>
            {onUploadCardBackground && (
              <>
                <input ref={backgroundInputRef} type="file" accept="image/*" hidden onChange={uploadBackground} />
                <Button
                  icon={<UploadOutlined />}
                  loading={backgroundUploading}
                  onClick={() => backgroundInputRef.current?.click()}
                >
                  Kart fonunu dəyiş
                </Button>
              </>
            )}
          </div>

          <div className="ca-admin-profile-form-grid">
            <Form.Item name="firstName" label="Ad" rules={[{ required: true, message: "Adı daxil edin" }]}>
              <Input prefix={<UserOutlined />} />
            </Form.Item>
            <Form.Item name="lastName" label="Soyad" rules={[{ required: true, message: "Soyadı daxil edin" }]}>
              <Input prefix={<UserOutlined />} />
            </Form.Item>
            <Form.Item name="middleName" label="Ata adı"><Input /></Form.Item>
            <Form.Item name="jobTitle" label="Vəzifə"><Input /></Form.Item>
            <Form.Item
              name="phone1"
              label="Telefon 1"
              rules={[{ required: true, whitespace: true, message: "Telefon 1 mütləqdir" }]}
            >
              <Input prefix={<PhoneOutlined />} placeholder="Məsələn: +994501112233" />
            </Form.Item>
            <Form.Item name="phone2" label="Telefon 2"><Input prefix={<PhoneOutlined />} /></Form.Item>
            <Form.Item name="whatsappPhone" label="WhatsApp"><Input prefix={<WhatsAppOutlined />} /></Form.Item>
            <Form.Item name="extensionNumber" label="Daxili nömrə"><Input /></Form.Item>
          </div>

          <Form.Item name="additionalInfo" label="Haqqımda / əlavə məlumat">
            <Input.TextArea rows={4} placeholder="Qısa məlumat yazın" />
          </Form.Item>

          <div className="ca-admin-profile-form-section">
            <div className="ca-admin-profile-form-section-title">
              <LinkOutlined />
              <div>
                <strong>Sosial hesablar və linklər</strong>
                <span>Public profildə görünəcək keçidləri əlavə edin</span>
              </div>
            </div>

            <div className="ca-admin-profile-form-grid">
              <Form.Item name="linkedinUrl" label="LinkedIn"><Input prefix={<LinkedinOutlined />} placeholder="https://linkedin.com/in/..." /></Form.Item>
              <Form.Item name="facebookUrl" label="Facebook"><Input prefix={<FacebookOutlined />} placeholder="https://facebook.com/..." /></Form.Item>
              <Form.Item name="instagramUrl" label="Instagram"><Input prefix={<InstagramOutlined />} placeholder="https://instagram.com/..." /></Form.Item>
              <Form.Item name="googleMapsUrl" label="Google Maps / ünvan linki"><Input prefix={<EnvironmentOutlined />} placeholder="https://maps.google.com/..." /></Form.Item>
            </div>

            <Form.List name="socialAccounts">
              {(fields, { add, remove }) => (
                <div className="ca-admin-custom-links">
                  {fields.map(({ key, name, ...restField }) => (
                    <div className="ca-admin-custom-link-row" key={key}>
                      <Form.Item {...restField} name={[name, "platformName"]} rules={[{ required: true, message: "Link adını yazın" }]}>
                        <Input placeholder="Məsələn: Website" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, "profileUrl"]} rules={[{ required: true, message: "Linki yazın" }]}>
                        <Input prefix={<LinkOutlined />} placeholder="https://..." />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, "iconUrl"]} hidden><Input /></Form.Item>
                      <div className="ca-admin-custom-link-actions">
                        <Button
                          type="text"
                          icon={<UploadOutlined />}
                          onClick={() => setIconPickerIndex(name)}
                          aria-label="Link ikonunu seç"
                        />
                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} aria-label="Linki sil" />
                      </div>
                    </div>
                  ))}

                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ platformName: "", profileUrl: "", iconUrl: "" })} block>
                    Yeni link əlavə et
                  </Button>
                </div>
              )}
            </Form.List>
          </div>

          <div className="ca-admin-profile-save-bar">
            <Button onClick={() => setEditing(false)}>Ləğv et</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Dəyişiklikləri yadda saxla</Button>
          </div>
        </Form>

        <Modal
          title="Link ikonunu seç"
          open={iconPickerIndex !== null}
          onCancel={() => setIconPickerIndex(null)}
          footer={null}
          centered
          width={520}
          className="ca-link-icon-modal"
        >
          <p className="ca-link-icon-hint">Əlavə etdiyiniz link üçün uyğun ikon növünü seçin.</p>
          <div className="ca-link-icon-grid">
            {LINK_ICON_PRESETS.map((preset) => (
              <button key={preset.name} type="button" onClick={() => selectLinkIcon(preset.name)}>
                <span style={{ background: `${preset.tone}18`, color: preset.tone }}>{preset.icon}</span>
                <strong>{preset.label}</strong>
              </button>
            ))}
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="ca-admin-profile-page ca-admin-profile-card-page">
      <div className="ca-admin-profile-card">
        <div
          className="ca-admin-profile-cover"
          style={backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : undefined}
        />

        <div className="ca-admin-profile-main">
          <div className="ca-admin-profile-avatar-wrap">
            <Avatar size={112} src={avatarSrc || undefined} className="ca-admin-profile-avatar">
              {!avatarSrc && initials}
            </Avatar>
            {onUploadPhoto && (
              <>
                <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={uploadPhoto} />
                <Button
                  type="primary"
                  shape="circle"
                  icon={<CameraOutlined />}
                  loading={photoUploading}
                  className="ca-admin-photo-button"
                  onClick={() => photoInputRef.current?.click()}
                  aria-label="Profil şəklini dəyiş"
                />
              </>
            )}
          </div>

          <div className="ca-admin-profile-identity">
            <h1>{fullName}</h1>
            <p>{clean(initialValues?.jobTitle) || "CompanyAdmin"}</p>
            {companyName && <strong>{companyName}</strong>}
          </div>

          {onSave && (
            <Button type="primary" icon={<EditOutlined />} onClick={startEdit} className="ca-admin-profile-edit-main">
              Redaktə et
            </Button>
          )}

          {info && <div className="ca-admin-profile-bio">{info}</div>}

          <div className="ca-admin-profile-primary-actions">
            <Button icon={<SaveOutlined />} onClick={downloadContact}>Kontakta əlavə et</Button>
            <Button
              type="primary"
              icon={<PhoneOutlined />}
              href={phone ? `tel:${phone}` : details.email ? `mailto:${details.email}` : undefined}
              disabled={!phone && !details.email}
            >
              Əlaqə
            </Button>
          </div>

          {(phone || whatsapp || details.email) && (
            <section className="ca-admin-card-section">
              <h3>Əlaqə</h3>
              <div className="ca-admin-contact-grid">
                {phone && <a href={`tel:${phone}`} aria-label="Zəng et"><PhoneOutlined /></a>}
                {details.email && <a href={`mailto:${details.email}`} aria-label="E-poçt"><MailOutlined /></a>}
                {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><WhatsAppOutlined /></a>}
              </div>
            </section>
          )}

          {businessLinks.length > 0 && (
            <section className="ca-admin-card-section">
              <h3>Linklər</h3>
              <div className="ca-admin-business-links">
                {businessLinks.map((item, index) => (
                  <a key={`${item.platformName}-${index}`} href={normalizeHref(item.profileUrl)} target="_blank" rel="noreferrer">
                    <span className="ca-admin-business-icon">{renderLinkIcon(item)}</span>
                    <strong>{item.platformName || "Link"}</strong>
                  </a>
                ))}
              </div>
            </section>
          )}

          {socialLinks.length > 0 && (
            <section className="ca-admin-card-section">
              <h3>Sosial media</h3>
              <div className="ca-admin-social-grid">
                {socialLinks.map((item, index) => (
                  <a key={`${item.platformName}-${index}`} href={normalizeHref(item.profileUrl)} target="_blank" rel="noreferrer" aria-label={item.platformName || "Sosial link"}>
                    {renderLinkIcon(item)}
                  </a>
                ))}
              </div>
            </section>
          )}

          {initialValues?.googleMapsUrl && (
            <section className="ca-admin-card-section">
              <h3>Ünvan</h3>
              <div className="ca-admin-business-links">
                <a href={normalizeHref(initialValues.googleMapsUrl)} target="_blank" rel="noreferrer">
                  <span className="ca-admin-business-icon"><EnvironmentOutlined /></span>
                  <strong>{companyName ? `${companyName} ünvanı` : "Xəritədə aç"}</strong>
                </a>
              </div>
            </section>
          )}

          {businessLinks.length === 0 && socialLinks.length === 0 && !initialValues?.googleMapsUrl && onSave && (
            <button type="button" className="ca-admin-profile-empty-link" onClick={startEdit}>
              <PlusOutlined />
              <span>Link əlavə et</span>
            </button>
          )}

          <Button
            block
            icon={<ShareAltOutlined />}
            className="ca-admin-profile-share-button"
            onClick={() => setShareOpen(true)}
          >
            Paylaş
          </Button>
        </div>
      </div>

      <Modal
        title="CompanyAdmin QR kodu"
        open={shareOpen}
        onCancel={() => setShareOpen(false)}
        footer={null}
        centered
        width={360}
        className="ca-admin-share-modal"
      >
        <div className="ca-admin-share-qr">
          <QRCode value={shareQrPayload} size={230} bordered={false} errorLevel="M" />
          <strong>{fullName}</strong>
          <span>QR kodu skan etdikdə kontakt məlumatları açılacaq.</span>
        </div>
      </Modal>
    </div>
  );
}
