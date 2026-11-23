import { test, expect, type Page } from '@playwright/test';
import { contrast } from '../../src/lib/channels';

/**
 * The things a visitor steers by, checked where they are drawn: the pointer,
 * the rail, the focus rings, and the cues that have to survive forced colours.
 * axe checks names and roles; none of these is something it can see.
 */

test.use({ viewport: { width: 1440, height: 900 } });

const toHex = (rgb: string): string => {
	const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
	if (!m) throw new Error(`not an rgb() colour: ${rgb}`);
	return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
};

/** Jump to a section without the smooth scroll, and let the channel settle. */
const jumpTo = async (page: Page, id: string): Promise<void> => {
	await page.evaluate((target) => {
		const root = document.documentElement;
		root.style.scrollBehavior = 'auto';
		document.getElementById(target)?.scrollIntoView();
		root.style.scrollBehavior = '';
	}, id);
	await page.waitForTimeout(400);
};

test.describe('the pointer', () => {
	// The ring used to stand in for the pointer, which was hidden: no pointer
	// at all after a page load until the mouse moved, and none of a visitor's
	// own pointer settings. Now it is decoration beside it.
	test('the system pointer is never hidden, and the ring is decoration', async ({ page }) => {
		await page.goto('/');
		await page.mouse.move(700, 300);
		await page.mouse.move(720, 320);
		await expect(page.locator('.cursor__ring')).toHaveCount(1);

		const hidden = await page.evaluate(
			() =>
				[document.documentElement, ...document.querySelectorAll('*')].filter(
					(el) => getComputedStyle(el).cursor === 'none',
				).length,
		);
		expect(hidden, 'elements with cursor: none').toBe(0);

		const ring = page.locator('.cursor__ring');
		await expect(ring).toHaveAttribute('aria-hidden', 'true');
		expect(await ring.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
		await expect(page.locator('.cursor__dot')).toHaveCount(0);
	});

	test('no ring under forced colours', async ({ browser }) => {
		const context = await browser.newContext({
			viewport: { width: 1440, height: 900 },
			forcedColors: 'active',
		});
		const page = await context.newPage();
		await page.goto('/');
		await page.mouse.move(700, 300);
		await page.mouse.move(720, 320);
		await page.waitForTimeout(200);
		await expect(page.locator('.cursor__ring')).toHaveCount(0);
		await context.close();
	});
});

test.describe('the rail', () => {
	test('every dot is a 24px target with a name of its own', async ({ page }) => {
		await page.goto('/');
		const dots = await page.evaluate(() =>
			[...document.querySelectorAll<HTMLAnchorElement>('[data-rail] a')].map((a) => {
				const r = a.getBoundingClientRect();
				return { name: (a.textContent ?? '').trim(), w: r.width, h: r.height };
			}),
		);
		expect(dots.length).toBeGreaterThan(0);
		for (const d of dots) {
			expect(d.w, `${d.name}: target width`).toBeGreaterThanOrEqual(24);
			expect(d.h, `${d.name}: target height`).toBeGreaterThanOrEqual(24);
		}
		const names = dots.map((d) => d.name);
		expect(new Set(names).size, `rail names repeat: ${names.join(', ')}`).toBe(names.length);
	});

	test('a dot shows its name on focus and under the pointer, and hides it at rest', async ({
		page,
	}) => {
		await page.goto('/');
		const dot = page.locator('[data-rail] a[href="#practice"]');
		const label = dot.locator('.rail__label');
		const shown = (): Promise<number> =>
			label.evaluate((el) => {
				const r = el.getBoundingClientRect();
				return getComputedStyle(el).clipPath === 'none' ? r.width : 0;
			});

		expect(await shown(), 'the label shows at rest').toBe(0);

		await dot.focus();
		await expect.poll(shown, { message: 'no label on focus' }).toBeGreaterThan(40);
		await expect(label).toHaveText('How I work');
		await dot.blur();

		const box = (await dot.boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await expect.poll(shown, { message: 'no label under the pointer' }).toBeGreaterThan(40);

		// The label sits beside the rail, not over it or off the screen.
		const [l, rail] = await Promise.all([
			label.boundingBox(),
			page.locator('[data-rail]').boundingBox(),
		]);
		expect(l!.x + l!.width).toBeLessThanOrEqual(rail!.x + 0.5);
		expect(l!.x).toBeGreaterThanOrEqual(0);
	});

	test('the interludes are two regions, not one twice', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('region', { name: 'Interlude: Signal' })).toHaveCount(1);
		await expect(page.getByRole('region', { name: 'Interlude: Field' })).toHaveCount(1);
	});
});

test.describe('forced colours', () => {
	test('the current rail dot and the programme in focus keep a cue', async ({ browser }) => {
		const context = await browser.newContext({
			viewport: { width: 1440, height: 900 },
			forcedColors: 'active',
		});
		const page = await context.newPage();
		await page.goto('/');
		await expect(page.locator('[data-rail] a[aria-current="true"]')).toHaveCount(1);

		const borders = await page.evaluate(() =>
			[...document.querySelectorAll('[data-rail] a')].map((a) => ({
				current: a.getAttribute('aria-current') === 'true',
				width: getComputedStyle(a, '::before').borderTopWidth,
			})),
		);
		const current = borders.find((b) => b.current)!;
		const rest = new Set(borders.filter((b) => !b.current).map((b) => b.width));
		expect(rest.has(current.width), 'the current dot looks like the rest').toBe(false);

		// The programme in focus against one that is not.
		await jumpTo(page, 'work');
		const fills = await page.evaluate(() => {
			const lit = document.querySelector('#work .guide__block[data-focus]')!;
			const unlit = document.querySelector('#work .guide__block:not([data-focus])')!;
			return [getComputedStyle(lit).backgroundColor, getComputedStyle(unlit).backgroundColor];
		});
		expect(fills[0], 'the programme in focus looks like the rest').not.toBe(fills[1]);
		await context.close();
	});
});

test.describe('focus rings', () => {
	// WCAG 1.4.11: a focus ring is a non-text cue, 3:1 against what it is
	// drawn on. A social link's plate lights up in another channel on focus,
	// and the ring drawn round the text fell inside it, in the page's mark.
	test('a social link is ringed outside its plate, clear of the page', async ({ page }) => {
		await page.goto('/');
		await jumpTo(page, 'contact');
		const links = page.locator('#contact .social a');
		const count = await links.count();
		expect(count).toBeGreaterThan(0);

		for (let i = 0; i < count; i++) {
			const link = links.nth(i);
			await link.focus();
			const m = await link.evaluate((a) => {
				const plate = a.querySelector('.social__plate')!;
				const ps = getComputedStyle(plate);
				const field = getComputedStyle(a.closest('[data-channel]')!).backgroundColor;
				return {
					name: (a.textContent ?? '').trim(),
					own: getComputedStyle(a).outlineStyle,
					style: ps.outlineStyle,
					width: parseFloat(ps.outlineWidth),
					offset: parseFloat(ps.outlineOffset),
					colour: ps.outlineColor,
					field,
				};
			});
			expect(m.own, `${m.name}: a second ring round the text`).toBe('none');
			expect(m.style, `${m.name}: no ring round the plate`).toBe('solid');
			expect(m.width, `${m.name}: ring width`).toBeGreaterThanOrEqual(2);
			expect(m.offset, `${m.name}: the ring touches the plate`).toBeGreaterThan(0);
			const ratio = contrast(toHex(m.colour), toHex(m.field));
			expect(ratio, `${m.name}: ring ${m.colour} on ${m.field}`).toBeGreaterThanOrEqual(3);
		}
	});
});

test('a case study lists the guide strip among its headings', async ({ page }) => {
	await page.goto('/work/vamp');
	await expect(
		page.getByRole('navigation', { name: 'Programme guide' }).getByRole('heading', { level: 2 }),
	).toHaveText(/On the guide/i);
});
