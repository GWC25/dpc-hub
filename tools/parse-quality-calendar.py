#!/usr/bin/env python3
"""
Parse the Quality Calendar 26/27 workbook into data/quality-calendar-2627.json.

Two principles, both agreed with Graeme:
  1. Cell text is stored VERBATIM. Nothing is silently corrected.
  2. Anything that looks like a slip, or that disagrees with the Quality
     Assurance & Improvement Manual 26/27, is recorded as a sourceNote
     against the entry rather than fixed in place.

Window definitions come from the Manual, not the calendar, because the
Manual is the authority on them and states explicit from/to dates.

Usage: python3 tools/parse-quality-calendar.py <workbook.xlsx> [out.json]
"""
import json, re, sys, unicodedata
from datetime import date
from openpyxl import load_workbook

SHEET = 'College Calendar 26.27'

MONTHS = {'jan':1,'feb':2,'mar':3,'apr':4,'april':4,'may':5,'jun':6,'june':6,
          'jul':7,'july':7,'aug':8,'sep':9,'sept':9,'oct':10,'nov':11,'dec':12}

def slug(s):
    s = unicodedata.normalize('NFKD', str(s))
    s = re.sub(r'\(.*?\)', ' ', s)
    s = re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-').lower()
    return s

def parse_week(text):
    """'17th Aug 26' -> date(2026, 8, 17)."""
    m = re.match(r'\s*(\d{1,2})\w{0,2}\s+([A-Za-z]+)\s+(\d{2,4})\s*$', str(text))
    if not m:
        return None
    d, mon, y = int(m.group(1)), MONTHS.get(m.group(2)[:4].lower().rstrip('.')), int(m.group(3))
    if mon is None:
        mon = MONTHS.get(m.group(2)[:3].lower())
    if mon is None:
        return None
    if y < 100:
        y += 2000
    try:
        return date(y, mon, d)
    except ValueError:
        return None

def dates_in(text, week):
    """Pull dd/mm or dd/mm/yy fragments out of a cell, resolved against the week."""
    out = []
    for m in re.finditer(r'\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b', text):
        d, mon = int(m.group(1)), int(m.group(2))
        if m.group(3):
            y = int(m.group(3));  y += 2000 if y < 100 else 0
        else:
            # Academic year runs Aug to Jul: months Aug-Dec belong to the
            # first calendar year, Jan-Jul to the second.
            y = week.year if mon >= 8 else (week.year + 1 if week.month >= 8 else week.year)
        try:
            out.append(date(y, mon, d).isoformat())
        except ValueError:
            pass
    return out

# ── Known discrepancies, recorded not corrected ──────────────────
# Each is (substring to match in the cell, note). Raised with Quality 18/09/26.
NOTES = [
  ('SGM 7 22nd March 25',
   'Calendar says 2025 in a 2026/27 calendar. Likely 22 March 2027. Raised with Quality, not corrected.'),
  ('SGCM 1 0th Dec 26',
   'Calendar reads "1 0th Dec 26". Likely 10 December 2026. Raised with Quality, not corrected.'),
  ('SGCM 1 3th May 27',
   'Calendar reads "1 3th May 27". Likely 13 May 2027. Raised with Quality, not corrected.'),
  ('FINAL SAR Submission 25th Sept 2026',
   'Calendar says 25 September 2026 but sits in the week commencing 9 August 2027. The Manual gives 24 September 2027. Raised with Quality, not corrected.'),
  ('Luke Weaton Legacy Trust Apprenticeship Open Evening (03/10)',
   'Dated 03/10 but placed in the week commencing 30 November 2026. Raised with Quality, not corrected.'),
  ('25/26 QIP Sign off 05/10',
   'Calendar places this in the week commencing 7 September 2026. The Manual SAR timeline gives 5 September 2026 for 25/26 QIP development and sign off. Raised with Quality, not corrected.'),
  ('Draft SAR Submission 09/07',
   'The Manual narrative says 11 July 2027 and the Manual timeline table says 9 July 2027. Calendar says 09/07. Raised with Quality, not corrected.'),
]

STREAM_NOTES = {
  'career-development-plan-audits':
    'Column heading reads "(CPD)" but the cells read "CDP Audit". The Manual calls this the Career Development Plan (CDP). CPD means continuing professional development elsewhere in the Manual. Raised with Quality.',
  'apprenticehsip-progress-review-audits':
    'Column heading is spelled "Apprenticehsip" in the source. Stored verbatim.',
  'apprentice-employer-survey-forums':
    'Cells read "Apprentice Ambassador Fourm" in the source. Stored verbatim.',
  'career-excellence-hub-employer-advisary-boards':
    'Column heading is spelled "Advisary" in the source. Stored verbatim.',
  'send-review-boards':
    'SRB Window 3 appears at week commencing 26 April 2027 and Window 2 at 7 June 2027, so the windows run out of order in the source. Raised with Quality, not corrected.',
}

# ── Window definitions: Manual is the authority ──────────────────
MANUAL_SOURCE = 'Weston College Quality Assurance & Improvement Manual 26/27'
WINDOWS = [
  {'streamKey':'learning-walks-and-instructional-coaching','number':1,'from':'2026-08-31','to':'2026-11-06'},
  {'streamKey':'learning-walks-and-instructional-coaching','number':2,'from':'2027-01-04','to':'2027-03-05'},
  {'streamKey':'learning-walks-and-instructional-coaching','number':3,'from':'2027-04-19','to':'2027-06-25'},
  {'streamKey':'peer-self-reviews','number':1,'from':'2026-08-31','to':'2026-11-06'},
  {'streamKey':'peer-self-reviews','number':2,'from':'2027-01-04','to':'2027-03-05'},
  {'streamKey':'peer-self-reviews','number':3,'from':'2027-04-19','to':'2027-06-25'},
]
WINDOW_NOTES = {
  'peer-self-reviews': 'The Manual notes that windows 2 and 3 are for new staff or follow-up reviews. Existing staff and staff joining in September must complete a self-review in window 1. Self-review deadline 6 November 2026; peer review deadline 5 March 2027.',
}

def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else 'data/quality-calendar-2627.json'

    ws = load_workbook(src, read_only=True)[SHEET]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    groups = [(c or '').strip() if isinstance(c, str) else '' for c in rows[0]]
    names  = [(c or '').strip() if isinstance(c, str) else '' for c in rows[1]]

    streams, seen = [], {}
    for i in range(1, len(names)):
        if not names[i]:
            continue
        key = slug(names[i])
        if key in seen:                      # duplicate heading, keep them distinct
            seen[key] += 1
            key = f'{key}-{seen[key]}'
        else:
            seen[key] = 1
        s = {'key': key, 'name': names[i],
             'group': (groups[i] if i < len(groups) else '').strip() or None,
             'column': i}
        if key in STREAM_NOTES:
            s['sourceNote'] = STREAM_NOTES[key]
        streams.append(s)
    by_col = {s['column']: s for s in streams}

    weeks, entries = [], []
    for r in rows[2:]:
        if not r or not r[0]:
            continue
        wk = parse_week(r[0])
        if not wk:
            continue
        weeks.append({'weekCommencing': wk.isoformat(), 'label': str(r[0]).strip()})
        for i in range(1, len(r)):
            cell = r[i]
            if cell is None or not str(cell).strip() or i not in by_col:
                continue
            text = ' '.join(str(cell).split())
            e = {'streamKey': by_col[i]['key'],
                 'weekCommencing': wk.isoformat(),
                 'text': text}
            ds = dates_in(text, wk)
            if ds:
                e['dates'] = ds
            for frag, note in NOTES:
                if frag in text:
                    e['sourceNote'] = note
                    break
            entries.append(e)

    windows = []
    for w in WINDOWS:
        w = dict(w, source=MANUAL_SOURCE)
        if w['streamKey'] in WINDOW_NOTES:
            w['note'] = WINDOW_NOTES[w['streamKey']]
        windows.append(w)

    doc = {
      'academicYear': '2026/27',
      'source': 'Quality Calendar 26-27.xlsx, sheet "College Calendar 26.27"',
      'windowSource': MANUAL_SOURCE,
      'storedVerbatim': True,
      'verbatimPolicy': 'Cell text is stored exactly as written. Entries that look like slips, or that disagree with the Manual, carry a sourceNote instead of being corrected.',
      'generated': date.today().isoformat(),
      'weeks': weeks,
      'streams': streams,
      'windows': windows,
      'entries': entries,
    }
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
        f.write('\n')
    noted = sum(1 for e in entries if 'sourceNote' in e)
    print(f'{out}: {len(weeks)} weeks, {len(streams)} streams, {len(entries)} entries, '
          f'{noted} entry notes, {len(windows)} windows')

if __name__ == '__main__':
    main()
