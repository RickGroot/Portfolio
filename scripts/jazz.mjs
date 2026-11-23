#!/usr/bin/env node
/*
 * `pnpm jazz` — opt-in only.
 *
 * Rules this file must keep obeying (docs/easter-eggs.md):
 *   no dependencies · no network · no audio · no file writes
 *   not wired to install/build/CI · exits immediately
 *
 * It writes to stdout and returns. That is the whole program.
 */

const ESC = String.fromCharCode(27);
const NO_COLOR = process.env.NO_COLOR !== undefined || process.env.TERM === 'dumb';
const c = (code, s) => (NO_COLOR ? s : `${ESC}[${code}m${s}${ESC}[0m`);
const dim = (s) => c('2', s);
// The palette in src/lib/palette.ts, as the nearest xterm-256 colours: a
// terminal cannot read a custom property, and 256 colours is what every
// terminal that has colour at all can show.
const blue = (s) => c('38;5;27', s); // signal blue #2340ff, the field's
const yellow = (s) => c('38;5;220', s); // the palette's yellow #ffc21a
const brass = (s) => c('38;5;178', s); // brass #e0a526, the music work's

// The signal resolves from noise into a steady reading — the same idea as the
// Decode treatment, at roughly one-thousandth of the budget.
const RAMP = ['░', '▒', '▓', '█'];
const bars = [1, 2, 3, 4, 4, 3, 2, 3, 4, 4, 4, 3];

const meter = bars.map((n) => blue(RAMP[n - 1])).join('');
const noise = Array.from({ length: 12 }, () => dim(RAMP[Math.floor(Math.random() * 2)])).join('');

const trumpet = [
	'        ______',
	'   ____/  |  /|',
	'  /  o o o | / |   ♪',
	' |__________|/  |      ♫',
	'    |__|__|    /',
].join('\n');

process.stdout.write(
	[
		'',
		`  ${noise}  ${dim('…')}  ${meter}`,
		'',
		`  ${yellow('SIGNAL ACQUIRED')}`,
		'',
		brass(trumpet),
		'',
		dim('  ii – V – I. Back to work.'),
		'',
		'',
	].join('\n'),
);
