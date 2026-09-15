import { Card, Col, Row, Space, Tag } from 'antd';
import {CheckCircleOutlined,InfoCircleOutlined,QrcodeOutlined,SafetyCertificateOutlined,TeamOutlined,ThunderboltOutlined,} from '@ant-design/icons';

const quickCards = [
  {
    icon: <TeamOutlined />,
    title: 'Rol sistemi',
    text: 'Super Admin, Company Admin və əməkdaş girişləri ayrı idarə olunur.',
  },
  {
    icon: <QrcodeOutlined />,
    title: 'Rəqəmsal kart',
    text: 'Vizitkart, əlaqə və QR paylaşımı bir paneldə toplanır.',
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: 'Təhlükəsizlik',
    text: 'Səlahiyyət, audit və giriş nəzarəti daim izlənir.',
  },
  {
    icon: <ThunderboltOutlined />,
    title: 'Sürətli idarəetmə',
    text: 'Şirkət, limit və admin məlumatları rahat yenilənir.',
  },
];

export default function SuperInfo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div
        className="super-info-hero"
        style={{
          background: 'linear-gradient(135deg,#0f172a 0%,#312e81 58%,#6d28d9 100%)',
          borderRadius: 26,
          padding: '28px 30px',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(49,46,129,0.24)',
        }}
      >
        <div style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', right: 120, bottom: -70, width: 180, height: 180, borderRadius: '50%', background: 'rgba(129,140,248,0.18)' }} />

        <div
          className="super-info-hero-grid"
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, 0.9fr)',
            gap: 24,
            alignItems: 'center',
          }}
        >
          <div>
            <Tag color="blue" icon={<InfoCircleOutlined />} style={{ borderRadius: 999, marginBottom: 12 }}>
              SetClapp haqqında
            </Tag>
            <h1 className="super-info-title" style={{ margin: 0, color: '#fff', fontSize: 34, fontWeight: 950, letterSpacing: -0.6 }}>
              SetClapp idarəetmə panelinə xoş gəldiniz
            </h1>
            <p style={{ margin: '12px 0 0', color: '#ddd6fe', fontSize: 15, lineHeight: 1.7, maxWidth: 700 }}>
              Bu panel vasitəsilə şirkətləri yaratmaq, admin hesablarını bağlamaq, əməkdaş limitlərini idarə etmək və bütün dəyişiklikləri rahat izləmək mümkündür.
            </p>

            <Space wrap size={[10, 10]} style={{ marginTop: 18 }}>
              <Tag color="success" style={{ borderRadius: 999, paddingInline: 12, lineHeight: '28px' }}>Şirkət idarəetməsi</Tag>
              <Tag color="processing" style={{ borderRadius: 999, paddingInline: 12, lineHeight: '28px' }}>Audit nəzarəti</Tag>
              <Tag color="purple" style={{ borderRadius: 999, paddingInline: 12, lineHeight: '28px' }}>Rəqəmsal vizitkart</Tag>
            </Space>
          </div>

          <div
            className="super-info-logo-panel"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: 24,
              padding: 24,
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <img
                src="/setclapp-logo.svg"
                alt="SetClapp"
                style={{ width: 'min(100%, 260px)', height: 'auto', filter: 'drop-shadow(0 10px 24px rgba(15,23,42,0.18))' }}
              />
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#eef2ff' }}>
                <CheckCircleOutlined style={{ color: '#86efac' }} />
                <span>Şirkət və admin məlumatları bir yerdə</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#eef2ff' }}>
                <CheckCircleOutlined style={{ color: '#93c5fd' }} />
                <span>Limitlər və girişlər rahat idarə olunur</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#eef2ff' }}>
                <CheckCircleOutlined style={{ color: '#c4b5fd' }} />
                <span>Dəyişikliklər audit bölməsində izlənir</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Row gutter={[18, 18]}>
        {quickCards.map((item) => (
          <Col xs={24} sm={12} xl={6} key={item.title}>
            <Card style={{ borderRadius: 22, border: '1px solid #e2e8f0', boxShadow: '0 12px 30px rgba(15,23,42,0.05)', height: '100%' }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 18,
                  background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)',
                  color: '#4f46e5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  marginBottom: 16,
                }}
              >
                {item.icon}
              </div>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: 18, fontWeight: 900 }}>{item.title}</h3>
              <p style={{ margin: '10px 0 0', color: '#64748b', lineHeight: 1.7 }}>{item.text}</p>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
