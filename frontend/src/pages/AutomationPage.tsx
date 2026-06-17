const scripts = [
  { name: 'network-reset.ps1', desc: '网络连接重置', risk: '中', riskColor: 'yellow', runs: 156, success: '97.4%', last: '5分钟前' },
  { name: 'cache-cleanup.ps1', desc: '系统缓存清理', risk: '低', riskColor: 'green', runs: 89, success: '99.1%', last: '18分钟前' },
  { name: 'printer-reset.ps1', desc: '打印机服务重启', risk: '低', riskColor: 'green', runs: 67, success: '95.5%', last: '1小时前' },
  { name: 'office-repair.ps1', desc: 'Office 组件修复', risk: '中', riskColor: 'yellow', runs: 45, success: '91.1%', last: '2小时前' },
  { name: 'drive-remap.ps1', desc: '网络驱动器映射', risk: '低', riskColor: 'green', runs: 32, success: '100%', last: '3小时前' },
  { name: 'disk-cleanup.ps1', desc: '磁盘空间清理', risk: '高', riskColor: 'red', runs: 12, success: '100%', last: '1天前' },
]

export default function AutomationPage() {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <h2 style={{ fontSize: '1.4rem' }}>自动化引擎</h2>
        <button className="btn btn-primary btn-sm">+ 新建脚本</button>
      </div>
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 'var(--space-xl)' }}>
        <div className="kpi-card"><div className="kpi-value" style={{ fontSize: '1.5rem' }}>18</div><div className="kpi-label">脚本模板</div></div>
        <div className="kpi-card"><div className="kpi-value" style={{ fontSize: '1.5rem' }}>389</div><div className="kpi-label">本月执行次数</div></div>
        <div className="kpi-card"><div className="kpi-value" style={{ fontSize: '1.5rem' }}>94.2%</div><div className="kpi-label">执行成功率</div></div>
      </div>
      <div className="data-table-container">
        <div className="data-table-header"><h3>脚本库</h3></div>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['脚本名称', '说明', '风险等级', '执行次数', '成功率', '最后执行'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scripts.map((s) => (
              <tr key={s.name}>
                <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border-color)' }}>{s.name}</td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>{s.desc}</td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}><span className={`badge badge-${s.riskColor}`}>{s.risk}</span></td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>{s.runs}</td>
                <td style={{ padding: '12px 16px', color: 'var(--accent-green)', borderBottom: '1px solid var(--border-color)' }}>{s.success}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>{s.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
