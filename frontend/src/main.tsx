import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './styles/global.css'

const lightTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#3b82f6',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#06b6d4',
    borderRadius: 10,
    fontFamily: "'Inter', 'Noto Sans SC', -apple-system, sans-serif",
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f5f7fb',
    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#cbd5e1',
    colorText: '#1e293b',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#64748b',
    colorTextQuaternary: '#94a3b8',
  },
  components: {
    Layout: {
      siderBg: '#ffffff',
      headerBg: '#ffffff',
      bodyBg: '#f5f7fb',
    },
    Menu: {
      itemSelectedBg: 'rgba(59,130,246,.10)',
      itemHoverBg: 'rgba(59,130,246,.06)',
      itemSelectedColor: '#2563eb',
    },
    Table: {
      headerBg: '#f8fafc',
      rowHoverBg: 'rgba(37,99,235,.04)',
      borderColor: '#e2e8f0',
    },
    Card: {
      colorBgContainer: '#ffffff',
    },
    Input: {
      colorBgContainer: '#ffffff',
    },
    Select: {
      colorBgContainer: '#ffffff',
    },
    Modal: {
      contentBg: '#ffffff',
    },
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider locale={zhCN} theme={lightTheme}>
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
