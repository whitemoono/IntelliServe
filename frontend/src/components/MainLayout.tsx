import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '../stores/authStore'

type NavKey =
  | 'dashboard'
  | 'assets'
  | 'ipam'
  | 'software-catalog'
  | 'printers'
  | 'tickets'
  | 'monitoring'
  | 'network'
  | 'ai-gateway'
  | 'knowledge'
  | 'automation'
  | 'chatbot'
  | 'sandbox'
  | 'licenses'
  | 'reports'
  | 'departments'
  | 'users'
  | 'settings'

const navItems: { section: string; items: { key: NavKey; label: string; badge?: number; icon: string }[] }[] = [
  {
    section: '概览',
    items: [{ key: 'dashboard', label: '仪表盘', icon: 'dashboard' }],
  },
  {
    section: '运维管理',
    items: [
      { key: 'assets', label: '资产管理', icon: 'assets' },
      { key: 'ipam', label: 'IPAM 地址管理', icon: 'ipam' },
      { key: 'software-catalog', label: '软件库', icon: 'software' },
      { key: 'printers', label: '打印机与驱动', icon: 'printers' },
      { key: 'tickets', label: '工单管理', icon: 'tickets', badge: 12 },
      { key: 'monitoring', label: '监控中心', icon: 'monitoring' },
      { key: 'network', label: '网络拓扑', icon: 'network' },
    ],
  },
  {
    section: '智能服务',
    items: [
      { key: 'ai-gateway', label: 'AI 资产管家', icon: 'gateway' },
      { key: 'knowledge', label: '知识库', icon: 'knowledge' },
      { key: 'automation', label: '自动化引擎', icon: 'automation' },
      { key: 'chatbot', label: 'AI 助手', icon: 'chatbot' },
      { key: 'sandbox', label: '沙箱任务', icon: 'sandbox' },
    ],
  },
  {
    section: '管理',
    items: [
      { key: 'licenses', label: '软件许可', icon: 'licenses' },
      { key: 'reports', label: '报表分析', icon: 'reports' },
      { key: 'departments', label: '部门管理', icon: 'departments' },
      { key: 'users', label: '用户管理', icon: 'users' },
      { key: 'settings', label: '系统设置', icon: 'settings' },
    ],
  },
]

const iconMap: Record<string, ReactNode> = {
  dashboard: <BoxIcon />,
  assets: <AssetIcon />,
  ipam: <IpamIcon />,
  software: <SoftwareIcon />,
  printers: <PrinterIcon />,
  tickets: <TicketIcon />,
  monitoring: <MonitoringIcon />,
  network: <NetworkIcon />,
  gateway: <GatewayIcon />,
  knowledge: <KnowledgeIcon />,
  automation: <AutomationIcon />,
  chatbot: <ChatbotIcon />,
  sandbox: <SandboxIcon />,
  licenses: <LicenseIcon />,
  reports: <ReportIcon />,
  departments: <DepartmentIcon />,
  users: <UsersIcon />,
  settings: <SettingsIcon />,
}

const pageLabels: Record<string, string> = {
  dashboard: '仪表盘',
  assets: '资产管理',
  ipam: 'IPAM 地址管理',
  'software-catalog': '软件库',
  printers: '打印机与驱动',
  tickets: '工单管理',
  monitoring: '监控中心',
  network: '网络拓扑',
  'ai-gateway': 'AI 资产管家',
  knowledge: '知识库',
  automation: '自动化引擎',
  chatbot: 'AI 助手',
  sandbox: '沙箱任务',
  licenses: '软件许可',
  reports: '报表分析',
  departments: '部门管理',
  users: '用户管理',
  settings: '系统设置',
}

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const currentPath = location.pathname.split('/')[2] || 'dashboard'

  const handleLogout = () => {
    logout()
    navigate('/system/login')
  }

  return (
    <div className="system-layout">
      <aside className="sys-sidebar">
        <div className="sys-sidebar-header">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <div className="brand-text">IntelliServe</div>
            <div className="brand-sub">IT Suite v1.0</div>
          </div>
        </div>

        <nav className="sys-sidebar-nav">
          {navItems.map((section) => (
            <div className="sys-nav-section" key={section.section}>
              <div className="sys-nav-label">{section.section}</div>
              {section.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`sys-nav-item ${currentPath === item.key ? 'active' : ''}`}
                  onClick={() => navigate(`/system/${item.key}`)}
                >
                  <span className="nav-icon icon">{iconMap[item.icon]}</span>
                  <span>{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sys-sidebar-footer">
          <div className="user-avatar">{user?.name?.[0] || '管'}</div>
          <div className="user-info">
            <div className="user-name">{user?.name || '管理员'}</div>
            <div className="user-role">{user?.role || 'admin'}</div>
          </div>
        </div>
      </aside>

      <div className="sys-main">
        <header className="sys-topbar">
          <div className="sys-topbar-left">
            <nav className="breadcrumb">
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/system/dashboard') }}>首页</a>
              <span>/</span>
              <span className="current">{pageLabels[currentPath] || '仪表盘'}</span>
            </nav>
          </div>
          <div className="sys-topbar-right">
            <div className="sys-topbar-search">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input type="text" placeholder="搜索资产、工单、知识库..." />
            </div>
            <button type="button" className="notification-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="dot" />
            </button>
            <button
              type="button"
              className="user-avatar"
              style={{ width: 36, height: 36, cursor: 'pointer' }}
              onClick={handleLogout}
              title="点击退出登录"
            >
              {user?.name?.[0] || '管'}
            </button>
          </div>
        </header>

        <div className="sys-content">
          <div className="sys-page-view" key={currentPath}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}

function BoxIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg> }
function AssetIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg> }
function IpamIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 0 20" /><path d="M12 2a15.3 15.3 0 0 0 0 20" /></svg> }
function SoftwareIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.3 7 12 12l8.7-5" /><path d="M12 22V12" /></svg> }
function PrinterIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg> }
function TicketIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" /></svg> }
function MonitoringIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg> }
function NetworkIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="6" rx="2" /><rect x="16" y="16" width="6" height="6" rx="2" /><rect x="2" y="16" width="6" height="6" rx="2" /><path d="M12 8v4" /><path d="M6 12h12" /><path d="M6 12v4" /><path d="M18 12v4" /></svg> }
function GatewayIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 20h8" /><path d="M12 18v2" /><path d="M8 9h.01" /><path d="M12 9h.01" /><path d="M16 9h.01" /><path d="M7 13h10" /></svg> }
function KnowledgeIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg> }
function AutomationIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> }
function ChatbotIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" /></svg> }
function SandboxIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3z" /><path d="M8 8h8v8H8z" /><path d="M3 9h5" /><path d="M16 9h5" /><path d="M9 3v5" /><path d="M9 16v5" /></svg> }
function LicenseIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777z" /><path d="M15.5 7.5l3 3L22 7l-3-3" /></svg> }
function ReportIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg> }
function DepartmentIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="8" width="7" height="13" rx="1" /><path d="M6 7h1" /><path d="M6 11h1" /><path d="M6 15h1" /><path d="M17 12h1" /><path d="M17 16h1" /></svg> }
function UsersIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> }
function SettingsIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg> }
