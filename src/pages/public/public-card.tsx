import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Alert, Avatar, Button, Empty, QRCode } from 'antd';
import {BankOutlined,CalendarOutlined,ContactsOutlined,EnvironmentOutlined,FacebookOutlined,GlobalOutlined,InstagramOutlined,LinkedinOutlined,MailOutlined,MessageOutlined,PhoneOutlined,SendOutlined,WhatsAppOutlined,YoutubeOutlined,} from '@ant-design/icons';
import { useParams, useSearchParams } from 'react-router';
import {downloadVCard,fetchPublicCardProfile,getFullName,recordPublicScan,type PublicCardProfile,type ScanSource,} from '../../features/public-card/public-card';
import { stripSocialLinksFromAdditionalInfo } from '../../features/profile/profile-info';

const SETCLAPP_URL = 'https://www.setclapp.com/';

const normalizeUrl = (value: string) => {
  if (!value) return '#';
  return /^(https?:\/\/|mailto:|tel:|sms:)/i.test(value) ? value : `https://${value}`;
};

const normalizeSocialHref = (platform: string, value: string) => {
  const text = String(value || '').trim();
  if (!text) return '#';
  if (/^(https?:\/\/|mailto:|tel:|sms:)/i.test(text)) return text;

  const marker = `${platform} ${text}`.toLowerCase();
  if (marker.includes('telefon') || marker.includes('phone')) return `tel:${text}`;
  if (marker.includes('email') || marker.includes('mail')) return `mailto:${text}`;
  if (marker.includes('mesaj') || marker.includes('message') || marker.includes('sms')) return `sms:${text}`;
  if (marker.includes('whatsapp')) return `https://wa.me/${text.replace(/\D/g, '')}`;
  if (marker.includes('telegram') && text.startsWith('@')) return `https://t.me/${text.slice(1)}`;

  return normalizeUrl(text);
};

const phoneDigits = (value?: string) => String(value || '').replace(/\D/g, '');
const formatBirthDate = (value?: string) => {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : text;
};
const isWhatsappType = (value: string) => value.toLowerCase().includes('whatsapp');

// Public card-dakı QR internet linki deyil, birbaşa kontakt vCard məlumatı daşıyır.
// QR-i kiçik və rahat skan olunan saxlamaq üçün yalnız əsas kontakt sahələri daxil edilir.
const escapeQrVCard = (value: string) => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

const buildCompactContactQrPayload = (profile: PublicCardProfile) => {
  const fullName = getFullName(profile);
  const uniquePhones = profile.phones
    .filter((phone) => String(phone.number || '').trim())
    .filter((phone, index, list) => {
      const digits = phoneDigits(phone.number);
      return Boolean(digits) && list.findIndex((item) => phoneDigits(item.number) === digits) === index;
    })
    .slice(0, 2);

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeQrVCard(profile.lastName)};${escapeQrVCard(profile.firstName)};${escapeQrVCard(profile.middleName)};;`,
    `FN:${escapeQrVCard(fullName)}`,
  ];

  if (profile.companyName) lines.push(`ORG:${escapeQrVCard(profile.companyName)}`);
  if (profile.jobTitle) lines.push(`TITLE:${escapeQrVCard(profile.jobTitle)}`);

  uniquePhones.forEach((phone) => {
    const type = isWhatsappType(phone.type) ? 'CELL' : 'WORK';
    lines.push(`TEL;TYPE=${type}:${escapeQrVCard(phone.number)}`);
  });

  if (profile.email) lines.push(`EMAIL:${escapeQrVCard(profile.email)}`);

  lines.push('END:VCARD');
  return `${lines.join('\r\n')}\r\n`;
};

const socialKeyPattern = /(linkedin|facebook|instagram|youtube|tiktok|twitter|x\.com|telegram|sosial|social)/i;
const socialUrlPattern = /(?:https?:\/\/)?(?:www\.)?(?:linkedin|facebook|instagram|youtube|tiktok|twitter|x)\.com\//i;

const normalizeComparableUrl = (value: string) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/^www\./, '')
  .replace(/\/+$/, '');

const getSocialMarker = (platform: string, url = '') => `${platform} ${url}`.toLowerCase();

const getSocialIcon = (platform: string, iconUrl?: string, url = ''): ReactNode => {
  if (iconUrl) {
    return <img src={iconUrl} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />;
  }

  const key = getSocialMarker(platform, url);
  if (key.includes('linkedin')) return <LinkedinOutlined style={{ fontSize: 23 }} />;
  if (key.includes('facebook')) return <FacebookOutlined style={{ fontSize: 23 }} />;
  if (key.includes('instagram')) return <InstagramOutlined style={{ fontSize: 23 }} />;
  if (key.includes('youtube') || key.includes('youtu.be')) return <YoutubeOutlined style={{ fontSize: 23 }} />;
  if (key.includes('telegram') || key.includes('t.me')) return <SendOutlined style={{ fontSize: 23 }} />;
  if (key.includes('whatsapp') || key.includes('wa.me')) return <WhatsAppOutlined style={{ fontSize: 23 }} />;
  if (key.includes('email') || key.includes('mail') || key.includes('mailto:')) return <MailOutlined style={{ fontSize: 23 }} />;
  if (key.includes('telefon') || key.includes('phone') || key.includes('tel:')) return <PhoneOutlined style={{ fontSize: 23 }} />;
  if (key.includes('mesaj') || key.includes('message') || key.includes('sms:')) return <MessageOutlined style={{ fontSize: 23 }} />;
  return <GlobalOutlined style={{ fontSize: 23 }} />;
};

const getSocialColor = (platform: string, url = '') => {
  const key = getSocialMarker(platform, url);
  if (key.includes('linkedin')) return '#0077b5';
  if (key.includes('facebook')) return '#1877f2';
  if (key.includes('instagram')) return '#e1306c';
  if (key.includes('youtube') || key.includes('youtu.be')) return '#ff0000';
  if (key.includes('telegram') || key.includes('t.me')) return '#229ed9';
  if (key.includes('whatsapp') || key.includes('wa.me')) return '#25d366';
  return '#4b9ada';
};

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  href?: string;
}) {
  if (!value) return null;

  const row = (
    <div style={infoRow}>
      <div style={infoIcon}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={infoLabel}>{label}</div>
        <div style={infoValue}>{value}</div>
      </div>
      <span style={arrow}>›</span>
    </div>
  );

  return href ? (
    <a href={href} style={{ textDecoration: 'none' }}>
      {row}
    </a>
  ) : (
    row
  );
}

export default function PublicCard() {
  const { cardId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const scanRecordedRef = useRef(false);
  const vcfDownloadedRef = useRef(false);

  const source = useMemo<ScanSource>(() => {
    const value = (searchParams.get('source') || searchParams.get('type') || '').toUpperCase();
    if (value === 'NFC') return 'NFC';
    if (value === 'QR') return 'QR';
    return 'Direct';
  }, [searchParams]);

  const shouldAutoDownloadVcf = useMemo(() => {
    return source === 'QR' && searchParams.get('downloadVcf') === '1';
  }, [searchParams, source]);

  const requestKey = `${cardId}:${source}:${shouldAutoDownloadVcf ? 'vcf' : 'page'}`;
  const [cardState, setCardState] = useState<{ key: string; profile: PublicCardProfile | null }>({
    key: '',
    profile: null,
  });

  const loading = cardState.key !== requestKey;
  const profile = loading ? null : cardState.profile;

  useEffect(() => {
    let cancelled = false;
    scanRecordedRef.current = false;
    vcfDownloadedRef.current = false;

    fetchPublicCardProfile(cardId, source).then((data: PublicCardProfile | null) => {
      if (!cancelled) setCardState({ key: requestKey, profile: data });
    });

    return () => {
      cancelled = true;
    };
  }, [cardId, source, requestKey]);

  useEffect(() => {
    if (!profile || scanRecordedRef.current) return;
    scanRecordedRef.current = true;
    void recordPublicScan(profile, source);
  }, [profile, source]);

  useEffect(() => {
    if (!profile || !shouldAutoDownloadVcf || vcfDownloadedRef.current) return;
    vcfDownloadedRef.current = true;
    const timer = window.setTimeout(() => void downloadVCard(profile), 250);
    return () => window.clearTimeout(timer);
  }, [profile, shouldAutoDownloadVcf]);

  if (loading) {
    return (
      <div style={pageCenter}>
        <div style={emptyCard}>
          <Empty description="Vizitkart yüklənir..." />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={pageCenter}>
        <div style={emptyCard}>
          <Empty description="Vizitkart tapılmadı" />
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 16 }}
            title="Bu link üçün məlumat yoxdur"
            description="CompanyAdmin panelində əməkdaşı əlavə edin və QR kodu yenidən açın."
          />
        </div>
      </div>
    );
  }

  const fullName = getFullName(profile);
  const qrContactPayload = buildCompactContactQrPayload(profile);
  const visiblePhones = profile.phones.filter((phone) => phone.number);
  const visibleSocials = profile.socials.filter((social) => social.url);
  const socialUrls = new Set(visibleSocials.map((social) => normalizeComparableUrl(social.url)).filter(Boolean));
  const visibleExtras = profile.extras
    .map((extra) => ({
      ...extra,
      value: stripSocialLinksFromAdditionalInfo(extra.value, Array.from(socialUrls)),
    }))
    .filter((extra) => (
      extra.label &&
      extra.value &&
      !socialKeyPattern.test(extra.label) &&
      !socialUrlPattern.test(extra.value)
    ));
  const visibleEmail = String(profile.email || '').trim();

  const whatsapp = visiblePhones.find((phone) => isWhatsappType(phone.type));
  const callPhone = visiblePhones.find((phone) => !isWhatsappType(phone.type)) || visiblePhones[0];
  const callDigits = phoneDigits(callPhone?.number);
  const whatsappDigits = phoneDigits(whatsapp?.number);

  const detailedPhones = visiblePhones.filter((phone) => {
    const digits = phoneDigits(phone.number);
    const sameCall = Boolean(callDigits && digits === callDigits);
    const sameWhatsapp = Boolean(isWhatsappType(phone.type) && whatsappDigits && digits === whatsappDigits);
    return !sameCall && !sameWhatsapp;
  });

  const effectiveBackground = profile.cardBackground || profile.companyLogo;
  const usesCompanyLogoAsBackground = Boolean(!profile.cardBackground && profile.companyLogo);

  return (
    <div style={page}>
      <main style={shell}>
        <section
          style={{
            ...hero,
            ...(effectiveBackground
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(248,252,255,0.58), rgba(232,245,255,0.76)), url("${effectiveBackground.replace(/"/g, '%22')}")`,
                  backgroundSize: usesCompanyLogoAsBackground ? '42% auto' : 'contain',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundColor: '#eef7ff',
                }
              : {}),
          }}
        >
          <div style={heroCircleTop} />
          <div style={heroCircleBottom} />

          <div style={heroTop}>
            <div style={topBadge}>
              {profile.companyLogo ? (
                <img src={profile.companyLogo} alt={profile.companyName} style={logoImg} />
              ) : (
                <BankOutlined style={{ fontSize: 30, color: '#1e293b' }} />
              )}
            </div>

            <div style={topBadge}>
              <QRCode value={qrContactPayload} size={76} bordered={false} type="svg" errorLevel="L" />
            </div>
          </div>

          <div style={profileBlock}>
            <Avatar size={88} src={profile.photo || undefined} style={avatarStyle}>
              {fullName[0]}
            </Avatar>

            <h1 style={nameStyle}>{fullName}</h1>

            {profile.jobTitle && <div style={jobStyle}>{profile.jobTitle}</div>}

            {profile.companyName && <div style={companyPill}>{profile.companyName}</div>}
          </div>
        </section>

        <section style={contactCard}>
          <div style={buttonGrid}>
            {callPhone && (
              <Button href={`tel:${callPhone.number}`} icon={<PhoneOutlined />} type="primary" style={callButton}>
                Zəng et
              </Button>
            )}

            {whatsapp && (
              <Button
                href={`https://wa.me/${phoneDigits(whatsapp.number)}`}
                target="_blank"
                icon={<WhatsAppOutlined />}
                style={whatsappButton}
              >
                WhatsApp
              </Button>
            )}
          </div>

          <div style={rowsBox}>
            {visibleEmail && (
              <InfoRow
                icon={<MailOutlined />}
                label="Email"
                value={visibleEmail}
                href={`mailto:${visibleEmail}`}
              />
            )}

            {profile.dateOfBirth && (
              <InfoRow
                icon={<CalendarOutlined />}
                label="Doğum tarixi"
                value={formatBirthDate(profile.dateOfBirth)}
              />
            )}

            {(profile.address || profile.googleMapsUrl) && (
              <InfoRow
                icon={<EnvironmentOutlined />}
                label="Ünvan"
                value={profile.address || 'Google Maps ünvanı'}
                href={profile.googleMapsUrl ? normalizeUrl(profile.googleMapsUrl) : undefined}
              />
            )}

            {detailedPhones.map((phone) => (
              <InfoRow
                key={`${phone.type}-${phone.number}`}
                icon={isWhatsappType(phone.type) ? <WhatsAppOutlined /> : <PhoneOutlined />}
                label={phone.type}
                value={phone.number}
                href={`tel:${phone.number}`}
              />
            ))}

            {visibleExtras.map((extra) => (
              <InfoRow
                key={`${extra.label}-${extra.value}`}
                icon={<BankOutlined />}
                label={extra.label}
                value={extra.value}
              />
            ))}
          </div>
        </section>

        <button type="button" onClick={() => void downloadVCard(profile)} style={addContactButton}>
          <ContactsOutlined style={{ fontSize: 24 }} />
          <span>Kontaktlara əlavə et</span>
          <span style={addArrow}>›</span>
        </button>

        {visibleSocials.length > 0 && (
          <section style={socialCard}>
            <div style={sectionTitle}>
              <span style={titleLine} />
              <span>Sosial şəbəkələr</span>
              <span style={titleLine} />
            </div>

            <div style={socialList}>
              {visibleSocials.map((social) => (
                <a
                  key={`${social.platform}-${social.url}`}
                  href={normalizeSocialHref(social.platform, social.url)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    ...socialButton,
                    color: getSocialColor(social.platform, social.url),
                  }}
                >
                  {getSocialIcon(social.platform, social.iconUrl, social.url)}
                </a>
              ))}
            </div>
          </section>
        )}

        <footer style={setclappFooter}>
          <a href={SETCLAPP_URL} target="_blank" rel="noreferrer" style={setclappLink}>
            <img src="/setclapp-logo.svg" alt="SetClapp" style={setclappLogo} />
          </a>
        </footer>
      </main>
    </div>
  );
}

const page: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg,#eef7ff 0%,#ffffff 100%)',
  padding: '18px 12px',
  fontFamily: 'Inter, system-ui, sans-serif',
  boxSizing: 'border-box',
};

const shell: CSSProperties = {
  width: '100%',
  maxWidth: 500,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const hero: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  minHeight: 238,
  borderRadius: 28,
  padding: '18px 18px 22px',
  color: '#456b82',
  background: 'linear-gradient(180deg,#f8fcff 0%,#e8f5ff 100%)',
  boxShadow: '0 18px 52px rgba(71,120,153,0.12)',
};

const heroTop: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
};

const topBadge: CSSProperties = {
  width: 88,
  height: 88,
  borderRadius: 22,
  background: '#ffffff',
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
  boxShadow: '0 10px 24px rgba(71,120,153,0.12)',
  flexShrink: 0,
};

const logoImg: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  padding: 12,
};

const heroCircleTop: CSSProperties = {
  position: 'absolute',
  width: 260,
  height: 260,
  right: -90,
  top: -90,
  borderRadius: '50%',
  border: '1px solid rgba(90,168,232,0.22)',
};

const heroCircleBottom: CSSProperties = {
  position: 'absolute',
  width: 210,
  height: 210,
  left: -100,
  bottom: -100,
  borderRadius: '50%',
  background: 'radial-gradient(circle,#5aa8e8 0%,rgba(90,168,232,0.10) 64%,transparent 65%)',
};

const profileBlock: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  marginTop: -4,
  textAlign: 'center',
};

const avatarStyle: CSSProperties = {
  background: 'linear-gradient(180deg,#f5fbff 0%,#d7ecfb 100%)',
  fontSize: 32,
  fontWeight: 900,
  color: '#456b82',
  border: '4px solid #ffffff',
  boxShadow: '0 14px 30px rgba(71,120,153,0.16)',
};

const nameStyle: CSSProperties = {
  margin: '14px 0 3px',
  fontSize: 27,
  lineHeight: 1.15,
  fontWeight: 950,
};

const jobStyle: CSSProperties = {
  color: '#6d7f8d',
  fontSize: 17,
  fontWeight: 700,
};

const companyPill: CSSProperties = {
  display: 'inline-flex',
  marginTop: 10,
  padding: '7px 22px',
  borderRadius: 999,
  background: '#ffffff',
  color: '#456b82',
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: 0.4,
};

const contactCard: CSSProperties = {
  background: '#ffffff',
  borderRadius: 28,
  padding: 8,
  border: '1px solid #d9ebf8',
  boxShadow: '0 14px 36px rgba(71,120,153,0.08)',
};

const buttonGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginBottom: 14,
};

const callButton: CSSProperties = {
  height: 52,
  background: '#5aa8e8',
  borderColor: '#5aa8e8',
  borderRadius: 15,
  fontWeight: 900,
  fontSize: 16,
  boxShadow: '0 10px 18px rgba(90,168,232,0.16)',
};

const whatsappButton: CSSProperties = {
  height: 52,
  borderRadius: 15,
  fontWeight: 900,
  fontSize: 16,
  color: '#456b82',
  background: '#e8f5ff',
  borderColor: '#cde6f8',
};

const rowsBox: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  overflow: 'hidden',
  background: '#ffffff',
};

const infoRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px 1fr 18px',
  alignItems: 'center',
  gap: 10,
  padding: '13px 14px',
  borderBottom: '1px solid #edf2f7',
};

const infoIcon: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  background: '#eef8ff',
  color: '#5aa8e8',
  display: 'grid',
  placeItems: 'center',
  fontSize: 19,
};

const infoLabel: CSSProperties = {
  color: '#64748b',
  fontSize: 13,
  fontWeight: 700,
};

const infoValue: CSSProperties = {
  marginTop: 2,
  color: '#0f172a',
  fontSize: 17,
  fontWeight: 850,
  overflowWrap: 'anywhere',
};

const arrow: CSSProperties = {
  color: '#64748b',
  fontSize: 34,
  lineHeight: 1,
};

const addContactButton: CSSProperties = {
  height: 74,
  border: 0,
  borderRadius: 24,
  background: '#ffffff',
  display: 'grid',
  gridTemplateColumns: '42px 1fr 18px',
  alignItems: 'center',
  gap: 12,
  padding: '0 18px',
  cursor: 'pointer',
  fontSize: 17,
  fontWeight: 900,
  color: '#0f172a',
  boxShadow: '0 14px 36px rgba(71,120,153,0.07)',
};

const addArrow: CSSProperties = {
  color: '#64748b',
  fontSize: 34,
  lineHeight: 1,
};

const socialCard: CSSProperties = {
  background: '#ffffff',
  borderRadius: 24,
  padding: '18px 16px 22px',
  border: '1px solid #d9ebf8',
  boxShadow: '0 14px 36px rgba(71,120,153,0.06)',
};

const sectionTitle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  gap: 12,
  color: '#334155',
  fontSize: 15,
  fontWeight: 900,
  marginBottom: 18,
};

const titleLine: CSSProperties = {
  height: 1,
  background: '#cbd5e1',
};

const socialList: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 22,
  flexWrap: 'wrap',
};

const socialButton: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 14,
  background: '#ffffff',
  border: '1px solid #d9ebf8',
  display: 'grid',
  placeItems: 'center',
  textDecoration: 'none',
};

const setclappFooter: CSSProperties = {
  background: '#ffffff',
  borderRadius: 22,
  height: 62,
  display: 'grid',
  placeItems: 'center',
  border: '1px solid #d9ebf8',
  boxShadow: '0 14px 36px rgba(15,23,42,0.05)',
};

const setclappLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
};

const setclappLogo: CSSProperties = {
  width: 116,
  height: 'auto',
  objectFit: 'contain',
};

const pageCenter: CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: '#eef7ff',
  padding: 16,
};

const emptyCard: CSSProperties = {
  width: '100%',
  maxWidth: 500,
  background: '#ffffff',
  borderRadius: 20,
  padding: 24,
  border: '1px solid #e2e8f0',
  boxShadow: '0 18px 52px rgba(71,120,153,0.10)',
  textAlign: 'center',
};