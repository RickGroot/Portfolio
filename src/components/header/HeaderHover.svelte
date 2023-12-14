<script lang="ts">
	import { onMount } from 'svelte';
	import { writable, type Writable } from 'svelte/store';

	interface Square {
		id: number;
		size: number;
	}

	let container: HTMLElement;
	let squares: Writable<Square[]> = writable([]);
	const minSquareSize = 80; // in px

	onMount(() => {
		const { clientWidth, clientHeight } = container;
		const columns = Math.floor(clientWidth / minSquareSize);
		const rows = Math.floor(clientHeight / minSquareSize);
		const newSquares = Array.from({ length: columns * rows }, (_, index) => ({
			id: index,
			size: minSquareSize
		}));
		squares.set(newSquares);
	});
</script>

<div bind:this={container} class="container">
	{#each $squares as { id, size } (id)}
		<div class="square" style="width: {size}px; height: {size}px;" />
	{/each}
</div>

<style lang="scss">
	.container {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		gap: 0;
		flex-direction: row;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		align-content: center;
	}

	.square {
		$color: rgba(
			$color: #fff,
			$alpha: 0.6
		);

		display: block;
		margin: 1px;
		box-shadow: 0 0 0 0 $color inset;
		transition: box-shadow 0.6s cubic-bezier(0, 1, 0.5, 1);

		&:hover {
			box-shadow: 0 0 0 1rem $color inset;
			transition: none;
		}
	}
</style>
