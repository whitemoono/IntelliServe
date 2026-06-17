import { useState, useEffect, useCallback, useMemo } from 'react'
import { message, Modal, Input, Select, Switch } from 'antd'
import { kbApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'

const { TextArea } = Input

interface Article {
  id: string
  title: string
  content?: string
  category: string | null
  tags: string[]
  source_type?: string
  version?: number
  is_published: boolean
  embedding_model: string | null
  chunk_count: number | null
  view_count: number
  helpful_count: number
  not_helpful_count?: number
  created_at: string
  updated_at?: string
}

interface SearchResult {
  article_id: string
  title: string
  chunk_index: number
  content: string
  score: number
  category: string | null
  tags?: string[]
}

const categories = ['全部', '网络故障', 'Office 问题', '打印机', 'VPN', '系统配置']
const seedCategories = ['全部', '用户与排障', '部署运维', 'AI 与架构', ...categories.slice(1)]

const formatDate = (value?: string) => {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

const categoryName = (article: Pick<Article, 'category'>) => article.category || '未分类'

export default function KnowledgePage() {
  const user = useAuthStore((s) => s.user)
  const [articles, setArticles] = useState<Article[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeCategory, setActiveCategory] = useState('全部')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newTags, setNewTags] = useState('')
  const [newPublished, setNewPublished] = useState(true)
  const [loading, setLoading] = useState(false)
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null)
  const [deleting, setDeleting] = useState(false)
  const canDeleteArticles = user?.role === 'admin'

  const loadArticles = useCallback(async () => {
    setArticlesLoading(true)
    setLoadError('')
    try {
      const params: Record<string, any> = { page_size: 100 }
      if (activeCategory !== '全部') params.category = activeCategory
      const res = await kbApi.listArticles(params)
      setArticles(res.data.items || [])
    } catch (err: any) {
      const detail = err.response?.data?.detail || '知识库列表加载失败'
      setLoadError(detail)
      message.error(detail)
    } finally {
      setArticlesLoading(false)
    }
  }, [activeCategory])

  useEffect(() => { loadArticles() }, [loadArticles])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const res = await kbApi.search({ query: searchQuery, top_k: 8 })
      setSearchResults(res.data.results || [])
      if (res.data.results?.length === 0) {
        message.info('未找到相关内容')
      }
    } catch {
      message.warning('搜索服务暂不可用')
    } finally {
      setIsSearching(false)
    }
  }

  const handleCreate = async () => {
    if (!newTitle || !newContent) {
      message.warning('请填写标题和内容')
      return
    }
    setLoading(true)
    try {
      await kbApi.createArticle({
        title: newTitle,
        content: newContent,
        category: newCategory || undefined,
        tags: newTags.split(',').map((tag) => tag.trim()).filter(Boolean),
        is_published: newPublished,
      })
      message.success(newPublished ? '文章创建成功，正在自动向量化...' : '草稿创建成功')
      setShowCreate(false)
      setNewTitle('')
      setNewContent('')
      setNewCategory('')
      setNewTags('')
      setNewPublished(true)
      loadArticles()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '创建失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await kbApi.seed('ops')
      const data = res.data
      message.success(`已导入 ${data.imported} 篇运维文档，提交 ${data.index_tasks} 个索引任务`)
      await loadArticles()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '导入运维文档失败')
    } finally {
      setSeeding(false)
    }
  }

  const handleReindex = async (article: Article) => {
    try {
      await kbApi.reindex(article.id)
      message.success(`已提交重建索引：${article.title}`)
      loadArticles()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '重建索引失败')
    }
  }

  const requestDelete = (article: Article) => {
    if (!canDeleteArticles) {
      message.warning('只有管理员可以删除文章')
      return
    }

    setDeleteTarget(article)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      await kbApi.deleteArticle(deleteTarget.id)
      message.success('文章已删除')
      setArticles((prev) => prev.filter((item) => item.id !== deleteTarget.id))
      setSearchResults((prev) => prev.filter((item) => item.article_id !== deleteTarget.id))
      if (selectedArticle?.id === deleteTarget.id) {
        setDetailOpen(false)
        setSelectedArticle(null)
      }
      setDeleteTarget(null)
      await loadArticles()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const openArticle = async (articleOrId: Article | string) => {
    const id = typeof articleOrId === 'string' ? articleOrId : articleOrId.id
    const cached = typeof articleOrId === 'string'
      ? articles.find((article) => article.id === id)
      : articleOrId
    setSelectedArticle(cached || null)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await kbApi.getArticle(id)
      setSelectedArticle(res.data)
    } catch (err: any) {
      message.error(err.response?.data?.detail || '文章详情加载失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const totalChunks = articles.reduce((sum, article) => sum + (article.chunk_count || 0), 0)
  const indexedCount = articles.filter((article) => article.chunk_count && article.embedding_model).length
  const publishedCount = articles.filter((article) => article.is_published).length
  const draftCount = articles.length - publishedCount
  const unindexedPublishedCount = articles.filter((article) => article.is_published && !article.chunk_count).length
  const indexProgress = publishedCount ? Math.round((indexedCount / publishedCount) * 100) : 0

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>()
    articles.forEach((article) => {
      const key = categoryName(article)
      map.set(key, (map.get(key) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [articles])

  const filterCategories = useMemo(() => {
    const dynamic = articles.map((article) => categoryName(article))
    return Array.from(new Set([...seedCategories, ...dynamic]))
  }, [articles])

  const maxCategoryCount = Math.max(1, ...categoryStats.map((item) => item.count))
  const recentArticles = articles.slice(0, 5)

  return (
    <>
      <div className="kb-page-head">
        <div>
          <span className="demo-kicker">Knowledge Base</span>
          <h2>知识库</h2>
          <p>查看运维知识、索引状态、分类分布和 RAG 语义检索来源。</p>
        </div>
        <div className="kb-head-actions">
          <button className="btn btn-ghost btn-sm" onClick={loadArticles} disabled={articlesLoading}>
            刷新
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleSeed} disabled={seeding}>
            {seeding ? '导入中...' : '导入运维文档'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建文章
          </button>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-value" style={{ fontSize: '1.45rem' }}>{articles.length}</div>
          <div className="kpi-label">当前文章</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ fontSize: '1.45rem' }}>{publishedCount}</div>
          <div className="kpi-label">已发布</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ fontSize: '1.45rem' }}>{indexedCount}</div>
          <div className="kpi-label">已索引</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ fontSize: '1.45rem' }}>{totalChunks}</div>
          <div className="kpi-label">向量块</div>
        </div>
      </div>

      <div className="kb-visual-grid">
        <section className="kb-visual-card">
          <div className="kb-visual-header">
            <h3>索引可视化</h3>
            <span className={`badge ${unindexedPublishedCount ? 'badge-yellow' : 'badge-green'}`}>
              {unindexedPublishedCount ? `${unindexedPublishedCount} 篇待索引` : '索引完成'}
            </span>
          </div>
          <div className="kb-index-panel">
            <div className="kb-index-ring" style={{ ['--progress' as any]: `${indexProgress}%` }}>
              <strong>{indexProgress}%</strong>
              <span>发布文章索引率</span>
            </div>
            <div className="kb-index-steps">
              {[
                { label: '发布文章', value: publishedCount, tone: 'blue' },
                { label: '已向量化', value: indexedCount, tone: 'green' },
                { label: '待索引', value: unindexedPublishedCount, tone: unindexedPublishedCount ? 'yellow' : 'green' },
                { label: '草稿', value: draftCount, tone: 'purple' },
              ].map((item) => (
                <div className="kb-index-step" key={item.label}>
                  <span className={`kb-step-dot ${item.tone}`} />
                  <div>
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="kb-visual-card">
          <div className="kb-visual-header">
            <h3>分类分布</h3>
            <span className="badge badge-blue">{categoryStats.length || 0} 类</span>
          </div>
          <div className="kb-category-bars">
            {categoryStats.length === 0 && <div className="kb-muted">暂无分类数据</div>}
            {categoryStats.map((item) => (
              <div className="kb-category-row" key={item.name}>
                <div className="kb-category-row-head">
                  <span>{item.name}</span>
                  <strong>{item.count}</strong>
                </div>
                <div className="kb-bar">
                  <span style={{ width: `${Math.max(8, (item.count / maxCategoryCount) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="kb-visual-card">
          <div className="kb-visual-header">
            <h3>最近更新</h3>
            <span className="badge badge-purple">可查看</span>
          </div>
          <div className="kb-recent-list">
            {recentArticles.length === 0 && <div className="kb-muted">暂无文章</div>}
            {recentArticles.map((article) => (
              <button key={article.id} className="kb-recent-item" onClick={() => openArticle(article)}>
                <span>{article.title}</span>
                <em>{formatDate(article.updated_at || article.created_at)}</em>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="kb-search" style={{ position: 'relative', marginBottom: 20 }}>
        <svg style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="语义搜索 — 用自然语言描述您的问题..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ width: '100%', padding: '14px 20px 14px 48px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', fontFamily: 'var(--font-sans)' }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSearch}
          disabled={isSearching}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
        >
          {isSearching ? '搜索中...' : '搜索'}
        </button>
      </div>

      <div className="kb-filter-row">
        <div className="kb-category-filter">
          {filterCategories.map((cat) => (
            <span
              key={cat}
              className={`badge ${activeCategory === cat ? 'badge-blue' : ''}`}
              style={{ cursor: 'pointer', ...(activeCategory !== cat ? { background: '#f8fafc', color: 'var(--text-muted)', border: '1px solid var(--border-color)' } : {}) }}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </span>
          ))}
        </div>
        <div className="kb-view-switch">
          <button className={viewMode === 'cards' ? 'active' : ''} onClick={() => setViewMode('cards')}>卡片</button>
          <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>表格</button>
        </div>
      </div>

      {searchResults.length > 0 && (
        <div className="kb-search-results">
          <div className="kb-section-title">
            <h3>语义搜索结果</h3>
            <span>{searchResults.length} 条来源片段</span>
          </div>
          <div className="kb-result-grid">
            {searchResults.map((result, i) => (
              <button key={`${result.article_id}-${result.chunk_index}-${i}`} className="kb-result-card" onClick={() => openArticle(result.article_id)}>
                <div className="kb-result-card-head">
                  <strong>{result.title}</strong>
                  <span className="badge badge-blue">{Math.round(result.score * 100)}%</span>
                </div>
                <p>{result.content}</p>
                <div className="kb-result-meta">
                  <span>{result.category || '未分类'}</span>
                  <span>Chunk #{result.chunk_index + 1}</span>
                  <span>查看文章</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

          <div className="kb-section-title">
            <h3>文章库</h3>
            <span>{articlesLoading ? '加载中' : `${articles.length} 篇 · ${canDeleteArticles ? '管理员可删除' : '只读'}`}</span>
          </div>

      <div className="kb-list">
        {articlesLoading && <div className="empty-state">正在加载知识库...</div>}
        {!articlesLoading && loadError && (
          <div className="empty-state">
            <h3>知识库加载失败</h3>
            <p>{loadError}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" onClick={loadArticles}>重新加载</button>
            </div>
          </div>
        )}
        {!articlesLoading && !loadError && articles.length === 0 && (
          <div className="empty-state">
            <h3>暂无知识库文章</h3>
            <p>可以先导入内置运维文档，或在这里手工新建文章。</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" onClick={handleSeed} disabled={seeding}>
                {seeding ? '导入中...' : '导入运维文档'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>新建文章</button>
            </div>
          </div>
        )}

        {!articlesLoading && articles.length > 0 && viewMode === 'cards' && (
          <div className="kb-card-grid">
            {articles.map((article) => (
              <article
                key={article.id}
                className="kb-article kb-article-card"
                role="button"
                tabIndex={0}
                onClick={() => openArticle(article)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openArticle(article)
                  }
                }}
              >
                <div className="kb-article-top">
                  <span className={`badge ${article.is_published ? 'badge-green' : 'badge-purple'}`}>
                    {article.is_published ? '已发布' : '草稿'}
                  </span>
                  <span className={`badge ${article.chunk_count ? 'badge-blue' : 'badge-yellow'}`}>
                    {article.chunk_count ? `${article.chunk_count} 块` : '未索引'}
                  </span>
                </div>
                <h4>{article.title}</h4>
                <p>{article.tags?.length ? article.tags.join(' / ') : categoryName(article)}</p>
                <div className="kb-article-footer">
                  <span>{categoryName(article)}</span>
                  <span>{article.embedding_model || '等待向量化'}</span>
                  <span>{formatDate(article.updated_at || article.created_at)}</span>
                </div>
                <div className="kb-card-actions">
                  <span>查看详情</span>
                  <div className="kb-card-action-buttons">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleReindex(article)
                      }}
                    >
                      重建索引
                    </button>
                    {canDeleteArticles && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          requestDelete(article)
                        }}
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {!articlesLoading && articles.length > 0 && viewMode === 'table' && (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>分类</th>
                  <th>状态</th>
                  <th>索引</th>
                  <th>模型</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id} className="kb-table-row" onClick={() => openArticle(article)}>
                    <td>{article.title}</td>
                    <td>{categoryName(article)}</td>
                    <td><span className={`badge ${article.is_published ? 'badge-green' : 'badge-purple'}`}>{article.is_published ? '已发布' : '草稿'}</span></td>
                    <td>{article.chunk_count ? `${article.chunk_count} 块` : '未索引'}</td>
                    <td>{article.embedding_model || '等待向量化'}</td>
                    <td>{formatDate(article.updated_at || article.created_at)}</td>
                    <td>
                      <div className="kb-row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleReindex(article)
                          }}
                        >
                          重建索引
                        </button>
                        {canDeleteArticles && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation()
                              requestDelete(article)
                            }}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        title={selectedArticle?.title || '文章详情'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={[
          <button key="close" className="btn btn-secondary btn-sm" onClick={() => setDetailOpen(false)}>关闭</button>,
          selectedArticle && (
            <div key="actions" className="kb-detail-footer-actions">
              <button key="reindex" className="btn btn-primary btn-sm" onClick={() => handleReindex(selectedArticle)}>
                重建索引
              </button>
              {canDeleteArticles && (
                <button
                  key="delete"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    setDetailOpen(false)
                    requestDelete(selectedArticle)
                  }}
                >
                  删除
                </button>
              )}
            </div>
          ),
        ]}
        width={920}
      >
        <div className="kb-detail-modal">
          {detailLoading && <div className="empty-state">正在加载文章详情...</div>}
          {!detailLoading && selectedArticle && (
            <>
              <div className="kb-detail-meta">
                <span className={`badge ${selectedArticle.is_published ? 'badge-green' : 'badge-purple'}`}>{selectedArticle.is_published ? '已发布' : '草稿'}</span>
                <span className="badge badge-blue">{categoryName(selectedArticle)}</span>
                <span>版本 v{selectedArticle.version || 1}</span>
                <span>{selectedArticle.source_type || 'manual'}</span>
                <span>{selectedArticle.chunk_count ? `${selectedArticle.chunk_count} 个向量块` : '未索引'}</span>
                <span>{selectedArticle.embedding_model || '等待向量化'}</span>
              </div>
              <div className="kb-detail-tags">
                {(selectedArticle.tags || []).length === 0 && <span className="kb-muted">暂无标签</span>}
                {(selectedArticle.tags || []).map((tag) => <span key={tag}>#{tag}</span>)}
              </div>
              <div className="kb-detail-stats">
                <div><strong>{selectedArticle.view_count || 0}</strong><span>查看</span></div>
                <div><strong>{selectedArticle.helpful_count || 0}</strong><span>有帮助</span></div>
                <div><strong>{selectedArticle.not_helpful_count || 0}</strong><span>无帮助</span></div>
                <div><strong>{formatDate(selectedArticle.updated_at || selectedArticle.created_at)}</strong><span>更新时间</span></div>
              </div>
              <article className="kb-detail-content">
                {selectedArticle.content || '暂无正文内容'}
              </article>
            </>
          )}
        </div>
      </Modal>

      <Modal
        title="新建知识库文章"
        open={showCreate}
        onOk={handleCreate}
        onCancel={() => setShowCreate(false)}
        confirmLoading={loading}
        okText="创建并发布"
        cancelText="取消"
        width={700}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '.85rem', color: 'var(--text-secondary)' }}>标题</label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="文章标题" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '.85rem', color: 'var(--text-secondary)' }}>分类</label>
            <Select
              value={newCategory || undefined}
              onChange={(v) => setNewCategory(v)}
              placeholder="选择分类"
              style={{ width: '100%' }}
              options={filterCategories.filter((c) => c !== '全部').map((c) => ({ label: c, value: c }))}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '.85rem', color: 'var(--text-secondary)' }}>标签</label>
            <Input value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="多个标签用英文逗号分隔" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '.85rem', color: 'var(--text-secondary)' }}>内容 (Markdown)</label>
            <TextArea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="输入文章内容，支持 Markdown 格式..."
              rows={10}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Switch checked={newPublished} onChange={setNewPublished} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>创建后发布并向量化</span>
          </div>
        </div>
      </Modal>

      <Modal
        title="确认删除文章？"
        open={!!deleteTarget}
        onOk={confirmDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        confirmLoading={deleting}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p style={{ marginTop: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          删除后会同时尝试清理向量库中的索引，无法从页面恢复。
        </p>
        <p style={{ marginTop: 10, fontWeight: 700, color: 'var(--text-heading)' }}>
          {deleteTarget?.title}
        </p>
      </Modal>
    </>
  )
}
