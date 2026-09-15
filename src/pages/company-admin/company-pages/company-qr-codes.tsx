import { useMemo, useState } from "react";
import { Avatar, Button, Checkbox, Dropdown, Empty, Input, Modal, Pagination, QRCode, Space, Tag, Tooltip, message, } from "antd";
import type { MenuProps } from "antd";
import { DownloadOutlined, FilePdfOutlined, IdcardOutlined, LinkOutlined, MailOutlined, PictureOutlined, SearchOutlined, UserOutlined, } from "@ant-design/icons";
import { buildQrDownloadBlob, downloadFilesAsZip, downloadQrByFormat, getFullName, getQrPayload, getPublicCardUrl, normalizeUserToPublicProfile, openQrPdfPrintPage, } from "../../../features/public-card/public-card";
import { useCompanyAdmin } from "../../../hooks/use-company-admin";
import type { UserData } from "../../../types/company-admin.type";
import type { PublicCardProfile, QrDownloadFormat } from "../../../types/public-card.type";

const cleanText = (value?: string | number | null) => String(value ?? "").trim();

const normalizeSimpleText = (value?: string | number | null) =>
  String(value ?? "").trim().toLowerCase();

const isEmail = (value?: string | number | null) => /@/.test(String(value ?? ""));

const getEmployeeName = (user: UserData) => {
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Əməkdaş";
};

const getUserNameKey = (user: Partial<UserData>) => {
  return [user.firstName, user.lastName, user.middleName]
    .map(normalizeSimpleText)
    .filter(Boolean)
    .join(" ");
};

const isSuperAdminRow = (user: Partial<UserData>) => {
  const role = normalizeSimpleText(user.role);
  const email = normalizeSimpleText(user.email);
  const jobTitle = normalizeSimpleText(user.jobTitle);
  const fullName = getUserNameKey(user);

  return (
    role === "super-admin" ||
    role === "superadmin" ||
    role === "2" ||
    email === "admin@setclapp.com" ||
    (fullName.includes("super") && fullName.includes("admin")) ||
    (jobTitle.includes("system") && jobTitle.includes("admin"))
  );
};

const getRoleLabel = (user: UserData) => {
  const role = normalizeSimpleText(user.role);
  const jobTitle = cleanText(user.jobTitle);

  if (role === "1" || role === "company-admin" || role === "companyadmin") {
    return "Company Admin";
  }

  return jobTitle || "İşçi";
};
export default function CompanyQrCodes() {
  const { company, usersList, fetchUsers } = useCompanyAdmin();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkFormat, setBulkFormat] = useState<QrDownloadFormat>("png");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [previewProfile, setPreviewProfile] = useState<PublicCardProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const handleRefresh = async () => {
    const key = "company-qr-refresh";
    setRefreshing(true);
    message.loading({ key, content: "QR siyahısı yenilənir...", duration: 0 });

    try {
      await fetchUsers();
      message.success({ key, content: "QR siyahısı yeniləndi." });
    } catch {
      message.error({ key, content: "QR siyahısı yenilənmədi." });
    } finally {
      setRefreshing(false);
    }
  };

  const companyUsers = useMemo(
    () => usersList.filter((user) => !isSuperAdminRow(user)),
    [usersList],
  );

  const qrRows = useMemo(() => {
    return companyUsers.map((user) => ({
      user,
      profile: normalizeUserToPublicProfile(user, company),
    }));
  }, [companyUsers, company]);

  const profiles = useMemo(() => qrRows.map(({ profile }) => profile), [qrRows]);

  const QR_PAGE_SIZE = 12;
  const totalQrPages = Math.max(1, Math.ceil(qrRows.length / QR_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalQrPages);
  const visibleQrRows = useMemo(
    () => qrRows.slice(
      (safeCurrentPage - 1) * QR_PAGE_SIZE,
      safeCurrentPage * QR_PAGE_SIZE,
    ),
    [qrRows, safeCurrentPage],
  );

  const selectedProfiles = useMemo(() => {
    const selected = new Set(selectedUserIds);
    return profiles.filter((profile) => selected.has(profile.id));
  }, [profiles, selectedUserIds]);

  const filteredCompanyUsers = useMemo(() => {
    const query = normalizeSimpleText(bulkSearch);

    if (!query) return companyUsers;

    return companyUsers.filter((user) => {
      const profile = normalizeUserToPublicProfile(user, company);
      const searchText = [
        getFullName(profile),
        getRoleLabel(user),
        user.email,
        user.phone1,
        profile.id,
      ]
        .map(normalizeSimpleText)
        .join(" ");

      return searchText.includes(query);
    });
  }, [bulkSearch, company, companyUsers]);

  const allSelected = selectedUserIds.length > 0 && selectedUserIds.length === profiles.length;
  const indeterminate = selectedUserIds.length > 0 && selectedUserIds.length < profiles.length;

  const shouldShowEmails = useMemo(() => {
    if (companyUsers.length === 0) return false;

    return companyUsers.every((user) => {
      const email = cleanText(user.email);
      return isEmail(email);
    });
  }, [companyUsers]);

  const resolveVisibleEmail = (user: UserData) => {
    if (!shouldShowEmails) return "";

    const backendEmail = cleanText(user.email);

    if (isEmail(backendEmail)) {
      return backendEmail;
    }

    return "";
  };

  const openBulkModal = () => {
    if (profiles.length === 0) {
      message.warning("QR kod üçün əməkdaş tapılmadı.");
      return;
    }

    setBulkSearch("");
    setBulkFormat("png");
    setSelectedUserIds(profiles.map((profile) => profile.id));
    setBulkModalOpen(true);
  };

  const handleToggleAllUsers = (checked: boolean) => {
    setSelectedUserIds(checked ? profiles.map((profile) => profile.id) : []);
  };

  const handleToggleUser = (userId: string, checked: boolean) => {
    setSelectedUserIds((current) => {
      if (checked) {
        return current.includes(userId) ? current : [...current, userId];
      }

      return current.filter((id) => id !== userId);
    });
  };

  const getZipFileName = () => {
    const companyName = cleanText(company.name) || "company";
    const safeCompanyName = companyName
      .toLowerCase()
      .replace(/ə/g, "e")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/ğ/g, "g")
      .replace(/ı/g, "i")
      .replace(/ç/g, "c")
      .replace(/ş/g, "s")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "company";

    return `${safeCompanyName}-qr-kodlar.zip`;
  };

  const handleDownload = async (user: UserData, format: QrDownloadFormat) => {
    const profile = normalizeUserToPublicProfile(user, company);
    const key = `${profile.id || user.id}-${format}`;

    try {
      setLoadingKey(key);
      await downloadQrByFormat(profile, format);
      message.success(`Kontakt QR ${format.toUpperCase()} faylı yükləndi.`);
    } finally {
      setLoadingKey(null);
    }
  };

  const downloadMenu = (user: UserData): MenuProps["items"] => [
    {
      key: "png",
      icon: <PictureOutlined />,
      label: "PNG yüklə",
      onClick: () => void handleDownload(user, "png"),
    },
    {
      key: "svg",
      icon: <IdcardOutlined />,
      label: "SVG vektor yüklə",
      onClick: () => void handleDownload(user, "svg"),
    },
    {
      key: "pdf",
      icon: <FilePdfOutlined />,
      label: "PDF fayl yüklə",
      onClick: () => void handleDownload(user, "pdf"),
    },
  ];

  const handleBulkDownload = async () => {
    if (selectedProfiles.length === 0) {
      message.warning("Yükləmək üçün ən azı 1 əməkdaş seçin.");
      return;
    }

    setBulkDownloading(true);

    try {
      if (bulkFormat === "pdf") {
        openQrPdfPrintPage(selectedProfiles);
        message.info("Çap pəncərəsində PDF kimi saxla seçin.");
        setBulkModalOpen(false);
        return;
      }

      if (selectedProfiles.length === 1) {
        const [profile] = selectedProfiles;
        await downloadQrByFormat(profile, bulkFormat);
        message.success("1 QR faylı yükləndi.");
        setBulkModalOpen(false);
        return;
      }

      const fallbackFormat = bulkFormat === "svg" ? "svg" : "png";
      const files: { fileName: string; blob: Blob }[] = [];

      for (const profile of selectedProfiles) {
        const { blob, fileName } = await buildQrDownloadBlob(profile, fallbackFormat);
        files.push({ blob, fileName });
      }

      await downloadFilesAsZip(files, getZipFileName());
      message.success(`${selectedProfiles.length} QR faylı ZIP içində yükləndi.`);
      setBulkModalOpen(false);
    } finally {
      setBulkDownloading(false);
    }
  };

  return (
    <div className="pro-page pro-qr-page" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section
        className="pro-hero"
        style={{
          background: "linear-gradient(135deg, #eaf6ff 0%, #ffffff 100%)",
          borderRadius: 18,
          padding: 24,
          color: "#263445",
          boxShadow: "0 18px 45px rgba(49,46,129,0.22)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: "50%",
            right: -70,
            top: -90,
            background: "#ffffff",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <Tag
              style={{
                border: "1px solid rgba(255,255,255,0.18)",
                color: "#527086",
                background: "#ffffff",
                marginBottom: 10,
              }}
            >
              {company.name}
            </Tag>

            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>QR kodlar</h2>

            <p style={{ margin: "8px 0 0", color: "#6d7f8d", maxWidth: 670 }}>
              Eyni QR kod internet olduqda da, internet olmadıqda da kontakt məlumatlarını açır.
              Şəkil QR-a daxil edilmir.
            </p>
          </div>

          <Space wrap align="center">
            <Button loading={refreshing} onClick={() => void handleRefresh()} style={{ height: 40, borderRadius: 12 }}>
              Yenilə
            </Button>

            <Button
              icon={<DownloadOutlined />}
              onClick={openBulkModal}
              style={{ height: 40, borderRadius: 12, fontWeight: 700 }}
            >
              Hamısını yüklə
            </Button>
          </Space>
        </div>
      </section>

      {companyUsers.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: 42,
          }}
        >
          <Empty description="QR kod üçün əməkdaş tapılmadı" />
        </div>
      ) : (
        <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 10,
          }}
        >
          {visibleQrRows.map(({ user, profile }, index) => {
            const name = getFullName(profile) || getEmployeeName(user);
            const isActive = user.isActive !== false;
            const publicUrl = getPublicCardUrl(profile.id, "QR");
            const qrPayload = getQrPayload(profile);
            const visibleEmail = resolveVisibleEmail(user);
            const visiblePhone = cleanText(user.phone1);
            const cardKey = `${profile.id || user.id || user.email || "employee"}-${(safeCurrentPage - 1) * QR_PAGE_SIZE + index}`;

            return (
              <article
                className="pro-qr-card"
                key={cardKey}
                role="button"
                tabIndex={0}
                onClick={() => setPreviewProfile(profile)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setPreviewProfile(profile);
                  }
                }}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 16,
                  padding: 10,
                  boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  minWidth: 0,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <Space align="start" size={8} style={{ minWidth: 0 }}>
                    <Avatar
                      size={34}
                      style={{
                        background: "linear-gradient(135deg,#4b9ada,#5aa8e8)",
                        flexShrink: 0,
                      }}
                      icon={<UserOutlined />}
                    >
                      {name[0]}
                    </Avatar>

                    <div style={{ minWidth: 0 }}>
                      <div
                        title={name}
                        style={{
                          fontWeight: 800,
                          color: "#263445",
                          fontSize: 15,
                          lineHeight: 1.2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 155,
                        }}
                      >
                        {name}
                      </div>

                      <div
                        title={getRoleLabel(user)}
                        style={{
                          color: "#64748b",
                          fontSize: 12,
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 155,
                        }}
                      >
                        {getRoleLabel(user)}
                      </div>
                    </div>
                  </Space>

                  <Tag color={isActive ? "success" : "default"} style={{ marginInlineEnd: 0 }}>
                    {isActive ? "Aktiv" : "Deaktiv"}
                  </Tag>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewProfile(profile)}
                  aria-label={`${name} QR kodunu böyük göstər`}
                  style={{
                    border: "1px solid #e6f4ff",
                    background: "linear-gradient(180deg,#fff,#f8fafc)",
                    borderRadius: 14,
                    padding: 10,
                    minHeight: 145,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    cursor: "zoom-in",
                    width: "100%",
                  }}
                >
                  <QRCode value={qrPayload} size={125} bordered={false} errorLevel="M" />
                </button>

                <div style={{ display: "grid", gap: 7, color: "#475569", fontSize: 12 }}>
                  {visibleEmail && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <MailOutlined style={{ color: "#4b9ada", flexShrink: 0 }} />
                      <span
                        title={visibleEmail}
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {visibleEmail}
                      </span>
                    </div>
                  )}

                  {visiblePhone && visiblePhone !== "-" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <IdcardOutlined style={{ color: "#5aa8e8", flexShrink: 0 }} />
                      <span
                        title={visiblePhone}
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {visiblePhone}
                      </span>
                    </div>
                  )}

                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    title={publicUrl}
                    style={{
                      color: "#2563eb",
                      fontSize: 11,
                      wordBreak: "break-all",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                      lineHeight: 1.3,
                    }}
                  >
                    <LinkOutlined style={{ marginTop: 2, flexShrink: 0 }} />
                    <span>{publicUrl}</span>
                  </a>
                </div>

                <Tooltip title="QR kodu PNG, SVG və ya PDF formatında al">
                  <Dropdown menu={{ items: downloadMenu(user) }} placement="bottomRight">
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      loading={Boolean(loadingKey?.startsWith(profile.id || user.id))}
                      onClick={(event) => event.stopPropagation()}
                      style={{ borderRadius: 10, height: 34, fontWeight: 700 }}
                      block
                    >
                      QR kodu yüklə
                    </Button>
                  </Dropdown>
                </Tooltip>
              </article>
            );
          })}
        </div>

        {qrRows.length > QR_PAGE_SIZE && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
            <Pagination
              current={safeCurrentPage}
              pageSize={QR_PAGE_SIZE}
              total={qrRows.length}
              showSizeChanger={false}
              onChange={setCurrentPage}
            />
          </div>
        )}
        </>
      )}

      <Modal
        centered
        open={Boolean(previewProfile)}
        onCancel={() => setPreviewProfile(null)}
        footer={null}
        title={previewProfile ? `${getFullName(previewProfile) || "Əməkdaş"} QR kodu` : "QR kod"}
        width={430}
        destroyOnHidden
      >
        {previewProfile && (
          <div style={{ display: "grid", gap: 16, justifyItems: "center", textAlign: "center" }}>
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 18,
                padding: 20,
                background: "linear-gradient(180deg,#fff,#f8fafc)",
                boxShadow: "0 16px 34px rgba(15,23,42,0.08)",
              }}
            >
              <QRCode value={getQrPayload(previewProfile)} size={250} bordered={false} errorLevel="M" />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#263445", fontWeight: 900, fontSize: 18 }}>
                {getFullName(previewProfile) || "Əməkdaş"}
              </div>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                {previewProfile.jobTitle || "İşçi"}
              </div>
              <Tag color="green" style={{ marginTop: 8, marginInlineEnd: 0 }}>
                Şəkilsiz kontakt · internetlə və internetsiz işləyir
              </Tag>
            </div>

            <Space wrap style={{ justifyContent: "center" }}>
              <Button onClick={() => setPreviewProfile(null)} style={{ borderRadius: 10 }}>
                Bağla
              </Button>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: "png",
                      icon: <PictureOutlined />,
                      label: "PNG yüklə",
                      onClick: () => void downloadQrByFormat(previewProfile, "png"),
                    },
                    {
                      key: "svg",
                      icon: <IdcardOutlined />,
                      label: "SVG yüklə",
                      onClick: () => void downloadQrByFormat(previewProfile, "svg"),
                    },
                  ],
                }}
                placement="bottomRight"
              >
                <Button type="primary" icon={<DownloadOutlined />} style={{ borderRadius: 10, fontWeight: 800 }}>
                  QR yüklə
                </Button>
              </Dropdown>
            </Space>
          </div>
        )}
      </Modal>

      <Modal
        open={bulkModalOpen}
        onCancel={() => setBulkModalOpen(false)}
        footer={null}
        title="QR kodları seç və yüklə"
        width={720}
        destroyOnHidden
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Checkbox
              checked={allSelected}
              indeterminate={indeterminate}
              onChange={(event) => handleToggleAllUsers(event.target.checked)}
            >
              Hamısını seç ({selectedUserIds.length}/{profiles.length})
            </Checkbox>

            <select
              value={bulkFormat}
              onChange={(event) => setBulkFormat(event.target.value as QrDownloadFormat)}
              style={{
                height: 36,
                border: "1px solid #d9d9d9",
                borderRadius: 10,
                padding: "0 12px",
                color: "#263445",
                background: "#fff",
                fontWeight: 700,
              }}
            >
              <option value="png">PNG fayl</option>
              <option value="svg">SVG fayl</option>
              <option value="pdf">PDF fayl</option>
            </select>
          </div>

          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Ad, email, telefon və ya ID üzrə axtar"
            value={bulkSearch}
            onChange={(event) => setBulkSearch(event.target.value)}
            style={{ borderRadius: 12 }}
          />

          <div
            style={{
              maxHeight: 430,
              overflow: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              background: "#f8fafc",
              padding: 8,
            }}
          >
            {filteredCompanyUsers.length === 0 ? (
              <Empty description="Axtarışa uyğun əməkdaş tapılmadı" />
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {filteredCompanyUsers.map((user, index) => {
                  const profile = normalizeUserToPublicProfile(user, company);
                  const name = getFullName(profile) || getEmployeeName(user);
                  const roleLabel = getRoleLabel(user);
                  const isChecked = selectedUserIds.includes(profile.id);
                  const rowKey = `${profile.id || user.id || user.email || "employee"}-bulk-${index}`;

                  return (
                    <div
                      key={rowKey}
                      role="group"
                      aria-label={`${name} seçimi`}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        padding: 10,
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        background: isChecked ? "#e6f4ff" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <Checkbox
                        aria-label={`${name} seç`}
                        checked={isChecked}
                        onChange={(event) => handleToggleUser(profile.id, event.target.checked)}
                      />

                      <Avatar
                        size={34}
                        style={{ background: "linear-gradient(135deg,#4b9ada,#5aa8e8)" }}
                        icon={<UserOutlined />}
                      >
                        {name[0]}
                      </Avatar>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          title={name}
                          style={{
                            color: "#263445",
                            fontWeight: 800,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {name}
                        </div>
                        <div
                          title={`${roleLabel}${user.email ? ` • ${user.email}` : ""}`}
                          style={{
                            color: "#64748b",
                            fontSize: 12,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {roleLabel}
                          {user.email ? ` • ${user.email}` : ""}
                        </div>
                      </div>

                      <Tag color={user.isActive !== false ? "success" : "default"} style={{ marginInlineEnd: 0 }}>
                        {user.isActive !== false ? "Aktiv" : "Deaktiv"}
                      </Tag>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={() => setBulkModalOpen(false)} style={{ borderRadius: 10 }}>
              Bağla
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={bulkDownloading}
              disabled={selectedProfiles.length === 0}
              onClick={() => void handleBulkDownload()}
              style={{ borderRadius: 10, fontWeight: 800 }}
            >
              {selectedProfiles.length > 1 ? "Seçilənləri ZIP yüklə" : "Seçiləni yüklə"} ({selectedProfiles.length})
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
