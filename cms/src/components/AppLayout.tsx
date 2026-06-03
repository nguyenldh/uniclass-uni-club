import { useState } from 'react';
import { Layout, Menu, Button, Typography, Avatar, Dropdown } from 'antd';
import {
  DashboardOutlined,
  SettingOutlined,
  RobotOutlined,
  QuestionCircleOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

function getItem(
  label: React.ReactNode,
  key: string,
  icon?: React.ReactNode,
  children?: MenuItem[]
): MenuItem {
  return { key, icon, children, label } as MenuItem;
}

const menuItems: MenuItem[] = [
  getItem('Dashboard', '/', <DashboardOutlined />),
  getItem('Mind Game', 'mind-game', <SettingOutlined />, [
    getItem('Gomoku', '/mind-game/gomoku'),
    getItem('Card Flip', '/mind-game/card-flip'),
  ]),
  getItem('Quiz Arena', 'quiz-arena', <QuestionCircleOutlined />, [
    getItem('Cấu hình', '/quiz-arena/config'),
    getItem('Ngân hàng câu hỏi', '/quiz-arena/questions'),
  ]),
  getItem('Săn Boss', 'boss-battle', <FireOutlined />, [
    getItem('Cấu hình mặc định', '/boss-battle/config'),
    getItem('Cấu hình tuần', '/boss-battle/weekly-config'),
    getItem('Ngân hàng câu hỏi', '/boss-battle/questions'),
    getItem('Theo dõi', '/boss-battle/monitor'),
  ]),
  getItem('Bot Profiles', '/bot-profiles', <RobotOutlined />),
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, logout } = useAuthStore();

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      onClick: handleLogout,
    },
  ];

  // Tính selected keys cho menu
  const selectedKeys = [location.pathname];
  const openKeys = location.pathname.startsWith('/mind-game')
    ? ['mind-game']
    : location.pathname.startsWith('/quiz-arena')
    ? ['quiz-arena']
    : location.pathname.startsWith('/boss-battle')
    ? ['boss-battle']
    : [];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="dark"
        width={240}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Typography.Title
            level={4}
            style={{ color: '#fff', margin: 0 }}
          >
            {collapsed ? 'UC' : 'UniClub CMS'}
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} />
              <span>{admin?.name || admin?.username}</span>
            </div>
          </Dropdown>
        </Header>

        <Content
          style={{
            margin: 24,
            padding: 24,
            background: '#fff',
            borderRadius: 8,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default AppLayout;
