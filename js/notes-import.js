/* ================================================================
   notes-import.js — DPC Hub
   Notes import format v1 (October 2026).

   One text format carries meeting notes into the Hub, whichever way
   they were captured:
     - typed into the Meeting notes page (meetingnotes.js turns the
       form into this text), or
     - written on the printed two-page template and turned into this
       text by Copilot in the college tenant.

   niParse(text, ctx)  reads the text and checks it against live lists
                       (areas, focuses, loops). Errors block Apply;
                       warnings leave the item unticked for review.
   niBuild(parsed, ctx) turns parsed items into Hub entity drafts.
                       Nothing is saved here; meetingnotes.js applies.

   Privacy: no sanitisation exists elsewhere in the Hub, so this file
   flags anything that looks like a full name or learner data and
   leaves that item unticked.

   Every entity carries importId (<ref>:<key>) so importing the same
   notes twice updates rather than duplicates.

   Also runs under Node (module.exports) for testing.
   ================================================================ */
(function (root) {
  'use strict';

  var NI_HEADER = 'DPC HUB NOTES IMPORT · format v1';
  var NI_KINDS = {
    meeting:  { prefix: 'M', required: ['Key', 'Date'] },
    action:   { prefix: 'A', required: ['Key'] },
    note:     { prefix: 'N', required: ['Key', 'Text'] },
    evidence: { prefix: 'E', required: ['Key', 'Type', 'Summary'] },
    date:     { prefix: 'D', required: ['Key', 'Date'] }
  };
  var NI_FIELDS = ['Key','Date','Due','Time','Type','With','Owner','Area','Focus','Loop',
    'Meeting','Project','Status','Kind','Repeats','Movement','Check','Notes','Detail','Text','Summary'];
  var NI_LONG = ['Notes','Text','Summary','Detail'];
  var NI_MEETING_TYPES = (typeof MEETING_TYPE !== 'undefined')
    ? Object.keys(MEETING_TYPE).map(function (k) { return MEETING_TYPE[k]; })
    : ['quality-team','digital-lead','hoa','digital-projects-team','ap-joe','ap-neil','vp-ben','external-partner','other-staff'];
  var NI_EVIDENCE_TYPES = ['coaching','cpd-delivered','teach-meet','meeting','hoa-meeting','digital-lead-meeting',
    'learning-walk','resource-created','communication','referral','securing-improvement'];
  var NI_MOVEMENTS = ['opens','progresses','closes','none'];
  var NI_DATE_KINDS = ['deadline','meeting','work-block'];
  var NI_STATUS = ['upcoming','in-progress','complete'];

  // Pairs of capitalised words that are not names.
  var NI_NAME_ALLOW = ['Read Aloud','Read Write','Open Clinics','Learning Without','Without Barriers',
    'Foundation For','For Excellence','Excellence Model','Early Years','Heads And','Area Managers',
    'Deputy Principal','Assistive Technology','Share Point','Sharepoint Site','Cognitive Overload',
    'New Staff','Curriculum Review','Curriculum Reviews','Action Plan','Area Action','Learning Walk',
    'Learning Walks','Task Force','Quality Hub','Digital Development','Digital Lead','Digital Leads',
    'Current Focus','Health Check','Health Checks','Teach Meet','Microsoft Teams','Google Classroom'];

  function _isNone(v) { return v == null || /^\s*(none|n\/a|-)?\s*$/i.test(String(v)); }

  function _parseDate(v) {
    if (_isNone(v)) return null;
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return _validYMD(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return _validYMD(+m[3], +m[2], +m[1]);
    return undefined; // present but invalid
  }
  function _validYMD(y, mo, d) {
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return undefined;
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function _parseTime(v) {
    if (_isNone(v)) return { start: null, end: null };
    var m = String(v).replace(/\s/g, '').match(/^(\d{1,2})[:.](\d{2})(?:-(\d{1,2})[:.](\d{2}))?$/);
    if (!m) return undefined;
    var p = function (h, mi) { return String(h).padStart(2, '0') + ':' + mi; };
    return { start: p(m[1], m[2]), end: m[3] ? p(m[3], m[4]) : null };
  }
  // Small stable hash, so a Copilot reply without a Ref still gets a
  // repeatable import ID.
  function _hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  // Strip Copilot wrappers: chatter, code fences, bold markers, quote marks.
  function _clean(text) {
    var all = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var f1 = all.findIndex(function (l) { return /^\s*```/.test(l); });
    if (f1 >= 0) {
      var f2 = all.findIndex(function (l, k) { return k > f1 && /^\s*```/.test(l); });
      all = all.slice(f1 + 1, f2 > f1 ? f2 : all.length);
    }
    return all.map(function (l) { return l.replace(/\*\*/g, '').replace(/^\s*>\s?/, '').replace(/\s+$/, ''); });
  }

  /* ctx: { areas: ['QUA', ...], areaNames: ['Quality & Standards', ...],
   *        focuses: { F1: {id, title} }, loops: { L1: {id, title} } } */
  function niParse(text, ctx) {
    ctx = ctx || {};
    var lines = _clean(text);
    var out = { header: {}, items: [], checks: [], checkLinks: [], errors: [], warnings: [] };
    var i = 0;
    while (i < lines.length && lines[i].trim() !== NI_HEADER) i++;
    if (i >= lines.length) {
      out.errors.push({ line: 1, msg: 'The first line "' + NI_HEADER + '" was not found. Paste the whole reply from Copilot.' });
      return out;
    }
    if (lines.slice(0, i).some(function (l) { return l.trim(); })) out.warnings.push({ line: 1, msg: 'Text before the header was ignored.' });
    i++;
    var cur = null, inCheck = false, longKey = null;

    for (; i < lines.length; i++) {
      var ln = i + 1, t = lines[i].trim(), m;
      if (/^##\s*check\s*$/i.test(t)) { cur = null; inCheck = true; longKey = null; continue; }
      if ((m = t.match(/^##\s*([A-Za-z]+)\s*:\s*(.+)$/))) {
        inCheck = false; longKey = null;
        var kind = m[1].toLowerCase();
        if (!NI_KINDS[kind]) { out.errors.push({ line: ln, msg: 'Unknown block "' + m[1] + '".' }); cur = null; continue; }
        cur = { kind: kind, title: m[2].trim(), line: ln, f: {} };
        out.items.push(cur);
        continue;
      }
      if (inCheck) { if ((m = t.match(/^[-*•]\s*(.+)$/))) out.checks.push(m[1].trim()); continue; }

      if (!cur) {
        if ((m = t.match(/^(Source|Captured|Ref)\s*:\s*(.*)$/i))) out.header[m[1].toLowerCase()] = m[2].trim();
        else if (t) out.warnings.push({ line: ln, msg: 'Text outside any block ignored.' });
        continue;
      }
      var fm = t.match(/^([A-Za-z]+)\s*:\s*(.*)$/);
      var fieldName = fm && NI_FIELDS.filter(function (f) { return f.toLowerCase() === fm[1].toLowerCase(); })[0];
      // Inside a long text field, "Date: moved" is text unless that
      // field has not been set yet in this block.
      if (fieldName && !(longKey && cur.f[fieldName] !== undefined)) {
        longKey = NI_LONG.indexOf(fieldName) >= 0 ? fieldName : null;
        cur.f[fieldName] = fm[2].trim();
        continue;
      }
      if (longKey) { cur.f[longKey] = (cur.f[longKey] ? cur.f[longKey] + '\n' : '') + t; continue; }
      if (t) out.warnings.push({ line: ln, msg: 'Line not understood in ' + cur.kind + ' block, ignored: "' + t.slice(0, 40) + '".' });
    }

    out.items.forEach(function (it) { NI_LONG.forEach(function (k) { if (it.f[k] != null) it.f[k] = it.f[k].replace(/\s+$/, ''); }); });

    var captured = _parseDate(out.header.captured);
    if (!captured) out.errors.push({ line: 2, msg: 'Captured date missing or invalid.' });
    out.header.capturedDate = captured || null;
    // Ref makes import IDs unique per set of notes. The Hub form always
    // sets one; for Copilot replies it is derived from the content.
    var firstTitle = out.items.length ? out.items[0].title : '';
    out.header.ref = (out.header.ref || '').replace(/[^A-Za-z0-9_-]/g, '') ||
      ((captured || 'undated') + '-' + _hash(firstTitle + '|' + (out.header.source || '')));

    _validate(out, ctx);
    _linkChecks(out);
    return out;
  }

  // Copilot often asks questions in the Check section without flagging
  // the blocks they relate to. Match each question to blocks by [keys]
  // or quoted phrases, and untick those blocks.
  function _linkChecks(out) {
    out.checks.forEach(function (q) {
      var terms = [], m, re = /[“"']([^”"']{2,40})[”"']/g;
      while ((m = re.exec(q))) terms.push(m[1].replace(/[.\s]+$/, '').toLowerCase());
      var keys = (q.match(/\b[AMNEDamned]\d{1,2}\b/g) || []).map(function (k) { return k.toUpperCase(); });
      var hits = out.items.filter(function (it) {
        if (keys.indexOf((it.f.Key || '').toUpperCase()) >= 0) return true;
        var hay = (it.title + ' ' + Object.keys(it.f).map(function (k) { return it.f[k]; }).join(' '))
          .toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ');
        return terms.some(function (t) {
          var phrase = t.replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();
          if (phrase.length < 3) return false;
          return new RegExp('(^|[^a-z0-9])' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(hay);
        });
      });
      hits.forEach(function (it) {
        if (!it.untick) out.warnings.push({ line: it.line, key: it.f.Key, msg: 'Linked to a check question: ' + q });
        it.untick = true;
      });
      out.checkLinks.push({ question: q, keys: hits.map(function (it) { return it.f.Key; }) });
    });
  }

  function _validate(out, ctx) {
    var keys = {}, meetingKeys = {};
    var areas = (ctx.areas || []).map(function (a) { return String(a).toUpperCase(); });
    var areaNames = ctx.areaNames || [];
    out.items.forEach(function (it) { if (it.kind === 'meeting' && it.f.Key) meetingKeys[it.f.Key.toUpperCase()] = true; });

    out.items.forEach(function (it) {
      var spec = NI_KINDS[it.kind], f = it.f;
      var e = function (msg) { out.errors.push({ line: it.line, key: f.Key, msg: msg }); };
      var w = function (msg) { out.warnings.push({ line: it.line, key: f.Key, msg: msg }); it.untick = true; };
      var before = out.errors.length;

      spec.required.forEach(function (r) { if (_isNone(f[r])) e(_kindLabel(it.kind) + ' "' + it.title + '" needs ' + r + '.'); });
      if (f.Key) {
        var K = f.Key.toUpperCase();
        if (K[0] !== spec.prefix) e('Key ' + f.Key + ' should start with ' + spec.prefix + '.');
        if (keys[K]) e('Duplicate key ' + f.Key + '.');
        keys[K] = true;
      }
      ['Date', 'Due'].forEach(function (d) { if (f[d] != null && _parseDate(f[d]) === undefined) e(d + ' "' + f[d] + '" is not a real date.'); });
      if (f.Time != null && _parseTime(f.Time) === undefined) e('Time "' + f.Time + '" not understood. Use HH:MM or HH:MM-HH:MM.');
      if (!_isNone(f.Area) && areas.length && areas.indexOf(f.Area.toUpperCase()) < 0) e('Area "' + f.Area + '" is not a live area code.');
      if (!_isNone(f.Focus) && !(ctx.focuses || {})[f.Focus.toUpperCase()]) e('Focus "' + f.Focus + '" is not in the list.');
      if (!_isNone(f.Loop) && !(ctx.loops || {})[f.Loop.toUpperCase()]) e('Loop "' + f.Loop + '" is not in the list.');
      if (!_isNone(f.Meeting) && !meetingKeys[f.Meeting.toUpperCase()]) e('Meeting "' + f.Meeting + '" is not a meeting key in these notes.');
      if (it.kind === 'meeting' && !_isNone(f.Type) && NI_MEETING_TYPES.indexOf(f.Type) < 0) e('Meeting type "' + f.Type + '" not recognised.');
      if (it.kind === 'evidence' && !_isNone(f.Type) && NI_EVIDENCE_TYPES.indexOf(f.Type) < 0) e('Evidence type "' + f.Type + '" not recognised.');
      if (it.kind === 'evidence' && !_isNone(f.Movement) && NI_MOVEMENTS.indexOf(f.Movement) < 0) e('Movement "' + f.Movement + '" not recognised.');
      if (it.kind === 'evidence' && _isNone(f.Area) && _isNone(f.Focus)) e('Evidence "' + it.title + '" needs an area or a focus so it has somewhere to live.');
      if (it.kind === 'evidence' && !_isNone(f.Movement) && f.Movement !== 'none' && _isNone(f.Loop)) w('Movement "' + f.Movement + '" given without a loop, so it will be ignored.');
      if (it.kind === 'date' && !_isNone(f.Kind) && NI_DATE_KINDS.indexOf(f.Kind) < 0) e('Date kind "' + f.Kind + '" not recognised.');
      if (it.kind === 'action' && !_isNone(f.Status) && NI_STATUS.indexOf(f.Status) < 0) e('Status "' + f.Status + '" not recognised.');

      if (!_isNone(f.Check) && /^yes/i.test(f.Check)) w('Marked for checking: ' + (f.Check.replace(/^yes\s*[-:]?\s*/i, '') || 'no reason given') + '.');
      _privacy(it, w, areaNames);
      it.errors = out.errors.length - before;
    });
  }

  function _kindLabel(k) { return { meeting: 'Meeting', action: 'Action', note: 'Note', evidence: 'Evidence', date: 'Date' }[k] || k; }

  function _privacy(it, w, areaNames) {
    var text = [it.title].concat(Object.keys(it.f).map(function (k) { return k === 'Key' ? '' : it.f[k]; })).join('\n');
    var allow = NI_NAME_ALLOW.concat(areaNames).map(function (s) { return String(s).toLowerCase(); });
    var pairs = [];
    text.split('\n').forEach(function (line) {
      var re = /(^|[^.:;!?\-\s]\s+)([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})\b/g, m;
      while ((m = re.exec(line))) {
        if (m.index === 0 && m[1] === '') continue; // first word of a line
        var pair = m[2].toLowerCase();
        if (!allow.some(function (a) { return a.indexOf(pair) >= 0; })) pairs.push(m[2]);
      }
    });
    if (pairs.length) w('Possible full name: "' + pairs[0] + '". Use initials only.');
    if (/\b(ULN|DOB|date of birth)\b/i.test(text) || /\b(learner|student)\s+[A-Z][a-z]+/.test(text)) w('Possible learner data. Remove it before applying.');
    if (/\b(EHCP|diagnos\w*|medical|safeguarding concern)\b/i.test(text)) w('Possible personal or sensitive detail. Check before applying.');
  }

  /* Returns [{ key, kind, title, dest, untick, links[], entity, loopEvidence?, note? }] */
  function niBuild(parsed, ctx) {
    var cap = parsed.header.capturedDate, ref = parsed.header.ref, ops = [], meetingIds = {};
    var id = (ctx && ctx.generateId) || (typeof generateId === 'function' ? generateId : function () { return 'id-' + Math.random().toString(16).slice(2, 10); });
    var focusOf = function (c) { return _isNone(c) ? null : ctx.focuses[c.toUpperCase()]; };
    var loopOf = function (c) { return _isNone(c) ? null : ctx.loops[c.toUpperCase()]; };
    var area = function (c) { return _isNone(c) ? null : c.toUpperCase(); };
    var people = function (v) { return _isNone(v) ? [] : v.split(/[,;&]| and /).map(function (s) { return s.trim(); }).filter(Boolean); };
    var importId = function (k) { return ref + ':' + k.toUpperCase(); };

    parsed.items.forEach(function (it) { if (it.kind === 'meeting') meetingIds[it.f.Key.toUpperCase()] = id(); });

    parsed.items.forEach(function (it) {
      var f = it.f, op = { key: f.Key.toUpperCase(), kind: it.kind, title: it.title, untick: !!it.untick, links: [] };
      var tm = _parseTime(f.Time) || {};
      var meetingRef = _isNone(f.Meeting) ? null : meetingIds[f.Meeting.toUpperCase()];
      var fo = focusOf(f.Focus), lo = loopOf(f.Loop);
      if (area(f.Area)) op.links.push({ type: 'area', label: area(f.Area) });
      if (fo) op.links.push({ type: 'focus', label: fo.title });
      if (lo) op.links.push({ type: 'loop', label: lo.title });
      if (meetingRef) op.links.push({ type: 'meeting', label: f.Meeting.toUpperCase() });

      if (it.kind === 'meeting') {
        op.dest = 'Meetings';
        op.entity = { entryId: meetingIds[f.Key.toUpperCase()], entryType: 'meeting', meetingType: _isNone(f.Type) ? 'other-staff' : f.Type,
          title: it.title, date: _parseDate(f.Date), startTime: tm.start || null, endTime: tm.end || null, location: null,
          personRefs: people(f.With), areaCode: area(f.Area), linkedDocumentUrl: null, linkedDocumentLabel: null,
          prepNotes: null, links: [], myNotes: f.Notes || null, actions: [], notesComplete: true,
          linkedFocusId: fo ? fo.id : null, source: 'notes-import', importId: importId(f.Key) };
      } else if (it.kind === 'action') {
        op.dest = 'Tasks';
        op.entity = { entryId: id(), entryType: 'task', title: it.title, date: _parseDate(f.Due) || null,
          startTime: null, endTime: null, personRefs: people(f.Owner), areaCode: area(f.Area), projectRef: null,
          status: _isNone(f.Status) ? 'upcoming' : f.Status, notes: f.Detail || null, microTasks: [], isSurfaceLayerVisible: true,
          source: meetingRef ? 'meeting' : 'notes-import', sourceRef: meetingRef ? { entryId: meetingRef } : {},
          linkedFocusId: fo ? fo.id : null, linkedAfiId: lo ? lo.id : null, importId: importId(f.Key) };
        if (!op.entity.date) op.note = 'No due date, so it is set to the meeting date.';
      } else if (it.kind === 'note') {
        op.dest = 'Notes';
        op.entity = { noteId: id(), createdAt: cap ? cap + 'T09:00:00.000Z' : null, text: f.Text, areaCode: area(f.Area),
          projectRef: _isNone(f.Project) ? null : f.Project, linkedMeetingId: meetingRef, personRef: null, personStaffId: null,
          departmentId: null, linkedAfiId: lo ? lo.id : null, linkedFocusId: fo ? fo.id : null,
          source: 'notes-import', importId: importId(f.Key) };
      } else if (it.kind === 'evidence') {
        op.dest = area(f.Area) ? 'Area log · ' + area(f.Area) : 'Cross-college activity';
        var links = [];
        if (fo) links.push({ type: 'focus', id: fo.id });
        op.entity = { activityId: id(), activityType: f.Type, date: _parseDate(f.Date) || cap, areaCode: area(f.Area) || '',
          staffIds: [], lraThemeIds: [], hyperThemes: [],
          summary: f.Summary.indexOf(it.title) === 0 ? f.Summary : it.title + ': ' + f.Summary, links: links,
          afiIdsGenerated: [], sharedId: null, qipRef: null, createdAt: null, source: 'notes-import', importId: importId(f.Key) };
        if (lo) op.loopEvidence = { afiId: lo.id, loopMovement: (_isNone(f.Movement) || f.Movement === 'none') ? 'progresses' : f.Movement };
      } else if (it.kind === 'date') {
        var kind = _isNone(f.Kind) ? 'deadline' : f.Kind;
        op.dest = 'Calendar';
        op.entity = { entryId: id(), entryType: kind, title: it.title, date: _parseDate(f.Date),
          startTime: tm.start || null, endTime: tm.end || null, personRefs: [], areaCode: area(f.Area), status: null,
          notes: _isNone(f.Repeats) ? null : 'Repeats: ' + f.Repeats, linkedFocusId: fo ? fo.id : null,
          source: 'notes-import', importId: importId(f.Key) };
      }
      ops.push(op);
    });

    // Attach each action to its meeting, both ways.
    ops.forEach(function (op) {
      if (op.kind === 'action' && op.entity.sourceRef.entryId) {
        var mt = ops.filter(function (o) { return o.kind === 'meeting' && o.entity.entryId === op.entity.sourceRef.entryId; })[0];
        var aid = id();
        mt.entity.actions.push({ actionId: aid, title: op.title, deadline: op.entity.date, linkedTaskId: op.entity.entryId });
        op.entity.sourceRef.actionId = aid;
      }
    });
    return ops;
  }

  var api = { NI_HEADER: NI_HEADER, niParse: niParse, niBuild: niBuild, niParseDate: _parseDate, NI_EVIDENCE_TYPES: NI_EVIDENCE_TYPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.niParse = niParse; root.niBuild = niBuild; root.NI_HEADER = NI_HEADER; root.niParseDate = _parseDate; }
})(this);
