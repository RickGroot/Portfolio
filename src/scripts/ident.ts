/**
 * The one line in the console (docs/easter-eggs.md): the test card's colour
 * bars, then "Signal acquired." on a plate of the page's channel. Nothing that
 * reads like a job advert, and nothing more than the one line.
 *
 * The colours are read off <html>, which carries the palette and the page's
 * channel as custom properties (src/lib/channels.ts), so there is no second
 * copy of them here. The bars run as the hero's do (--bars in tokens.css):
 * brightest to darkest.
 */
const BARS = ['--paper', '--signal-yellow', '--brass', '--signal-red', '--signal-blue', '--navy'];

export function boot(): void {
	const root = getComputedStyle(document.documentElement);
	const read = (name: string): string => root.getPropertyValue(name).trim();
	// Each bar is a styled space: a %c with nothing after it would style nothing.
	const bars = BARS.map((name) => `background:${read(name)};padding:0.25em 0.5em`);
	const plate =
		`background:${read('--field')};color:${read('--mark')};` +
		'margin-left:0.6em;padding:0.25em 0.8em;font-weight:700;letter-spacing:0.08em';
	console.log(`${'%c '.repeat(BARS.length)}%cSignal acquired.`, ...bars, plate);
}
