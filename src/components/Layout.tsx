import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Avatar, Button, Divider, Form, Input, message, Modal, Popover, Space, Tag, Tooltip } from "antd";
import {ClockCircleOutlined,LockOutlined,LogoutOutlined,MenuFoldOutlined,MenuUnfoldOutlined,SafetyCertificateOutlined,SettingOutlined,UserOutlined,} from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router";
import type { AppLayoutProps } from "../types/layout.type";
import type { ChangePasswordRequest } from "../types/auth.type";
import { authOperations } from "../helpers/auth.helper";
import { ROLE_CONFIG } from "./menu-items";
import CompanyAdminProfileView from "./company-admin-profile-view";

export default function AppLayout({
  role,
  children,
  onLogout,
  titleSuffix,
  userName,
  avatarText,
  avatarSrc,
  profileDetails = [],
  profileInitialValues,
  onSaveProfile,
  onUploadProfilePhoto,
  onUploadCardBackground,
  onUploadSocialIcon,
  companyLogo,
  companyInfoPath = "/company-admin/company",
}: AppLayoutProps) {
  const getIsMobileLayout = () => typeof window !== "undefined" && window.innerWidth <= 768;

  const [isMobileLayout, setIsMobileLayout] = useState(getIsMobileLayout);
  const [collapsed, setCollapsed] = useState(getIsMobileLayout);
  const [compactMenuOpen, setCompactMenuOpen] = useState(false);
  const [routeSwitching, setRouteSwitching] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const [passwordForm] = Form.useForm<ChangePasswordRequest>();
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const compactSidebarRef = useRef<HTMLElement>(null);
  const compactScreenRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const config = ROLE_CONFIG[role];

  useEffect(() => {
    let previousIsMobile = getIsMobileLayout();

    const handleResize = () => {
      const nextIsMobile = getIsMobileLayout();
      setIsMobileLayout(nextIsMobile);
      if (nextIsMobile && !previousIsMobile) {
        setCollapsed(true);
      }
      previousIsMobile = nextIsMobile;
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const activeItem = useMemo(() => {
    return (
      [...config.menu]
        .sort((a, b) => b.path.length - a.path.length)
        .find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) || config.menu[0]
    );
  }, [config.menu, location.pathname]);

  const mobileCollapsedSideW = 52;
  const mobileExpandedSideW = "80vw";
  const desktopSideW = collapsed ? 72 : 240;
  const sideW = isMobileLayout ? (collapsed ? mobileCollapsedSideW : mobileExpandedSideW) : desktopSideW;
  const mainOffset = isMobileLayout ? mobileCollapsedSideW : desktopSideW;
  const displayName = userName || config.userTitle;
  const profileVoen = profileDetails.find((item) => /v[öo]en/i.test(item.label))?.value || "";
  const initials = avatarText || config.logo;
  const sidebarTopPadding = collapsed ? (isMobileLayout ? "20px 8px" : "24px 16px") : isMobileLayout ? "22px 16px" : "24px 20px";
  const mainContentPadding = isMobileLayout ? 12 : 28;
  const isLightTheme = role === "employee" || role === "super-admin";
  const accentGradient = role === "company-admin" || isLightTheme
    ? "linear-gradient(135deg, #dff1ff, #5aa8e8)"
    : "linear-gradient(135deg, #6366f1, #8b5cf6)";
  const accentColor = role === "company-admin" || isLightTheme ? "#4b9ada" : "#6366f1";
  const sidebarBackground = isLightTheme
    ? "linear-gradient(180deg, #e7f4fc 0%, #f4f9fc 100%)"
    : "linear-gradient(180deg, #1e1b4b 0%, #312e81 60%, #4c1d95 100%)";
  const sidebarBorder = isLightTheme ? "1px solid #c9deea" : "none";
  const sidebarDivider = isLightTheme ? "1px solid rgba(89,139,172,0.22)" : "1px solid rgba(255,255,255,0.08)";
  const sidebarLogoBackground = isLightTheme
    ? "linear-gradient(135deg, #dff1ff 0%, #8cc7ef 100%)"
    : "linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)";
  const sidebarLogoColor = isLightTheme ? "#234d68" : "#fff";
  const sidebarLogoShadow = isLightTheme
    ? "0 8px 20px rgba(35,78,104,0.12)"
    : "0 2px 12px rgba(99,102,241,0.4)";
  const sidebarTitleColor = isLightTheme ? "#263445" : "#fff";
  const sidebarSubtitleColor = isLightTheme ? "#6d8191" : "#a5b4fc";
  const sidebarInactiveColor = isLightTheme ? "#527086" : "#94a3b8";
  const sidebarActiveColor = isLightTheme ? "#234d68" : "#c7d2fe";
  const sidebarHoverBackground = isLightTheme ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.05)";
  const sidebarHoverColor = isLightTheme ? "#234d68" : "#e0e7ff";
  const sidebarActiveBackground = isLightTheme
    ? "rgba(255,255,255,0.88)"
    : "linear-gradient(90deg, rgba(129,140,248,0.25) 0%, rgba(167,139,250,0.12) 100%)";
  const sidebarActiveBorder = isLightTheme ? "#4b9ada" : "#818cf8";

  const openPasswordModal = () => {
    setProfileOpen(false);
    setPasswordModalOpen(true);
  };

  const closeCompactMenu = () => {
    const activeElement = document.activeElement;

    if (
      activeElement instanceof HTMLElement &&
      compactSidebarRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }

    setCompactMenuOpen(false);

    window.requestAnimationFrame(() => {
      menuTriggerRef.current?.focus();
    });
  };

  useEffect(() => {
    const sidebar = compactSidebarRef.current as (HTMLElement & { inert: boolean }) | null;

    if (!sidebar) return;
    sidebar.inert = !compactMenuOpen;
  }, [compactMenuOpen]);

  const openProfileInfo = () => {
    setProfileOpen(false);
    setShowAdminProfile(true);
    closeCompactMenu();
  };

  const navigateCompanyAdminPage = (path: string) => {
    if (location.pathname === path && !showAdminProfile) {
      closeCompactMenu();
      return;
    }
    flushSync(() => {
      setRouteSwitching(true);
      setCompactMenuOpen(false);
      setShowAdminProfile(false);
      navigate(path);
    });

    compactScreenRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    window.requestAnimationFrame(() => {
      setRouteSwitching(false);
      menuTriggerRef.current?.focus();
    });
  };

  useLayoutEffect(() => {
    if (role !== "company-admin") return;

    compactScreenRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, role, showAdminProfile]);

  const handlePasswordChange = async (values: ChangePasswordRequest) => {
    setPasswordLoading(true);

    try {
      await authOperations.changePassword(values);
      message.success("Şifrə uğurla yeniləndi.");
      passwordForm.resetFields();
      setPasswordModalOpen(false);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Şifrə dəyişdirilmədi.";
      message.error(text);
    } finally {
      setPasswordLoading(false);
    }
  };
  const profileContent = (
    <div style={{ width: 290 }}>
      <Space align="center" style={{ width: "100%", marginBottom: 12 }}>
        <Avatar size={44} src={avatarSrc || undefined} style={{ background: accentGradient }}>
          {!avatarSrc && initials}
        </Avatar>
        <div>
          <div style={{ color: "#0f172a", fontWeight: 900, fontSize: 15 }}>{displayName}</div>
          <Tag color={config.tagColor} style={{ margin: "6px 0 0", borderRadius: 999 }}>
            {config.userTag}{role === "company-admin" && profileVoen && profileVoen !== "-" ? ` · VÖEN: ${profileVoen}` : ""}
          </Tag>
        </div>
      </Space>

      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", color: "#475569", marginBottom: 8 }}>
          <SafetyCertificateOutlined style={{ color: "#16a34a" }} />
          <span style={{ fontSize: 13 }}>Sessiya aktivdir və hesab qorunur</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", color: "#475569" }}>
          <ClockCircleOutlined style={{ color: accentColor }} />
          <span style={{ fontSize: 13 }}>Profil ayarlarını buradan idarə edin</span>
        </div>
      </div>

      <Divider style={{ margin: "12px 0" }} />

      <Button icon={<LockOutlined />} block onClick={openPasswordModal} style={{ borderRadius: 10, height: 38, fontWeight: 700 }}>
        Şifrəni dəyiş
      </Button>

      <Button
        icon={<LogoutOutlined />}
        danger
        block
        onClick={() => {
          setProfileOpen(false);
          onLogout();
        }}
        style={{ borderRadius: 10, height: 38, fontWeight: 700, marginTop: 8 }}
      >
        Çıxış
      </Button>
    </div>
  );
  const passwordChangeModal = (
    <Modal
      title="Şifrəni dəyiş"
      open={passwordModalOpen}
      onCancel={() => setPasswordModalOpen(false)}
      footer={null}
      destroyOnHidden
    >
      <div style={{ color: "#64748b", marginBottom: 16 }}>
        Hesab təhlükəsizliyi üçün köhnə şifrəni və yeni şifrəni daxil edin.
      </div>
      <Form<ChangePasswordRequest>
        form={passwordForm}
        layout="vertical"
        onFinish={handlePasswordChange}
        autoComplete="off"
      >
        <Form.Item name="currentPassword" label="Köhnə şifrə / kod" rules={[{ required: true, message: "Köhnə şifrə tələb olunur" }]}>
          <Input.Password prefix={<LockOutlined />} placeholder="Köhnə şifrə / kod" />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label="Yeni şifrə"
          rules={[
            { required: true, message: "Yeni şifrə tələb olunur" },
            { min: 6, message: "Şifrə ən azı 6 simvol olmalıdır" },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Yeni şifrə" />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Yeni şifrə təkrar"
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
          <Input.Password prefix={<LockOutlined />} placeholder="Yeni şifrə təkrar" />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={passwordLoading} icon={<UserOutlined />} block style={{ height: 40, borderRadius: 10, fontWeight: 800 }}>
          Şifrəni yenilə
        </Button>
      </Form>
    </Modal>
  );

  if (role === "company-admin") {
    return (
      <div className={`ca-compact-root ${compactMenuOpen ? "ca-menu-open" : ""} ${routeSwitching ? "ca-route-switching" : ""}`}>
        <div className="ca-compact-device">
          <button
            type="button"
            aria-label="Menyunu bağla"
            className="ca-menu-backdrop"
            onClick={closeCompactMenu}
          />

          <aside id="company-admin-sidebar" ref={compactSidebarRef} className="ca-compact-sidebar">
            <div className="ca-sidebar-profile">
              <button
                type="button"
                className={`ca-sidebar-admin-button ${showAdminProfile ? "is-selected" : ""}`}
                onClick={openProfileInfo}
              >
                <Avatar size={58} src={avatarSrc || undefined} className="ca-sidebar-avatar">
                  {!avatarSrc && initials}
                </Avatar>
                <span className="ca-sidebar-profile-text">
                  <strong>{displayName}</strong>
                  <small>Öz məlumatlarım</small>
                </span>
              </button>

              {titleSuffix && (
                <button
                  type="button"
                  className={`ca-sidebar-company-button ${!showAdminProfile && activeItem.key === "company" ? "is-selected" : ""}`}
                  onClick={() => {
                    navigateCompanyAdminPage(companyInfoPath);
                  }}
                >
                  {titleSuffix}
                </button>
              )}

            </div>

            <nav className="ca-sidebar-nav">
              {config.menu
                .filter((item) => item.key !== "company")
                .map((item) => {
                const isActive = !showAdminProfile && activeItem.key === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`ca-sidebar-link ${isActive ? "is-active" : ""}`}
                    onClick={() => {
                      navigateCompanyAdminPage(item.path);
                    }}
                  >
                    <span className="ca-sidebar-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="ca-sidebar-brand">
              <a
                className="ca-sidebar-brand-link"
                href="https://www.setclapp.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SetClapp saytını aç"
              >
                <img src="/setclapp-logo-without-text.svg" alt="SetClapp" />
                <span>SetClapp</span>
              </a>
              <small>© 2019–2026 SetClapp MMC<br />Bütün hüquqlar qorunur.</small>
            </div>

            <button type="button" className="ca-sidebar-logout" onClick={onLogout}>
              <LogoutOutlined />
              <span>Çıxış</span>
            </button>
          </aside>

          <main ref={compactScreenRef} className="ca-compact-screen">
            <header className="ca-compact-topbar">
              <button
                ref={menuTriggerRef}
                type="button"
                className="ca-menu-trigger"
                aria-label="Menyunu aç"
                aria-expanded={compactMenuOpen}
                aria-controls="company-admin-sidebar"
                onClick={() => setCompactMenuOpen(true)}
              >
                <span />
                <span />
                <span />
              </button>

              <div className="ca-topbar-title">
                <strong>{showAdminProfile ? "Öz məlumatlarım" : activeItem.label}</strong>
                <span>{showAdminProfile ? "CompanyAdmin profili" : titleSuffix}</span>
              </div>

              <div className="ca-topbar-actions">
                <Popover content={profileContent} trigger="click" open={profileOpen} onOpenChange={setProfileOpen} placement="bottomRight">
                  <button type="button" className="ca-profile-pill">
                    <Avatar size={30} src={avatarSrc || undefined} className="ca-profile-avatar">
                      {!avatarSrc && initials}
                    </Avatar>
                    <SettingOutlined />
                  </button>
                </Popover>
              </div>
            </header>

            <section className={`ca-compact-content ${showAdminProfile ? "ca-profile-content" : ""}`}>
              {showAdminProfile ? (
                <CompanyAdminProfileView
                  displayName={displayName}
                  companyName={titleSuffix}
                  avatarSrc={avatarSrc}
                  initials={initials}
                  profileDetails={profileDetails}
                  initialValues={profileInitialValues}
                  onSave={onSaveProfile}
                  onUploadPhoto={onUploadProfilePhoto}
                  onUploadCardBackground={onUploadCardBackground}
                  onUploadSocialIcon={onUploadSocialIcon}
                  companyLogo={companyLogo}
                />
              ) : children}
            </section>
          </main>
        </div>

        {passwordChangeModal}
      </div>
    );
  }

  return (
    <div className={`app-layout-root ${isLightTheme ? "employee-layout-theme" : ""} ${role === "super-admin" ? "super-admin-layout-theme" : ""}`} style={{ display: "flex", minHeight: "100vh", background: isLightTheme ? "#eef7ff" : "#f1f5f9", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <aside
        className="app-sidebar"
        style={{
          width: sideW,
          minHeight: "100vh",
          background: sidebarBackground,
          borderRight: sidebarBorder,
          boxShadow: isLightTheme ? "18px 0 50px rgba(35,78,104,0.10)" : undefined,
          display: "flex",
          flexDirection: "column",
          transition: "width 0.25s cubic-bezier(.4,0,.2,1)",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: sidebarTopPadding, display: "flex", alignItems: "center", gap: 12, borderBottom: sidebarDivider, minHeight: 72, position: "relative" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: sidebarLogoBackground,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: sidebarLogoColor,
              fontSize: 16,
              flexShrink: 0,
              boxShadow: sidebarLogoShadow,
            }}
          >
            {config.logo}
          </div>
          {!collapsed && (
            <div>
              <div style={{ color: sidebarTitleColor, fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{config.brand}</div>
              <div style={{ color: sidebarSubtitleColor, fontSize: 11 }}>{config.brandSub}</div>
            </div>
          )}
          {isMobileLayout && !collapsed && (
            <button
              aria-label="Menyunu bağla"
              onClick={() => setCollapsed(true)}
              style={{
                position: "absolute",
                right: 12,
                top: 18,
                width: 34,
                height: 34,
                border: isLightTheme ? "1px solid #c9deea" : "1px solid rgba(255,255,255,0.14)",
                borderRadius: 10,
                background: isLightTheme ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.08)",
                color: isLightTheme ? "#45677d" : "#e0e7ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <MenuFoldOutlined />
            </button>
          )}
        </div>

        <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {config.menu.map((item) => {
            const isActive = activeItem.key === item.key;
            return (
              <Tooltip key={item.key} title={collapsed ? item.label : ""} placement="right">
                <button
                  onClick={() => {
                    navigate(item.path);
                    if (isMobileLayout) setCollapsed(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: collapsed ? "11px 0" : "11px 14px",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    background: isActive ? sidebarActiveBackground : "transparent",
                    color: isActive ? sidebarActiveColor : sidebarInactiveColor,
                    fontWeight: isActive ? 600 : 400,
                    fontSize: 14,
                    transition: "all 0.15s",
                    width: "100%",
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderLeft: isActive ? `3px solid ${sidebarActiveBorder}` : "3px solid transparent",
                    boxShadow: isActive && isLightTheme ? "0 8px 22px rgba(35,78,104,0.07)" : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = sidebarHoverBackground;
                      e.currentTarget.style.color = sidebarHoverColor;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = sidebarInactiveColor;
                    }
                  }}
                >
                  <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
                  {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
                </button>
              </Tooltip>
            );
          })}
        </nav>

        <div style={{ padding: collapsed ? "16px 10px" : "16px 16px", borderTop: sidebarDivider }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: collapsed ? "center" : "flex-start" }}>
            <Avatar src={avatarSrc || undefined} style={{ background: accentGradient, flexShrink: 0 }}>
              {!avatarSrc && initials}
            </Avatar>
            {!collapsed && (
              <div>
                <div style={{ color: isLightTheme ? "#263445" : "#e0e7ff", fontSize: 13, fontWeight: 600 }}>{displayName}</div>
                <div style={{ display: "inline-block", background: isLightTheme ? "rgba(90,168,232,0.16)" : "rgba(52,211,153,0.18)", color: isLightTheme ? "#35627f" : "#34d399", fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 20, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>{config.userStatus}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main
        className="app-main"
        style={{
          marginLeft: mainOffset,
          flex: 1,
          width: isMobileLayout ? `calc(100vw - ${mobileCollapsedSideW}px)` : undefined,
          maxWidth: isMobileLayout ? `calc(100vw - ${mobileCollapsedSideW}px)` : undefined,
          overflowX: isMobileLayout ? "hidden" : undefined,
          transition: "margin-left 0.25s cubic-bezier(.4,0,.2,1)",
          minHeight: "100vh",
          boxSizing: "border-box",
        }}
      >
        <header className="app-header" style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobileLayout ? "0 10px" : "0 28px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 90, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: isMobileLayout ? 10 : 16, minWidth: 0 }}>
            <button
              onClick={() => setCollapsed((value) => !value)}
              style={{ border: "none", background: "#f8fafc", borderRadius: 8, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 16, transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e2e8f0")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f8fafc")}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <span style={{ color: "#1e293b", fontWeight: 700, fontSize: isMobileLayout ? 17 : 18, whiteSpace: "nowrap" }}>{activeItem.label}</span>
              {titleSuffix && !isMobileLayout && <span style={{ color: "#94a3b8", fontSize: 13, marginLeft: 10 }}>/ {titleSuffix}</span>}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: isMobileLayout ? 6 : 12, flexShrink: 0 }}>
            <Popover content={profileContent} trigger="click" open={profileOpen} onOpenChange={setProfileOpen} placement="bottomRight">
              <button style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", padding: isMobileLayout ? "5px" : "6px 12px 6px 6px", borderRadius: 20, border: "1px solid #e2e8f0", cursor: "pointer" }}>
                <Avatar size={28} src={avatarSrc || undefined} style={{ background: accentGradient }}>
                  {!avatarSrc && initials}
                </Avatar>
                {!isMobileLayout && <span style={{ color: "#1e293b", fontWeight: 600, fontSize: 13 }}>{displayName}</span>}
                {!isMobileLayout && <Tag color={config.tagColor} style={{ margin: 0, fontSize: 10, padding: "0 6px", lineHeight: "18px" }}>{config.userTag}</Tag>}
                {!isMobileLayout && <SettingOutlined style={{ color: "#94a3b8" }} />}
              </button>
            </Popover>
          </div>
        </header>

        <div className="app-content" style={{ padding: mainContentPadding }}>{children}</div>
      </main>

      {passwordChangeModal}
    </div>
  );
}
