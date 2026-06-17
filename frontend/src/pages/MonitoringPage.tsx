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

const printerKpis = [
  { label: '打印机总数', value: '38', color: '#3b82f6' },
  { label: '正常运行', value: '32', color: '#10b981' },
  { label: '故障队列', value: '4', color: '#f59e0b' },
  { label: '耗材预警', value: '6', color: '#ef4444' },
]

const printers = [
  { name: 'FIN-PRN-01', model: 'HP M428fdw', ip: '192.168.30.21', location: '财务部 5F', status: '驱动异常', statusColor: 'red', queue: '堆积 18 任务', queueColor: '#ef4444', toner: '墨粉 12%', tonerColor: '#ef4444' },
  { name: 'HR-PRN-02', model: 'Canon iR 2625', ip: '192.168.30.32', location: '人力资源 4F', status: '正常', statusColor: 'green', queue: '正常', queueColor: '#10b981', toner: '硒鼓 68%', tonerColor: '#10b981' },
  { name: 'WH-LABEL-01', model: 'Zebra ZD421', ip: '192.168.30.66', location: '仓库 1F', status: '队列堵塞', statusColor: 'yellow', queue: '堵塞', queueColor: '#f59e0b', toner: '标签纸待补', tonerColor: '#f59e0b' },
  { name: 'MKT-PRN-03', model: 'HP Color M454', ip: '192.168.30.45', location: '市场部 3F', status: '正常', statusColor: 'green', queue: '正常', queueColor: '#10b981', toner: '青色 22%', tonerColor: '#f59e0b' },
  { name: 'SRV-PRN-01', model: 'Xerox C405', ip: '192.168.30.88', location: '机房 A', status: '离线', statusColor: 'red', queue: '离线', queueColor: '#ef4444', toner: '-', tonerColor: '#64748b' },
]

export default function MonitoringPage() {
  return (
    <>
      <h2 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-lg)' }}>监控中心</h2>

      {/* 主机监控 KPI */}
      <div className="kpi-grid" style={{ marginBottom: 'var(--space-xl)' }}>
        {kpis.map((k) => (
          <div className="kpi-card" key={k.label}>
            <div className="kpi-value" style={{ fontSize: '1.5rem', color: k.color }}>{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* 活跃告警表 */}
      <div className="data-table-container" style={{ marginBottom: 'var(--space-xl)' }}>
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

      {/* 打印机监控 KPI */}
      <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-md)' }}>打印机监控</h3>
      <div className="kpi-grid" style={{ marginBottom: 'var(--space-lg)' }}>
        {printerKpis.map((k) => (
          <div className="kpi-card" key={k.label}>
            <div className="kpi-value" style={{ fontSize: '1.5rem', color: k.color }}>{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* 打印机状态表 */}
      <div className="data-table-container">
        <div className="data-table-header">
          <h3>打印机状态</h3>
          <span className="badge badge-blue">Zabbix 采集</span>
        </div>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['名称', '型号', 'IP', '位置', '状态', '打印队列', '耗材'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {printers.map((p) => (
              <tr key={p.name}>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}><strong>{p.name}</strong></td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>{p.model}</td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontFamily: 'var(--font-mono)', fontSize: '.85rem' }}>{p.ip}</td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>{p.location}</td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}><span className={`badge badge-${p.statusColor}`}>{p.status}</span></td>
                <td style={{ padding: '12px 16px', color: p.queueColor, borderBottom: '1px solid var(--border-color)' }}>{p.queue}</td>
                <td style={{ padding: '12px 16px', color: p.tonerColor, borderBottom: '1px solid var(--border-color)' }}>{p.toner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
