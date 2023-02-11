<script lang="ts" context="module">
	import icons from '../lib/icons';
</script>

<script lang="ts">
	export let name: string;
	export let width: string;
	export let height: string = 'auto';
	export let noAlign = false;

	$: html = generateSVG(name, width, height);
	function generateSVG(icon: string, w: string, h: string) {
		let svg = icons[icon as keyof typeof icons];
		if (!svg) {
			console.warn(`No icon "${icon}"`);
			return '';
		}
		const style = `${
			noAlign ? '' : 'display: inline-block; vertical-align: middle;'
		} width: ${w}; height: ${h === 'auto' ? w : h}`;
		svg = svg.replace('<svg ', `<svg style="${style}" `);
		return svg;
	}
</script>

{@html html}
