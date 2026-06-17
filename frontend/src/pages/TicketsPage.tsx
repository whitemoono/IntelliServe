const columns = [
  {
    title: '待处理', color: '#3b82f6', count: 4,
    cards: [
      { title: '财务部打印机无法连接', desc: 'FIN-PRN-01 打印队列堆积', priority: 'high', assignee: '未指派' },
      { title: '销售部 Wi-Fi 信号弱', desc: '会议室区域频繁断连', priority: 'medium', assignee: '未指派' },
      { title: '新员工入职设备配置', desc: '市场部 3 名新员工', priority: 'low', assignee: '张工' },
      { title: '共享打印机驱动更新', desc: '3楼打印区驱动版本过旧', priority: 'low', assignee: '未指派' },
    ],
  },
  {
    title: 'AI 诊断中', color: '#8b5cf6', count: 2,
    cards: [
      { title: 'Office 365 激活失败', desc: 'PC-HR-015 许可证激活异常', priority: 'medium', assignee: 'AI 处理' },
      { title: 'Outlook 收发邮件异常', desc: '研发部多人反馈同步失败', priority: 'high', assignee: 'AI 处理' },
    ],
  },
  {
    title: '处理中', color: '#f59e0b', count: 3,
    cards: [
      { title: 'VPN 连接频繁断开', desc: '远程办公用户反馈 VPN 不稳定', priority: 'high', assignee: '李工' },
      { title: '共享文件夹权限配置', desc: '财务部需要新增共享目录权限', priority: 'medium', assignee: '王工' },
      { title: '会议室投影仪故障', desc: 'HDMI 信号不稳定', priority: 'medium', assignee: '张工' },
    ],
  },
  {
    title: '已解决', color: '#10b981', count: 3,
    cards: [
      { title: '网络重置 — PC-FIN-008', desc: 'AI 自动执行 network-reset.ps1', priority: 'high', assignee: 'AI 自动' },
      { title: '缓存清理 — PC-MKT-003', desc: 'AI 自动执行 cache-cleanup.ps1', priority: 'low', assignee: 'AI 自动' },
      { title: '软件安装申请', desc: 'Adobe CC 授权安装完成', priority: 'low', assignee: '赵工' },
    ],
  },
]

export default function TicketsPage() {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <h2 style={{ fontSize: '1.4rem' }}>工单管理</h2>
        <button className="btn btn-primary btn-sm">+ 创建工单</button>
      </div>
      <div className="ticket-board">
        {columns.map((col) => (
          <div className="ticket-column" key={col.title}>
            <div className="ticket-column-header">
              <h4><span style={{ color: col.color }}>●</span> {col.title}</h4>
              <span className="ticket-count">{col.count}</span>
            </div>
            {col.cards.map((card, i) => (
              <div className="ticket-card" key={i}>
                <h5>{card.title}</h5>
                <p>{card.desc}</p>
                <div className="ticket-card-footer">
                  <span className={`ticket-priority ${card.priority}`} />
                  <span className="ticket-assignee">{card.assignee}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
