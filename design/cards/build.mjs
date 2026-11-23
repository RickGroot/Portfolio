// Builds design-system.html from source.html: inlines the fonts and downsized
// images so the preview is one self-contained file. Design preview only, not part of the site build.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
let html = await readFile(path.join(here, 'source.html'), 'utf8');

const replaceAsync = async (text, pattern, fn) => {
	const jobs = [...text.matchAll(pattern)].map((m) => fn(...m));
	const done = await Promise.all(jobs);
	let i = 0;
	return text.replace(pattern, () => done[i++]);
};

html = await replaceAsync(html, /\{\{font:([^}]+)\}\}/g, async (_, file) => {
	const data = await readFile(path.resolve(root, file));
	return `data:font/woff2;base64,${data.toString('base64')}`;
});
html = await replaceAsync(html, /\{\{img:([^:}]+):(\d+)\}\}/g, async (_, file, width) => {
	const data = await sharp(path.resolve(root, file)).resize({ width: Number(width) }).jpeg({ quality: 72 }).toBuffer();
	return `data:image/jpeg;base64,${data.toString('base64')}`;
});

const out = path.join(here, 'design-system.html');
await writeFile(out, html);
console.log(`${path.relative(root, out)} ${(html.length / 1024).toFixed(0)} KB`);
