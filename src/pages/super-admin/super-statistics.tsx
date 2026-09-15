import { Avatar, Button, Card, Space, Table, Tag } from 'antd';
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import type { SuperAdminController } from '../../hooks/use-super-admin-controller';
import type { CompanyScanRankingRow } from '../../types/super.type';

type SuperStatisticsProps = {
  controller: SuperAdminController;
};

const statIcons = [
  <ApartmentOutlined key="companies" />,
  <CheckCircleOutlined key="active" />,
  <CloseCircleOutlined key="inactive" />,
  <QrcodeOutlined key="scans" />,
];

export default function SuperStatistics({ controller }: SuperStatisticsProps) {
  const {
    companyScanRanking,
    dashboardStats,
    fetchStatistics,
    loading,
    statisticsLoading,
  } = controller;

  return (
    <div className="super-statistics-page">
      <section className="super-statistics-hero">
        <div>
          <Tag color="blue" className="super-statistics-tag">Super Admin</Tag>
          <h1>Statistika</h1>
          <p>Şirkətlərin aktivlik vəziyyətini və skan sayına görə populyarlıq reytinqini izləyin.</p>
        </div>
        <Button
          icon={<ReloadOutlined />}
          loading={statisticsLoading}
          onClick={() => void fetchStatistics()}
          className="super-statistics-refresh"
        >
          Yenilə
        </Button>
      </section>

      <div className="super-statistics-cards">
        {dashboardStats.map((stat, index) => (
          <Card key={stat.label} className="super-stat-card" loading={loading && index === 0}>
            <div className="super-stat-icon">{statIcons[index]}</div>
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          </Card>
        ))}
      </div>

      <Card className="super-ranking-card" styles={{ body: { padding: 0 } }}>
        <div className="super-ranking-header">
          <div>
            <Space size={9} align="center">
              <TrophyOutlined className="super-ranking-title-icon" />
              <h2>Populyar şirkətlər</h2>
            </Space>
            <p>Skan sayına görə azalan sıra ilə göstərilir.</p>
          </div>
          <Tag color="blue">{companyScanRanking.length} şirkət</Tag>
        </div>

        <Table<CompanyScanRankingRow>
          rowKey="key"
          dataSource={companyScanRanking}
          loading={statisticsLoading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: 'Reytinq üçün skan məlumatı tapılmadı.' }}
          columns={[
            {
              title: '#',
              key: 'rank',
              width: 70,
              render: (_value, _row, index) => <span className="super-rank-number">{index + 1}</span>,
            },
            {
              title: 'Şirkət',
              key: 'company',
              render: (_value, row) => (
                <Space size={12}>
                  <Avatar src={row.logo || undefined} className="super-ranking-logo">
                    {!row.logo && row.companyName.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <div className="super-ranking-company">
                    <strong>{row.companyName}</strong>
                    <span>{row.voen || 'VÖEN yoxdur'}</span>
                  </div>
                </Space>
              ),
            },
            {
              title: 'Status',
              key: 'status',
              width: 130,
              render: (_value, row) => (
                <Tag color={row.isActive ? 'success' : 'default'}>
                  {row.isActive ? 'Aktiv' : 'Deaktiv'}
                </Tag>
              ),
            },
            {
              title: 'Skan sayı',
              dataIndex: 'scanCount',
              width: 150,
              sorter: (left, right) => left.scanCount - right.scanCount,
              defaultSortOrder: 'descend',
              render: (value: number) => <span className="super-scan-count">{value}</span>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
