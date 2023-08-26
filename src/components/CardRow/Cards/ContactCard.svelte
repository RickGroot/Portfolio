<script lang="ts">
	import Icon from '../../Icon.svelte';
	import CardContainer from '../CardContainer.svelte';
	import type { Card } from '../typing';

	export let card: Card;
</script>

<CardContainer id={card.id} zoom={180}>
	<h2 class="title-3">{card.title}</h2>
	<h2 class="title-2">{card.title}</h2>
	<h2 class="title-1">{card.title}</h2>
	{#if card.description}
		<p class="description">{card.description}</p>
	{/if}
	{#if card.links}
		<div class="links">
			{#each card.links as link}
				<a href={link.url} target="_blank" rel="noopener noreferrer" class="link">
					<Icon name={link.icon} width="2.4rem" />
				</a>
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
		bottom: 20px;
		left: 60px;
		margin: 0;
		transform: rotate(-90deg);
		transform-origin: bottom left;
	}

	.title-2,
	.title-3 {
		@extend .title-1;
		-webkit-text-stroke: 1px white;
		-webkit-mask-image: linear-gradient(180deg, transparent 55%, black);
		mask-image: linear-gradient(180deg, transparent 40%, black);
		color: transparent;
		text-shadow: none;
		display: none;
	}

	.title-2 {
		left: 75px;
	}
	.title-3 {
		left: 90px;
	}

	@supports (-webkit-text-stroke: 1px black) {
		.title-2,
		.title-3 {
			display: block;
		}
	}

	.description {
		font: 400 20px 'Lato';
		font-family: 'Lato';
		position: absolute;
		top: 20px;
		left: 20px;
		margin: 0;
	}

	.links {
		position: absolute;
		bottom: 20px;
		right: 20px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-end;
	}

	.link {
		margin-bottom: 10px;
		transition: transform 0.2s ease-in-out;

		&:last-child {
			margin-bottom: 0;
		}

		&:hover {
			transform: scale(1.1);
		}
	}
</style>
