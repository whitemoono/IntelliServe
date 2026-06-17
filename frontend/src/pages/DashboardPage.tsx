import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

function KpiCard({ icon, iconBg, iconColor, change, changeDir, value, label }: {
  icon: React.ReactNode; iconBg: string; iconColor: string
  change: string; changeDir: 'up' | 'down'; value: string; label: string
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-header">
        <div className="kpi-icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
        <span className={`kpi-change ${changeDir}`}>{change}</span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  )
}

export default function DashboardPage() {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current)
    chart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 20, right: 20, bottom: 30, left: 50 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b' },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b' },
      },
      series: [
        {
          name: 'CPU',
          type: 'line',
          smooth: true,
          data: [25, 18, 42, 68, 55, 45, 32],
          lineStyle: { color: '#3b82f6', width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59,130,246,0.3)' },
              { offset: 1, color: 'rgba(59,130,246,0)' },
            ]),
          },
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: '内存',
          type: 'line',
          smooth: true,
          data: [55, 52, 61, 72, 68, 62, 58],
          lineStyle: { color: '#06b6d4', width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(6,182,212,0.3)' },
              { offset: 1, color: 'rgba(6,182,212,0)' },
            ]),
          },
          itemStyle: { color: '#06b6d4' },
        },
      ],
    })
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); chart.dispose() }
  }, [])

  const tickets = [
    { id: '#TK-1024', title: '财务部打印机无法连接', status: '处理中', statusColor: 'yellow', priority: 'high', time: '5 分钟前' },
    { id: '#TK-1023', title: 'Office 365 激活失败', status: '诊断中', statusColor: 'blue', priority: 'medium', time: '18 分钟前' },
    { id: '#TK-1022', title: 'VPN 连接频繁断开', status: '已解决', statusColor: 'green', priority: 'high', time: '1 小时前' },
    { id: '#TK-1021', title: '新员工电脑配置申请', status: '已解决', statusColor: 'green', priority: 'low', time: '2 小时前' },
    { id: '#TK-1020', title: '共享文件夹权限问题', status: '处理中', statusColor: 'yellow', priority: 'medium', time: '3 小时前' },
  ]

  const alerts = [
    { dot: 'var(--accent-red)', text: 'PC-FIN-023 磁盘空间不足 5%', time: '2分钟前' },
    { dot: 'var(--accent-yellow)', text: 'PC-HR-015 CPU 持续高负载', time: '15分钟前' },
    { dot: 'var(--accent-yellow)', text: 'PC-DEV-042 内存使用率 92%', time: '28分钟前' },
  ]

  return (
    <>
      <div className="kpi-grid">
        <KpiCard
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>}
          iconBg="rgba(59,130,246,.15)" iconColor="#3b82f6" change="↑ 12" changeDir="up" value="486" label="资产总数"
        />
        <KpiCard
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" /></svg>}
          iconBg="rgba(245,158,11,.15)" iconColor="#f59e0b" change="↑ 3" changeDir="down" value="12" label="待处理工单"
        />
        <KpiCard
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /></svg>}
          iconBg="rgba(139,92,246,.15)" iconColor="#8b5cf6" change="↑ 28%" changeDir="up" value="1,247" label="AI 诊断次数"
        />
        <KpiCard
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>}
          iconBg="rgba(16,185,129,.15)" iconColor="#10b981" change="↑ 15%" changeDir="up" value="389" label="自动化执行数"
        />
      </div>

      <div className="dashboard-grid">
        <div className="chart-container">
          <div className="chart-header">
            <h3>CPU / 内存使用趋势</h3>
            <div className="chart-actions">
              <button className="chart-tab active">24h</button>
              <button className="chart-tab">7天</button>
              <button className="chart-tab">30天</button>
            </div>
          </div>
          <div ref={chartRef} style={{ height: 280 }} />
        </div>
        <div className="chart-container">
          <div className="chart-header"><h3>告警分布</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {[
              { label: '严重', count: 3, color: '#ef4444', pct: 4 },
              { label: '警告', count: 8, color: '#f59e0b', pct: 12 },
              { label: '信息', count: 15, color: '#3b82f6', pct: 22 },
              { label: '已解决', count: 42, color: '#10b981', pct: 62 },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                    {item.label}
                  </span>
                  <span style={{ color: item.color, fontWeight: 600 }}>{item.count}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${item.pct}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="data-table-container">
          <div className="data-table-header">
            <h3>最近工单</h3>
            <a href="/tickets" className="btn btn-ghost btn-sm">查看全部 →</a>
          </div>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>工单号</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>标题</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>状态</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>提交时间</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-color)' }}>{t.id}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>{t.title}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}><span className={`badge badge-${t.statusColor}`}>{t.status}</span></td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>{t.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="chart-container">
          <div className="chart-header"><h3>资产健康状态</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            {[
              { label: '在线正常', count: '412 台 (84.8%)', pct: 84.8, color: 'var(--accent-green)' },
              { label: '告警状态', count: '38 台 (7.8%)', pct: 7.8, color: 'var(--accent-yellow)' },
              { label: '离线', count: '24 台 (4.9%)', pct: 4.9, color: 'var(--accent-red)' },
              { label: '闲置设备', count: '12 台 (2.5%)', pct: 2.5, color: 'var(--text-muted)' },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span style={{ color: item.color, fontWeight: 600 }}>{item.count}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${item.pct}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>最近告警</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.85rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.dot, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{a.text}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
