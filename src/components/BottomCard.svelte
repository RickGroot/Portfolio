<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly } from 'svelte/transition';
	import Icon from './Icon.svelte';

	export let hovered: boolean;

	interface Icons {
		name: string;
		url: string;
	}

	const icons: Icons[] = [
		{ name: 'cv', url: 'https://read.cv/rg' },
		{ name: 'github', url: 'https://github.com/rickgroot' },
		{ name: 'linkedin', url: 'https://www.linkedin.com/in/r-groot/' },
		{ name: 'mail', url: 'mailto:RickGroot41@gmail.com' }
	];

	const dispatch = createEventDispatcher();
</script>

{#if hovered}
	<section class="layout" transition:fly={{ y: -100 }}>
		<button
			class="container"
			on:mouseenter={() => dispatch('hover', true)}
			on:mouseleave={() => dispatch('hover', false)}
		>
			{#each icons as icon}
				<a href={icon.url} target="_blank" rel="noopener noreferrer">
					<Icon name={icon.name} width="2.4rem" />
				</a>
			{/each}
		</button>
	</section>
{/if}

<style lang="scss">
	@import '../styling/base.scss';

	$padding: 1rem;

	.layout {
		position: absolute;
		bottom: -6rem;
		width: $card-width-mobile;
	}

	.container {
		@include removeButton;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #0013de;
		border-radius: calc($card-width-mobile / 32);
		padding: 4rem $padding $padding;
		box-shadow: 0 5px 10px rgba(0, 0, 0, 0.3);
	}

	@include tablet {
		.layout {
			width: $card-width-desktop;
			display: flex;
			justify-content: center;
		}

		.container {
			width: $card-width-mobile;
		}
	}
</style>
