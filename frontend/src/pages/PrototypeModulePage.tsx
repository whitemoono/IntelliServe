import { message } from 'antd'

type ModuleType =
  | 'ipam'
  | 'software-catalog'
  | 'printers'
  | 'network'
  | 'ai-gateway'
  | 'sandbox'
  | 'licenses'
  | 'reports'
  | 'departments'

type Tone = 'blue' | 'green' | 'yellow' | 'red' | 'purple'

interface MetricItem {
  label: string
  value: string
  detail: string
  tone?: Tone
}

interface TableColumn {
  key: string
  label: string
  mono?: boolean
}

interface TableRow {
  [key: string]: string | { text: string; tone: Tone; mono?: boolean } | undefined
}

interface ModuleContent {
  title: string
  subtitle: string
  primaryAction: string
  secondaryAction: string
  metrics: MetricItem[]
  tableTitle: string
  columns: TableColumn[]
  rows: TableRow[]
  adviceTitle: string
  advice: string
  evidence: string[]
  workflow: string[]
}

const moduleContent: Record<ModuleType, ModuleContent> = {
  ipam: {
    title: 'IPAM 地址管理',
    subtitle: '地址池、VLAN、冲突检测与 AI 推荐分配视图，先以演示数据展示完整管理闭环。',
    primaryAction: '推荐分配 IP',
    secondaryAction: '扫描冲突',
    metrics: [
      { label: '地址池', value: '8', detail: '办公、研发、服务器、无线与访客网', tone: 'blue' },
      { label: '已分配', value: '1,284', detail: '本周新增 27 个地址', tone: 'green' },
      { label: '空闲地址', value: '316', detail: '可用于新员工和临时设备', tone: 'purple' },
      { label: '冲突/保留', value: '3 / 42', detail: '2 个冲突需要处理', tone: 'yellow' },
    ],
    tableTitle: '地址池与分配情况',
    columns: [
      { key: 'pool', label: '地址池' },
      { key: 'cidr', label: 'CIDR', mono: true },
      { key: 'vlan', label: 'VLAN' },
      { key: 'usage', label: '用途' },
      { key: 'used', label: '已用' },
      { key: 'free', label: '空闲' },
      { key: 'conflict', label: '冲突' },
    ],
    rows: [
      { pool: '办公终端网段', cidr: '192.168.10.0/24', vlan: '10', usage: '员工终端', used: '168', free: '62', conflict: { text: '2', tone: 'yellow' } },
      { pool: '研发无线网段', cidr: '192.168.20.0/24', vlan: '20', usage: '研发无线', used: '198', free: '36', conflict: { text: '0', tone: 'green' } },
      { pool: '服务器管理网', cidr: '10.10.1.0/24', vlan: '110', usage: '服务器/OOB', used: '74', free: '132', conflict: { text: '0', tone: 'green' } },
      { pool: '打印机与外设', cidr: '192.168.30.0/24', vlan: '30', usage: '打印机/会议设备', used: '46', free: '181', conflict: { text: '1', tone: 'red' } },
    ],
    adviceTitle: 'AI 推荐分配',
    advice: '市场部新员工设备 PC-MKT-NEW-03 建议分配 192.168.10.87。该地址 45 天未在 DHCP/ARP 中出现，位于员工终端 VLAN，未与静态保留冲突。',
    evidence: ['DHCP 租约空闲 45 天', 'ARP 缓存未发现占用', '同部门 VLAN 策略匹配', '静态保留清单未冲突'],
    workflow: ['发现地址池', '检测冲突', '生成建议', '管理员确认'],
  },
  'software-catalog': {
    title: '软件库',
    subtitle: '统一维护标准软件、安装包、静默参数、许可策略和禁用软件清单。',
    primaryAction: '新增软件',
    secondaryAction: '生成整改工单',
    metrics: [
      { label: '标准软件', value: '42', detail: '必装 12，可选 21，受控 9', tone: 'blue' },
      { label: '安装包', value: '96', detail: '含驱动、工具和安全补丁', tone: 'green' },
      { label: '许可风险', value: '7', detail: '3 个超额，4 个闲置可回收', tone: 'yellow' },
      { label: '禁用软件', value: '5', detail: '检测到 2 台终端命中', tone: 'red' },
    ],
    tableTitle: '标准软件目录',
    columns: [
      { key: 'name', label: '软件' },
      { key: 'version', label: '版本' },
      { key: 'level', label: '级别' },
      { key: 'policy', label: '许可策略' },
      { key: 'silent', label: '静默安装参数', mono: true },
      { key: 'distribution', label: '安装分布' },
    ],
    rows: [
      { name: 'Microsoft 365 Apps', version: '2405', level: { text: '受控', tone: 'yellow' }, policy: '按用户', silent: '/configure config.xml', distribution: '286 台' },
      { name: 'Chrome Enterprise', version: '126', level: { text: '必装', tone: 'green' }, policy: '免费', silent: '/silent /install', distribution: '462 台' },
      { name: 'Adobe Acrobat Pro', version: '2025', level: { text: '受控', tone: 'yellow' }, policy: '按设备', silent: 'msiexec /qn', distribution: '64 台' },
      { name: '未知远控工具', version: '2.8', level: { text: '禁用', tone: 'red' }, policy: '不允许', silent: '-', distribution: '2 台' },
    ],
    adviceTitle: 'AI 合规建议',
    advice: 'Adobe Acrobat Pro 有 4 个授权 60 天未启动，建议优先从 PC-SALE-015、PC-MKT-007 回收许可；未知远控工具命中禁用规则，建议创建整改工单并人工复核。',
    evidence: ['4 个席位连续 60 天未启动', '2 台终端命中禁用软件', '安装参数已入库', '可复用现有审批流'],
    workflow: ['录入软件', '匹配资产', '检测合规', '生成整改'],
  },
  printers: {
    title: '打印机与驱动库',
    subtitle: '集中管理打印机台账、驱动适配、队列堵塞和耗材预警。',
    primaryAction: '驱动匹配',
    secondaryAction: '清理队列',
    metrics: [
      { label: '打印机', value: '38', detail: '办公区、会议室、仓库标签机', tone: 'blue' },
      { label: '驱动包', value: '64', detail: 'Windows/macOS 多版本适配', tone: 'green' },
      { label: '故障队列', value: '4', detail: '队列堵塞 2，驱动不匹配 2', tone: 'yellow' },
      { label: '耗材预警', value: '6', detail: '低墨粉或硒鼓寿命不足', tone: 'red' },
    ],
    tableTitle: '打印机台账',
    columns: [
      { key: 'name', label: '名称' },
      { key: 'model', label: '型号' },
      { key: 'ip', label: 'IP', mono: true },
      { key: 'mac', label: 'MAC', mono: true },
      { key: 'location', label: '位置' },
      { key: 'status', label: '状态' },
      { key: 'driver', label: '推荐驱动' },
    ],
    rows: [
      { name: 'FIN-PRN-01', model: 'HP M428fdw', ip: '192.168.30.21', mac: 'F0:92:1C:44:10:21', location: '财务部', status: { text: '驱动异常', tone: 'red' }, driver: 'HP UPD 7.2' },
      { name: 'HR-PRN-02', model: 'Canon iR 2625', ip: '192.168.30.32', mac: '80:CE:62:18:20:32', location: '人力资源', status: { text: '正常', tone: 'green' }, driver: 'Canon UFRII 30.9' },
      { name: 'WH-LABEL-01', model: 'Zebra ZD421', ip: '192.168.30.66', mac: '00:07:4D:88:33:66', location: '仓库', status: { text: '队列堵塞', tone: 'yellow' }, driver: 'ZDesigner 8.6' },
    ],
    adviceTitle: 'AI 驱动修复建议',
    advice: 'FIN-PRN-01 在 Windows 11 23H2 上使用旧版 HP UPD 6.x，建议推送 HP UPD 7.2，并重建 TCP/IP Port 后重启 Spooler。',
    evidence: ['驱动版本落后 2 个主版本', '打印队列堆积 18 个任务', '端口可达但 Spooler 异常', '推荐脚本风险等级为低'],
    workflow: ['识别型号', '匹配驱动', '审批推送', '验证队列'],
  },
  network: {
    title: '网络拓扑',
    subtitle: '展示全网扫描、交换机链路、接入终端、故障定位和拓扑依赖。',
    primaryAction: '开始全网扫描',
    secondaryAction: '生成拓扑报告',
    metrics: [
      { label: '核心节点', value: '4', detail: '核心交换、出口、无线控制器', tone: 'blue' },
      { label: '接入交换机', value: '28', detail: '覆盖 6 个楼层与机房', tone: 'green' },
      { label: '链路告警', value: '3', detail: '2 条丢包，1 条高延迟', tone: 'yellow' },
      { label: '未知设备', value: '11', detail: '等待资产归属确认', tone: 'purple' },
    ],
    tableTitle: '链路与节点状态',
    columns: [
      { key: 'node', label: '节点' },
      { key: 'type', label: '类型' },
      { key: 'ip', label: '管理 IP', mono: true },
      { key: 'uplink', label: '上联' },
      { key: 'latency', label: '延迟' },
      { key: 'status', label: '状态' },
    ],
    rows: [
      { node: 'CORE-SW-01', type: '核心交换', ip: '10.10.0.1', uplink: 'FW-EDGE-01', latency: '1ms', status: { text: '正常', tone: 'green' } },
      { node: 'ACC-F2-07', type: '接入交换机', ip: '10.10.2.7', uplink: 'CORE-SW-01', latency: '18ms', status: { text: '高延迟', tone: 'yellow' } },
      { node: 'AP-MEET-03', type: '无线 AP', ip: '10.10.9.33', uplink: 'ACC-F3-02', latency: '4ms', status: { text: '正常', tone: 'green' } },
      { node: 'UNKNOWN-18', type: '未知终端', ip: '192.168.10.188', uplink: 'ACC-F1-04', latency: '6ms', status: { text: '待归属', tone: 'purple' } },
    ],
    adviceTitle: '拓扑诊断建议',
    advice: '销售区 Wi-Fi 弱信号与 ACC-F2-07 上联端口丢包相关。建议先核对交换机端口错误包计数，再安排非工作时段更换网线或端口。',
    evidence: ['上联端口 15 分钟内丢包 2.1%', '同楼层 8 台终端漫游失败', 'AP 控制器无异常重启', '影响范围集中在 2 楼东侧'],
    workflow: ['发现节点', '绘制依赖', '定位链路', '生成报告'],
  },
  'ai-gateway': {
    title: 'AI 资产管家',
    subtitle: '管理模型接入、路由策略、预算控制、知识库引用与安全审计。',
    primaryAction: '新增模型路由',
    secondaryAction: '模拟问答路由',
    metrics: [
      { label: '模型路由', value: '5', detail: 'DashScope、Ollama 与规则兜底', tone: 'blue' },
      { label: '本月调用', value: '1,247', detail: '知识问答 68%，故障诊断 22%', tone: 'green' },
      { label: '平均延迟', value: '4.2s', detail: 'RAG 检索 + 生成平均耗时', tone: 'yellow' },
      { label: '预算使用', value: '42%', detail: '本月仍有 58% 可用额度', tone: 'purple' },
    ],
    tableTitle: '模型与路由策略',
    columns: [
      { key: 'route', label: '路由' },
      { key: 'model', label: '模型' },
      { key: 'scenario', label: '场景' },
      { key: 'guardrail', label: '安全策略' },
      { key: 'status', label: '状态' },
    ],
    rows: [
      { route: 'rag_qa_v1', model: 'qwen-plus', scenario: '知识问答', guardrail: '引用知识来源', status: { text: '启用', tone: 'green' } },
      { route: 'ticket_triage_v1', model: 'qwen-plus', scenario: '故障分诊', guardrail: '只生成建议', status: { text: '启用', tone: 'green' } },
      { route: 'script_review_v1', model: 'qwen-max', scenario: '脚本风险审查', guardrail: '人工审批', status: { text: '灰度', tone: 'yellow' } },
      { route: 'local_fallback', model: 'Ollama/Qwen', scenario: '离线兜底', guardrail: '低风险问答', status: { text: '待接入', tone: 'purple' } },
    ],
    adviceTitle: '路由模拟结果',
    advice: '用户提问“电脑连不上内网怎么办”将进入 rag_qa_v1，先检索 Qdrant Top-K，再由 DashScope 生成分步骤回答，并返回知识来源。',
    evidence: ['命中意图：knowledge_qa', '检索范围：已发布知识库', 'Top-K：5', '高风险动作：不自动执行'],
    workflow: ['识别意图', '选择路由', '检索知识', '生成回答'],
  },
  sandbox: {
    title: '沙箱任务',
    subtitle: '在隔离环境里演示脚本、补丁、安装包和自动化动作的验证流程。',
    primaryAction: '创建沙箱任务',
    secondaryAction: '查看审计日志',
    metrics: [
      { label: '任务模板', value: '18', detail: '脚本、补丁、安装包与回滚验证', tone: 'blue' },
      { label: '本月运行', value: '389', detail: '平均完成时间 2 分 18 秒', tone: 'green' },
      { label: '待审批', value: '7', detail: '涉及远程执行或批量变更', tone: 'yellow' },
      { label: '阻断动作', value: '3', detail: '命中高风险规则', tone: 'red' },
    ],
    tableTitle: '沙箱任务队列',
    columns: [
      { key: 'task', label: '任务' },
      { key: 'target', label: '目标环境' },
      { key: 'risk', label: '风险' },
      { key: 'owner', label: '发起人' },
      { key: 'result', label: '结果' },
    ],
    rows: [
      { task: 'network-reset.ps1', target: 'Windows 11 23H2', risk: { text: '中', tone: 'yellow' }, owner: 'zhangsan', result: { text: '通过', tone: 'green' } },
      { task: 'cache-cleanup.ps1', target: 'Windows 10 22H2', risk: { text: '低', tone: 'green' }, owner: 'ai-assistant', result: { text: '通过', tone: 'green' } },
      { task: 'office-repair.ps1', target: 'Microsoft 365 Apps', risk: { text: '中', tone: 'yellow' }, owner: 'lisi', result: { text: '待审批', tone: 'purple' } },
      { task: 'delete-profile.ps1', target: 'Domain PC', risk: { text: '高', tone: 'red' }, owner: 'wangwu', result: { text: '已阻断', tone: 'red' } },
    ],
    adviceTitle: '安全执行建议',
    advice: '对涉及远程执行、批量卸载、用户数据删除的任务只生成审批建议，不自动执行。通过沙箱验证后仍需管理员二次确认。',
    evidence: ['WinRM 执行需要审批', '高危脚本命中阻断规则', '可回滚动作优先执行', '审计日志保留 180 天'],
    workflow: ['创建任务', '沙箱运行', '风险评分', '人工确认'],
  },
  licenses: {
    title: '软件许可',
    subtitle: '跟踪订阅、席位、到期、闲置授权和超额风险，辅助成本优化。',
    primaryAction: '追加授权',
    secondaryAction: '回收闲置席位',
    metrics: [
      { label: '许可总数', value: '735', detail: '覆盖 12 类商业软件', tone: 'blue' },
      { label: '已分配', value: '642', detail: '整体使用率 87%', tone: 'green' },
      { label: '30 天到期', value: '6', detail: '需要采购或续费确认', tone: 'yellow' },
      { label: '闲置可回收', value: '34', detail: '预计节省 ¥48,000/年', tone: 'purple' },
    ],
    tableTitle: '许可使用情况',
    columns: [
      { key: 'software', label: '软件名称' },
      { key: 'type', label: '许可类型' },
      { key: 'total', label: '总座席' },
      { key: 'used', label: '已分配' },
      { key: 'expiry', label: '到期日' },
      { key: 'status', label: '状态' },
    ],
    rows: [
      { software: 'Microsoft 365 E3 Enterprise', type: '年度订阅', total: '200', used: '186', expiry: '2027-03-15', status: { text: '正常', tone: 'green' } },
      { software: 'Adobe Creative Cloud', type: '年度订阅', total: '20', used: '18', expiry: '2026-12-01', status: { text: '正常', tone: 'green' } },
      { software: 'JetBrains Toolbox', type: '年度订阅', total: '15', used: '12', expiry: '2026-07-08', status: { text: '将到期', tone: 'yellow' } },
      { software: 'Windows Pro', type: '批量许可', total: '500', used: '486', expiry: '永久', status: { text: '接近上限', tone: 'yellow' } },
    ],
    adviceTitle: '成本优化建议',
    advice: 'Microsoft 365 与 Adobe 共发现 34 个闲置席位，其中 11 个已超过 90 天未启动。建议先通知部门负责人确认，再批量回收并保留审计记录。',
    evidence: ['90 天未启动席位 11 个', '60 天未启动席位 23 个', '续费窗口剩余 22 天', '预计年度节省 ¥48,000'],
    workflow: ['采集使用', '识别闲置', '部门确认', '回收授权'],
  },
  reports: {
    title: '报表分析',
    subtitle: '面向资产、工单、IPAM、许可和 AI 服务的综合运营分析。',
    primaryAction: '生成月报',
    secondaryAction: '导出 PDF',
    metrics: [
      { label: '报表模板', value: '12', detail: '资产、工单、成本、服务质量', tone: 'blue' },
      { label: '本月工单', value: '384', detail: '较上月下降 12%', tone: 'green' },
      { label: '平均解决', value: '46min', detail: '高优先级 18min 内响应', tone: 'yellow' },
      { label: 'AI 命中率', value: '68%', detail: '知识问答自助解决率', tone: 'purple' },
    ],
    tableTitle: '关键运营指标',
    columns: [
      { key: 'metric', label: '指标' },
      { key: 'current', label: '本月' },
      { key: 'previous', label: '上月' },
      { key: 'trend', label: '趋势' },
      { key: 'owner', label: '责任团队' },
    ],
    rows: [
      { metric: '重复工单占比', current: '24%', previous: '31%', trend: { text: '下降', tone: 'green' }, owner: 'IT 服务台' },
      { metric: '资产闲置风险', current: '12 台', previous: '19 台', trend: { text: '改善', tone: 'green' }, owner: '资产管理员' },
      { metric: '许可超额风险', current: '3 项', previous: '2 项', trend: { text: '上升', tone: 'yellow' }, owner: '采购与 IT' },
      { metric: '知识库缺口', current: '18 条', previous: '27 条', trend: { text: '改善', tone: 'green' }, owner: '知识运营' },
    ],
    adviceTitle: 'AI 报表解读',
    advice: '重复工单下降主要来自知识库补全和 AI 问答命中率提升。建议下一阶段优先补齐打印机驱动、VPN 掉线和 Outlook 同步类知识。',
    evidence: ['打印机类工单占比 18%', 'VPN 类平均解决时长仍偏高', '知识库命中率提升 14%', '闲置资产回收节省 ¥32,600'],
    workflow: ['选择模板', '聚合数据', 'AI 解读', '导出报告'],
  },
  departments: {
    title: '部门管理',
    subtitle: '按组织维护资产、地址池、负责人、预算与服务水平视图。',
    primaryAction: '新增部门',
    secondaryAction: '查看资产分布',
    metrics: [
      { label: '部门', value: '14', detail: '含职能、研发、销售与基础设施', tone: 'blue' },
      { label: '关联资产', value: '486', detail: '终端、服务器、外设与网络设备', tone: 'green' },
      { label: 'IP 紧张部门', value: '2', detail: '研发部、无线访客网需扩容', tone: 'yellow' },
      { label: '预算异常', value: '3', detail: '许可与外设成本超预算', tone: 'red' },
    ],
    tableTitle: '部门与资源映射',
    columns: [
      { key: 'dept', label: '部门' },
      { key: 'owner', label: '负责人' },
      { key: 'code', label: '成本中心', mono: true },
      { key: 'subnet', label: '主网段', mono: true },
      { key: 'assets', label: '资产' },
      { key: 'status', label: '状态' },
    ],
    rows: [
      { dept: '研发部', owner: '李总监', code: 'RD-2001', subnet: '192.168.20.0/24', assets: '148', status: { text: 'IP 紧张', tone: 'yellow' } },
      { dept: '财务部', owner: '王经理', code: 'FIN-1003', subnet: '192.168.10.0/25', assets: '52', status: { text: '正常', tone: 'green' } },
      { dept: '市场部', owner: '赵经理', code: 'MKT-3002', subnet: '192.168.10.128/26', assets: '67', status: { text: '闲置偏高', tone: 'purple' } },
      { dept: 'IT 基础设施', owner: '周工', code: 'IT-9001', subnet: '10.10.1.0/24', assets: '73', status: { text: '正常', tone: 'green' } },
    ],
    adviceTitle: '组织资源建议',
    advice: '研发部地址池使用率达到 86%，建议拆分无线与有线地址池，并把闲置终端归还到共享资源池；市场部存在 7 台低使用率设备可调拨。',
    evidence: ['研发地址池剩余 36 个', '市场部闲置终端 7 台', '财务部打印机故障频发', 'IT 基础设施服务器利用率稳定'],
    workflow: ['维护组织', '映射资产', '分析资源', '生成建议'],
  },
}

const toneClass: Record<Tone, string> = {
  blue: 'badge-blue',
  green: 'badge-green',
  yellow: 'badge-yellow',
  red: 'badge-red',
  purple: 'badge-purple',
}

export default function PrototypeModulePage({ type }: { type: ModuleType }) {
  const data = moduleContent[type]

  const handleDemoAction = (action: string) => {
    message.info(`${action} 为演示功能，后端接口待接入`)
  }

  return (
    <div className="demo-page">
      <section className="demo-hero">
        <div>
          <span className="demo-kicker">Prototype Module</span>
          <h2>{data.title}</h2>
          <p>{data.subtitle}</p>
        </div>
        <div className="demo-actions">
          <button className="btn btn-primary btn-sm" onClick={() => handleDemoAction(data.primaryAction)}>
            {data.primaryAction}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleDemoAction(data.secondaryAction)}>
            {data.secondaryAction}
          </button>
        </div>
      </section>

      <div className="ops-grid">
        {data.metrics.map((item) => (
          <div className={`ops-card ops-card-${item.tone || 'blue'}`} key={item.label}>
            <h4>{item.label}</h4>
            <strong>{item.value}</strong>
            <span>{item.detail}</span>
          </div>
        ))}
      </div>

      <div className="ops-section-grid">
        <div className="data-table-container">
          <div className="data-table-header">
            <h3>{data.tableTitle}</h3>
            <span className="badge badge-blue">演示数据</span>
          </div>
          <div className="demo-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {data.columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, index) => (
                  <tr key={index}>
                    {data.columns.map((column) => (
                      <td key={column.key} className={column.mono ? 'mono-cell' : undefined}>
                        {renderCell(row[column.key], column.mono)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="ai-advice-box">
          <div className="ai-advice-head">
            <span>AI</span>
            <h4>{data.adviceTitle}</h4>
          </div>
          <p>{data.advice}</p>
          <div className="evidence-list">
            {data.evidence.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
          <div className="demo-actions compact">
            <button className="btn btn-primary btn-sm" onClick={() => handleDemoAction('确认建议')}>
              确认建议
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleDemoAction('查看证据')}>
              查看证据
            </button>
          </div>
        </aside>
      </div>

      <section className="workflow-strip">
        {data.workflow.map((item, index) => (
          <div className="workflow-step" key={item}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{item}</strong>
          </div>
        ))}
      </section>

      {type === 'network' && <NetworkPreview />}
      {type === 'ai-gateway' && <GatewayPreview />}
      {type === 'reports' && <ReportsPreview />}
      {type === 'departments' && <DepartmentsPreview />}
    </div>
  )
}

function renderCell(value: TableRow[string], mono?: boolean) {
  if (!value) return '-'
  if (typeof value === 'string') {
    return <span className={mono ? 'mono-cell' : undefined}>{value}</span>
  }
  return <span className={`badge ${toneClass[value.tone]} ${value.mono ? 'mono-cell' : ''}`}>{value.text}</span>
}

function NetworkPreview() {
  return (
    <section className="topo-container">
      <div className="topo-node core">CORE-SW-01</div>
      <div className="topo-node firewall">FW-EDGE-01</div>
      <div className="topo-node access left">ACC-F2-07</div>
      <div className="topo-node access right">ACC-F3-02</div>
      <div className="topo-node endpoint one">PC-FIN-023</div>
      <div className="topo-node endpoint two">AP-MEET-03</div>
      <div className="topo-link link-a" />
      <div className="topo-link link-b" />
      <div className="topo-link link-c" />
      <div className="topo-link link-d" />
    </section>
  )
}

function GatewayPreview() {
  return (
    <section className="gateway-flow">
      {['用户问题', '意图分类', 'Qdrant 检索', '模型生成', '返回来源'].map((item) => (
        <div className="gateway-flow-step" key={item}>{item}</div>
      ))}
    </section>
  )
}

function ReportsPreview() {
  return (
    <section className="report-template-grid">
      {['资产成本月报', '工单 SLA 周报', 'AI 命中率分析', '许可优化报告'].map((item) => (
        <div className="report-template-card" key={item}>
          <strong>{item}</strong>
          <span>可配置周期、部门、指标和导出格式</span>
        </div>
      ))}
    </section>
  )
}

function DepartmentsPreview() {
  return (
    <section className="department-tree">
      <div className="department-root">公司总部</div>
      {['研发部', '财务部', '市场部', 'IT 基础设施'].map((item) => (
        <div className="department-node" key={item}>{item}</div>
      ))}
    </section>
  )
}
