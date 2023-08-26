<script lang="ts">
	import CardContainer from '../CardContainer.svelte';
	import type { Card } from '../typing';

	export let card: Card;
</script>

<CardContainer id={card.id} zoom={110}>
	<h2 class="title">{card.title}</h2>
	{#if card.description}
		<p class="description">{card.description}</p>
	{/if}
</CardContainer>

<style lang="scss">
	@import '../../../styling/base.scss';

	.title {
		font: 900 40px 'Lato';
		font-family: 'Lato';
		text-transform: uppercase;
		position: absolute;
		bottom: 20px;
		left: 60px;
		margin: 0;
		transform: rotate(-90deg);
		transform-origin: bottom left;
	}

	.description {
		font: 400 20px 'Lato';
		font-family: 'Lato';
		position: absolute;
		top: 20px;
		left: 20px;
		margin: 0;
		text-shadow: none;
	}
</style>
