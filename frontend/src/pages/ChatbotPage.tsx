import { useState, useRef, useEffect } from 'react'
import { chatbotApi } from '../services/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  intent?: string
  confidence?: number
  sources?: { title: string; score: number }[]
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '您好！👋 我是 IntelliServe IT 智能助手。\n\n我可以帮你：\n1. 解答 IT 常见问题（如网络、打印机、VPN 等）\n2. 报告设备故障\n3. 提交 IT 服务请求\n\n请问有什么可以帮你的？',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const res = await chatbotApi.sendMessage(text)
      const data = res.data
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply,
          intent: data.intent,
          confidence: data.confidence,
          sources: data.knowledge_sources,
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '抱歉，服务暂时不可用。请稍后再试。' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const askSuggestion = (text: string) => {
    setInput(text)
  }

  return (
    <>
      <h2 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-lg)' }}>AI 运维助手</h2>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 'var(--space-xl)' }}>
        <div className="kpi-card">
          <div className="kpi-value" style={{ fontSize: '1.5rem' }}>1,247</div>
          <div className="kpi-label">本月对话数</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ fontSize: '1.5rem' }}>68%</div>
          <div className="kpi-label">自助解决率</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ fontSize: '1.5rem' }}>4.2s</div>
          <div className="kpi-label">平均响应时间</div>
        </div>
      </div>

      <div className="chart-container" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>IM 渠道状态</h3>
        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { name: '企业微信', color: '#3b82f6', status: '已 connected', daily: 342, icon: '💬' },
            { name: '钉钉', color: '#8b5cf6', status: '已连接', daily: 187, icon: '🔔' },
          ].map((ch) => (
            <div key={ch.name} style={{ flex: 1, padding: 20, background: '#fff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: '1.5rem' }}>{ch.icon}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{ch.name}</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--accent-green)' }}>● 已连接</div>
                </div>
              </div>
              <div style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>今日消息：{ch.daily} 条</div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className="chart-container">
        <div className="chart-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" />
            </svg>
            对话测试
          </h3>
          <span className="badge badge-green">在线</span>
        </div>

        <div className="chat-panel" style={{ height: 400 }}>
          <div className="chat-messages" style={{ overflowY: 'auto', flex: 1, padding: '16px 0' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role === 'assistant' ? 'bot' : 'user'}`}>
                <div className="msg-avatar">
                  {msg.role === 'assistant' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" />
                    </svg>
                  ) : '我'}
                </div>
                <div className="msg-bubble">
                  {msg.content.split('\n').map((line, j) => (
                    <span key={j}>{line}<br /></span>
                  ))}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="chat-source-meta">
                      📚 来源: {msg.sources.map((s) => `${s.title} (${Math.round(s.score * 100)}%)`).join(', ')}
                    </div>
                  )}
                  {msg.intent && (
                    <div style={{ marginTop: 4, fontSize: '.72rem', color: 'var(--text-muted)' }}>
                      意图: {msg.intent} | 置信度: {Math.round((msg.confidence || 0) * 100)}%
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-message bot">
                <div className="msg-avatar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" />
                  </svg>
                </div>
                <div className="msg-bubble" style={{ color: 'var(--text-muted)' }}>思考中...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input">
            <input
              type="text"
              placeholder="输入问题或故障描述..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} disabled={loading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {['电脑连不上内网怎么办？', 'Outlook 邮件同步失败怎么排查？', '打印机脱机如何处理？'].map((item) => (
              <button key={item} className="btn btn-ghost btn-sm" onClick={() => askSuggestion(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
