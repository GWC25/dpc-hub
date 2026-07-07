// DPC Hub · js/rag.js · v1.0 · July 2026
// RAG Matrix module. 8-dimension scoring 1-5 with rationale and snapshot history.
// Called from areas.js initRAGTab(areaCode). Writes to area.ragDimensions via saveArea().

function initRAGTab(areaCode) {
  const panel = document.getElementById('area-tab-panel');
  if (!panel) return;

  const area = _getArea(areaCode);
  if (!area) return;

  const dims  = area.ragDimensions || {};

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);">
      <h3 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);">RAG Matrix</h3>
      <button id="rag-update-btn" type="button" class="btn btn--primary btn--sm">+ Update RAG scores</button>
    </div>

    <!-- 8 dimension rows -->
    <div id="rag-dimension-rows" role="list" aria-label="RAG dimension scores">
      ${RAG_DIMENSIONS.map(dim => _buildDimRow(dim, dims[dim.id])).join('')}
    </div>

    <!-- Snapshot modal -->
    <div id="rag-modal" role="dialog" aria-modal="true" aria-labelledby="rag-modal-title" style="
      display:none;position:fixed;inset:0;
      background:rgba(0,0,0,0.5);z-index:500;
      align-items:center;justify-content:center;padding:var(--space-lg);
    ">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:660px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="rag-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Update RAG scores — ${_escHtml(area.areaCode)}</h2>
          <button id="rag-modal-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>

        ${area.ragDimensions && Object.keys(area.ragDimensions).length > 0
          ? `<div style="background:var(--color-light);border-radius:var(--radius-sm);padding:var(--space-md);margin-bottom:var(--space-lg);font-size:var(--text-sm);color:var(--color-muted);">
              Previous snapshot: ${_getLastSnapshotDate(area)} · Saving will create a new snapshot and preserve the previous one.
             </div>` : ''
        }

        <form id="rag-form" novalidate>
          ${RAG_DIMENSIONS.map(dim => {
            const current = dims[dim.id];
            return `
            <div style="margin-bottom:var(--space-lg);padding-bottom:var(--space-lg);border-bottom:1px solid var(--color-border);">
              <label style="display:block;font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-sm);">${_escHtml(dim.label)}</label>
              <div role="group" aria-label="Score for ${_escHtml(dim.label)}" style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm);flex-wrap:wrap;">
                ${[1,2,3,4,5].map(score => {
                  const selected = current && current.score === score;
                  const bg = selected ? _ragBg(score) : 'var(--color-white)';
                  const col = selected ? _ragText(score) : 'var(--color-muted)';
                  return `<label style="cursor:pointer;">
                    <input type="radio" name="rag_${dim.id}" value="${score}" ${selected?'checked':''} style="position:absolute;opacity:0;width:0;height:0;" aria-label="${RAG_LABELS[score]}">
                    <span class="rag-score-btn" data-dim="${dim.id}" data-score="${score}" style="
                      display:inline-flex;align-items:center;justify-content:center;
                      width:44px;height:44px;border-radius:var(--radius-sm);
                      border:2px solid ${selected?_ragText(score):'var(--color-border)'};
                      background:${bg};color:${col};
                      font-weight:var(--font-bold);font-size:var(--text-base);
                      cursor:pointer;transition:all 150ms ease;
                      user-select:none;
                    " aria-hidden="true">${score}</span>
                  </label>`;
                }).join('')}
                <span style="font-size:var(--text-xs);color:var(--color-muted);align-self:center;margin-left:var(--space-sm);" id="rag-label-${dim.id}">${current && current.score ? RAG_LABELS[current.score] : 'Not scored'}</span>
              </div>
              <label for="rag-rationale-${dim.id}" style="font-size:var(--text-sm);color:var(--color-muted);display:block;margin-bottom:4px;">Rationale</label>
              <textarea id="rag-rationale-${dim.id}" name="rag_rationale_${dim.id}" rows="2" style="width:100%;padding:var(--space-sm);border:2px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-sm) Arial,sans-serif;color:var(--color-slate);resize:vertical;" placeholder="Brief rationale for this score…">${_escHtml(current && current.rationale ? current.rationale : '')}</textarea>
            </div>`;
          }).join('')}
        </form>

        <div class="btn-row">
          <button id="rag-save-btn" type="button" class="btn btn--primary">Save snapshot</button>
          <button id="rag-cancel-btn" type="button" class="btn btn--secondary">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Snapshot history modal -->
    <div id="rag-history-modal" role="dialog" aria-modal="true" aria-labelledby="rag-history-title" style="
      display:none;position:fixed;inset:0;
      background:rgba(0,0,0,0.5);z-index:500;
      align-items:center;justify-content:center;padding:var(--space-lg);
    ">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:500px;max-height:80vh;overflow-y:auto;padding:var(--space-xl);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="rag-history-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Score history</h2>
          <button id="rag-history-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <div id="rag-history-content"></div>
      </div>
    </div>
  `;

  _wireRAGEvents(areaCode);
}

function _buildDimRow(dim, data) {
  const score = data && data.score ? data.score : null;
  const label = score ? RAG_LABELS[score] : 'Not scored';
  const bg    = score ? _ragBg(score) : 'var(--color-light)';
  const col   = score ? _ragText(score) : 'var(--color-muted)';

  return `
    <div role="listitem" style="display:grid;grid-template-columns:220px 80px 1fr auto;gap:var(--space-md);align-items:center;padding:var(--space-md) 0;border-bottom:1px solid var(--color-border);">
      <span style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-slate);">${_escHtml(dim.label)}</span>
      <span style="display:inline-flex;align-items:center;gap:var(--space-xs);background:${bg};color:${col};padding:4px 12px;border-radius:var(--radius-sm);font-weight:var(--font-bold);font-size:var(--text-base);" aria-label="Score: ${score || 'Not scored'}">
        ${score ? score : '—'}
      </span>
      <div>
        <span style="font-size:var(--text-sm);color:${col};font-weight:var(--font-bold);">${label}</span>
        ${data && data.rationale ? `<p style="font-size:var(--text-xs);color:var(--color-muted);margin-top:2px;">${_escHtml(data.rationale).substring(0,100)}${data.rationale.length>100?'…':''}</p>` : ''}
        ${data && data.updatedAt ? `<p style="font-size:var(--text-xs);color:var(--color-muted);">Updated: ${_formatDateShort(data.updatedAt)}</p>` : ''}
      </div>
      <button type="button" class="btn btn--ghost btn--sm rag-history-btn" data-dim="${dim.id}" aria-label="View score history for ${_escHtml(dim.label)}" style="white-space:nowrap;">History</button>
    </div>`;
}

function _wireRAGEvents(areaCode) {
  // Open update modal
  document.getElementById('rag-update-btn')?.addEventListener('click', () => {
    document.getElementById('rag-modal').style.display = 'flex';
    document.getElementById('rag-modal').querySelector('button')?.focus();
  });

  // Close modals
  document.getElementById('rag-modal-close')?.addEventListener('click', () => {
    document.getElementById('rag-modal').style.display = 'none';
  });
  document.getElementById('rag-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('rag-modal').style.display = 'none';
  });
  document.getElementById('rag-history-close')?.addEventListener('click', () => {
    document.getElementById('rag-history-modal').style.display = 'none';
  });

  // Click on overlay to close
  ['rag-modal','rag-history-modal'].forEach(id => {
    const modal = document.getElementById(id);
    modal?.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
  });

  // Score button visual feedback (clicking label wraps to radio)
  document.getElementById('rag-form')?.addEventListener('click', e => {
    const btn = e.target.closest('.rag-score-btn');
    if (!btn) return;
    const dimId = btn.dataset.dim;
    const score = parseInt(btn.dataset.score);

    // Update all buttons in this dimension
    document.querySelectorAll(`.rag-score-btn[data-dim="${dimId}"]`).forEach(b => {
      const s = parseInt(b.dataset.score);
      const sel = s === score;
      b.style.background   = sel ? _ragBg(s) : 'var(--color-white)';
      b.style.color        = sel ? _ragText(s) : 'var(--color-muted)';
      b.style.borderColor  = sel ? _ragText(s) : 'var(--color-border)';
    });

    // Update label
    const labelEl = document.getElementById(`rag-label-${dimId}`);
    if (labelEl) labelEl.textContent = RAG_LABELS[score] || '';

    // Check the radio
    const radio = document.querySelector(`input[name="rag_${dimId}"][value="${score}"]`);
    if (radio) radio.checked = true;
  });

  // Save snapshot
  document.getElementById('rag-save-btn')?.addEventListener('click', () => {
    const area = _getArea(areaCode);
    if (!area) return;

    // Preserve existing as snapshot history
    const existing = area.ragDimensions || {};
    if (!area.ragSnapshots) area.ragSnapshots = [];
    if (Object.keys(existing).length > 0) {
      area.ragSnapshots.push({ savedAt: nowISO(), dimensions: JSON.parse(JSON.stringify(existing)) });
    }

    // Build new scores
    const newDims = {};
    RAG_DIMENSIONS.forEach(dim => {
      const radio = document.querySelector(`input[name="rag_${dim.id}"]:checked`);
      const rationale = document.getElementById(`rag-rationale-${dim.id}`)?.value.trim() || '';
      if (radio) {
        newDims[dim.id] = {
          score:     parseInt(radio.value),
          rationale,
          updatedAt: nowISO(),
        };
      } else if (existing[dim.id]) {
        newDims[dim.id] = existing[dim.id]; // preserve existing if not changed
      }
    });

    area.ragDimensions = newDims;
    saveArea(area);

    document.getElementById('rag-modal').style.display = 'none';
    initRAGTab(areaCode); // re-render tab
  });

  // History buttons
  document.querySelectorAll('.rag-history-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dimId = btn.dataset.dim;
      const dim   = RAG_DIMENSIONS.find(d => d.id === dimId);
      const area  = _getArea(areaCode);
      if (!area || !dim) return;

      const histModal   = document.getElementById('rag-history-modal');
      const histTitle   = document.getElementById('rag-history-title');
      const histContent = document.getElementById('rag-history-content');
      if (!histModal || !histTitle || !histContent) return;

      histTitle.textContent = `History — ${dim.label}`;

      const snapshots = (area.ragSnapshots || []).slice().reverse();
      const current   = area.ragDimensions && area.ragDimensions[dimId];

      let html = '';
      if (current) {
        html += `<div style="padding:var(--space-md);background:var(--color-teal-lt);border-radius:var(--radius-sm);margin-bottom:var(--space-md);">
          <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:4px;">
            <span style="font-weight:bold;font-size:var(--text-sm);">Current</span>
            <span style="background:${_ragBg(current.score)};color:${_ragText(current.score)};padding:1px 10px;border-radius:999px;font-weight:bold;font-size:var(--text-base);">${current.score}</span>
            <span style="font-size:var(--text-sm);color:var(--color-teal);">${RAG_LABELS[current.score]}</span>
          </div>
          ${current.rationale ? `<p style="font-size:var(--text-sm);color:var(--color-slate);">${_escHtml(current.rationale)}</p>` : ''}
          <p style="font-size:var(--text-xs);color:var(--color-muted);">Updated: ${_formatDateShort(current.updatedAt)}</p>
        </div>`;
      }

      if (snapshots.length === 0) {
        html += '<p style="font-size:var(--text-sm);color:var(--color-muted);">No previous snapshots recorded.</p>';
      } else {
        snapshots.forEach(snap => {
          const d = snap.dimensions && snap.dimensions[dimId];
          if (!d) return;
          html += `<div style="padding:var(--space-md);border:1px solid var(--color-border);border-radius:var(--radius-sm);margin-bottom:var(--space-sm);">
            <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:4px;">
              <span style="background:${_ragBg(d.score)};color:${_ragText(d.score)};padding:1px 10px;border-radius:999px;font-weight:bold;font-size:var(--text-base);">${d.score}</span>
              <span style="font-size:var(--text-sm);color:var(--color-slate);">${RAG_LABELS[d.score]}</span>
            </div>
            ${d.rationale ? `<p style="font-size:var(--text-sm);color:var(--color-slate);">${_escHtml(d.rationale)}</p>` : ''}
            <p style="font-size:var(--text-xs);color:var(--color-muted);">Snapshot: ${_formatDateShort(snap.savedAt)}</p>
          </div>`;
        });
      }

      histContent.innerHTML = html;
      histModal.style.display = 'flex';
    });
  });

  // ESC to close
  document.addEventListener('keydown', function ragEsc(e) {
    if (e.key === 'Escape') {
      const m1 = document.getElementById('rag-modal');
      const m2 = document.getElementById('rag-history-modal');
      if (m1 && m1.style.display==='flex') { m1.style.display='none'; return; }
      if (m2 && m2.style.display==='flex') { m2.style.display='none'; return; }
      document.removeEventListener('keydown', ragEsc);
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────
function _ragBg(score) {
  return ['','var(--rag-1-bg)','var(--rag-2-bg)','var(--rag-3-bg)','var(--rag-4-bg)','var(--rag-5-bg)'][score] || 'var(--color-light)';
}
function _ragText(score) {
  return ['','var(--rag-1-text)','var(--rag-2-text)','var(--rag-3-text)','var(--rag-4-text)','var(--rag-5-text)'][score] || 'var(--color-muted)';
}
function _getLastSnapshotDate(area) {
  const snaps = area.ragSnapshots || [];
  if (snaps.length === 0) return 'None';
  const latest = snaps[snaps.length - 1];
  return _formatDateShort(latest.savedAt);
}
function _formatDateShort(isoStr) {
  if (!isoStr) return '';
  try { return new Date(isoStr.split('T')[0] + 'T12:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return isoStr; }
}
function _escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
