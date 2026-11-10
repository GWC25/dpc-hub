/* ================================================================
   docx-text.js — DPC Hub
   Reads the text out of a Word file (.docx) in the browser
   (November 2026).

   A .docx file is a zip of XML files. The words live in
   word/document.xml. This file finds that entry in the zip, unpacks
   it with the browser's own DecompressionStream (no library needed),
   and turns it into plain lines:
     - each paragraph becomes a line
     - a line break inside a paragraph becomes a new line
     - a bulleted or numbered paragraph starts with "- ", so lists
       pasted into Word keep the dash the notes import format needs
     - tabs become spaces; Word's non-breaking spaces become spaces

   docxToText(arrayBuffer) -> Promise<string>
   fileToText(file)        -> Promise<string> for .docx, .txt or .md

   Also runs under Node 18+ (module.exports) for testing.
   ================================================================ */
(function (root) {
  'use strict';

  function _u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function _u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  // Finds one entry in the zip by name, using the central directory
  // (sizes there are always filled in, unlike some local headers).
  function _findEntry(bytes, wanted) {
    var eocd = -1;
    for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (_u32(bytes, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('This does not look like a Word file. Save it as .docx and try again.');
    var count = _u16(bytes, eocd + 10), p = _u32(bytes, eocd + 16);
    var dec = new TextDecoder('utf-8');
    for (var n = 0; n < count; n++) {
      if (_u32(bytes, p) !== 0x02014b50) break;
      var method = _u16(bytes, p + 10), csize = _u32(bytes, p + 20);
      var nlen = _u16(bytes, p + 28), xlen = _u16(bytes, p + 30), clen = _u16(bytes, p + 32);
      var local = _u32(bytes, p + 42);
      var name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
      if (name === wanted) {
        var start = local + 30 + _u16(bytes, local + 26) + _u16(bytes, local + 28);
        return { method: method, data: bytes.subarray(start, start + csize) };
      }
      p += 46 + nlen + xlen + clen;
    }
    return null;
  }

  async function _inflate(data) {
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([data]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function _unescape(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(+d); })
      .replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&amp;/g, '&');
  }

  // Word XML -> lines. Only the tags that carry text or line structure
  // matter here; everything else is skipped.
  function xmlToText(xml) {
    var body = (xml.match(/<w:body[\s>][\s\S]*<\/w:body>/) || [xml])[0];
    var lines = [];
    var paras = body.match(/<w:p[\s>][\s\S]*?<\/w:p>|<w:p\/>/g) || [];
    paras.forEach(function (p) {
      // A list is either numbered on the paragraph itself or given a
      // list style (List Bullet, List Paragraph and so on).
      var isList = /<w:numPr[\s>]/.test(p) || /<w:pStyle\s+w:val="[^"]*List[^"]*"/i.test(p);
      var text = '';
      var re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(br|cr)(?:\s[^>]*)?\/>|<w:tab(?:\s[^>]*)?\/>/g, m;
      while ((m = re.exec(p))) {
        if (m[1] != null) text += _unescape(m[1]);
        else if (m[2]) text += '\n';
        else text += ' ';
      }
      text = text.replace(/ /g, ' ');
      var parts = text.split('\n');
      if (isList && parts[0].trim() && !/^\s*[-*•]\s/.test(parts[0])) parts[0] = '- ' + parts[0].trim();
      lines.push.apply(lines, parts);
    });
    return lines.join('\n');
  }

  async function docxToText(buffer) {
    var bytes = new Uint8Array(buffer);
    var entry = _findEntry(bytes, 'word/document.xml');
    if (!entry) throw new Error('No text found in this Word file.');
    var raw;
    if (entry.method === 0) raw = entry.data;
    else if (entry.method === 8) raw = await _inflate(entry.data);
    else throw new Error('This Word file is packed in a way the Hub cannot read. Open it and save it again as .docx.');
    return xmlToText(new TextDecoder('utf-8').decode(raw));
  }

  async function fileToText(file) {
    var name = String(file.name || '').toLowerCase();
    if (/\.docx$/.test(name)) return docxToText(await file.arrayBuffer());
    if (/\.(txt|md)$/.test(name)) return (await file.text()).replace(/ /g, ' ');
    throw new Error('Only Word (.docx) and text (.txt) files can be read.');
  }

  var api = { docxToText: docxToText, fileToText: fileToText, docxXmlToText: xmlToText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.docxToText = docxToText; root.fileToText = fileToText; }
})(typeof window !== 'undefined' ? window : this);
