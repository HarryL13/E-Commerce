// Changes: Full E2E test — Gemini SKU listing (direct or proxy) + Shopify draft publish.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const IMAGE_PATH =
  process.argv[2] ||
  '/Users/linyuxiao/Library/Application Support/Cursor/User/workspaceStorage/1776352706217/images/20260707151859-m0OzkY0L-192df686-17c1-44c4-acc5-6153a2f22308.png';
const BASE = process.env.API_BASE || 'http://localhost:3000';
const PROXY_URL = process.env.API_BASE_URL || 'https://lumina.tripo3d.com';
const PROXY_TOKEN = process.env.API_AUTH_TOKEN || 'sk-ELK4mC5Kf8jkfkcZyk6DkA';

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

const POD_SIZES = ['4cm', '5cm', '6cm', '7cm', '8cm', '10cm'];
const POD_SIZE_PRICES = {
  '4cm': '29.99',
  '5cm': '49.99',
  '6cm': '69.99',
  '7cm': '99.99',
  '8cm': '129.99',
  '10cm': '169.99',
};

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

function buildPodVariants(abbrev, imageSrc) {
  return POD_SIZES.map((size) => ({
    option1Name: 'Size',
    option1Value: size,
    option2Name: '',
    option2Value: '',
    option3Name: '',
    option3Value: '',
    sku: abbrev ? `FIG-POD-${size}-${abbrev}` : `FIG-POD-${size}`,
    price: POD_SIZE_PRICES[size],
    compareAtPrice: '',
    imageSrc,
  }));
}

function parseListingJson(text) {
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(cleaned);
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

async function generateViaLocalApi(password, imageBase64) {
  console.log('   trying /api/anthropic (direct Gemini)...');
  return apiPost('/api/anthropic', password, {
    imageBase64,
    contextText: `Series: FIG-POD Print-on-Demand Collection
SKU line: FIG-POD (sizes 4cm–10cm)
Title format must use series name "FIG-POD" in the product title.
Product: chibi tactical soldier vinyl figurine with minigun.`,
    contextMode: 'series',
  }, 45000);
}

async function generateViaProxy(imageBase64) {
  console.log(`   trying proxy ${PROXY_URL}...`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(`${PROXY_URL.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
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
Based on the image and FIG-POD series info, return ONLY raw JSON with:
title, handle, description_html, seo_title, seo_description, tags (array), vendor, category, type, about_section.
Title format: "FIG-POD - [Creative Name]" (1-3 word creative name).`,
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
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!fs.existsSync(IMAGE_PATH)) {
    console.error('Image not found:', IMAGE_PATH);
    process.exit(1);
  }

  const { APP_PASSWORD: password } = loadDevVars();
  if (!password) {
    console.error('APP_PASSWORD missing in .dev.vars');
    process.exit(1);
  }

  console.log('1/3 Loading image...');
  const imageBase64 = toDataUrl(IMAGE_PATH);
  console.log('   ', Math.round(imageBase64.length / 1024), 'KB base64');

  console.log('2/3 Generating SKU listing...');
  let listing;
  try {
    listing = await generateViaLocalApi(password, imageBase64);
    console.log('   source: local /api/anthropic');
  } catch (localErr) {
    console.log('   local failed:', localErr.message);
    listing = await generateViaProxy(imageBase64);
    console.log('   source: proxy fallback');
  }

  console.log('   title:', listing.title);
  console.log('   handle:', listing.handle);

  const abbrev = getProductAbbreviation(listing.title || '', listing.handle || '');
  const variants = buildPodVariants(abbrev, imageBase64);
  const product = {
    title: listing.title,
    handle: listing.handle,
    description_html: listing.description_html,
    vendor: listing.vendor || 'JuJuBit',
    category: listing.category || '',
    type: listing.type || 'Collectible Figurine',
    tags: listing.tags || ['FIG-POD'],
    seo_title: listing.seo_title || listing.title,
    seo_description: listing.seo_description || '',
    mainImageSrc: imageBase64,
    galleryImageSrcs: [],
  };

  console.log('3/3 Publishing draft to Shopify...');
  const published = await apiPost('/api/shopify-publish', password, {
    product,
    variants,
    status: 'draft',
  }, 120000);

  console.log('\n✅ Full E2E success');
  console.log('   Product ID:', published.productId);
  console.log('   Title:', product.title);
  console.log('   Admin URL:', published.adminUrl);
  console.log('   Variants:', variants.length);
  console.log('   Images:', published.imageUrls?.length ?? 0);
}

main().catch((err) => {
  console.error('\n❌ E2E failed:', err.message);
  process.exit(1);
});
