import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { useAuthStore } from '../stores/authStore'
import { authApi } from '../services/api'

const platformStats = [
  { value: 'RAG', label: '知识库检索' },
  { value: '24/7', label: 'AI 助手在线' },
  { value: '5min', label: '常见故障建议' },
]

const serviceItems = [
  { name: 'FastAPI 后端', status: 'online' },
  { name: 'Qdrant 向量库', status: 'online' },
  { name: 'Celery Worker', status: 'ready' },
]

const workflowItems = ['感知', '诊断', '建议', '闭环']

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      message.warning('请输入工号和密码')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.login(username, password)
      const { access_token, refresh_token, user } = res.data
      setAuth(access_token, refresh_token, user)
      message.success('登录成功')
      navigate('/system/dashboard')
    } catch (err: any) {
      message.error(err.response?.data?.detail || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-grid-bg" />
      <div className="login-orb login-orb-blue" />
      <div className="login-orb login-orb-purple" />

      <section className="login-shell">
        <div className="login-brand-panel" aria-label="IntelliServe 平台概览">
          <div className="login-brand-mark">
            <span className="login-logo">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </span>
            <div>
              <strong>IntelliServe IT Suite</strong>
              <span>AI 驱动的 IT 运维智能平台</span>
            </div>
          </div>

          <div className="login-hero-copy">
            <span className="login-badge">本地部署 · RAG 知识库 · 运维后台</span>
            <h1>让 IT 运维从响应问题，走向主动闭环。</h1>
            <p>
              统一知识库、AI 助手、用户权限与系统状态，帮助运维团队在一个控制台里完成诊断、协作和持续优化。
            </p>
          </div>

          <div className="login-stats">
            {platformStats.map((item) => (
              <div className="login-stat-card" key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="login-console">
            <div className="login-console-header">
              <span />
              <span />
              <span />
              <strong>运维闭环状态</strong>
            </div>
            <div className="login-workflow">
              {workflowItems.map((item, index) => (
                <div className="login-workflow-step" key={item}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item}</strong>
                </div>
              ))}
            </div>
            <div className="login-service-list">
              {serviceItems.map((item) => (
                <div className="login-service-item" key={item.name}>
                  <span className={`login-status-dot ${item.status}`} />
                  <span>{item.name}</span>
                  <em>{item.status === 'online' ? '在线' : '就绪'}</em>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <form className="login-card" onSubmit={handleLogin}>
            <div className="login-card-header">
              <span className="login-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20V10" />
                  <path d="M18 20V4" />
                  <path d="M6 20v-4" />
                </svg>
              </span>
              <div>
                <h2>登录系统后台</h2>
                <p>进入 IntelliServe 运维控制台</p>
              </div>
            </div>

            <label className="login-field">
              <span>工号 / 用户名</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入工号或用户名"
                autoComplete="username"
              />
            </label>

            <label className="login-field">
              <span>密码</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入登录密码"
                autoComplete="current-password"
              />
            </label>

            <button type="submit" disabled={loading} className="login-submit">
              {loading ? '登录中...' : '登录控制台'}
            </button>

            <div className="login-test-account">
              <div>
                <strong>测试账号</strong>
                <span>测试用户名：admin / 测试密码：admin123</span>
              </div>
              <dl>
                <div>
                  <dt>用户名</dt>
                  <dd>admin</dd>
                </div>
                <div>
                  <dt>密码</dt>
                  <dd>admin123</dd>
                </div>
              </dl>
            </div>

            <div className="login-capability-tags" aria-label="平台能力">
              <span>本地部署</span>
              <span>RAG 知识库</span>
              <span>AI 助手</span>
              <span>运维后台</span>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
