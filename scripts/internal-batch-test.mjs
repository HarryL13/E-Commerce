// Changes: Internal batch test — 1 POD + 2 大货 SKUs from three studio images, publish drafts to Shopify.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = process.env.API_BASE || 'http://localhost:3000';
const PROXY_URL = process.env.API_BASE_URL || 'https://lumina.tripo3d.com';
const PROXY_TOKEN = process.env.API_AUTH_TOKEN || 'sk-ELK4mC5Kf8jkfkcZyk6DkA';

const TEST_CASES = [
  {
    label: 'POD #1 — Wizard Boy',
    skuLine: 'pod',
    imagePath:
      '/Users/linyuxiao/Library/Application Support/Cursor/User/workspaceStorage/1776352706217/images/20260707142233-9GvTSHnY-ad546f14-04a5-4920-9c65-90cd2db83c95.png',
  },
  {
    label: '大货 #2 — Tactical Operator',
    skuLine: 'bulk',
    imagePath:
      '/Users/linyuxiao/Library/Application Support/Cursor/User/workspaceStorage/1776352706217/images/20260707172325-XysHL1Wl-e41df94a-e250-4875-8d63-ab251d587461.png',
  },
  {
    label: '大货 #3 — Minigun Soldier',
    skuLine: 'bulk',
    imagePath:
      '/Users/linyuxiao/Library/Application Support/Cursor/User/workspaceStorage/1776352706217/images/20260707151859-m0OzkY0L-e51e502c-cd0a-4e36-8d4c-042f6d190c75.png',
  },
];

const POD_SIZES = ['4cm', '5cm', '6cm', '7cm', '8cm', '10cm'];
const POD_SIZE_PRICES = {
  '4cm': '29.99',
  '5cm': '49.99',
  '6cm': '69.99',
  '7cm': '99.99',
  '8cm': '129.99',
  '10cm': '169.99',
};

function loadDevVars() {
  const raw = fs.readFileSync(path.join(ROOT, '.dev.vars'), 'utf8');
  const vars = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

function toDataUrl(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function slugifyHandle(handle) {
  return handle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'product';
}

function buildImageFilename(handle, position, ext = 'png') {
  return `${slugifyHandle(handle)}-${String(position).padStart(2, '0')}.${ext}`;
}

function getProductAbbreviation(title, handle) {
  const pad = (s) => (s.length >= 3 ? s.slice(0, 3) : s.padEnd(3, 'X').slice(0, 3));
  if (handle?.trim()) {
    const parts = handle.trim().toLowerCase().split('-').filter(Boolean);
    if (parts.length >= 3) return pad(parts.slice(0, 3).map((p) => p[0]).join('').toUpperCase());
    if (parts.length === 2) return pad((parts[0].slice(0, 2) + (parts[1][0] || '')).toUpperCase());
  }
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 3) return pad(words.slice(0, 3).map((w) => w[0]).join('').toUpperCase());
  if (words.length === 2) return pad((words[0].slice(0, 2) + words[1][0]).toUpperCase());
  return 'PRD';
}

function buildPodSku(size) {
  return `FIG-POD-${size}`;
}

function buildBulkSku(productCode, size, subCode) {
  const pc = productCode.trim().toUpperCase();
  const sc = subCode?.trim().toUpperCase();
  const sz = size.trim();
  if (sc) return `${pc}-REG-${sc}-${sz}`;
  return `${pc}-REG-${sz}`;
}

function buildPodVariants(imageSrc) {
  return POD_SIZES.map((size) => ({
    option1Name: 'Size',
    option1Value: size,
    option2Name: '',
    option2Value: '',
    option3Name: '',
    option3Value: '',
    sku: buildPodSku(size),
    price: POD_SIZE_PRICES[size],
    compareAtPrice: '',
    imageSrc,
  }));
}

function buildBulkVariants(productCode, imageSrc) {
  return POD_SIZES.map((size) => ({
    option1Name: 'Size',
    option1Value: size,
    option2Name: '',
    option2Value: '',
    option3Name: '',
    option3Value: '',
    sku: buildBulkSku(productCode, size),
    price: POD_SIZE_PRICES[size],
    compareAtPrice: '',
    imageSrc,
  }));
}

function parseListingJson(text) {
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(cleaned);
}

function contextForLine(skuLine) {
  if (skuLine === 'pod') {
    return `Series: FIG-POD Print-on-Demand (POD)
Variant SKU format: FIG-POD-{size} only (4cm–10cm)
Product title: JuJuBit pipe format "[Descriptor] | [Tagline]" — NEVER put FIG-POD in title
Example: "Custom Hogwarts Student Figurine | Create Your Own 3D Printed Collectible Figure"`;
  }
  return `Series: 大货 Bulk / Wholesale (REG SKU)
Variant SKU format: {PRODUCT}-REG-{size}
Product title: descriptive name only (e.g. "Tactical Operator Action Figure")`;
}

function titlePromptForLine(skuLine) {
  if (skuLine === 'pod') {
    return `Title MUST be: "[Character/Product Descriptor] | [Marketing tagline about 3D printed figurine]"
Example: "Custom Figurine of Yourself | Turn Your Photo into a 3D Printed Figure"
NEVER include "FIG-POD" in the title.`;
  }
  return 'Title: descriptive product name only (no FIG-POD, no REG, no SKU codes).';
}

async function apiPost(route, password, body, timeoutMs = 120000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${route}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-app-password': password,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 500) };
    }
    if (!res.ok) throw new Error(`${route} ${res.status}: ${json.error || text.slice(0, 300)}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function generateListing(imageBase64, skuLine, password) {
  try {
    return await apiPost(
      '/api/anthropic',
      password,
      {
        imageBase64,
        contextText: contextForLine(skuLine),
        contextMode: 'series',
        skuLine,
      },
      45000
    );
  } catch {
    const res = await fetch(`${PROXY_URL.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PROXY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen3-vl-flash',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are an expert Shopify product copywriter.
${contextForLine(skuLine)}
Return ONLY raw JSON: title, handle, description_html, seo_title, seo_description, tags (array), vendor, category, type.
${titlePromptForLine(skuLine)}`,
            },
            { type: 'image_url', image_url: { url: imageBase64 } },
          ],
        }],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`proxy ${res.status}: ${raw.slice(0, 300)}`);
    const json = JSON.parse(raw);
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('No content from proxy');
    return parseListingJson(text);
  }
}

async function runCase(testCase, password, index) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${index + 1}/3] ${testCase.label} (${testCase.skuLine.toUpperCase()})`);
  console.log('='.repeat(60));

  if (!fs.existsSync(testCase.imagePath)) {
    throw new Error(`Image not found: ${testCase.imagePath}`);
  }

  const imageBase64 = toDataUrl(testCase.imagePath);
  console.log('  image:', Math.round(imageBase64.length / 1024), 'KB');

  console.log('  generating listing...');
  const listing = await generateListing(imageBase64, testCase.skuLine, password);
  const handle = listing.handle || `test-${Date.now()}-${index}`;
  console.log('  title:', listing.title);
  console.log('  handle:', handle);

  const productCode = getProductAbbreviation(listing.title || '', handle);
  const variants =
    testCase.skuLine === 'pod'
      ? buildPodVariants(imageBase64)
      : buildBulkVariants(productCode, imageBase64);

  console.log('  sample SKUs:', variants.slice(0, 2).map((v) => v.sku).join(', '), '...');
  console.log('  image file:', buildImageFilename(handle, 1));

  const product = {
    title: listing.title,
    handle,
    description_html: listing.description_html || '<p>Test product</p>',
    vendor: listing.vendor || 'JuJuBit',
    category: listing.category || '',
    type: listing.type || 'Collectible Figurine',
    tags: listing.tags || [testCase.skuLine === 'pod' ? 'FIG-POD' : 'REG'],
    seo_title: listing.seo_title || listing.title,
    seo_description: listing.seo_description || '',
    mainImageSrc: imageBase64,
    galleryImageSrcs: [],
    imageFileNames: [buildImageFilename(handle, 1)],
  };

  console.log('  publishing draft to Shopify...');
  const published = await apiPost('/api/shopify-publish', password, {
    product,
    variants,
    status: 'draft',
  });

  return {
    label: testCase.label,
    skuLine: testCase.skuLine,
    title: product.title,
    handle: published.handle,
    productId: published.productId,
    adminUrl: published.adminUrl,
    sampleSku: variants[0].sku,
    imageFile: product.imageFileNames[0],
    imageUrl: published.imageUrls?.[0],
  };
}

async function main() {
  const { APP_PASSWORD: password } = loadDevVars();
  if (!password) {
    console.error('APP_PASSWORD missing');
    process.exit(1);
  }

  console.log('Internal batch test: 1 POD + 2 大货 → Shopify drafts\n');

  const results = [];
  for (let i = 0; i < TEST_CASES.length; i++) {
    try {
      results.push(await runCase(TEST_CASES[i], password, i));
    } catch (err) {
      console.error(`  ❌ FAILED:`, err.message);
      results.push({ label: TEST_CASES[i].label, error: err.message });
    }
    if (i < TEST_CASES.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const r of results) {
    if (r.error) {
      console.log(`❌ ${r.label}: ${r.error}`);
    } else {
      console.log(`✅ ${r.label}`);
      console.log(`   ${r.skuLine.toUpperCase()} · ${r.sampleSku}`);
      console.log(`   image: ${r.imageFile}`);
      console.log(`   ${r.adminUrl}`);
    }
  }

  const failed = results.filter((r) => r.error).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
