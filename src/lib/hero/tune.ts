/**
 * The tune the masthead's tracker plays: "When the Saints Go Marching In",
 * traditional and in the public domain, a trumpet standard. Written for
 * trumpet in C, 112 bpm, sixteen bars, as a four-channel tracker pattern --
 * trumpet, bass, keys, drums -- two rows a beat.
 *
 * Art data: it draws the pattern, it is not copy anyone reads as prose, so
 * it lives beside the code that plays it rather than in src/content/.
 */

export const BPM = 112;
export const ROWS_PER_BEAT = 2;
export const CHANNELS = ['Trumpet', 'Bass', 'Keys', 'Drums'] as const;

type Note = [string, number]; // 'r' for a rest; length in beats

const MELODY: Note[] = [
	['r', 1],
	['C5', 1],
	['E5', 1],
	['F5', 1],
	['G5', 4],
	['r', 1],
	['C5', 1],
	['E5', 1],
	['F5', 1],
	['G5', 4],
	['r', 1],
	['C5', 1],
	['E5', 1],
	['F5', 1],
	['G5', 2],
	['E5', 2],
	['C5', 2],
	['E5', 2],
	['D5', 4],
	['r', 1],
	['E5', 1],
	['E5', 1],
	['D5', 1],
	['C5', 3],
	['C5', 1],
	['E5', 2],
	['G5', 2],
	['G5', 1],
	['F5', 3],
	['r', 1],
	['E5', 1],
	['F5', 1],
	['G5', 1],
	['E5', 2],
	['C5', 2],
	['D5', 4],
	['C5', 4],
];

/** One chord a bar: the bass's root and fifth, and the note the keys stab. */
const CHORDS: [string, string, string][] = [
	['C3', 'G2', 'E4'],
	['C3', 'G2', 'E4'],
	['C3', 'G2', 'E4'],
	['C3', 'G2', 'E4'],
	['C3', 'G2', 'E4'],
	['C3', 'G2', 'E4'],
	['C3', 'G2', 'E4'],
	['G2', 'D3', 'B3'],
	['C3', 'G2', 'E4'],
	['C3', 'G2', 'E4'],
	['F2', 'C3', 'A4'],
	['F2', 'C3', 'A4'],
	['C3', 'G2', 'E4'],
	['C3', 'G2', 'E4'],
	['G2', 'D3', 'B3'],
	['C3', 'G2', 'E4'],
];

export const ROWS = CHORDS.length * 4 * ROWS_PER_BEAT;

/** "C5" -> "C-5": a tracker's three characters for a note. */
const cell = (n: string): string => (n.length === 2 ? `${n[0]}-${n[1]}` : n);

const hex = (n: number): string => n.toString(16).toUpperCase().padStart(2, '0');

export interface Pattern {
	/** One line of text a row, every channel: `00 |C-5 01 40 |--- .. .. ...`. */
	lines: (channels: readonly number[]) => string[];
	/** Each row's volume per channel, 0 where nothing plays. */
	volumes: number[][];
}

export function pattern(): Pattern {
	const notes: string[][] = Array.from({ length: ROWS }, () => ['---', '---', '---', '---']);
	const volumes: number[][] = Array.from({ length: ROWS }, () => [0, 0, 0, 0]);
	const put = (row: number, ch: number, note: string, vol: number): void => {
		const r = notes[row];
		const v = volumes[row];
		if (!r || !v) return;
		r[ch] = note;
		v[ch] = vol;
	};

	let beat = 0;
	for (const [n, len] of MELODY) {
		if (n !== 'r') put(beat * ROWS_PER_BEAT, 0, cell(n), 0x40);
		beat += len;
	}
	CHORDS.forEach(([root, fifth, stab], bar) => {
		const r0 = bar * 4 * ROWS_PER_BEAT;
		put(r0, 1, cell(root), 0x38);
		put(r0 + 2 * ROWS_PER_BEAT, 1, cell(fifth), 0x30);
		put(r0 + ROWS_PER_BEAT + 1, 2, cell(stab), 0x24);
		put(r0 + 3 * ROWS_PER_BEAT + 1, 2, cell(stab), 0x24);
		for (let b = 0; b < 4; b++)
			put(r0 + b * ROWS_PER_BEAT, 3, b % 2 === 0 ? 'C-1' : 'D-1', b % 2 === 0 ? 0x3c : 0x2c);
	});

	return {
		volumes,
		lines: (channels) =>
			notes.map(
				(row, r) =>
					`${hex(r)} ${channels
						.map((ch) => {
							const n = row[ch] ?? '---';
							const v = volumes[r]?.[ch] ?? 0;
							return `|${n === '---' ? '--- .. ..' : `${n} 0${ch + 1} ${hex(v)}`} `;
						})
						.join('')}`,
			),
	};
}
