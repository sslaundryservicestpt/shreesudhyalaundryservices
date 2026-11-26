import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('out');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const references = [...html.matchAll(/<(?:a|link|script|img)\b[^>]*?\b(?:href|src)="([^"]+)"/g)].map(match => match[1]);
let anchors = 0;
const assets = new Set();
for (const ref of references) {
  if (ref.startsWith('#')) {
    assert(ids.has(ref.slice(1)), `Broken section link: ${ref}`);
    anchors++;
  } else if (ref.startsWith('/')) {
    const pathname = new URL(ref, 'https://local.test').pathname;
    if (pathname === '/') continue;
    const target = path.join(root, decodeURIComponent(pathname));
    await access(target);
    assets.add(pathname);
  } else if (ref.startsWith('tel:') || ref.startsWith('mailto:')) {
    assert(ref.split(':')[1].trim(), `Empty contact link: ${ref}`);
  }
}
assert.equal((html.match(/<h1\b/g) || []).length, 1, 'The page must have one primary heading');
assert(html.includes('lang="en"'), 'Missing document language');
assert(html.includes('Supplied reference photographs'), 'Gallery must disclose supplied reference photography');
assert.equal((html.match(/class="gallery-photo"/g) || []).length, 2, 'Both supplied photographs must appear in the gallery');
const brandLinks = [...html.matchAll(/<a\b[^>]*aria-label="Shree Sudhya Laundry Services home"[^>]*>(.*?)<\/a>/g)];
assert.equal(brandLinks.length, 2, 'Brand links belong in the navbar and footer');
for (const [, markup] of brandLinks) assert(markup.includes('/images/brand-logo-clean.jpg'));
assert(!html.includes('/images/brand-banner.jpeg'), 'The exported page must use the Operations logo');
const marketingLogo = await readFile(path.join(root, 'images/brand-logo-clean.jpg'));
const operationsLogo = await readFile(new URL('../../operations/public/images/brand-logo-clean.jpg', import.meta.url));
assert(marketingLogo.equals(operationsLogo), 'Marketing must ship the same logo artwork as Operations');
assert(!/<img\b[^>]*src="\/images\/brand-seal.jpeg"/.test(html), 'Decorative logo repetition must stay removed');
await access(path.join(root, 'images/brand-marble-v2.webp'));
for (const route of ['favicon.ico', 'icon.svg', '404.html', 'robots.txt', 'sitemap.xml', 'images/brand-logo-clean.jpg']) await access(path.join(root, route));
const favicon = await readFile(path.join(root, 'favicon.ico'));
assert.equal(favicon.readUInt16LE(2), 1, 'Favicon must be an ICO image');
assert.equal(favicon.readUInt16LE(4), 4, 'Favicon must contain four browser sizes');
assert(/rel="icon"[^>]*href="\/favicon.ico/.test(html), 'Missing favicon metadata');
for (const font of ['dm-sans-latin.woff2', 'dm-sans-latin-ext.woff2', 'OFL.txt']) await access(path.join(root, 'fonts', font));
assert(!html.includes('fonts.googleapis.com'), 'Fonts must be self-hosted');
const notFound = await readFile(path.join(root, '404.html'), 'utf8');
assert(notFound.includes('Page not found.'), '404 must use the branded fallback');
console.log(`PASS: ${anchors} section links, ${assets.size} local assets, semantic heading, photography disclosure and exported routes.`);

assert(html.includes('tel:+917075577737'), 'Primary poster phone must be callable');
assert(html.includes('tel:+917396777470'), 'Second poster phone must be callable');
assert(html.includes('mailto:ss.laundryservices.tpt@gmail.com'), 'Poster email must be linked');
assert(html.includes('https://wa.me/message/74YQLIO236XGC1?src=qr'), 'Use the decoded poster WhatsApp QR link');
assert(html.includes('Tirupati, Andhra Pradesh'), 'Display the city from the posters');
assert(html.includes('Request a business quote'), 'Main action should invite a commercial quote');
assert(html.includes('Hotels &amp; Hostels') && html.includes('Restaurants &amp; Catering'), 'Commercial sectors must appear on the page');
assert(!/wardrobe|your favourite clothes|your home or business/i.test(html), 'Consumer copy must not reappear');
assert(html.includes('Continue in WhatsApp'), 'Form must disclose its actual handoff');
for (const name of ['business', 'name', 'phone', 'email', 'service', 'message']) assert(html.includes(`name="${name}"`), `Missing contact field ${name}`);
assert(!html.includes('contact details are being finalised'), 'Remove obsolete contact placeholder');
console.log('PASS: poster contacts, labelled enquiry form and honest WhatsApp handoff.');

assert(/<iframe[^>]+src="https:\/\/www\.google\.com\/maps\?q=13\.6449346%2C79\.449206[^"]*output=embed"/.test(html), 'Contact should embed the verified business pin');
assert(html.includes('https://maps.app.goo.gl/7VLbVzc1y3VRUAyP7') && html.includes('destination=13.6449346%2C79.449206'), 'Map link and directions must use the owner-supplied location');
assert(html.includes('Commercial linen finishing') && html.includes('Reference photography'), 'About must disclose the finishing image as reference photography');

const commercialCards = [...html.matchAll(/<article class="service-card">/g)];
assert.equal(commercialCards.length, 6, 'All six commercial cards must render in the page');
assert.equal((html.match(/aria-label="Request a quote for /g) || []).length, 6, 'Each commercial card must have a quote link');
assert(html.includes('aria-label="Request a quote for Hotels &amp; Hostels"'), 'The hotel card must link to its business quote');
