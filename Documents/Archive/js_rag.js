/* ================================================================
   rag.js — DPC Impact Hub  v3.0
   RAG matrix: individual sub-criterion scoring (1–5 per cell)
   Dimension score = average of rated sub-criteria
   Sub-criterion scores persisted for granular reporting
   ================================================================ */

DPC.RAG = {

  // ── READ / WRITE HELPERS ───────────────────────────────────────

  // Read the current sub-criterion scores for a dimension
  // Returns { scores: {0:n, 1:n, …}, avg: n|null }
  // Handles legacy integer values transparently
  _getDimData: function(current, dimKey) {
    const raw = current[dimKey];
    if (raw === null || raw === undefined) {
      return { scores: {}, avg: null };
    }
    // Legacy: stored as a plain integer → treat as if all sub-criteria agree
    if (typeof raw === 'number') {
      return { scores: {}, avg: raw, _legacy: raw };
    }
    return { scores: raw.scores || {}, avg: raw.avg };
  },

  // Calculate average of rated sub-criteria
  _calcDimAvg: function(scores) {
    const vals = Object.values(scores).filter(v => v !== null && v !== undefined);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a,b)=>a+b,0) / vals.length) * 10) / 10;
  },

  // Set a sub-criterion score and recalculate dimension avg
  setSubScore: function(areaCode, dimKey, subIndex, score, containerId) {
    const area = DPC.getArea(areaCode);
    if (!area) return;
    if (!area.ragRatings) area.ragRatings = { current:{}, history:[] };
    if (!area.ragRatings.current) area.ragRatings.current = {};

    const current = area.ragRatings.current;
    const existing = current[dimKey];

    // Initialise if not yet an object
    let dimData;
    if (!existing || typeof existing === 'number') {
      dimData = { scores: {}, avg: null };
    } else {
      dimData = { scores: { ...(existing.scores||{}) }, avg: existing.avg };
    }

    // Toggle: clicking selected score deselects
    const prev = dimData.scores[subIndex];
    dimData.scores[subIndex] = (prev === score) ? null : score;

    // Recalculate dimension average
    dimData.avg = DPC.RAG._calcDimAvg(dimData.scores);
    current[dimKey] = dimData;

    // Recalculate overall weighted RAG
    current.overall = DPC.calcWeightedRAG(current);

    DPC.saveToLocalStorage();
    DPC.App.markUnsaved();

    // Re-render matrix
    DPC.RAG.render(areaCode, containerId);
    DPC.Areas.updateHeaderScores(areaCode);

    // Announce
    const schema = DPC.ragSchema;
    const dim = schema?.dimensions[dimKey];
    const subLabel = dim?.subCriteriaLabels?.[subIndex] || `criterion ${subIndex+1}`;
    const val = dimData.scores[subIndex];
    const lvlLabel = val ? (schema?.scale[String(val)]?.label || val) : 'cleared';
    DPC.announce(`${dim?.shortLabel || dimKey} — ${subLabel}: ${lvlLabel}`);
  },

  // ── RENDER MATRIX ──────────────────────────────────────────────
  render: function(areaCode, containerId) {
    const area   = DPC.getArea(areaCode);
    const schema = DPC.ragSchema;
    if (!area || !schema) return;
    const el = document.getElementById(containerId);
    if (!el) return;

    const current  = area.ragRatings?.current || {};
    const dimOrder = schema.dimensionOrder;
    const scale    = schema.scale;

    let html = `<p style="font-size:.8rem;color:var(--col-muted);margin-bottom:16px">
      Score each sub-criterion (column) independently. Click a score to select; click again to deselect.
      The dimension score is the average of all rated sub-criteria. Hover a cell for the success statement.
    </p>`;

    dimOrder.forEach(key => {
      const dim     = schema.dimensions[key];
      const dimData = DPC.RAG._getDimData(current, key);
      const avg     = dimData.avg;
      const isLegacy= dimData._legacy !== undefined;
      const avgColor = avg ? (scale[String(Math.round(avg))]?.color || 'var(--col-muted)') : 'var(--col-muted)';
      const avgLabel = avg ? (scale[String(Math.round(avg))]?.label || '') : '';
      const subLabels = dim.subCriteriaLabels || [];
      const numSub  = subLabels.length;

      // Which sub-criteria have been rated
      const ratedCount = Object.values(dimData.scores).filter(v=>v!==null&&v!==undefined).length;

      html += `
      <div style="
        border:1px solid ${avg?avgColor+'55':'var(--col-border)'};
        border-left:4px solid ${avg?avgColor:'var(--col-border)'};
        border-radius:var(--radius-lg);overflow:hidden;margin-bottom:14px;
      ">
        <!-- Dimension header -->
        <div style="
          display:flex;align-items:center;gap:10px;flex-wrap:wrap;
          padding:10px 16px;background:var(--col-surface-2);border-bottom:1px solid var(--col-border);
        ">
          <span style="font-size:1rem;color:var(--col-muted)" aria-hidden="true">${dim.icon}</span>
          <strong style="font-size:.9rem;color:var(--col-text);flex:1">${dim.label}</strong>
          <div style="display:flex;align-items:center;gap:10px">
            ${avg !== null
              ? `<span style="font-size:.82rem;font-weight:700;color:${avgColor}">${avg.toFixed(1)} · ${avgLabel}</span>
                 <span style="font-size:.7rem;color:var(--col-muted)">${ratedCount}/${numSub} rated</span>`
              : `<span style="font-size:.75rem;color:var(--col-muted)">Not rated</span>`}
            <button type="button"
              style="font-size:.7rem;padding:3px 8px;background:transparent;border:1px solid var(--col-border);border-radius:var(--radius);color:var(--col-muted);cursor:pointer"
              onclick="DPC.RAG.clearDimension('${areaCode}','${key}','${containerId}')"
              aria-label="Clear all scores for ${dim.label}">Clear all</button>
          </div>
        </div>

        <!-- Sub-criterion × level grid -->
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:.78rem;min-width:600px">
            <thead>
              <tr style="background:var(--col-surface-2)">
                <th style="width:160px;min-width:140px;padding:8px 12px;text-align:left;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--col-muted);border-bottom:1px solid var(--col-border);border-right:1px solid var(--col-border)">
                  Sub-criterion
                </th>
                ${Object.entries(scale).map(([v,s]) =>
                  `<th style="text-align:center;padding:8px 6px;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:${s.color};border-bottom:1px solid var(--col-border);border-right:1px solid var(--col-border);min-width:80px">
                    ${v} ${s.label}
                  </th>`
                ).join('')}
                <th style="width:60px;text-align:center;padding:8px 6px;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--col-muted);border-bottom:1px solid var(--col-border)">Score</th>
              </tr>
            </thead>
            <tbody>
              ${subLabels.map((subLabel, subIdx) => {
                const subScore = dimData.scores[subIdx] ?? null;
                const subColor = subScore ? (scale[String(subScore)]?.color || 'var(--col-muted)') : null;

                return `<tr>
                  <!-- Sub-criterion label — name only, no expander -->
                  <td style="padding:10px 12px;border-bottom:1px solid var(--col-border);border-right:1px solid var(--col-border);vertical-align:top;background:var(--col-surface-2)">
                    <div style="font-size:.78rem;font-weight:600;color:var(--col-text-2)">${subLabel}</div>
                    ${subScore
                      ? `<div style="margin-top:4px;font-size:.68rem;font-weight:700;color:${subColor}">${subScore} · ${scale[String(subScore)]?.label||''}</div>`
                      : `<div style="margin-top:4px;font-size:.68rem;color:var(--col-muted)">Not rated</div>`}
                  </td>

                  <!-- Criteria cells: each cell IS the success statement — click to score -->
                  ${Object.entries(scale).map(([v,s]) => {
                    const isSelected = subScore === parseInt(v);
                    const crit = dim.levels?.[v]?.subCriteria?.[subIdx] || '';
                    return `<td
                      onclick="DPC.RAG.setSubScore('${areaCode}','${key}',${subIdx},${v},'${containerId}')"
                      role="button"
                      tabindex="0"
                      aria-pressed="${isSelected}"
                      aria-label="${subLabel}: ${v} — ${s.label}"
                      onkeydown="if(event.key==='Enter'||event.key===' '){DPC.RAG.setSubScore('${areaCode}','${key}',${subIdx},${v},'${containerId}')}"
                      style="
                        padding:10px 10px;
                        border-bottom:1px solid var(--col-border);
                        border-right:1px solid var(--col-border);
                        vertical-align:top;
                        cursor:pointer;
                        transition:background .12s ease;
                        background:${isSelected ? s.color+'20' : 'var(--col-surface)'};
                        border-left:${isSelected ? '3px solid '+s.color : '1px solid var(--col-border)'};
                        outline:${isSelected ? '2px solid '+s.color+'88' : 'none'};
                        outline-offset:-2px;
                        position:relative;
                      "
                      onmouseover="this.style.background='${s.color}14'"
                      onmouseout="this.style.background='${isSelected?s.color+'20':'var(--col-surface)'}'"
                    >
                      ${isSelected ? `<div style="position:absolute;top:4px;right:6px;font-size:.65rem;font-weight:700;color:${s.color}" aria-hidden="true">✓</div>` : ''}
                      <div style="font-size:.72rem;line-height:1.5;color:${isSelected ? 'var(--col-text)' : 'var(--col-text-2)'}">
                        ${crit || '<span style="color:var(--col-muted);font-style:italic">—</span>'}
                      </div>
                    </td>`;
                  }).join('')}

                  <!-- Score summary -->
                  <td style="padding:6px 8px;border-bottom:1px solid var(--col-border);text-align:center;vertical-align:middle;background:var(--col-surface-2)">
                    ${subScore
                      ? `<span style="font-size:.85rem;font-weight:700;font-family:var(--font-mono);color:${subColor}">${subScore}</span>`
                      : `<span style="font-size:.75rem;color:var(--col-muted)">—</span>`}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>

        ${isLegacy ? `<div style="padding:6px 16px;font-size:.7rem;color:var(--col-muted);background:var(--col-surface-2)">
          ⓘ This dimension has a legacy overall score of ${dimData._legacy}. Score individual sub-criteria above to replace it.
        </div>` : ''}
      </div>`;
    });

    // Overall RAG
    const overall = current.overall;
    const overallRounded = overall ? Math.round(overall) : null;
    const overallColor = overallRounded ? (scale[String(overallRounded)]?.color || 'var(--col-muted)') : 'var(--col-muted)';
    const overallLabel = overallRounded ? (scale[String(overallRounded)]?.label || '—') : 'Not yet rated';

    html += `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:14px 16px;
      background:var(--col-surface-2);border:1px solid var(--col-border);border-radius:var(--radius-lg)">
      <div>
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--col-muted);margin-bottom:2px">Overall RAG (weighted average of dimension averages)</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:1.8rem;font-weight:700;font-family:var(--font-mono);color:${overallColor}">${overall ? overall.toFixed(1) : '—'}</span>
          <span style="font-size:.9rem;color:${overallColor};font-weight:600">${overallLabel}</span>
        </div>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" type="button"
          onclick="DPC.RAG.saveSnapshot('${areaCode}','${containerId}')">
          Save Rating Snapshot
        </button>
        <button class="btn btn-ghost btn-sm" type="button"
          onclick="DPC.RAG.showHistory('${areaCode}')">
          View History
        </button>
      </div>
    </div>
    <p style="font-size:.72rem;color:var(--col-muted);margin-top:8px">
      Weights: Staff Capability ×1.5 · HoA Leadership ×1.5 · Digital Health ×1.5 · all others ×1.0 ·
      Each dimension score = average of its rated sub-criteria only (unrated sub-criteria excluded)
    </p>`;

    el.innerHTML = html;
  },

  // ── TOGGLE SUB-CRITERION DETAIL ───────────────────────────────
  toggleSubDetail: function(id) {
    const el  = document.getElementById(`sub-detail-${id}`);
    const btn = el?.previousElementSibling;
    if (!el) return;
    const open = el.style.display === 'none';
    el.style.display = open ? 'block' : 'none';
    if (btn) {
      btn.setAttribute('aria-expanded', open);
      btn.textContent = open ? 'Hide success criteria ▴' : 'View success criteria ▾';
    }
  },

  // ── CLEAR DIMENSION ────────────────────────────────────────────
  clearDimension: function(areaCode, dimKey, containerId) {
    const area = DPC.getArea(areaCode);
    if (!area) return;
    if (area.ragRatings?.current) {
      area.ragRatings.current[dimKey] = { scores: {}, avg: null };
      area.ragRatings.current.overall = DPC.calcWeightedRAG(area.ragRatings.current);
    }
    DPC.saveToLocalStorage();
    DPC.App.markUnsaved();
    DPC.RAG.render(areaCode, containerId);
    DPC.Areas.updateHeaderScores(areaCode);
  },

  // ── SAVE SNAPSHOT ─────────────────────────────────────────────
  saveSnapshot: function(areaCode, containerId) {
    const area = DPC.getArea(areaCode);
    if (!area) return;
    const cur = area.ragRatings.current;

    // Snapshot stores dimension averages + sub-criterion scores
    const snapshot = {
      date:    new Date().toISOString(),
      overall: cur.overall,
      dimensions: {}
    };
    const schema = DPC.ragSchema;
    (schema?.dimensionOrder || []).forEach(k => {
      const d = DPC.RAG._getDimData(cur, k);
      snapshot.dimensions[k] = { avg: d.avg, scores: { ...d.scores } };
    });

    if (!area.ragRatings.history) area.ragRatings.history = [];
    area.ragRatings.history.unshift(snapshot);
    DPC.saveToLocalStorage();
    DPC.App.markUnsaved();
    DPC.showToast('Rating snapshot saved');
  },

  // ── SHOW HISTORY ──────────────────────────────────────────────
  showHistory: function(areaCode) {
    const area   = DPC.getArea(areaCode);
    if (!area) return;
    const history = area.ragRatings?.history || [];
    const schema  = DPC.ragSchema;

    let body = '';
    if (!history.length) {
      body = `<div class="empty-state"><div class="empty-state__title">No snapshots yet</div><div class="empty-state__body">Save a rating snapshot to track changes over time.</div></div>`;
    } else {
      history.forEach(snap => {
        const ov      = snap.overall;
        const ovR     = ov ? Math.round(ov) : null;
        const color   = ovR ? (schema.scale[String(ovR)]?.color || 'var(--col-muted)') : 'var(--col-muted)';
        const label   = ovR ? (schema.scale[String(ovR)]?.label || '—') : '—';
        body += `<div class="card" style="margin-bottom:10px">
          <div class="card-header">
            <span class="card-title">${DPC.formatDate(snap.date)}</span>
            <span style="font-weight:700;color:${color}">${ov ? ov.toFixed(1) + ' · ' + label : '—'}</span>
          </div>
          <div class="card-body" style="display:flex;flex-wrap:wrap;gap:6px">
            ${(schema.dimensionOrder||[]).map(k => {
              const dim  = schema.dimensions[k];
              const data = snap.dimensions?.[k];
              const avg  = data?.avg ?? (typeof snap.dimensions?.[k] === 'number' ? snap.dimensions[k] : null);
              const c    = avg ? schema.scale[String(Math.round(avg))]?.color : 'var(--col-border)';
              const l    = avg ? schema.scale[String(Math.round(avg))]?.label : '—';
              return `<span style="font-size:.72rem;padding:3px 8px;border-radius:999px;border:1px solid ${c}44;background:${avg?c+'11':'var(--col-surface-2)'};color:${avg?c:'var(--col-muted)'}">
                ${dim.icon} ${dim.shortLabel}: <strong>${avg ? avg.toFixed(1) : '—'}</strong> ${avg ? '· ' + l : ''}
              </span>`;
            }).join('')}
          </div>
        </div>`;
      });
    }
    DPC.App.openModal(`RAG Rating History — ${area.code} ${area.name}`, body);
  },

  // ── SUMMARY HELPERS ───────────────────────────────────────────
  getDimPills: function(areaCode) {
    const area   = DPC.getArea(areaCode);
    const schema = DPC.ragSchema;
    if (!area || !schema) return '';
    const current = area.ragRatings?.current || {};
    return (schema.dimensionOrder||[]).map(key => {
      const d     = DPC.RAG._getDimData(current, key);
      const avg   = d.avg;
      const dim   = schema.dimensions[key];
      const color = avg ? (schema.scale[String(Math.round(avg))]?.color || '#ccc') : 'var(--col-border)';
      const label = avg ? (schema.scale[String(Math.round(avg))]?.label || avg) : '—';
      return `<span style="
        display:inline-flex;align-items:center;justify-content:center;
        width:26px;height:26px;border-radius:4px;
        background:${avg ? color : 'var(--col-surface-2)'};
        color:${avg ? '#fff' : 'var(--col-muted)'};
        font-size:.65rem;font-weight:700;
        border:1px solid ${avg ? color : 'var(--col-border)'};flex-shrink:0;
      " title="${dim.label}: ${avg ? avg.toFixed(1) + ' · ' + label : '—'}">${avg ? avg.toFixed(1) : '—'}</span>`;
    }).join('');
  },

  getOverallBadge: function(areaCode) {
    const area   = DPC.getArea(areaCode);
    const schema = DPC.ragSchema;
    if (!area) return '<span style="opacity:.4">—</span>';
    const v = area.ragRatings?.current?.overall;
    // Also check history for legacy display
    const display = v ?? area.ragRatings?.history?.[0]?.overall;
    if (!display) return '<span style="color:var(--col-muted);font-size:.8rem">Not rated</span>';
    const rv    = Math.round(display);
    const color = schema?.scale?.[String(rv)]?.color || 'var(--col-muted)';
    const label = schema?.scale?.[String(rv)]?.label || rv;
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;
      background:${color}18;border:1px solid ${color}44;color:${color};font-size:.75rem;font-weight:700">
      ${display.toFixed ? display.toFixed(1) : display} · ${label}
    </span>`;
  }
};

// ── CALC WEIGHTED RAG ─────────────────────────────────────────
// Reads dimension averages (from sub-criterion scoring) and applies weights
DPC.calcWeightedRAG = function(current) {
  const schema  = DPC.ragSchema;
  if (!schema) return null;
  const weights = schema.weights;
  let total = 0, totalWeight = 0;
  Object.keys(weights).forEach(k => {
    const d   = DPC.RAG._getDimData(current, k);
    const avg = d.avg;
    if (avg !== null && avg !== undefined) {
      total       += avg * weights[k];
      totalWeight += weights[k];
    }
  });
  if (!totalWeight) return null;
  return Math.round(total / totalWeight * 10) / 10;
};