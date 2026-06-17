import { useState, useEffect, useCallback } from 'react'
import { Modal, Input, Select, message } from 'antd'
import { authApi } from '../services/api'

interface User {
  id: string
  employee_id: string
  name: string
  email: string | null
  role: string
  is_active: boolean
  created_at: string
}

const roleColors: Record<string, string> = { admin: 'red', engineer: 'blue', user: 'green' }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ employee_id: '', name: '', email: '', password: '', role: 'user' })
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(false)

  const loadUsers = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await authApi.listUsers({ page_size: 100 })
      setUsers(res.data.items || [])
    } catch (err: any) {
      message.error(err.response?.data?.detail || '用户列表加载失败')
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleCreate = async () => {
    if (!form.employee_id || !form.name || !form.password) {
      message.warning('请填写必填字段')
      return
    }
    setLoading(true)
    try {
      await authApi.createUser(form)
      message.success('用户创建成功')
      setShowCreate(false)
      setForm({ employee_id: '', name: '', email: '', password: '', role: 'user' })
      loadUsers()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <h2 style={{ fontSize: '1.4rem' }}>用户管理</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ 添加用户</button>
      </div>
      <div className="data-table-container">
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['用户名', '姓名', '邮箱', '角色', '状态', '最后登录'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listLoading && (
              <tr>
                <td colSpan={6} style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>正在加载用户...</td>
              </tr>
            )}
            {!listLoading && users.map((u) => (
              <tr key={u.id}>
                <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border-color)' }}>{u.employee_id}</td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>{u.name}</td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>{u.email}</td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}><span className={`badge badge-${roleColors[u.role]}`}>{u.role}</span></td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}><span className={`status-dot ${u.is_active ? 'online' : 'offline'}`}>{u.is_active ? '活跃' : '停用'}</span></td>
                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>{new Date(u.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!listLoading && users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>暂无用户</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal title="添加用户" open={showCreate} onOk={handleCreate} onCancel={() => setShowCreate(false)} confirmLoading={loading} okText="创建" cancelText="取消">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div><label style={{ display: 'block', marginBottom: 6, fontSize: '.85rem', color: 'var(--text-secondary)' }}>工号 *</label><Input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} /></div>
          <div><label style={{ display: 'block', marginBottom: 6, fontSize: '.85rem', color: 'var(--text-secondary)' }}>姓名 *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label style={{ display: 'block', marginBottom: 6, fontSize: '.85rem', color: 'var(--text-secondary)' }}>邮箱</label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label style={{ display: 'block', marginBottom: 6, fontSize: '.85rem', color: 'var(--text-secondary)' }}>密码 *</label><Input.Password value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div><label style={{ display: 'block', marginBottom: 6, fontSize: '.85rem', color: 'var(--text-secondary)' }}>角色</label><Select value={form.role} onChange={(v) => setForm({ ...form, role: v })} style={{ width: '100%' }} options={[{ label: '管理员', value: 'admin' }, { label: '工程师', value: 'engineer' }, { label: '普通用户', value: 'user' }]} /></div>
        </div>
      </Modal>
    </>
  )
}
