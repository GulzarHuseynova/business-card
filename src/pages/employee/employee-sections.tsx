import { Alert, Avatar, Button, Empty, Input, Spin, Tag, Tooltip } from "antd";
import {BankOutlined,CameraOutlined,CheckOutlined,CloseOutlined,EditOutlined,FacebookOutlined,IdcardOutlined,InstagramOutlined, InfoCircleOutlined,LinkOutlined,LinkedinOutlined,PhoneOutlined, PictureOutlined,QrcodeOutlined,SaveOutlined,UserOutlined,WhatsAppOutlined,WifiOutlined,} from "@ant-design/icons";
import type { ReactNode } from "react";
import { useEmployee } from "../../hooks/use-employee";
import {AddBtn,CompanyInfoLine,CopyBtn,DynRow,EmptyLine,FieldLabel,InfoRow,PhoneTypeSelect,Section,SocialSelect,} from "./employee-shared";
import { iconBox, inputStyle, shortText, uuid } from "../../features/employee/employee-card";

const SOCIAL_META: Record<string, { icon: ReactNode; color: string }> = {
  Instagram: { icon: <InstagramOutlined />, color: "#e1306c" },
  LinkedIn: { icon: <LinkedinOutlined />, color: "#0077b5" },
  Facebook: { icon: <FacebookOutlined />, color: "#1877f2" },
  "Twitter/X": { icon: <LinkOutlined />, color: "#0f172a" },
  TikTok: { icon: <LinkOutlined />, color: "#010101" },
  YouTube: { icon: <LinkOutlined />, color: "#ff0000" },
  Website: { icon: <LinkOutlined />, color: "#6366f1" },
};

export function EmployeePageState({ children }: { children: ReactNode }) {
  const { loading, loadError } = useEmployee();

  if (loading) {
    return (
      <div className="employee-loading-card">
        <Spin />
        <div style={{ marginTop: 12, color: "#64748b" }}>Vizitkart məlumatları yüklənir...</div>
      </div>
    );
  }

  if (loadError) {
    return <Alert type="error" showIcon title="Məlumat tapılmadı" description={loadError} style={{ marginBottom: 18, borderRadius: 14 }} />;
  }

  return <>{children}</>;
}

export function EmployeeActions() {
  const { editing, canEditCard, save, cancel, startEdit } = useEmployee();

  if (editing) {
    return (
      <>
        <Button type="primary" icon={<SaveOutlined />} onClick={save} style={{ borderRadius: 12, height: 42, fontWeight: 800 }}>Saxla</Button>
        <Button icon={<CloseOutlined />} onClick={cancel} style={{ borderRadius: 12, height: 42, fontWeight: 800 }}>Ləğv et</Button>
      </>
    );
  }

  return (
    <Tooltip title={canEditCard ? "" : "Redaktə icazəniz CompanyAdmin tərəfindən bağlanıb"}>
      <Button icon={<EditOutlined />} disabled={!canEditCard} onClick={startEdit} style={{ borderRadius: 12, height: 42, fontWeight: 800 }}>
        Redaktə et
      </Button>
    </Tooltip>
  );
}

export function EmployeeHero() {
  const {
    editing,
    canEditCard,
    currentCard: d,
    fullName,
    fileRef,
    backgroundFileRef,
    backgroundUploading,
    handlePhoto,
    handleCardBackground,
  } = useEmployee();

  const effectiveBackground = d.cardBackground || d.companyLogo;
  const usesCompanyLogo = Boolean(!d.cardBackground && d.companyLogo);

  return (
    <div className="employee-hero">
      <div className="employee-hero-grid">
        <div
          className="employee-profile-card"
          style={effectiveBackground ? {
            backgroundImage: `linear-gradient(rgba(255,255,255,0.84), rgba(255,255,255,0.90)), url("${effectiveBackground.replace(/"/g, "%22")}")`,
            backgroundSize: usesCompanyLogo ? "42% auto" : "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundColor: "#eef7ff",
          } : undefined}
        >
          <div>
            <div className="employee-profile-top">
              <div className="employee-avatar-wrap">
                <Avatar src={d.photo || undefined} size={90} style={{ background: "linear-gradient(135deg,#38bdf8,#6366f1)", fontSize: 32, fontWeight: 900, border: "4px solid #e0f2fe" }}>
                  {!d.photo && (d.firstName?.[0] || "E")}
                </Avatar>
                {editing && (
                  <button type="button" onClick={() => fileRef.current?.click()} className="employee-photo-button">
                    <CameraOutlined />
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
              </div>
              <Tag color="blue" style={{ borderRadius: 999, fontWeight: 800, margin: 0 }}>Employee Card</Tag>
            </div>

            {editing && (
              <div style={{ margin: "14px 0 4px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Button
                  icon={<PictureOutlined />}
                  loading={backgroundUploading}
                  onClick={() => backgroundFileRef.current?.click()}
                  style={{ borderRadius: 12, fontWeight: 800 }}
                >
                  {d.cardBackground ? "Kart fonunu dəyiş" : "Şirkət loqosu fonunu dəyiş"}
                </Button>
                {usesCompanyLogo && (
                  <span style={{ color: "#527086", fontSize: 12, fontWeight: 700 }}>
                    Hazırda şirkət loqosu avtomatik fon kimi göstərilir.
                  </span>
                )}
                <input
                  ref={backgroundFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(event) => void handleCardBackground(event)}
                />
              </div>
            )}

            <div className="employee-name-block">
              <div className="employee-full-name">{fullName || "Əməkdaş"}</div>
              <div className="employee-position">{d.position || "Vəzifə qeyd olunmayıb"}</div>
              <div className="employee-company-line">
                <BankOutlined />
                <span>{d.company || "Şirkət"}</span>
              </div>
            </div>
          </div>

          <div className="employee-mini-grid">
            <InfoRow icon={<IdcardOutlined />} label="Daxili" value={d.internalNumber || "-"} color="#0891b2" />
            <InfoRow icon={<QrcodeOutlined />} label="QR UID" value={shortText(d.qrUid)} color="#7c3aed" />
          </div>
        </div>

        <div className="employee-hero-info">
          <div>
            <Tag color="cyan" style={{ borderRadius: 999, marginBottom: 12 }}>Yalnız öz vizitkart məlumatların</Tag>
            <h1>Vizitkart paneli</h1>
            <p>Şəxsi kart məlumatlarını rahat kart görünüşündə yoxla və icazən varsa redaktə et.</p>
            {!canEditCard && (
              <Alert
                type="warning"
                showIcon
                title="Redaktə icazəniz bağlıdır"
                description="Kartınıza daxil ola bilərsiniz, amma CompanyAdmin icazə vermədiyi üçün məlumatları dəyişə bilməzsiniz."
                style={{ marginTop: 14, borderRadius: 14, maxWidth: 620 }}
              />
            )}
          </div>

          <div className="employee-actions-row">
            <EmployeeActions />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PersonalInfoSection() {
  const { editing, draft, currentCard: d, fullName, setField } = useEmployee();

  return (
    <Section title="Şəxsi məlumat" icon={<UserOutlined />} accent="#6366f1">
      {editing ? (
        <>
          <div className="employee-edit-grid-3">
            {(["lastName", "firstName", "middleName"] as const).map((field, index) => (
              <div key={field}>
                <FieldLabel>{["Soyad", "Ad", "Ata adı"][index]}</FieldLabel>
                <Input value={draft[field]} onChange={event => setField(field, event.target.value)} style={inputStyle} />
              </div>
            ))}
          </div>
          <div className="employee-edit-grid-2">
            <div>
              <FieldLabel>Vəzifə</FieldLabel>
              <Input value={draft.position} onChange={event => setField("position", event.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel>Daxili nömrə</FieldLabel>
              <Input value={draft.internalNumber} onChange={event => setField("internalNumber", event.target.value)} style={inputStyle} />
            </div>
          </div>
          <CompanyInfoLine company={draft.company} />
        </>
      ) : (
        <div className="employee-info-grid">
          <InfoRow icon={<UserOutlined />} label="Ad Soyad" value={fullName} color="#6366f1" />
          <InfoRow icon={<BankOutlined />} label="Şirkət" value={d.company} color="#0ea5e9" />
          <InfoRow icon={<IdcardOutlined />} label="Vəzifə" value={d.position} color="#8b5cf6" />
          <InfoRow icon={<QrcodeOutlined />} label="Daxili nömrə" value={d.internalNumber} color="#0891b2" />
        </div>
      )}
    </Section>
  );
}

export function SocialsSection() {
  const { editing, draft, currentCard: d, socialOps } = useEmployee();

  return (
    <Section title="Sosial şəbəkələr" icon={<LinkOutlined />} accent="#e1306c">
      {editing ? (
        <>
          {draft.socials.map((social, index) => (
            <DynRow key={`${social.platform}-${index}`} onRemove={() => socialOps.remove(index)}>
              <SocialSelect value={social.platform} onChange={value => socialOps.update(index, "platform", value)} />
              <Input value={social.url} placeholder="URL" onChange={event => socialOps.update(index, "url", event.target.value)} style={inputStyle} />
            </DynRow>
          ))}
          <AddBtn color="#e1306c" label="Sosial əlavə et" onClick={() => socialOps.add({ platform: "Instagram", url: "" })} />
        </>
      ) : (
        <div className="employee-stack" style={{ gap: 10 }}>
          {d.socials.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sosial link yoxdur" />}
          {d.socials.map((social, index) => {
            const meta = SOCIAL_META[social.platform] ?? { icon: <LinkOutlined />, color: "#64748b" };
            return (
              <a key={`${social.platform}-${index}`} href={social.url.startsWith("http") ? social.url : `https://${social.url}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <InfoRow icon={meta.icon} label={social.platform} value={social.url} color={meta.color} />
              </a>
            );
          })}
        </div>
      )}
    </Section>
  );
}

export function PhonesSection() {
  const { editing, draft, currentCard: d, phoneOps } = useEmployee();

  return (
    <Section title="Telefon nömrələri" icon={<PhoneOutlined />} accent="#10b981">
      {editing ? (
        <>
          {draft.phones.map((phone, index) => (
            <DynRow key={`${phone.type}-${index}`} onRemove={() => phoneOps.remove(index)}>
              <PhoneTypeSelect value={phone.type} onChange={value => phoneOps.update(index, "type", value)} />
              <Input value={phone.number} placeholder="+994 XX XXX XX XX" onChange={event => phoneOps.update(index, "number", event.target.value)} style={inputStyle} />
            </DynRow>
          ))}
          <AddBtn color="#10b981" label="Nömrə əlavə et" onClick={() => phoneOps.add({ type: "İş", number: "" })} />
        </>
      ) : (
        <div className="employee-stack" style={{ gap: 10 }}>
          {d.phones.length === 0 && <EmptyLine text="Telefon nömrəsi yoxdur" />}
          {d.phones.map((phone, index) => {
            const isWhatsApp = phone.type === "WhatsApp";
            return (
              <InfoRow key={`${phone.type}-${index}`} icon={isWhatsApp ? <WhatsAppOutlined /> : <PhoneOutlined />} label={phone.type} value={phone.number} color={isWhatsApp ? "#25d366" : "#10b981"} />
            );
          })}
        </div>
      )}
    </Section>
  );
}

export function ExtraInfoSection() {
  const { editing, draft, currentCard: d, extraOps } = useEmployee();

  return (
    <Section title="Əlavə məlumat" icon={<InfoCircleOutlined />} accent="#f59e0b">
      {editing ? (
        <>
          {draft.extras.map((extra, index) => (
            <DynRow key={`${extra.label}-${index}`} onRemove={() => extraOps.remove(index)}>
              <Input value={extra.label} placeholder="Sahə adı" onChange={event => extraOps.update(index, "label", event.target.value)} style={inputStyle} />
              <Input value={extra.value} placeholder="Dəyər" onChange={event => extraOps.update(index, "value", event.target.value)} style={inputStyle} />
            </DynRow>
          ))}
          <AddBtn color="#f59e0b" label="Məlumat əlavə et" onClick={() => extraOps.add({ label: "", value: "" })} />
        </>
      ) : (
        <div className="employee-extra-grid">
          {d.extras.length === 0 && <EmptyLine />}
          {d.extras.map((extra, index) => (
            <div key={`${extra.label}-${index}`} className="employee-extra-card">
              <div style={{ color: "#92400e", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.4 }}>{extra.label}</div>
              <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 800, marginTop: 3 }}>{extra.value}</div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export function IdentifiersSection() {
  const { editing, draft, currentCard: d, setField } = useEmployee();

  return (
    <Section title="İdentifikatorlar" icon={<QrcodeOutlined />} accent="#8b5cf6">
      <div className="employee-stack" style={{ gap: 10 }}>
        {[
          { label: "NFC Etiket URL", icon: <WifiOutlined />, value: d.nfcUrl, field: "nfcUrl" as const, color: "#7c3aed" },
          { label: "QR UID", icon: <QrcodeOutlined />, value: d.qrUid, field: "qrUid" as const, color: "#059669" },
        ].map(row => (
          <div key={row.field} className="employee-info-row">
            <div style={iconBox(`${row.color}18`, row.color, 38)}>{row.icon}</div>
            <div className="employee-info-content">
              <FieldLabel>{row.label}</FieldLabel>
              {editing ? (
                <Input value={draft[row.field]} onChange={event => setField(row.field, event.target.value)} style={inputStyle} />
              ) : (
                <div className="employee-info-value" style={{ fontFamily: row.field === "qrUid" ? "monospace" : undefined }}>
                  {row.value || "-"}
                </div>
              )}
            </div>
            <CopyBtn text={row.value} />
            {editing && row.field === "qrUid" && (
              <Tooltip title="Yeni UUID yarat">
                <Button icon={<CheckOutlined />} onClick={() => setField("qrUid", uuid())} style={{ borderRadius: 10, flexShrink: 0 }} />
              </Tooltip>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

export function EmployeePageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="employee-page-header">
      <div className="employee-page-header-row">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="employee-actions-row">
          <EmployeeActions />
        </div>
      </div>
    </div>
  );
}
