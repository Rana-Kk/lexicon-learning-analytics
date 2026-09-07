import { inflateRawSync } from 'node:zlib';

function findEndOfCentralDirectory(buf) {
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error('Invalid XLSX/ZIP file');
}

function readEntries(buf) {
  const eocd = findEndOfCentralDirectory(buf);
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Invalid ZIP central directory');
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    entries.set(name, { method, compressedSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(buf, entry) {
  const p = entry.localOffset;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('Invalid ZIP local entry');
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + entry.compressedSize);
  return entry.method === 0 ? data : inflateRawSync(data);
}

function xmlUnescape(s) {
  return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
}
function colIndex(ref) { let n=0; for(const c of ref.replace(/\d+$/,'')){n=n*26+c.charCodeAt(0)-64} return n-1; }
function textFromCell(xml) {
  const inline = xml.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
  if (inline) return xmlUnescape(inline[1]);
  const v = xml.match(/<v[^>]*>([\s\S]*?)<\/v>/);
  return v ? xmlUnescape(v[1]) : '';
}

export function parseXlsx(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const entries = readEntries(buf);
  const shared = [];
  const ss = entries.get('xl/sharedStrings.xml');
  if (ss) {
    const xml = readEntry(buf, ss).toString('utf8');
    for (const item of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(xmlUnescape([...item[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m=>m[1]).join('')));
    }
  }
  const sheetName = [...entries.keys()].find(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
  if (!sheetName) throw new Error('No worksheet found in XLSX file');
  const xml = readEntry(buf, entries.get(sheetName)).toString('utf8');
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1]; const body = cellMatch[2];
      const ref = attrs.match(/\br="([A-Z]+\d+)"/i)?.[1];
      const idx = ref ? colIndex(ref) : row.length;
      let value = textFromCell(body);
      if (/\bt="s"/.test(attrs)) value = shared[Number(value)] ?? '';
      row[idx] = value;
    }
    rows.push(row.map(v=>v ?? ''));
  }
  if (!rows.length) return [];
  const headers = rows[0].map(h=>String(h).trim().toLowerCase().replace(/\s+/g,'_'));
  return rows.slice(1).filter(r=>r.some(v=>String(v).trim())).map(r=>Object.fromEntries(headers.map((h,i)=>[h,String(r[i] ?? '').trim()])));
}
