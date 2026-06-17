import { useMemo, useState } from 'react'

type AssetStatus = 'online' | 'warning' | 'offline' | 'idle'
type RiskLevel = 'high' | 'medium' | 'low'
type AssigneeFilter = 'all' | 'assigned' | 'unassigned' | 'pool'
type SortField = 'id' | 'name' | 'assignee' | 'dept' | 'purchaseCost' | 'purchaseDate' | 'bookValue' | 'usage' | 'risk'
type SortDir = 'asc' | 'desc'
type ToastTone = 'success' | 'warning' | 'danger' | 'info'

type Asset = {
  id: string
  name: string
  model: string
  assignee: string
  dept: string
  status: AssetStatus
  mac: string
  ip: string
  purchaseCost: number
  purchaseDate: string
  bookValue: number
  usage: number
  risk: RiskLevel
  heartbeat: string
  health: number
  serial: string
  vlan: string
  cpu: string
  ram: string
  disk: string
  os: string
  location: string
  assignedAt: string
  lastUser: string
  ownerMatch: string
  assignStatus: string
  salvageValue: number
  depreciationPct: number
  repairCost: number
  lastTicket: string
  controlledSoftware: string
  aiAdvice: string
  liveCpu: number
  liveRam: number
}

type AssetForm = {
  id: string
  name: string
  model: string
  dept: string
  assignee: string
  status: AssetStatus
}

const statusMap: Record<AssetStatus, { label: string; badge: string; tone: string }> = {
  online: { label: '在线', badge: '在线正常', tone: 'green' },
  warning: { label: '告警', badge: '性能告警', tone: 'yellow' },
  offline: { label: '离线', badge: '离线待盘点', tone: 'red' },
  idle: { label: '闲置', badge: '闲置可调拨', tone: 'purple' },
}

const riskMap: Record<RiskLevel, { label: string; className: string; score: number }> = {
  high: { label: '高', className: 'risk-high', score: 3 },
  medium: { label: '中', className: 'risk-mid', score: 2 },
  low: { label: '低', className: 'risk-low', score: 1 },
}

const departments = ['财务部', '研发部', '人力资源', '市场部', '销售部', 'IT 基础设施', '库存池']

const initialAssets: Asset[] = [
  {
    id: 'A-2024-001',
    name: 'PC-FIN-001',
    model: 'ThinkPad T14s',
    assignee: '王会计',
    dept: '财务部',
    status: 'online',
    mac: '8C:16:45:AA:01:22',
    ip: '192.168.10.101',
    purchaseCost: 8600,
    purchaseDate: '2024-03-12',
    bookValue: 4920,
    usage: 76,
    risk: 'low',
    heartbeat: '刚刚',
    health: 98,
    serial: 'L3-N982A10',
    vlan: 'VLAN 10 / Agent',
    cpu: 'Intel Core i7-12700H @ 2.7GHz',
    ram: '16 GB DDR4-3200',
    disk: '512 GB SSD NVMe M.2',
    os: 'Windows 11 Enterprise 22H2',
    location: '财务部 5F-财务区',
    assignedAt: '2024-03-14',
    lastUser: 'wang.kj',
    ownerMatch: '一致',
    assignStatus: '已分配',
    salvageValue: 688,
    depreciationPct: 48,
    repairCost: 320,
    lastTicket: '无高风险故障',
    controlledSoftware: '无异常',
    aiAdvice: '设备使用率稳定，健康度高，建议继续保留。当前无调拨、报废或换新需求。',
    liveCpu: 34,
    liveRam: 62,
  },
  {
    id: 'A-2024-002',
    name: 'PC-HR-003',
    model: 'OptiPlex 7090',
    assignee: '赵 HR',
    dept: '人力资源',
    status: 'warning',
    mac: '00:1A:2B:31:HR:03',
    ip: '192.168.10.115',
    purchaseCost: 5200,
    purchaseDate: '2022-11-08',
    bookValue: 1240,
    usage: 88,
    risk: 'medium',
    heartbeat: '1分钟前',
    health: 64,
    serial: 'CN-09827B-7090',
    vlan: 'VLAN 10 / DHCP',
    cpu: 'Intel Core i5-11500 @ 2.7GHz',
    ram: '8 GB DDR4-2666',
    disk: '256 GB SSD SATA',
    os: 'Windows 10 Pro 21H2',
    location: '人力资源 4F-HR 区',
    assignedAt: '2022-11-10',
    lastUser: 'zhao.hr',
    ownerMatch: '一致',
    assignStatus: '已分配',
    salvageValue: 416,
    depreciationPct: 76,
    repairCost: 1680,
    lastTicket: '近 90 天 3 次性能/蓝屏工单',
    controlledSoftware: 'Office 授权正常',
    aiAdvice: '累计维修成本已超过账面净值 40%，且故障频率偏高。建议进入 Q3 换新预算，旧设备仅保留保修内处理。',
    liveCpu: 89,
    liveRam: 78,
  },
  {
    id: 'A-2024-003',
    name: 'PC-DEV-012',
    model: 'MacBook Pro 14',
    assignee: '李研发',
    dept: '研发部',
    status: 'online',
    mac: 'A4:83:E7:21:0F:9B',
    ip: '192.168.20.42',
    purchaseCost: 16800,
    purchaseDate: '2025-01-20',
    bookValue: 12980,
    usage: 82,
    risk: 'low',
    heartbeat: '刚刚',
    health: 96,
    serial: 'C02YP9HXQ05D',
    vlan: 'VLAN 20 / Agent',
    cpu: 'Apple M3 Pro 11-Core',
    ram: '18 GB Unified Memory',
    disk: '1 TB SSD',
    os: 'macOS Sonoma 14.5',
    location: '研发部 7F-研发区',
    assignedAt: '2025-01-22',
    lastUser: 'li.dev',
    ownerMatch: '一致',
    assignStatus: '已分配',
    salvageValue: 1344,
    depreciationPct: 23,
    repairCost: 0,
    lastTicket: '无维修记录',
    controlledSoftware: 'JetBrains 授权正常',
    aiAdvice: '研发高频设备，利用率和健康度均稳定。建议继续保留，并纳入研发高性能终端池容量观察。',
    liveCpu: 45,
    liveRam: 71,
  },
  {
    id: 'A-2024-004',
    name: 'PC-MKT-007',
    model: 'ThinkCentre M920',
    assignee: '未分配',
    dept: '市场部',
    status: 'offline',
    mac: '3C:7C:3F:09:18:77',
    ip: '192.168.10.137',
    purchaseCost: 4900,
    purchaseDate: '2021-09-18',
    bookValue: 520,
    usage: 18,
    risk: 'high',
    heartbeat: '3小时前',
    health: 52,
    serial: 'SN-GENERIC-42A',
    vlan: 'VLAN 10 / ARP 3小时前',
    cpu: 'AMD Ryzen 5 5600G',
    ram: '16 GB RAM',
    disk: '1 TB SSD',
    os: 'Windows 11 Pro',
    location: '市场部 3F-旧设备柜',
    assignedAt: '2021-09-20',
    lastUser: '无最近登录',
    ownerMatch: '需盘点',
    assignStatus: '待盘点',
    salvageValue: 392,
    depreciationPct: 90,
    repairCost: 920,
    lastTicket: '长期离线且折旧接近完成',
    controlledSoftware: '无异常',
    aiAdvice: '设备账面净值较低且长期离线，建议先自动盘点确认实物位置，再评估报废或作为备机。',
    liveCpu: 0,
    liveRam: 0,
  },
  {
    id: 'A-2024-005',
    name: 'SRV-DB-001',
    model: 'PowerEdge R750',
    assignee: '平台组',
    dept: 'IT 基础设施',
    status: 'online',
    mac: '90:B1:1C:DB:00:01',
    ip: '10.10.1.15',
    purchaseCost: 68000,
    purchaseDate: '2023-06-01',
    bookValue: 38540,
    usage: 91,
    risk: 'low',
    heartbeat: '刚刚',
    health: 95,
    serial: 'DELL-R750-DB-01',
    vlan: 'VLAN 30 / Agent',
    cpu: '2 x Intel Xeon Silver 4314',
    ram: '256 GB ECC DDR4',
    disk: '8 x 1.92 TB SSD RAID10',
    os: 'Ubuntu Server 22.04 LTS',
    location: '机房 A-03 机柜',
    assignedAt: '2023-06-02',
    lastUser: 'svc-postgres',
    ownerMatch: '一致',
    assignStatus: '服务资产',
    salvageValue: 5440,
    depreciationPct: 43,
    repairCost: 1200,
    lastTicket: '本月补丁窗口完成',
    controlledSoftware: 'PostgreSQL / Backup Agent 正常',
    aiAdvice: '数据库服务资产运行稳定，但使用率较高。建议保留当前扩容观察，并在月报中提示 Q4 存储预算。',
    liveCpu: 22,
    liveRam: 55,
  },
  {
    id: 'A-2024-006',
    name: 'PC-FIN-023',
    model: 'ThinkPad E15',
    assignee: '陈出纳',
    dept: '财务部',
    status: 'warning',
    mac: 'D8:9E:F3:44:23:06',
    ip: '192.168.10.123',
    purchaseCost: 5900,
    purchaseDate: '2022-04-22',
    bookValue: 1050,
    usage: 43,
    risk: 'medium',
    heartbeat: '刚刚',
    health: 71,
    serial: 'LEN-E15-2204-06',
    vlan: 'VLAN 10 / Agent',
    cpu: 'Intel Core i5-1135G7',
    ram: '8 GB DDR4',
    disk: '512 GB SSD',
    os: 'Windows 10 Enterprise',
    location: '财务部 5F-出纳区',
    assignedAt: '2022-04-25',
    lastUser: 'chen.cashier',
    ownerMatch: '一致',
    assignStatus: '已分配',
    salvageValue: 472,
    depreciationPct: 82,
    repairCost: 740,
    lastTicket: '内存占用持续高于 90%',
    controlledSoftware: '财务软件授权正常',
    aiAdvice: '内存压力偏高但设备仍可用。建议先升级内存或优化启动项，换新预算优先级低于 PC-HR-003。',
    liveCpu: 15,
    liveRam: 95,
  },
  {
    id: 'A-2024-007',
    name: 'PC-SALE-015',
    model: 'OptiPlex 5090',
    assignee: '待调拨',
    dept: '销售部',
    status: 'idle',
    mac: '00:1A:2B:50:90:15',
    ip: '192.168.10.148',
    purchaseCost: 5100,
    purchaseDate: '2023-02-14',
    bookValue: 2260,
    usage: 9,
    risk: 'high',
    heartbeat: '7天前',
    health: 88,
    serial: 'OPTI-5090-SALE-015',
    vlan: 'VLAN 10 / ARP 7天前',
    cpu: 'Intel Core i5-10505',
    ram: '16 GB DDR4',
    disk: '512 GB NVMe SSD',
    os: 'Windows 11 Pro',
    location: '销售部库房 B-03',
    assignedAt: '2023-02-16',
    lastUser: 'sale.temp',
    ownerMatch: '可调拨',
    assignStatus: '闲置池',
    salvageValue: 408,
    depreciationPct: 56,
    repairCost: 180,
    lastTicket: '7 天无登录，30 天使用率 9%',
    controlledSoftware: 'Adobe Acrobat Pro 60 天未使用，可回收',
    aiAdvice: '健康度较高但使用率低，建议调拨给新员工并释放 Adobe 授权；确认后生成调拨单、IP 释放/重绑任务。',
    liveCpu: 0,
    liveRam: 4,
  },
]

const baseCounts = {
  all: 486,
  online: 412,
  warning: 38,
  offline: 24,
  idle: 12,
}

const formatCurrency = (value: number) => `¥${value.toLocaleString('zh-CN')}`

const emptyForm: AssetForm = {
  id: 'A-2024-008',
  name: '',
  model: '',
  dept: '市场部',
  assignee: '',
  status: 'online',
}

function createAssetFromForm(form: AssetForm, index: number): Asset {
  const isIdle = form.status === 'idle'
  const assignee = form.assignee.trim() || (isIdle ? '待调拨' : '未分配')
  const purchaseCost = isIdle ? 5200 : 6800

  return {
    id: form.id.trim() || `A-2024-${String(index).padStart(3, '0')}`,
    name: form.name.trim() || 'PC-GENERIC-99',
    model: form.model.trim() || 'Generic PC',
    assignee,
    dept: form.dept,
    status: form.status,
    mac: `A8:5E:45:${String(index).padStart(2, '0')}:7C:10`,
    ip: `192.168.10.${150 + index}`,
    purchaseCost,
    purchaseDate: '2026-06-17',
    bookValue: Math.round(purchaseCost * 0.84),
    usage: isIdle ? 8 : 35,
    risk: isIdle ? 'medium' : 'low',
    heartbeat: form.status === 'offline' ? '未采集' : '刚刚',
    health: form.status === 'warning' ? 72 : form.status === 'offline' ? 58 : 92,
    serial: `MANUAL-${String(index).padStart(4, '0')}`,
    vlan: 'VLAN 10 / 手工录入',
    cpu: '待 Agent 采集',
    ram: '待 Agent 采集',
    disk: '待 Agent 采集',
    os: '待 Agent 采集',
    location: `${form.dept} 待确认工位`,
    assignedAt: '2026-06-17',
    lastUser: assignee === '未分配' || assignee === '待调拨' ? '无最近登录' : assignee,
    ownerMatch: '待确认',
    assignStatus: isIdle ? '闲置池' : assignee === '未分配' ? '待分配' : '已分配',
    salvageValue: Math.round(purchaseCost * 0.08),
    depreciationPct: 16,
    repairCost: 0,
    lastTicket: '新录入资产，暂无维修记录',
    controlledSoftware: '待软件清单同步',
    aiAdvice: '新录入资产已进入台账，建议等待 Agent 首次心跳后再生成调拨、预算或软件回收动作。',
    liveCpu: form.status === 'offline' ? 0 : 12,
    liveRam: form.status === 'offline' ? 0 : 28,
  }
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all')
  const [keyword, setKeyword] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all')
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all')
  const [sortField, setSortField] = useState<SortField>('id')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [ocrOpen, setOcrOpen] = useState(false)
  const [ocrPhase, setOcrPhase] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<AssetForm>(emptyForm)
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null)

  const dynamicCounts = useMemo(() => {
    const extra = Math.max(0, assets.length - initialAssets.length)
    return {
      all: baseCounts.all + extra,
      online: baseCounts.online + assets.slice(initialAssets.length).filter((a) => a.status === 'online').length,
      warning: baseCounts.warning + assets.slice(initialAssets.length).filter((a) => a.status === 'warning').length,
      offline: baseCounts.offline + assets.slice(initialAssets.length).filter((a) => a.status === 'offline').length,
      idle: baseCounts.idle + assets.slice(initialAssets.length).filter((a) => a.status === 'idle').length,
    }
  }, [assets])

  const filteredAssets = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    const rows = assets.filter((asset) => {
      const text = [asset.id, asset.name, asset.model, asset.assignee, asset.dept, asset.mac, asset.ip].join(' ').toLowerCase()
      const isPoolAssignee = asset.assignee === '待调拨' || asset.assignStatus.includes('闲置')
      const isUnassigned = asset.assignee === '未分配'
      const assigneeMatched =
        assigneeFilter === 'all' ||
        (assigneeFilter === 'assigned' && !isUnassigned && !isPoolAssignee) ||
        (assigneeFilter === 'unassigned' && isUnassigned) ||
        (assigneeFilter === 'pool' && isPoolAssignee)

      return (
        (statusFilter === 'all' || asset.status === statusFilter) &&
        (!normalizedKeyword || text.includes(normalizedKeyword)) &&
        (deptFilter === 'all' || asset.dept === deptFilter) &&
        assigneeMatched &&
        (riskFilter === 'all' || asset.risk === riskFilter)
      )
    })

    return [...rows].sort((a, b) => {
      const direction = sortDir === 'asc' ? 1 : -1
      const valueA = getSortValue(a, sortField)
      const valueB = getSortValue(b, sortField)

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * direction
      }

      return String(valueA).localeCompare(String(valueB), 'zh-CN') * direction
    })
  }, [assets, assigneeFilter, deptFilter, keyword, riskFilter, sortDir, sortField, statusFilter])

  const openOcrModal = () => {
    setOcrOpen(true)
    setOcrPhase('idle')
  }

  const simulateOcr = () => {
    setOcrPhase('scanning')
    window.setTimeout(() => setOcrPhase('done'), 850)
  }

  const confirmOcrImport = () => {
    const newAsset: Asset = {
      ...createAssetFromForm(
        {
          id: 'A-2024-009',
          name: 'PC-DEV-033',
          model: 'ThinkPad X1 Carbon Gen 10',
          dept: '研发部',
          assignee: '新员工待领用',
          status: 'online',
        },
        assets.length + 1,
      ),
      purchaseCost: 11800,
      bookValue: 9912,
      serial: 'CN-01A24B-908',
      cpu: 'Intel Core i7-1260P',
      ram: '16 GB LPDDR5',
      disk: '1 TB SSD NVMe',
      os: 'Windows 11 Pro',
      aiAdvice: 'OCR 已完成结构化识别。建议绑定采购单和使用人后再进入正式领用流程。',
    }

    setAssets((current) => [...current, newAsset])
    setOcrOpen(false)
    showToast('资产 PC-DEV-033 录入台账成功', 'success')
  }

  const confirmAddAsset = () => {
    const newAsset = createAssetFromForm(form, assets.length + 1)
    setAssets((current) => [...current, newAsset])
    setAddOpen(false)
    setForm({
      ...emptyForm,
      id: `A-2024-${String(assets.length + 2).padStart(3, '0')}`,
    })
    showToast(`新资产设备 ${newAsset.name} 录入成功`, 'success')
  }

  const resetFilters = () => {
    setStatusFilter('all')
    setKeyword('')
    setDeptFilter('all')
    setAssigneeFilter('all')
    setRiskFilter('all')
    setSortField('id')
    setSortDir('asc')
    showToast('资产筛选与排序已重置', 'info')
  }

  const sortByHeader = (field: SortField) => {
    if (sortField === field) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortField(field)
    setSortDir('asc')
  }

  const showToast = (message: string, tone: ToastTone = 'info') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 2600)
  }

  const filterButtons: { key: AssetStatus | 'all'; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: dynamicCounts.all },
    { key: 'online', label: '在线', count: dynamicCounts.online },
    { key: 'warning', label: '告警', count: dynamicCounts.warning },
    { key: 'offline', label: '离线', count: dynamicCounts.offline },
    { key: 'idle', label: '闲置', count: dynamicCounts.idle },
  ]

  return (
    <div className="assets-page">
      <div className="assets-page-head">
        <div>
          <span className="assets-kicker">Asset Operations</span>
          <h2>资产管理</h2>
          <p>统一管理终端、服务器、网络与软件归属，辅助盘点、调拨、换新预算和闲置回收。</p>
        </div>
        <div className="assets-head-actions">
          <button className="btn btn-secondary btn-sm" type="button" onClick={openOcrModal}>
            <CameraIcon /> OCR 扫码录入
          </button>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => setAddOpen(true)}>
            <PlusIcon /> 添加资产
          </button>
        </div>
      </div>

      <div className="asset-kpi-grid">
        <KpiCard title="资产总数" value={dynamicCounts.all} hint="本月新增 12 台" tone="blue" />
        <KpiCard title="在线资产" value={dynamicCounts.online} hint="Agent 心跳正常" tone="green" />
        <KpiCard title="性能告警" value={dynamicCounts.warning} hint="需关注维修成本" tone="yellow" />
        <KpiCard title="离线资产" value={dynamicCounts.offline} hint="待盘点或回收" tone="red" />
        <KpiCard title="闲置资产" value={dynamicCounts.idle} hint="可调拨 / 可释放授权" tone="purple" />
      </div>

      <div className="asset-filter-row">
        {filterButtons.map((item) => (
          <button
            key={item.key}
            className={`btn btn-ghost btn-sm asset-filter-btn ${statusFilter === item.key ? 'active' : ''}`}
            type="button"
            onClick={() => setStatusFilter(item.key)}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      <div className="asset-control-bar">
        <label className="asset-control">
          <span>关键词</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="资产编号 / 设备名 / 使用人 / MAC / IP"
          />
        </label>
        <label className="asset-control">
          <span>部门</span>
          <select value={deptFilter} onChange={(event) => setDeptFilter(event.target.value)}>
            <option value="all">全部部门</option>
            {departments.map((dept) => (
              <option value={dept} key={dept}>{dept}</option>
            ))}
          </select>
        </label>
        <label className="asset-control">
          <span>使用人</span>
          <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value as AssigneeFilter)}>
            <option value="all">全部</option>
            <option value="assigned">已分配</option>
            <option value="unassigned">未分配</option>
            <option value="pool">待调拨 / 资产池</option>
          </select>
        </label>
        <label className="asset-control">
          <span>闲置风险</span>
          <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskLevel | 'all')}>
            <option value="all">全部风险</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </label>
        <label className="asset-control">
          <span>排序字段</span>
          <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
            <option value="id">资产编号</option>
            <option value="name">设备名称</option>
            <option value="assignee">使用人</option>
            <option value="dept">部门</option>
            <option value="purchaseCost">购入金额</option>
            <option value="purchaseDate">购入日期</option>
            <option value="bookValue">账面净值</option>
            <option value="usage">使用率</option>
            <option value="risk">闲置风险</option>
          </select>
        </label>
        <label className="asset-control">
          <span>方向</span>
          <select value={sortDir} onChange={(event) => setSortDir(event.target.value as SortDir)}>
            <option value="asc">升序</option>
            <option value="desc">降序</option>
          </select>
        </label>
        <button className="btn btn-secondary btn-sm asset-reset-btn" type="button" onClick={resetFilters}>重置</button>
      </div>

      <div className="data-table-container asset-table-container">
        <table className="data-table asset-table">
          <thead>
            <tr>
              <SortableTh field="id" activeField={sortField} dir={sortDir} onSort={sortByHeader}>资产编号</SortableTh>
              <SortableTh field="name" activeField={sortField} dir={sortDir} onSort={sortByHeader}>设备名称</SortableTh>
              <th>型号</th>
              <SortableTh field="assignee" activeField={sortField} dir={sortDir} onSort={sortByHeader}>使用人</SortableTh>
              <SortableTh field="dept" activeField={sortField} dir={sortDir} onSort={sortByHeader}>部门</SortableTh>
              <th>状态</th>
              <th>MAC</th>
              <th>IP</th>
              <SortableTh field="purchaseCost" activeField={sortField} dir={sortDir} onSort={sortByHeader}>购入金额</SortableTh>
              <SortableTh field="purchaseDate" activeField={sortField} dir={sortDir} onSort={sortByHeader}>购入日期</SortableTh>
              <SortableTh field="bookValue" activeField={sortField} dir={sortDir} onSort={sortByHeader}>账面净值</SortableTh>
              <SortableTh field="usage" activeField={sortField} dir={sortDir} onSort={sortByHeader}>使用率</SortableTh>
              <SortableTh field="risk" activeField={sortField} dir={sortDir} onSort={sortByHeader}>闲置风险</SortableTh>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((asset) => (
              <tr key={asset.id} onClick={() => setSelectedAsset(asset)} className="asset-row">
                <td className="mono-cell">{asset.id}</td>
                <td><strong>{asset.name}</strong></td>
                <td>{asset.model}</td>
                <td className={asset.assignee === '未分配' || asset.assignee === '待调拨' ? 'asset-muted' : ''}>{asset.assignee}</td>
                <td>{asset.dept}</td>
                <td><span className={`status-dot ${asset.status}`}>{statusMap[asset.status].label}</span></td>
                <td className="mono-cell">{asset.mac}</td>
                <td className="mono-cell">{asset.ip}</td>
                <td>{formatCurrency(asset.purchaseCost)}</td>
                <td>{asset.purchaseDate}</td>
                <td>{formatCurrency(asset.bookValue)}</td>
                <td>{asset.usage}%</td>
                <td><span className={riskMap[asset.risk].className}>{riskMap[asset.risk].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAssets.length === 0 && (
          <div className="asset-empty">当前筛选条件下暂无资产，请调整筛选项。</div>
        )}
      </div>

      <AssetDrawer
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onAction={(message, tone) => showToast(message, tone)}
      />

      <OcrModal
        open={ocrOpen}
        phase={ocrPhase}
        onClose={() => setOcrOpen(false)}
        onSelect={simulateOcr}
        onConfirm={confirmOcrImport}
      />

      <AddAssetModal
        open={addOpen}
        form={form}
        onChange={setForm}
        onClose={() => setAddOpen(false)}
        onConfirm={confirmAddAsset}
      />

      {toast && (
        <div className="asset-toast-wrap">
          <div className={`asset-toast ${toast.tone}`}>
            <span>{toastIcon(toast.tone)}</span>
            <strong>{toast.message}</strong>
          </div>
        </div>
      )}
    </div>
  )
}

function getSortValue(asset: Asset, field: SortField) {
  if (field === 'risk') return riskMap[asset.risk].score
  return asset[field]
}

function KpiCard({ title, value, hint, tone }: { title: string; value: number; hint: string; tone: string }) {
  return (
    <div className={`asset-kpi-card asset-kpi-${tone}`}>
      <div className="asset-kpi-icon"><MonitorIcon /></div>
      <strong>{value}</strong>
      <span>{title}</span>
      <em>{hint}</em>
    </div>
  )
}

function SortableTh({
  field,
  activeField,
  dir,
  onSort,
  children,
}: {
  field: SortField
  activeField: SortField
  dir: SortDir
  onSort: (field: SortField) => void
  children: string
}) {
  const active = activeField === field
  return (
    <th
      className={`asset-sortable ${active ? `active ${dir}` : ''}`}
      onClick={() => onSort(field)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {children}
    </th>
  )
}

function AssetDrawer({
  asset,
  onClose,
  onAction,
}: {
  asset: Asset | null
  onClose: () => void
  onAction: (message: string, tone: ToastTone) => void
}) {
  const tone = asset ? statusMap[asset.status].tone : 'green'

  return (
    <>
      <div className={`asset-drawer-overlay ${asset ? 'active' : ''}`} onClick={onClose} />
      <aside className={`asset-drawer ${asset ? 'active' : ''}`} aria-hidden={!asset}>
        {asset && (
          <>
            <div className="asset-drawer-header">
              <div>
                <span>资产详情</span>
                <h3>{asset.name}</h3>
              </div>
              <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>关闭</button>
            </div>
            <div className="asset-drawer-body">
              <div className="asset-health-card">
                <div>
                  <span>Zabbix Agent 评估健康度</span>
                  <strong className={`health-${tone}`}>{asset.health} / 100</strong>
                </div>
                <span className={`badge badge-${tone}`}>{statusMap[asset.status].badge}</span>
              </div>

              <DrawerBlock title="硬件核心规格">
                <div className="asset-spec-grid">
                  <Spec label="序列号 (S/N)" value={asset.serial} mono />
                  <Spec label="IP 绑定地址" value={asset.ip} mono />
                  <Spec label="主 MAC 地址" value={asset.mac} mono />
                  <Spec label="VLAN / 来源" value={asset.vlan} />
                  <Spec label="CPU 处理器" value={asset.cpu} />
                  <Spec label="RAM 运行内存" value={asset.ram} />
                  <Spec label="系统固态硬盘" value={asset.disk} />
                  <Spec label="操作系统" value={asset.os} />
                </div>
              </DrawerBlock>

              <DrawerBlock title="分配与使用人">
                <div className="mini-metric-grid">
                  <MiniMetric label="当前使用人" value={asset.assignee} />
                  <MiniMetric label="所属部门" value={asset.dept} />
                  <MiniMetric label="分配状态" value={asset.assignStatus} />
                </div>
                <div className="asset-detail-copy">
                  <div>办公位置：<span>{asset.location}</span></div>
                  <div>分配时间：<span>{asset.assignedAt}</span>，最近登录：<span>{asset.lastUser}</span></div>
                  <div>账实一致性：<span className={asset.ownerMatch === '一致' ? 'risk-low' : asset.ownerMatch === '需盘点' ? 'risk-high' : 'risk-mid'}>{asset.ownerMatch}</span></div>
                </div>
              </DrawerBlock>

              <DrawerBlock title="成本与折旧">
                <div className="mini-metric-grid">
                  <MiniMetric label="购入金额" value={formatCurrency(asset.purchaseCost)} />
                  <MiniMetric label="购入日期" value={asset.purchaseDate} />
                  <MiniMetric label="账面净值" value={formatCurrency(asset.bookValue)} />
                </div>
                <div className="depreciation-line"><span style={{ width: `${asset.depreciationPct}%` }} /></div>
                <div className="asset-salvage-row"><span>原值</span><span>预计残值 {formatCurrency(asset.salvageValue)}</span></div>
              </DrawerBlock>

              <DrawerBlock title="维修成本与软件清单">
                <div className="asset-detail-copy">
                  <div>累计维修成本：<b>{formatCurrency(asset.repairCost)}</b>，最近工单：<span>{asset.lastTicket}</span></div>
                  <div>标准软件：Microsoft 365、Chrome、企业安全客户端</div>
                  <div>受控软件：<span>{asset.controlledSoftware}</span></div>
                </div>
              </DrawerBlock>

              <div className="drawer-block ai-advice-box">
                <h4>AI 盘活与预算建议</h4>
                <p>{asset.aiAdvice}</p>
                <div className="asset-drawer-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    type="button"
                    onClick={() => onAction('已生成资产调拨 / 预算待确认任务，等待管理员确认。', 'success')}
                  >
                    生成待确认动作
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => onAction('已打开资产成本报表视图演示入口。', 'info')}
                  >
                    查看报表
                  </button>
                </div>
              </div>

              <DrawerBlock title="实时性能状态">
                <div className="asset-live-stack">
                  <ProgressMetric label="CPU 利用率" value={asset.liveCpu} dangerAt={85} />
                  <ProgressMetric label="内存占用分配" value={asset.liveRam} dangerAt={90} />
                </div>
              </DrawerBlock>

              <DrawerBlock title="资产运维动作">
                <div className="asset-action-grid">
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => onAction('调试脚本已进入演示队列，真实执行需管理员确认。', 'warning')}>执行调试脚本</button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => onAction('远程屏幕控制为高风险动作，本阶段仅演示入口。', 'danger')}>远程屏幕控制</button>
                </div>
              </DrawerBlock>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

function DrawerBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="drawer-block">
      <h4>{title}</h4>
      {children}
    </section>
  )
}

function Spec({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="asset-spec-item">
      <span>{label}</span>
      <strong className={mono ? 'mono-cell' : ''}>{value}</strong>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ProgressMetric({ label, value, dangerAt }: { label: string; value: number; dangerAt: number }) {
  const color = value >= dangerAt ? 'var(--accent-red)' : value >= dangerAt - 15 ? 'var(--accent-yellow)' : 'var(--accent-blue)'

  return (
    <div>
      <div className="asset-progress-head">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}

function OcrModal({
  open,
  phase,
  onClose,
  onSelect,
  onConfirm,
}: {
  open: boolean
  phase: 'idle' | 'scanning' | 'done'
  onClose: () => void
  onSelect: () => void
  onConfirm: () => void
}) {
  const pct = phase === 'idle' ? 0 : phase === 'scanning' ? 68 : 100

  return (
    <ModalShell open={open} title="OCR 扫码资产录入" onClose={onClose}>
      <div className="asset-ocr-dropzone" onClick={onSelect}>
        <CameraIcon />
        <strong>点击上传设备资产标签贴纸照片</strong>
        <span>支持 PNG、JPG，OCR 将自动提取设备 SN 和产品型号</span>
        {phase !== 'idle' && <em>label_sticker_lenovo.jpg</em>}
      </div>
      {phase !== 'idle' && (
        <div className="asset-ocr-progress">
          <div className="asset-progress-head">
            <span>{phase === 'done' ? 'OCR 结构化字段识别成功' : '正在调用 PaddleOCR 识别设备 sticker 图像...'}</span>
            <strong>{pct}%</strong>
          </div>
          <div className="progress-bar"><div className="progress-bar-fill progress-bar-fill-green" style={{ width: `${pct}%` }} /></div>
        </div>
      )}
      {phase === 'done' && (
        <div className="asset-ocr-result">
          <div className="asset-ocr-result-title"><span /> PP-OCRv4 智能识别解析成功</div>
          <div className="asset-spec-grid">
            <Spec label="序列号 (S/N)" value="CN-01A24B-908" mono />
            <Spec label="生产厂商" value="Lenovo" />
            <Spec label="产品型号" value="ThinkPad X1 Carbon Gen 10" />
            <Spec label="设备类别" value="Notebook Laptop" />
          </div>
        </div>
      )}
      <div className="asset-modal-footer">
        <button className="btn btn-secondary btn-sm" type="button" onClick={onClose}>取消</button>
        <button className="btn btn-primary btn-sm" type="button" onClick={onConfirm} disabled={phase !== 'done'}>确认导入资产库</button>
      </div>
    </ModalShell>
  )
}

function AddAssetModal({
  open,
  form,
  onChange,
  onClose,
  onConfirm,
}: {
  open: boolean
  form: AssetForm
  onChange: (form: AssetForm) => void
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ModalShell open={open} title="新增资产设备台账" onClose={onClose}>
      <div className="asset-form-grid">
        <label>
          <span>资产编号 *</span>
          <input value={form.id} onChange={(event) => onChange({ ...form, id: event.target.value })} />
        </label>
        <label>
          <span>设备名称 *</span>
          <input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder="PC-MKT-012" />
        </label>
        <label>
          <span>产品型号 *</span>
          <input value={form.model} onChange={(event) => onChange({ ...form, model: event.target.value })} placeholder="ThinkPad L14" />
        </label>
        <label>
          <span>使用部门 *</span>
          <select value={form.dept} onChange={(event) => onChange({ ...form, dept: event.target.value })}>
            {departments.map((dept) => (
              <option value={dept} key={dept}>{dept}</option>
            ))}
          </select>
        </label>
        <label>
          <span>当前使用人</span>
          <input value={form.assignee} onChange={(event) => onChange({ ...form, assignee: event.target.value })} placeholder="例如：张三 / 未分配 / 待调拨" />
        </label>
        <label>
          <span>设备状态</span>
          <select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as AssetStatus })}>
            <option value="online">在线</option>
            <option value="warning">告警</option>
            <option value="offline">离线</option>
            <option value="idle">闲置</option>
          </select>
        </label>
      </div>
      <div className="asset-modal-note">
        本阶段为前端原型闭环，新资产会进入当前页面数据；真实入库、调拨、报废和预算提交需后端资产 API 接入后再执行。
      </div>
      <div className="asset-modal-footer">
        <button className="btn btn-secondary btn-sm" type="button" onClick={onClose}>取消</button>
        <button className="btn btn-primary btn-sm" type="button" onClick={onConfirm}>确认录入</button>
      </div>
    </ModalShell>
  )
}

function ModalShell({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <div className="asset-modal active" role="dialog" aria-modal="true">
      <div className="asset-modal-content">
        <div className="asset-modal-header">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>关闭</button>
        </div>
        <div className="asset-modal-body">{children}</div>
      </div>
    </div>
  )
}

function toastIcon(tone: ToastTone) {
  if (tone === 'success') return '✓'
  if (tone === 'warning') return '!'
  if (tone === 'danger') return '×'
  return 'i'
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function MonitorIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}
