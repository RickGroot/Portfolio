<script lang="ts">
	import CardContainer from '../CardContainer.svelte';
	import type { Card } from '../typing';

	export let card: Card;
</script>

<CardContainer id={card.id} zoom={120}>
	<div class="shape" />
	<h2 class="title">{card.title}</h2>
	{#if card.tags}
		<div class="tags">
			{#each card.tags as tag}
				<p class="tag">{tag}</p>
			{/each}
		</div>
	{/if}
</CardContainer>

<style lang="scss">
	@import '../../../styling/base.scss';

	$padding: 20px;

	.shape {
		position: absolute;
		top: $padding;
		bottom: $padding;
		left: 0;
		right: $padding;
		border-right: 3px solid white;
		border-bottom: 3px solid white;
		border-bottom-right-radius: 10px;
	}

	.title {
		$width: 250px;
		$height: 50px;
		font: 900 40px 'Lato';
		font-family: 'Lato';
		text-transform: uppercase;
		position: absolute;
		top: calc($padding - #{$height});
		right: calc(80px - #{$width});
		margin: 0;
		width: $width;
		height: $height;
		transform: rotate(90deg);
		transform-origin: bottom left;

		@supports (-webkit-text-stroke: 1px black) {
			-webkit-text-stroke: 2px white;
			color: transparent;
			text-shadow: none;
		}
	}

	.tags {
		position: absolute;
		bottom: 23px;
		left: $padding;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-end;
	}

	.tag {
		position: relative;
		font: 900 16px 'Lato';
		font-family: 'Lato';
		margin: 0;
		padding-bottom: 6px;
		margin-top: 10px;

		&::after {
			$height: 2px;
			content: '';
			position: absolute;
			top: 100%;
			left: -$padding;
			width: calc(100% + #{$padding * 2});
			height: $height;
			border-top-right-radius: calc($height / 2);
			border-bottom-right-radius: calc($height / 2);
			background-color: white;
		}

		&:last-child::after {
			display: none;
		}
	}
</style>
