import { useNavigate } from 'react-router-dom'

const features = [
  { icon: '🤖', title: '钉钉 AI 助手', desc: '钉钉 Stream Mode 对话式 AI 助手，用户输入问题自动匹配解决方案，支持文本 + 截图 + 交互卡片', color: '#3b82f6' },
  { icon: '🔧', title: '自动化修复引擎', desc: 'L1 常见故障自动执行修复脚本（网络重置、Office 修复、缓存清理等），钉钉审批流确认', color: '#10b981' },
  { icon: '📊', title: '资产全生命周期管理', desc: '终端 Agent 自动发现 + OCR 录入、健康度预测、闲置识别、自动盘点', color: '#8b5cf6' },
  { icon: '🖥️', title: '终端 Agent', desc: '自研轻量 Go Agent（<30MB），实时采集 + 远程执行 + 文件分发 + 本地诊断', color: '#06b6d4' },
  { icon: '📈', title: '运维效率量化', desc: '工单分析、故障分布、成本优化建议，持续迭代运维流程', color: '#f59e0b' },
]

const metrics = [
  { before: '30-60 分钟', after: '5-10 分钟', label: '常见故障修复时长', icon: '⚡' },
  { before: '<10%', after: '50%-70%', label: '用户自助解决率', icon: '🎯' },
  { before: '1-3 天/次', after: '实时自动', label: '资产盘点效率', icon: '📋' },
  { before: '70%+', after: '<30%', label: '重复性工作占比', icon: '🔄' },
]

const stats = [
  { value: '50%+', label: '自助解决率提升' },
  { value: '80%', label: '故障修复时间缩短' },
  { value: '500+', label: '终端管理规模' },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#e2e8f0', fontFamily: "'Inter', 'Noto Sans SC', sans-serif" }}>
      {/* Navbar */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 64, background: 'rgba(10,14,26,.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>IntelliServe</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {['功能', '效果', '架构', '技术栈'].map((item) => (
            <a key={item} href={`#${item}`} style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '.9rem', transition: 'color .15s' }}>{item}</a>
          ))}
          <button onClick={() => navigate('/system/login')} style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', border: 'none', borderRadius: 10, padding: '8px 20px', color: '#fff', fontWeight: 600, fontSize: '.9rem', cursor: 'pointer' }}>
            进入系统
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 48px 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(59,130,246,.15), transparent 70%)', borderRadius: '50%', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: 350, height: 350, background: 'radial-gradient(circle, rgba(6,182,212,.12), transparent 70%)', borderRadius: '50%', filter: 'blur(80px)' }} />
        <div style={{ position: 'relative', maxWidth: 800 }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.25)', borderRadius: 9999, fontSize: '.82rem', color: '#3b82f6', marginBottom: 24, fontWeight: 600 }}>
            AI 驱动 · 智能运维
          </div>
          <h1 style={{ fontSize: '3.2rem', fontWeight: 800, lineHeight: 1.2, color: '#f1f5f9', marginBottom: 20, letterSpacing: '-0.03em' }}>
            IT 运维<span style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>智能平台</span>
          </h1>
          <p style={{ fontSize: '1.15rem', color: '#94a3b8', lineHeight: 1.7, maxWidth: 600, margin: '0 auto 40px' }}>
            面向大型园区（2000-5000 台终端），将传统桌面运维与 AI 技术深度融合，打造主动预防 → 智能响应 → 自动修复 → 持续优化的闭环运维体系
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 60 }}>
            <button onClick={() => navigate('/system/login')} style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', border: 'none', borderRadius: 10, padding: '14px 32px', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 0 24px rgba(59,130,246,.35)' }}>
              体验系统 Demo →
            </button>
          </div>
          <div style={{ display: 'flex', gap: 48, justifyContent: 'center' }}>
            {stats.map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.value}</div>
                <div style={{ fontSize: '.85rem', color: '#64748b', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="功能" style={{ padding: '100px 48px', background: '#111827' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>核心能力</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.05rem' }}>覆盖 IT 运维全场景的智能化解决方案</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {features.map((f) => (
              <div key={f.title} style={{ background: '#1a1f2e', border: '1px solid #1e293b', borderRadius: 16, padding: 28, transition: 'all .25s', cursor: 'default' }}>
                <div style={{ width: 48, height: 48, background: `${f.color}20`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: '.88rem', color: '#94a3b8', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="效果" style={{ padding: '100px 48px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>效果对比</h2>
            <p style={{ color: '#94a3b8' }}>AI + 智能运维 vs 传统运维</p>
          </div>
          <div style={{ background: '#1a1f2e', border: '1px solid #1e293b', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '16px 24px', background: '#111827', fontSize: '.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              <div>指标</div>
              <div>传统运维</div>
              <div style={{ color: '#3b82f6' }}>AI + 智能运维</div>
            </div>
            {metrics.map((m, i) => (
              <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '18px 24px', borderTop: '1px solid #1e293b', fontSize: '.9rem' }}>
                <div style={{ color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}><span>{m.icon}</span> {m.label}</div>
                <div style={{ color: '#64748b' }}>{m.before}</div>
                <div style={{ color: '#10b981', fontWeight: 600 }}>{m.after}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="架构" style={{ padding: '100px 48px', background: '#111827' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>四层架构</h2>
            <p style={{ color: '#94a3b8' }}>感知 → 决策 → 执行 → 优化</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { name: '感知层', desc: 'Zabbix Agent 2 + PostgreSQL + 企微/钉钉 Webhook', color: '#3b82f6' },
              { name: '决策层', desc: 'Qwen2.5-7B (Ollama) + RAG (Qdrant) + 故障诊断引擎', color: '#8b5cf6' },
              { name: '执行层', desc: 'Celery + WinRM/PowerShell + 自动化脚本库', color: '#10b981' },
              { name: '优化层', desc: '知识库自动迭代 + ML 预测 + 效率分析', color: '#f59e0b' },
            ].map((layer, i) => (
              <div key={layer.name} style={{ background: '#1a1f2e', border: '1px solid #1e293b', borderLeft: `3px solid ${layer.color}`, borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 48, height: 48, background: `${layer.color}15`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800, color: layer.color }}>{i + 1}</div>
                <div>
                  <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>{layer.name}</div>
                  <div style={{ fontSize: '.85rem', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>{layer.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section id="技术栈" style={{ padding: '100px 48px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>技术栈</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { name: 'Ollama + Qwen2.5', desc: '本地 LLM 推理', color: '#3b82f6' },
              { name: 'FastAPI', desc: '异步 Python 后端', color: '#10b981' },
              { name: 'React 19', desc: '现代前端框架', color: '#06b6d4' },
              { name: 'PostgreSQL', desc: '关系型数据库', color: '#8b5cf6' },
              { name: 'Qdrant', desc: '向量数据库', color: '#f59e0b' },
              { name: 'Docker', desc: '容器化部署', color: '#3b82f6' },
              { name: 'PaddleOCR', desc: '文字识别', color: '#10b981' },
              { name: '钉钉 / 企微', desc: 'IM 集成', color: '#8b5cf6' },
            ].map((t) => (
              <div key={t.name} style={{ background: '#1a1f2e', border: '1px solid #1e293b', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 8, height: 40, background: t.color, borderRadius: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '.9rem' }}>{t.name}</div>
                  <div style={{ fontSize: '.78rem', color: '#64748b' }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 48px', background: '#111827', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 16 }}>开始体验</h2>
        <p style={{ color: '#94a3b8', marginBottom: 32 }}>点击下方按钮进入系统 Demo</p>
        <button onClick={() => navigate('/system/login')} style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', border: 'none', borderRadius: 10, padding: '14px 40px', color: '#fff', fontWeight: 700, fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 0 24px rgba(59,130,246,.35)' }}>
          进入系统 Demo →
        </button>
      </section>

      {/* Footer */}
      <footer style={{ padding: '40px 48px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.82rem', color: '#64748b' }}>
        <div>© 2025 IntelliServe IT Suite. All rights reserved.</div>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="#" style={{ color: '#64748b', textDecoration: 'none' }}>文档</a>
          <a href="#" style={{ color: '#64748b', textDecoration: 'none' }}>GitHub</a>
          <a href="#" style={{ color: '#64748b', textDecoration: 'none' }}>联系我们</a>
        </div>
      </footer>
    </div>
  )
}
