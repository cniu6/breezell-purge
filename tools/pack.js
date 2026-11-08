/* vsix packer (no external deps): node tools/pack.js [outDir] → <outDir>/<name>-<ver>.vsix */
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');

const SRC = path.resolve(__dirname, '..');
const OUTDIR = path.resolve(process.argv[2] || path.join(SRC, 'dist-vsix'));
const pkg = JSON.parse(fs.readFileSync(path.join(SRC, 'package.json'), 'utf8'));
const OUT = path.join(OUTDIR, `${pkg.name}-${pkg.version}.vsix`);

// 只有这些会进 vsix（仓库其它文件如 docs/ .github/ tools/ 不打包）
const INCLUDE = ['package.json', 'dist', 'ui', 'modes', 'rules', 'assets'];

const table = new Int32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
const crc32 = b => { let c = -1; for (let i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };

const files = [];
const add = (rel, data) => files.push({ rel: rel.replace(/\\/g, '/'), data });

add('[Content_Types].xml', Buffer.from(
  '<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="json" ContentType="application/json"/>' +
  '<Default Extension="js" ContentType="application/javascript"/>' +
  '<Default Extension="md" ContentType="text/markdown"/>' +
  '<Default Extension="html" ContentType="text/html"/>' +
  '<Default Extension="png" ContentType="image/png"/>' +
  '<Default Extension="vsixmanifest" ContentType="text/xml"/></Types>', 'utf8'));

add('extension.vsixmanifest', Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="${pkg.name}" Version="${pkg.version}" Publisher="${pkg.publisher || 'local'}"/>
    <DisplayName>${pkg.displayName || pkg.name}</DisplayName>
    <Description>${String(pkg.description || '').replace(/[<>&]/g, ' ')}</Description>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation>
  <Dependencies/>
  <Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/></Assets>
</PackageManifest>`, 'utf8'));

function walk(abs, relBase) {
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    for (const n of fs.readdirSync(abs)) walk(path.join(abs, n), path.join(relBase, n));
    return;
  }
  add('extension/' + relBase.replace(/\\/g, '/'), fs.readFileSync(abs));
}
for (const entry of INCLUDE) {
  const p = path.join(SRC, entry);
  if (!fs.existsSync(p)) { console.warn('skip missing: ' + entry); continue; }
  walk(p, entry);
}

const local = [], central = [];
let off = 0;
for (const f of files) {
  const crc = crc32(f.data), comp = zlib.deflateRawSync(f.data, { level: 9 });
  const name = Buffer.from(f.rel, 'utf8');
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8);
  lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12); lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(f.data.length, 22);
  lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
  local.push(lh, name, comp);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(8, 10);
  ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14); ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(f.data.length, 24);
  ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36);
  ch.writeUInt32LE(0, 38); ch.writeUInt32LE(off, 42);
  central.push(ch, name);
  off += 30 + name.length + comp.length;
}
const cd = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16); eocd.writeUInt16LE(0, 20);

const buf = Buffer.concat([...local, cd, eocd]);
fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(OUT, buf);
const sha = crypto.createHash('sha256').update(buf).digest('hex');
console.log(`built ${OUT}`);
console.log(`size ${buf.length} B · entries ${files.length} · sha256 ${sha}`);
