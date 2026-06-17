import { useState, useEffect } from 'react'
import api from '../services/api'

interface ConfigStatus {
  llm_provider: string
  chat_model: string
  embed_model: string
  llm_status: string
  qdrant_status: string
  worker_status: string
  kb_points_count: number
  app_env: string
}

const providerLabels: Record<string, string> = {
  dashscope: '阿里云 DashScope',
  ollama: 'Ollama (本地)',
}

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigStatus | null>(null)

  useEffect(() => {
    api.get('/config/status').then((res) => setConfig(res.data)).catch(() => {})
  }, [])

  const isHealthy = (status?: string) =>
    ['connected', 'green', 'ok', 'running'].includes(status || '')

  const services = [
    { name: 'FastAPI', status: 'running', detail: 'API 在线' },
    { name: 'LLM', status: config?.llm_status || 'loading', detail: config?.chat_model || '加载中' },
    { name: 'Qdrant', status: config?.qdrant_status || 'loading', detail: `${config?.kb_points_count ?? 0} 个向量点` },
    { name: 'Celery Worker', status: config?.worker_status || 'loading', detail: '知识库索引任务' },
  ]

  return (
    <>
      <h2 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-lg)' }}>系统设置</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* AI Model Config */}
        <div className="chart-container">
          <h3 style={{ marginBottom: 16 }}>AI 模型配置</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>模型提供商</span>
              <div style={{ fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                {providerLabels[config?.llm_provider || 'dashscope'] || '加载中...'}
                {config?.llm_status === 'connected' && (
                  <span className="badge badge-green" style={{ marginLeft: 8, fontSize: '.7rem' }}>已连接</span>
                )}
                {config?.llm_status === 'disconnected' && (
                  <span className="badge badge-red" style={{ marginLeft: 8, fontSize: '.7rem' }}>未连接</span>
                )}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>推理模型</span>
              <div style={{ fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                {config?.chat_model || '加载中...'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>嵌入模型</span>
              <div style={{ fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                {config?.embed_model || '加载中...'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>运行环境</span>
              <div style={{ fontFamily: 'var(--font-mono)', marginTop: 4, color: config?.app_env === 'production' ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
                {config?.app_env || '加载中...'}
              </div>
            </div>
          </div>
        </div>

        {/* Service Status */}
        <div className="chart-container">
          <h3 style={{ marginBottom: 16 }}>服务状态</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {services.map((s) => (
              <div
                key={s.name}
                style={{
                  textAlign: 'center',
                  padding: 12,
                  background: isHealthy(s.status) ? 'rgba(16,185,129,.05)' : 'rgba(239,68,68,.05)',
                  border: `1px solid ${isHealthy(s.status) ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)'}`,
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ fontSize: '.85rem', color: isHealthy(s.status) ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  ● {isHealthy(s.status) ? '运行中' : '异常/加载中'}
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{s.name}</div>
                <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{s.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Settings */}
        <div className="chart-container">
          <h3 style={{ marginBottom: 16 }}>安全设置</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'JWT Access Token', value: '30 分钟' },
              { label: 'JWT Refresh Token', value: '7 天' },
              { label: 'TLS 版本', value: 'TLS 1.3' },
              { label: '加密算法', value: 'AES-256-GCM', mono: true },
            ].map((item) => (
              <div key={item.label}>
                <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>{item.label}</span>
                <div style={{ marginTop: 4, fontFamily: item.mono ? 'var(--font-mono)' : undefined }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
