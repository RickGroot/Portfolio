<script lang="ts">
	import CardContainer from '../CardContainer.svelte';
	import type { Card } from '../typing';

	export let card: Card;
</script>

<CardContainer id={card.id} outline blur>
	<h2 class="title-3">{card.title}</h2>
	<h2 class="title-2">{card.title}</h2>
	<h2 class="title-1">{card.title}</h2>
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

	.title-1 {
		font: 900 40px 'Lato';
		font-family: 'Lato';
		text-transform: uppercase;
		position: absolute;
		top: 40px;
		left: 50px;
		margin: 0;
	}

	.title-2,
	.title-3 {
		@extend .title-1;
		-webkit-text-stroke: 1px white;
		-webkit-mask-image: linear-gradient(180deg, transparent 40%, black);
		mask-image: linear-gradient(180deg, transparent 40%, black);
		color: transparent;
		text-shadow: none;
		display: none;
	}

	.title-2 {
		top: 60px;
	}
	.title-3 {
		top: 80px;
	}

	@supports (-webkit-text-stroke: 1px black) {
		.title-2,
		.title-3 {
			display: block;
		}
	}

	.tags {
		position: absolute;
		bottom: 40px;
		left: 50px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-end;
	}

	.tag {
		$margin-left: 30px;
		position: relative;
		font: 900 16px 'Lato';
		font-family: 'Lato';
		margin: 0;
		padding-bottom: 10px;
	}
</style>
