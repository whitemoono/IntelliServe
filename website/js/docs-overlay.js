let modalFuse = null;
let modalCurrentDoc = null;

function openDocsOverlay(initPath = null) {
  const overlay = document.getElementById('docs-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 50);
  document.body.style.overflow = 'hidden';

  buildModalSidebar();
  
  if (initPath) {
    loadModalDoc(initPath);
  } else {
    showModalWelcome();
  }
}

function closeDocsOverlay() {
  const overlay = document.getElementById('docs-overlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  setTimeout(() => overlay.style.display = 'none', 300);
  document.body.style.overflow = '';

  const url = new URL(window.location.href);
  url.searchParams.delete('doc');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

function getModalDocContent(path) {
  if (!path) return null;
  let md = DOCS_DATA[path];
  if (!md) {
    const normalized = path.replace(/\\/g, '/');
    for (const key in DOCS_DATA) {
      const kn = key.replace(/\\/g, '/');
      if (kn.endsWith(normalized) || normalized.endsWith(kn.split('/doc/').pop() || '')) {
        md = DOCS_DATA[key];
        break;
      }
    }
  }
  return md || null;
}

function findModalRegistryItem(path) {
  for (const sec of DOC_REGISTRY) {
    for (const item of sec.items) {
      if (item.path === path) {
        return { section: sec.section, item };
      }
    }
  }
  return null;
}

function getModalStatusBadgeClass(status) {
  if (!status) return 'status-draft';
  if (status.includes('完稿') || status.includes('发布') || status.includes('通过')) return 'status-done';
  if (status.includes('审核') || status.includes('评审')) return 'status-review';
  return 'status-draft';
}

function getModalBadgeColor(path) {
  if (path.includes('architecture/')) return 'blue';
  if (path.includes('api/') || path.includes('data/')) return 'green';
  if (path.includes('deployment/')) return 'yellow';
  if (path.includes('user-guides/')) return 'purple';
  return 'blue';
}

function getModalCategory(path) {
  if (path.includes('architecture/')) return '架构与设计';
  if (path.includes('api/')) return 'API与通信';
  if (path.includes('data/')) return '数据与存储';
  if (path.includes('deployment/')) return '部署与运维';
  if (path.includes('user-guides/')) return '用户使用指南';
  return '文档';
}

function showModalWelcome() {
  modalCurrentDoc = null;
  document.getElementById('modal-content-inner').innerHTML = `
    <div class="welcome">
      <h2>IntelliServe IT Suite 文档中心</h2>
      <p>从左侧导航选择一篇文档开始阅读，或使用上方搜索框快速查找。</p>
      <div class="welcome-cards">
        <div class="welcome-card" onclick="loadModalDoc('doc/architecture/DOC-01-系统架构规格书.md')">
          <h4>快速开始</h4>
          <p>系统架构规格书</p>
        </div>
        <div class="welcome-card" onclick="loadModalDoc('doc/deployment/DOC-11-部署指南.md')">
          <h4>部署指南</h4>
          <p>Docker 一键部署</p>
        </div>
        <div class="welcome-card" onclick="loadModalDoc('doc/api/DOC-05-REST-API规范.md')">
          <h4>API 参考</h4>
          <p>REST API 端点</p>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-toc-list').innerHTML = '<li style="color:var(--text3);font-size:.82rem;padding:0 8px;">无目录</li>';
}

function buildModalSidebar() {
  const sb = document.getElementById('modal-sidebar-left');
  if (!sb) return;
  let html = '';
  DOC_REGISTRY.forEach((sec, si) => {
    html += `<div class="sb-section" data-section="${si}">
      <div class="sb-section-title" onclick="this.parentElement.classList.toggle('collapsed')">
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        ${sec.section}
      </div>
      <ul class="sb-list">`;
    sec.items.forEach(item => {
      const md = getModalDocContent(item.path);
      const size = md ? Math.round(md.length / 1024) + ' KB' : '';
      html += `<li><a href="#" data-path="${item.path}" onclick="event.preventDefault();loadModalDoc('${item.path}')">
        <span>${item.title}</span>
        <span class="doc-size">${size}</span>
      </a></li>`;
    });
    html += '</ul></div>';
  });
  sb.innerHTML = html;
}

function loadModalDoc(path) {
  let md = getModalDocContent(path);
  if (!md) {
    document.getElementById('modal-content-inner').innerHTML =
      '<div class="state-msg"><h3>文档未找到</h3><p>' + path + '</p></div>';
    return;
  }

  modalCurrentDoc = path;

  document.querySelectorAll('#modal-sidebar-left .sb-list a').forEach(a => a.classList.remove('active'));
  document.querySelectorAll(`#modal-sidebar-left .sb-list a[data-path="${path}"]`).forEach(a => {
    a.classList.add('active');
    const sec = a.closest('.sb-section');
    if (sec) sec.classList.remove('collapsed');
  });

  const registryInfo = findModalRegistryItem(path);
  const category = registryInfo ? registryInfo.section : getModalCategory(path);
  const title = registryInfo ? registryInfo.item.title : (path.split('/').pop().replace('.md', ''));
  const status = registryInfo ? registryInfo.item.status : '初稿';

  const html = marked.parse(md);
  
  const headerHtml = `
    <div class="content-header-area">
      <div class="breadcrumbs">
        <a href="#" onclick="event.preventDefault();showModalWelcome()">文档中心</a>
        <span class="separator">/</span>
        <span class="category-name">${category}</span>
        <span class="separator">/</span>
        <span class="current-doc-name">${title}</span>
      </div>
      <div class="action-buttons">
        <a href="vscode://file/D:/dev/IntelliServe IT Suite/${path}" class="action-btn edit-btn" title="在 VS Code 中编辑">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <span>在本地编辑</span>
        </a>
        <button class="action-btn copy-link-btn" onclick="copyModalDocLink('${path}')" title="复制文档链接">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span>复制链接</span>
        </button>
        <button class="action-btn copy-markdown-btn" onclick="copyModalMarkdownContent()" title="复制 Markdown 内容">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>复制 MD</span>
        </button>
      </div>
    </div>
    <div class="content-meta">
      <span class="badge badge-${getModalBadgeColor(path)}">${category}</span>
      <span class="badge badge-status ${getModalStatusBadgeClass(status)}">${status}</span>
      <span style="color:var(--text3);font-size:.82rem;margin-left:auto;">${Math.round(md.length / 1024)} KB</span>
    </div>
  `;

  document.getElementById('modal-content-inner').innerHTML = headerHtml + '<div class="md">' + html + '</div>';

  addModalCopyButtons();
  buildModalTOC();

  const url = new URL(window.location.href);
  url.searchParams.set('doc', path);
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);

  document.getElementById('modal-content').scrollTop = 0;
}

function buildModalTOC() {
  const headings = document.querySelectorAll('#modal-content-inner .md h2, #modal-content-inner .md h3');
  const tocList = document.getElementById('modal-toc-list');
  if (!headings.length) {
    tocList.innerHTML = '<li style="color:var(--text3);font-size:.82rem;padding:0 8px;">无目录</li>';
    return;
  }

  let html = '';
  headings.forEach((h, i) => {
    const id = 'modal-h-' + i;
    h.id = id;
    const cls = h.tagName === 'H3' ? ' toc-h3' : '';
    const text = h.textContent.replace(/^[\d.]+\s*/, '');
    html += `<li><a href="#${id}" class="toc-link${cls}" onclick="event.preventDefault();document.getElementById('${id}').scrollIntoView({behavior:'smooth',block:'start'})">${text}</a></li>`;
  });
  tocList.innerHTML = html;
}

function addModalCopyButtons() {
  document.querySelectorAll('#modal-content-inner pre').forEach(pre => {
    if (pre.querySelector('.copy-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = '复制';
    btn.onclick = () => {
      const code = pre.querySelector('code');
      navigator.clipboard.writeText(code.textContent).then(() => {
        btn.textContent = '已复制';
        setTimeout(() => btn.textContent = '复制', 1500);
      });
    };
    pre.style.position = 'relative';
    pre.appendChild(btn);
  });
}

function copyModalDocLink(path) {
  const url = new URL(window.location.href);
  url.searchParams.set('doc', path);
  navigator.clipboard.writeText(url.toString()).then(() => {
    alert('链接已复制到剪贴板！');
  });
}

function copyModalMarkdownContent() {
  if (!modalCurrentDoc) return;
  const md = getModalDocContent(modalCurrentDoc);
  if (md) {
    navigator.clipboard.writeText(md).then(() => {
      alert('Markdown 内容已复制！');
    });
  }
}

// Modal Search Logic
function initModalSearch() {
  const searchInput = document.getElementById('modal-search-input');
  const searchResults = document.getElementById('modal-search-results');
  if (!searchInput || !searchResults) return;

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (!q) { searchResults.classList.remove('show'); return; }

    if (!modalFuse && typeof Fuse !== 'undefined') {
      const searchItems = [];
      DOC_REGISTRY.forEach(sec => {
        sec.items.forEach(item => {
          const content = getModalDocContent(item.path) || '';
          searchItems.push({
            id: item.id,
            title: item.title,
            desc: item.desc,
            path: item.path,
            section: sec.section,
            content: content
          });
        });
      });

      modalFuse = new Fuse(searchItems, {
        keys: [
          { name: 'id', weight: 0.3 },
          { name: 'title', weight: 0.5 },
          { name: 'desc', weight: 0.3 },
          { name: 'content', weight: 0.1 }
        ],
        threshold: 0.4,
        ignoreLocation: true
      });
    }

    if (!modalFuse) return;

    const fuseResults = modalFuse.search(q);
    const results = [];
    fuseResults.forEach(r => {
      const item = r.item;
      let snippet = '';
      if (item.content) {
        const lines = item.content.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().includes(q.toLowerCase()) && !line.startsWith('#')) {
            snippet = line.replace(/[#*`\[\]]/g, '').trim().slice(0, 80);
            break;
          }
        }
      }
      results.push({
        path: item.path,
        title: item.title,
        cat: item.section,
        snippet: snippet
      });
    });

    if (!results.length) {
      searchResults.innerHTML = '<div class="sr-empty">未找到匹配结果</div>';
    } else {
      const seen = new Set();
      searchResults.innerHTML = results.filter(r => {
        if (seen.has(r.path)) return false;
        seen.add(r.path);
        return true;
      }).slice(0, 10).map((r, i) =>
        `<div class="sr-item" onclick="loadModalDoc('${r.path}');document.getElementById('modal-search-results').classList.remove('show');document.getElementById('modal-search-input').value='';">
          <strong>${r.title}</strong><span class="sr-cat">${r.cat}</span>
          ${r.snippet ? '<br><span style="font-size:.78rem;color:var(--text3)">' + r.snippet + '</span>' : ''}
        </div>`
      ).join('');
    }
    searchResults.classList.add('show');
  });

  document.addEventListener('click', e => {
    if (!document.getElementById('modal-search-box').contains(e.target)) {
      searchResults.classList.remove('show');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (searchResults.classList.contains('show')) {
        searchResults.classList.remove('show');
      } else {
        closeDocsOverlay();
      }
    }
  });
}

// Global click interceptor and deep-linking loader
document.addEventListener('click', e => {
  const link = e.target.closest('a');
  if (link) {
    const href = link.getAttribute('href');
    if (href && (href === 'docs.html' || href === '/docs.html' || href.startsWith('docs.html?'))) {
      e.preventDefault();
      try {
        const url = new URL(link.href);
        const docParam = url.searchParams.get('doc');
        openDocsOverlay(docParam);
      } catch (err) {
        openDocsOverlay();
      }
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  initModalSearch();
  const params = new URLSearchParams(window.location.search);
  const docParam = params.get('doc');
  if (docParam) {
    openDocsOverlay(docParam);
  } else if (window.location.hash === '#docs') {
    openDocsOverlay();
  }
});
