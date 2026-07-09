// Changes: Test POD title format — pipe style, no FIG-POD in title; optional Shopify draft publish.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = process.env.API_BASE || 'http://localhost:3000';
const PROXY_URL = process.env.API_BASE_URL || 'https://lumina.tripo3d.com';
const PROXY_TOKEN = process.env.API_AUTH_TOKEN || 'sk-ELK4mC5Kf8jkfkcZyk6DkA';
const IMAGE_PATH =
  process.argv[2] ||
  '/Users/linyuxiao/Library/Application Support/Cursor/User/workspaceStorage/1776352706217/images/20260707142233-9GvTSHnY-ad546f14-04a5-4920-9c65-90cd2db83c95.png';

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
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const POD_SIZES = ['4cm', '5cm', '6cm', '7cm', '8cm', '10cm'];
const POD_SIZE_PRICES = {
  '4cm': '29.99', '5cm': '49.99', '6cm': '69.99',
  '7cm': '99.99', '8cm': '129.99', '10cm': '169.99',
};

function slugify(handle) {
  return handle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'product';
}

function buildImageFilename(handle, position) {
  return `${slugify(handle)}-${String(position).padStart(2, '0')}.png`;
}

function parseListingJson(text) {
  return JSON.parse(text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim());
}

const POD_CONTEXT = `Series: FIG-POD Print-on-Demand (POD)
Variant SKU format: FIG-POD-{size} only (4cm–10cm)
IMPORTANT: "FIG-POD" is for variant SKUs only — NEVER in product title.
Product title: "[Descriptor] | [Tagline]" e.g. "Custom Figurine of Yourself | Turn Your Photo into a 3D Printed Figure"`;

async function generateListing(imageBase64, password) {
  try {
    const res = await fetch(`${BASE}/api/anthropic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': password },
      body: JSON.stringify({
        imageBase64,
        contextText: POD_CONTEXT,
        contextMode: 'series',
        skuLine: 'pod',
      }),
      signal: AbortSignal.timeout(45000),
    });
    const d = await res.json();
    if (res.ok && d.title) return { listing: d, source: 'local /api/anthropic' };
    throw new Error(d.error || `HTTP ${res.status}`);
  } catch (localErr) {
    console.log('   local API:', localErr.message, '→ proxy fallback');
    const res = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${PROXY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3-vl-flash',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Shopify POD listing. Return ONLY raw JSON: title, handle, description_html, seo_title, seo_description, tags, vendor, category, type.
Title MUST be: "[Descriptor] | [Tagline about 3D printed figurine]"
Example: "Custom Hogwarts Student Figurine | Create Your Own 3D Printed Collectible Figure"
NEVER put "FIG-POD" in the title.`,
            },
            { type: 'image_url', image_url: { url: imageBase64 } },
          ],
        }],
        max_tokens: 4096,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(90000),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`proxy ${res.status}: ${raw.slice(0, 200)}`);
    const text = JSON.parse(raw)?.choices?.[0]?.message?.content?.trim();
    return { listing: parseListingJson(text), source: 'proxy qwen3-vl-flash' };
  }
}

async function main() {
  const { APP_PASSWORD: password } = loadDevVars();
  const imageBase64 = toDataUrl(IMAGE_PATH);

  console.log('POD title format test (wizard image)\n');

  const { listing, source } = await generateListing(imageBase64, password);
  console.log('source:', source);
  console.log('title:', listing.title);
  console.log('handle:', listing.handle);

  const hasFigPod = /FIG-POD/i.test(listing.title || '');
  const hasPipe = (listing.title || '').includes('|');
  console.log('\n--- checks ---');
  console.log(hasFigPod ? '❌ FIG-POD in title (bad)' : '✅ no FIG-POD in title');
  console.log(hasPipe ? '✅ pipe | separator present' : '❌ missing pipe separator');

  if (hasFigPod || !hasPipe) {
    console.log('\n⚠️  Title format needs review before publish');
    process.exit(1);
  }

  const handle = listing.handle || `custom-wizard-${Date.now()}`;
  const variants = POD_SIZES.map((size) => ({
    option1Name: 'Size', option1Value: size,
    option2Name: '', option2Value: '', option3Name: '', option3Value: '',
    sku: `FIG-POD-${size}`, price: POD_SIZE_PRICES[size],
    compareAtPrice: '', imageSrc: imageBase64,
  }));

  console.log('\npublishing draft to Shopify...');
  const pub = await fetch(`${BASE}/api/shopify-publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-password': password },
    body: JSON.stringify({
      product: {
        title: listing.title,
        handle,
        description_html: listing.description_html || '<p>Test</p>',
        vendor: listing.vendor || 'JuJuBit',
        category: listing.category || '',
        type: listing.type || 'Collectible Figurine',
        tags: listing.tags || ['FIG-POD'],
        seo_title: listing.seo_title || listing.title,
        seo_description: listing.seo_description || '',
        mainImageSrc: imageBase64,
        galleryImageSrcs: [],
        imageFileNames: [buildImageFilename(handle, 1)],
      },
      variants,
      status: 'draft',
    }),
    signal: AbortSignal.timeout(120000),
  });
  const result = await pub.json();
  if (!pub.ok) throw new Error(result.error || 'publish failed');

  console.log('\n✅ Published draft');
  console.log('   SKU sample:', variants[0].sku);
  console.log('   image:', buildImageFilename(handle, 1));
  console.log('   admin:', result.adminUrl);
}

main().catch((e) => {
  console.error('\n❌', e.message);
  process.exit(1);
});
