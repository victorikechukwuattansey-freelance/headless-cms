const OS = {
  config: { name: 'Business OS', navItems: [], screens: {} },
  state: { currentScreen: 'dashboard', data: {} },

  db: {
    _data: {},
    _schemas: {},

    define(name, schema) {
      this._schemas[name] = schema;
      if (!this._data[name]) {
        this._data[name] = JSON.parse(localStorage.getItem(`os_${name}`) || '[]');
      }
    },

    _save(schema) {
      localStorage.setItem(`os_${schema}`, JSON.stringify(this._data[schema]));
    },

    schema(name) { return this._schemas[name]; },

    create(schema, item) {
      item.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      item.createdAt = new Date().toISOString();
      item.updatedAt = item.createdAt;
      this._data[schema].push(item);
      this._save(schema);
      return item;
    },

    read(schema, id) {
      return this._data[schema].find(i => i.id === id);
    },

    update(schema, id, updates) {
      const idx = this._data[schema].findIndex(i => i.id === id);
      if (idx === -1) return null;
      updates.updatedAt = new Date().toISOString();
      this._data[schema][idx] = { ...this._data[schema][idx], ...updates };
      this._save(schema);
      return this._data[schema][idx];
    },

    delete(schema, id) {
      this._data[schema] = this._data[schema].filter(i => i.id !== id);
      this._save(schema);
    },

    list(schema, filters = {}) {
      let items = this._data[schema] || [];
      for (const [k, v] of Object.entries(filters)) {
        if (v !== '' && v !== null && v !== undefined) {
          items = items.filter(i => String(i[k] || '').toLowerCase().includes(String(v).toLowerCase()));
        }
      }
      return items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    },

    search(schema, query) {
      if (!query) return this.list(schema);
      const q = String(query).toLowerCase();
      const s = this._schemas[schema];
      if (!s) return this.list(schema);
      const searchable = s.fields.filter(f => f.searchable !== false);
      return this._data[schema].filter(item =>
        searchable.some(f => String(item[f.key] || '').toLowerCase().includes(q))
      ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    },

    exportCSV(schema) {
      const items = this._data[schema] || [];
      if (!items.length) return '';
      const keys = Object.keys(items[0]);
      const lines = [keys.join(',')];
      for (const item of items) {
        lines.push(keys.map(k => {
          const v = item[k];
          if (Array.isArray(v)) return `"${v.join('; ')}"`;
          return `"${String(v || '')}"`;
        }).join(','));
      }
      return lines.join('\n');
    },

    exportJSON(schema) {
      return JSON.stringify(this._data[schema] || [], null, 2);
    },

    importJSON(schema, json) {
      try {
        const items = JSON.parse(json);
        if (!Array.isArray(items)) throw new Error('Must be array');
        this._data[schema] = items;
        this._save(schema);
        return items.length;
      } catch (e) {
        OS.ui.showToast('Import failed: ' + e.message, 'error');
        return 0;
      }
    },

    totals(schema, field) {
      return (this._data[schema] || []).reduce((s, i) => s + (parseFloat(i[field]) || 0), 0);
    },

    count(schema, filters = {}) {
      return this.list(schema, filters).length;
    },

    sumBy(schema, field, groupBy) {
      const groups = {};
      for (const item of this._data[schema] || []) {
        const key = item[groupBy] || 'Other';
        if (!groups[key]) groups[key] = 0;
        groups[key] += parseFloat(item[field]) || 0;
      }
      return groups;
    }
  },

  ui: {
    _toastTimeout: null,

    el(tag, attrs = {}, ...children) {
      const el = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'className') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
        else el.setAttribute(k, v);
      }
      for (const c of children) {
        if (c == null) continue;
        if (typeof c === 'string') el.appendChild(document.createTextNode(c));
        else if (c instanceof Node) el.appendChild(c);
        else el.appendChild(document.createTextNode(String(c)));
      }
      return el;
    },

    renderTable(container, data, columns, actions = {}) {
      container.innerHTML = '';
      if (!data || !data.length) {
        container.appendChild(this.el('div', { className: 'os-empty' }, 'No data yet.'));
        return;
      }
      const table = this.el('table', { className: 'os-table' });
      const thead = this.el('thead');
      const headRow = this.el('tr');
      for (const col of columns) {
        headRow.appendChild(this.el('th', col.headerAttrs || {}, col.label));
      }
      if (actions.onEdit || actions.onDelete) {
        headRow.appendChild(this.el('th', {}, 'Actions'));
      }
      thead.appendChild(headRow);
      table.appendChild(thead);
      const tbody = this.el('tbody');
      for (const row of data) {
        const tr = this.el('tr');
        for (const col of columns) {
          let val = col.render ? col.render(row) : row[col.key];
          if (val === null || val === undefined) val = '';
          const td = this.el('td');
          if (col.render) {
            if (typeof val === 'string') td.innerHTML = val;
            else td.appendChild(val);
          } else {
            td.textContent = val;
          }
          if (col.className) td.className = col.className;
          tr.appendChild(td);
        }
        if (actions.onEdit || actions.onDelete) {
          const td = this.el('td', { className: 'os-actions' });
          if (actions.onEdit) {
            td.appendChild(this.el('button', { className: 'os-btn os-btn-sm', onClick: () => actions.onEdit(row) }, 'Edit'));
          }
          if (actions.onDelete) {
            td.appendChild(this.el('button', { className: 'os-btn os-btn-sm os-btn-danger', onClick: () => actions.onDelete(row) }, 'Delete'));
          }
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      container.appendChild(table);
    },

    renderForm(container, schema, data = {}, onSubmit) {
      container.innerHTML = '';
      const form = this.el('form', { className: 'os-form' });
      for (const field of schema.fields) {
        if (field.hidden) continue;
        const group = this.el('div', { className: 'os-field' });
        const label = this.el('label', {}, field.label || field.key);
        group.appendChild(label);
        const val = data[field.key] !== undefined ? data[field.key] : field.default || '';
        if (field.type === 'textarea') {
          const ta = this.el('textarea', { name: field.key, placeholder: field.placeholder || '' });
          ta.value = val;
          group.appendChild(ta);
        } else if (field.type === 'select') {
          const sel = this.el('select', { name: field.key });
          if (field.placeholder) sel.appendChild(this.el('option', { value: '' }, field.placeholder));
          for (const opt of field.options || []) {
            const o = this.el('option', { value: opt.value || opt }, opt.label || opt);
            if ((opt.value || opt) === val) o.selected = true;
            sel.appendChild(o);
          }
          group.appendChild(sel);
        } else if (field.type === 'number') {
          const inp = this.el('input', { type: 'number', name: field.key, step: field.step || 'any', placeholder: field.placeholder || '' });
          inp.value = val;
          group.appendChild(inp);
        } else {
          const inp = this.el('input', { type: field.type || 'text', name: field.key, placeholder: field.placeholder || '' });
          inp.value = val;
          group.appendChild(inp);
        }
        form.appendChild(group);
      }
      const btnGroup = this.el('div', { className: 'os-form-actions' });
      btnGroup.appendChild(this.el('button', { type: 'submit', className: 'os-btn os-btn-primary' }, 'Save'));
      btnGroup.appendChild(this.el('button', { type: 'button', className: 'os-btn', onClick: () => OS.ui.closeModal() }, 'Cancel'));
      form.appendChild(btnGroup);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const result = {};
        for (const field of schema.fields) {
          if (field.hidden) continue;
          let v = fd.get(field.key);
          if (field.type === 'number' && v) v = parseFloat(v);
          if (field.type === 'select' && field.multiple) {
            v = Array.from(form.querySelector(`select[name="${field.key}"]`).selectedOptions).map(o => o.value);
          }
          result[field.key] = v;
        }
        onSubmit(result);
      });
      container.appendChild(form);
    },

    showModal(title, contentEl, opts = {}) {
      let existing = document.getElementById('os-modal');
      if (existing) existing.remove();
      const overlay = this.el('div', { id: 'os-modal', className: 'os-modal-overlay', onClick: (e) => { if (e.target === overlay && !opts.closable === false) OS.ui.closeModal(); } });
      const box = this.el('div', { className: 'os-modal-box' });
      if (opts.wide) box.style.maxWidth = '800px';
      const header = this.el('div', { className: 'os-modal-header' });
      header.appendChild(this.el('h3', {}, title));
      header.appendChild(this.el('span', { className: 'os-modal-close', onClick: () => OS.ui.closeModal() }, '✕'));
      box.appendChild(header);
      const body = this.el('div', { className: 'os-modal-body' });
      if (typeof contentEl === 'string') body.innerHTML = contentEl;
      else body.appendChild(contentEl);
      box.appendChild(body);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    },

    closeModal() {
      const el = document.getElementById('os-modal');
      if (el) el.remove();
    },

    renderKanban(container, itemsByStage, stages, onMove, onClick) {
      container.innerHTML = '';
      const board = this.el('div', { className: 'os-kanban' });
      for (const stage of stages) {
        const col = this.el('div', { className: 'os-kanban-col' });
        col.appendChild(this.el('div', { className: 'os-kanban-header' }, `${stage.icon || ''} ${stage.label} (${(itemsByStage[stage.key] || []).length})`));
        const list = this.el('div', { className: 'os-kanban-list' });
        for (const item of itemsByStage[stage.key] || []) {
          const card = this.el('div', { className: 'os-kanban-card', onClick: () => onClick && onClick(item) });
          card.appendChild(this.el('div', { className: 'os-kanban-card-title' }, item.title || item.name));
          if (item.value) card.appendChild(this.el('div', { className: 'os-kanban-card-value' }, `$${Number(item.value).toLocaleString()}`));
          if (item.assignedTo) card.appendChild(this.el('div', { className: 'os-kanban-card-assignee' }, item.assignedTo));
          if (onMove) {
            const actions = this.el('div', { className: 'os-kanban-card-actions' });
            const idx = stages.findIndex(s => s.key === stage.key);
            if (idx > 0) actions.appendChild(this.el('button', { className: 'os-btn os-btn-xs', onClick: (e) => { e.stopPropagation(); onMove(item, stages[idx - 1].key); } }, '←'));
            if (idx < stages.length - 1) actions.appendChild(this.el('button', { className: 'os-btn os-btn-xs', onClick: (e) => { e.stopPropagation(); onMove(item, stages[idx + 1].key); } }, '→'));
            list.appendChild(card);
            card.appendChild(actions);
          }
          list.appendChild(card);
        }
        col.appendChild(list);
        board.appendChild(col);
      }
      container.appendChild(board);
    },

    renderCards(container, cards) {
      container.innerHTML = '';
      const grid = this.el('div', { className: 'os-card-grid' });
      for (const c of cards) {
        const card = this.el('div', { className: 'os-card' });
        if (c.label) card.appendChild(this.el('div', { className: 'os-card-label' }, c.label));
        if (c.value !== undefined) {
          const val = this.el('div', { className: 'os-card-value' });
          if (typeof c.value === 'number' && c.prefix) val.textContent = c.prefix + Number(c.value).toLocaleString();
          else if (typeof c.value === 'number') val.textContent = Number(c.value).toLocaleString();
          else val.textContent = c.value;
          card.appendChild(val);
        }
        if (c.sub) card.appendChild(this.el('div', { className: 'os-card-sub' }, c.sub));
        if (c.color) card.style.borderLeft = `4px solid ${c.color}`;
        grid.appendChild(card);
      }
      container.appendChild(grid);
    },

    showToast(message, type = 'info') {
      let container = document.getElementById('os-toast-container');
      if (!container) {
        container = this.el('div', { id: 'os-toast-container', className: 'os-toast-container' });
        document.body.appendChild(container);
      }
      const toast = this.el('div', { className: `os-toast os-toast-${type}` }, message);
      container.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
    },

    renderSearch(container, placeholder, onSearch) {
      container.innerHTML = '';
      const input = this.el('input', { type: 'text', className: 'os-search', placeholder: placeholder || 'Search...' });
      input.addEventListener('input', () => onSearch(input.value));
      container.appendChild(input);
    },

    confirmDialog(message) {
      return new Promise((resolve) => {
        const box = this.el('div');
        box.appendChild(this.el('p', {}, message));
        const btnDiv = this.el('div', { className: 'os-form-actions', style: { marginTop: '12px' } });
        btnDiv.appendChild(this.el('button', { className: 'os-btn os-btn-primary', onClick: () => { OS.ui.closeModal(); resolve(true); } }, 'Confirm'));
        btnDiv.appendChild(this.el('button', { className: 'os-btn', onClick: () => { OS.ui.closeModal(); resolve(false); } }, 'Cancel'));
        box.appendChild(btnDiv);
        this.showModal('Confirm', box, { closable: false });
      });
    }
  },
};

function $el(tag, attrs, ...children) { return OS.ui.el(tag, attrs, ...children); }
