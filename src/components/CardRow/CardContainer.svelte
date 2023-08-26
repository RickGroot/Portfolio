<script lang="ts">
	export let outline = false;
	export let blur = false;
	export let id: number;
	export let zoom: number | null = null;

	const style = `
	background-image: url('/images/card-background-${id}.jpg');
	background-size: ${zoom ? `${zoom}%` : 'cover'};
	`;
</script>

<article class="card" class:outline class:blur {style}>
	<slot />
</article>

<style lang="scss">
	@import '../../styling/base.scss';
	$size: 100px;
	.card {
		position: relative;
		height: $size * 5.6;
		width: $size * 3.5;
		scroll-snap-align: start;
		flex: 0 0 auto;
		background-color: #462102;
		color: white;
		text-shadow: 1px 1px 5px rgba(0, 0, 0, 0.75);
		margin: 0 50px 0 0;
		border-radius: 16px;
		background-repeat: no-repeat;
		background-position: center center;
		transition: transform 0.2s ease-in-out, filter 0.2s ease-in-out;
		box-shadow: 5px 5px 10px rgba(#000000, 0.75);

		&.outline::after {
			$margin: 22px;
			content: '';
			position: absolute;
			top: $margin;
			bottom: $margin;
			left: $margin;
			right: $margin;
			width: calc(100% - #{$margin * 2});
			height: calc(100% - #{$margin * 2});
			border-radius: 12px;
			outline: 4px solid white;
		}

		&.blur::before {
			content: '';
			position: absolute;
			left: 0;
			right: 0;
			width: 100%;
			height: 100%;
			backdrop-filter: blur(1px);
		}

		&:hover {
			transform: scale(1.02);
			filter: saturate(120%) brightness(110%) contrast(104%);
		}
	}
</style>
