// DPC Hub · js/export.js · v1.0 · September 2026
// Writes real Word and Excel files in the browser, with no library.
//
// Why hand-rolled: the Hub has never loaded an external script, and a
// report that cannot be produced offline is not much use in a workshop
// on a bad connection. A .docx and a .xlsx are both just ZIPs of XML, so
// the only real work is the ZIP container. Entries are stored rather
// than deflated, which both Word and Excel accept, and which removes any
// need for a compression library.
//
// Renaming an HTML file to .doc was the shortcut. It is not used here:
// Word shows a format warning on opening one, which is exactly the sort
// of thing that makes a document look machine-produced.

// ── ZIP container ───────────────────────────────────────────────

const _CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function _crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = _CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function _utf8(str) {
  return new TextEncoder().encode(str);
}

// files: [{ name, data: string | Uint8Array }] → Uint8Array of a ZIP
// archive using stored (uncompressed) entries.
function zipStore(files) {
  const enc = files.map(f => ({
    nameBytes: _utf8(f.name),
    data: typeof f.data === 'string' ? _utf8(f.data) : f.data,
  }));
  enc.forEach(e => { e.crc = _crc32(e.data); });

  let size = 0;
  enc.forEach(e => { size += 30 + e.nameBytes.length + e.data.length + 46 + e.nameBytes.length; });
  size += 22;

  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  let off = 0;
  const u32 = (v) => { view.setUint32(off, v, true); off += 4; };
  const u16 = (v) => { view.setUint16(off, v, true); off += 2; };
  const raw = (b) => { out.set(b, off); off += b.length; };

  enc.forEach(e => {
    e.offset = off;
    u32(0x04034b50);
    u16(20); u16(0x0800); u16(0);   // version, UTF-8 flag, stored
    u16(0); u16(0);                 // DOS time and date, left at zero
    u32(e.crc); u32(e.data.length); u32(e.data.length);
    u16(e.nameBytes.length); u16(0);
    raw(e.nameBytes); raw(e.data);
  });

  const cdStart = off;
  enc.forEach(e => {
    u32(0x02014b50);
    u16(20); u16(20); u16(0x0800); u16(0);
    u16(0); u16(0);
    u32(e.crc); u32(e.data.length); u32(e.data.length);
    u16(e.nameBytes.length); u16(0); u16(0); u16(0); u16(0);
    u32(0); u32(e.offset);
    raw(e.nameBytes);
  });

  // Captured before the EOCD is written: off advances as those fields go
  // down, so computing the size inline overstates it by the header length.
  const cdSize = off - cdStart;
  u32(0x06054b50);
  u16(0); u16(0); u16(enc.length); u16(enc.length);
  u32(cdSize); u32(cdStart); u16(0);

  return out;
}

// ── Shared XML helpers ──────────────────────────────────────────

// Escapes XML and strips characters that give a document away as
// machine-produced: em-dashes, en-dashes, and the smart quotes and
// ellipsis that browsers and word processors insert silently.
function xmlText(s) {
  return String(s == null ? '' : s)
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    // Control characters are not legal in XML 1.0 and will make Word
    // refuse the file outright.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// ── Word ────────────────────────────────────────────────────────
//
// doc: {
//   title, subtitle,
//   marginTwips,                         // 720 = 12.7mm, the narrow preset
//   blocks: [
//     { type:'heading', level:1|2|3, text },
//     { type:'para', text },
//     { type:'bullets', items:[] },
//     { type:'table', caption?, head:[], rows:[[]] },
//   ]
// }

const DOCX_NARROW_MARGIN = 720;   // twentieths of a point: 12.7mm

function _docxRun(text, opts = {}) {
  const props = [];
  if (opts.bold) props.push('<w:b/>');
  if (opts.size) props.push(`<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>`);
  if (opts.color) props.push(`<w:color w:val="${opts.color}"/>`);
  const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
  // xml:space preserve keeps leading and trailing spaces, which Word
  // otherwise silently drops.
  return `<w:r>${rPr}<w:t xml:space="preserve">${xmlText(text)}</w:t></w:r>`;
}

function _docxPara(text, opts = {}) {
  const pPr = [];
  if (opts.style) pPr.push(`<w:pStyle w:val="${opts.style}"/>`);
  if (opts.spacingAfter != null) pPr.push(`<w:spacing w:after="${opts.spacingAfter}"/>`);
  if (opts.bullet) pPr.push('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');
  const props = pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : '';
  // A paragraph's text may carry newlines; each becomes a real break.
  const parts = String(text == null ? '' : text).split('\n');
  const runs = parts.map((p, i) => (i ? '<w:r><w:br/></w:r>' : '') + _docxRun(p, opts)).join('');
  return `<w:p>${props}${runs}</w:p>`;
}

function _docxTable(t) {
  const cell = (text, head) => `
    <w:tc>
      <w:tcPr><w:tcW w:w="0" w:type="auto"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>' : ''}</w:tcPr>
      ${_docxPara(text, { bold: !!head, size: 20, spacingAfter: 0 })}
    </w:tc>`;
  const row = (cells, head) => `<w:tr>${cells.map(c => cell(c, head)).join('')}</w:tr>`;
  const borders = ['top','left','bottom','right','insideH','insideV']
    .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>`).join('');
  return (t.caption ? _docxPara(t.caption, { bold: true, size: 20, spacingAfter: 60 }) : '')
    + `<w:tbl>
        <w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr>
        ${t.head && t.head.length ? row(t.head, true) : ''}
        ${(t.rows || []).map(r => row(r, false)).join('')}
      </w:tbl>`
    + _docxPara('', { spacingAfter: 120 });
}

function _docxStyles() {
  const heading = (id, name, size, before) => `
    <w:style w:type="paragraph" w:styleId="${id}">
      <w:name w:val="${name}"/><w:basedOn w:val="Normal"/>
      <w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="120"/><w:outlineLvl w:val="${id.slice(-1) - 1}"/></w:pPr>
      <w:rPr><w:b/><w:color w:val="1D3557"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>
    </w:style>`;
  return XML_DECL + `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:docDefaults><w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/>
    </w:rPr></w:rPrDefault></w:docDefaults>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>
      <w:pPr><w:spacing w:after="160" w:line="264" w:lineRule="auto"/></w:pPr></w:style>
    ${heading('Heading1','heading 1', 36, 240)}
    ${heading('Heading2','heading 2', 28, 240)}
    ${heading('Heading3','heading 3', 24, 200)}
    <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/>
      <w:rPr><w:color w:val="64748B"/><w:sz w:val="20"/></w:rPr></w:style>
  </w:styles>`;
}

function _docxNumbering() {
  return XML_DECL + `<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:abstractNum w:abstractNumId="0">
      <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val=""/>
        <w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>
        <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr></w:lvl>
    </w:abstractNum>
    <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  </w:numbering>`;
}

function buildDocx(doc) {
  const margin = doc.marginTwips || DOCX_NARROW_MARGIN;
  const body = [];

  if (doc.title)    body.push(_docxPara(doc.title, { style: 'Heading1' }));
  if (doc.subtitle) body.push(_docxPara(doc.subtitle, { style: 'Subtitle' }));

  (doc.blocks || []).forEach(b => {
    if (!b) return;
    if (b.type === 'heading') body.push(_docxPara(b.text, { style: 'Heading' + (b.level || 2) }));
    else if (b.type === 'para')    body.push(_docxPara(b.text));
    else if (b.type === 'bullets') (b.items || []).forEach(i => body.push(_docxPara(i, { bullet: true })));
    else if (b.type === 'table')   body.push(_docxTable(b));
  });

  body.push(`<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}"
             w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`);

  const document = XML_DECL + `<w:document
    xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <w:body>${body.join('')}</w:body></w:document>`;

  return zipStore([
    { name: '[Content_Types].xml', data: XML_DECL + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
        <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
        <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
      </Types>` },
    { name: '_rels/.rels', data: XML_DECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: XML_DECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
      </Relationships>` },
    { name: 'word/document.xml',  data: document },
    { name: 'word/styles.xml',    data: _docxStyles() },
    { name: 'word/numbering.xml', data: _docxNumbering() },
  ]);
}

// ── Excel ───────────────────────────────────────────────────────
//
// sheets: [{ name, rows: [[cell, ...], ...] }]
// The first row of each sheet is treated as a header row.

function _colRef(n) {
  let s = '';
  n += 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - m) / 26); }
  return s;
}

function _xlsxSheet(rows) {
  const body = (rows || []).map((row, r) => {
    const cells = row.map((v, c) => {
      const ref = _colRef(c) + (r + 1);
      const styleAttr = r === 0 ? ' s="1"' : '';
      if (typeof v === 'number' && isFinite(v)) {
        return `<c r="${ref}"${styleAttr}><v>${v}</v></c>`;
      }
      return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${xmlText(v)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${cells}</row>`;
  }).join('');
  return XML_DECL + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <sheetData>${body}</sheetData></worksheet>`;
}

function buildXlsx(sheets) {
  const list = (sheets || []).filter(s => s && s.rows);
  const parts = [
    { name: '[Content_Types].xml', data: XML_DECL + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
        <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
        ${list.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
      </Types>` },
    { name: '_rels/.rels', data: XML_DECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
      </Relationships>` },
    { name: 'xl/workbook.xml', data: XML_DECL + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets>${list.map((s, i) => `<sheet name="${xmlText((s.name || ('Sheet' + (i + 1))).slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
      </workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: XML_DECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        ${list.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
        <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
      </Relationships>` },
    { name: 'xl/styles.xml', data: XML_DECL + `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts>
        <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
        <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
        <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
        <!-- Without a named default style Excel and openpyxl both warn. -->
        <cellXfs count="2">
          <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
          <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
        </cellXfs>
        <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
      </styleSheet>` },
  ];
  list.forEach((s, i) => parts.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: _xlsxSheet(s.rows) }));
  return zipStore(parts);
}

// ── Download ────────────────────────────────────────────────────

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function downloadBytes(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoked on a delay: Safari cancels the download if the object URL
  // disappears in the same tick as the click.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Safe for a filename on Windows, macOS and SharePoint alike.
function safeFilename(s, ext) {
  const base = String(s || 'report')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || 'report';
  return ext ? `${base}.${ext}` : base;
}
