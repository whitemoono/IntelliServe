const kpis = [
  { label: '监控主机', value: '486', color: '#3b82f6' },
  { label: '正常运行', value: '412', color: '#10b981' },
  { label: '告警中', value: '38', color: '#f59e0b' },
  { label: '离线', value: '24', color: '#ef4444' },
]

const alerts = [
  { level: '严重', levelColor: 'red', host: 'PC-FIN-023', content: '磁盘 C: 可用空间不足 5%', time: '14:32', duration: '2分钟', durColor: '#ef4444' },
  { level: '严重', levelColor: 'red', host: 'SRV-DB-001', content: 'PostgreSQL 连接池耗尽', time: '14:28', duration: '6分钟', durColor: '#ef4444' },
  { level: '警告', levelColor: 'yellow', host: 'PC-HR-015', content: 'CPU 使用率持续 >85% (15分钟)', time: '14:19', duration: '15分钟', durColor: '#f59e0b' },
  { level: '警告', levelColor: 'yellow', host: 'PC-DEV-042', content: '内存使用率 92%', time: '14:06', duration: '28分钟', durColor: '#f59e0b' },
  { level: '信息', levelColor: 'blue', host: 'PC-MKT-007', content: '主机离线超过 3 小时', time: '11:30', duration: '3小时', durColor: '#64748b' },
]

export default function MonitoringPage() {
  return (
    <>
      <h2 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-lg)' }}>监控中心</h2>
      <div className="kpi-grid" style={{ marginBottom: 'var(--space-xl)' }}>
        {kpis.map((k) => (
          <div className="kpi-card" key={k.label}>
            <div className="kpi-value" style={{ fontSize: '1.5rem', color: k.color }}>{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>
      <div className="data-table-container">
        <div className="data-table-header"><h3>活跃告警</h3></div>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['级别', '主机', '告警内容', '触发时间', '持续时间'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map((a, i) => (
              <tr key={i}>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}><span className={`badge badge-${a.levelColor}`}>{a.level}</span></td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>{a.host}</td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>{a.content}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>{a.time}</td>
                <td style={{ padding: '12px 16px', color: a.durColor, borderBottom: '1px solid var(--border-color)' }}>{a.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
