<script lang="ts">
	const amount = 20;
	const particleSize = 14; // smaller size in vmin

	function randomRange(min: number, max: number) {
		return Math.random() * (max - min) + min;
	}

	// Colors as hex strings
	const colors = ['#00797f', '#005062', '#00ffbb'];

	// Helper to convert hex to rgba with alpha
	function hexToRGBA(hex: string, alpha: number) {
		const cleanHex = hex.replace(/^#/, '');
		const r = parseInt(cleanHex.substring(0, 2), 16);
		const g = parseInt(cleanHex.substring(2, 4), 16);
		const b = parseInt(cleanHex.substring(4, 6), 16);
		return `rgba(${r},${g},${b},${alpha})`;
	}

	// Generate random styles for each particle
	const particles = Array.from({ length: amount }, () => {
		const color = colors[Math.floor(Math.random() * colors.length)];
		const top = `${randomRange(0, 100)}%`;
		const left = `${randomRange(0, 100)}%`;
		const duration = `${randomRange(10, 20)}s`;
		const delay = `${-randomRange(0, 20)}s`;
		const originX = `${randomRange(-25, 25)}vw`;
		const originY = `${randomRange(-25, 25)}vh`;

		// Bigger, layered blur shadows for softness
		const blurRadiusPx1 = randomRange(4, 8) * particleSize;
		const blurRadiusPx2 = blurRadiusPx1 * 1.5;
		const blurRadiusPx3 = blurRadiusPx1 * 2;

		const boxShadow = `
			0 0 ${blurRadiusPx1}px currentColor,
			0 0 ${blurRadiusPx2}px currentColor,
			0 0 ${blurRadiusPx3}px currentColor
		`;

		const backgroundColor = hexToRGBA(color, 0.3); // translucent fill

		return {
			color,
			top,
			left,
			duration,
			delay,
			originX,
			originY,
			boxShadow,
			backgroundColor
		};
	});
</script>

<div class="background">
	{#each particles as p}
		<span
			style="
        color: {p.color};
        top: {p.top};
        left: {p.left};
        animation-duration: {p.duration};
        animation-delay: {p.delay};
        transform-origin: {p.originX} {p.originY};
        box-shadow: {p.boxShadow};
        background-color: {p.color};
      "
		/>
	{/each}
</div>

<style lang="scss">
	.background {
		width: 100vw;
		height: 100vh;
		background: #002b39;
		background-position: center;
		background-size: cover;
		position: relative;
		overflow: hidden;
	}

	.background span {
		width: 14vmin;
		height: 14vmin;
		border-radius: 50%;
		backface-visibility: hidden;
		position: absolute;
		animation-name: move;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
		opacity: 0.6;
		mix-blend-mode: screen;
	}

	@keyframes move {
		100% {
			transform: translate3d(0, 0, 1px) rotate(360deg);
		}
	}
</style>
