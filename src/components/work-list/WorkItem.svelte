<script lang="ts">
	import type { WorkItem } from '$lib/work-items';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	export let side: 'left' | 'right' = 'left';
	export let item: WorkItem;

	let active = false;
	let isDesktop = false;

	function getCustomStyle() {
		return `--card-selection-color: ${item.color};`;
	}

	onMount(() => {
		isDesktop = window.matchMedia('(min-width: 80rem)').matches;
		const handleResize = () => {
			isDesktop = window.matchMedia('(min-width: 80rem)').matches;
		};
		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<button
	class="container"
	class:left={side === 'left'}
	class:right={side === 'right'}
	class:active
	style={getCustomStyle()}
	on:mouseenter={() => isDesktop && (active = true)}
	on:mouseleave={() => isDesktop && (active = false)}
	on:focus={() => isDesktop && (active = true)}
	on:blur={() => isDesktop && (active = false)}
	on:click={() => (active = !active)}
>
	<div class="point" />
	<div class="content">
		<h1 class="title">{item.title}</h1>
		<div class="tags">
			{#each item.tags as tag}
				<p class="tag">{tag}</p>
			{/each}
		</div>
		<p class="description" transition:fade|local>{item.description}</p>
	</div>
	<img src="/images/projects/{item.imageUrl}" alt={item.title} class="image" />
</button>

<style lang="scss">
	@use 'sass:math';
	@import '../../styling/base.scss';

	$height: 20rem;
	$padding: 5rem;
	$gap: 8rem;
	$border-radius: 1rem;
	$blur: 1rem;
	$transition-duration: 0.2s;
	$desktop-width: 80rem;
	$mobile-width: 50rem;

	@mixin smallScreen {
		@media (max-width: $desktop-width) {
			@content;
		}
	}

	@mixin bigScreen {
		@media (min-width: $desktop-width) {
			@content;
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.point {
		$point-size: 2.4rem;

		position: absolute;
		top: 50%;
		left: calc(50% - math.div($point-size, 2));
		transform: translateY(-50%);
		height: $point-size;
		width: $point-size;
		background-color: $background-color;
		border-radius: 50%;
		z-index: -1;
		filter: blur(0);
		transition: filter $transition-duration;

		.active & {
			filter: blur($blur);
		}

		@include smallScreen {
			display: none;
		}
	}

	.container {
		@include removeButton;
		position: relative;
		height: $height;
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr;
		margin: $padding 0;
		border-radius: $border-radius;
		order: 1;
		backdrop-filter: blur(0);
		transition: transform $transition-duration, box-shadow $transition-duration,
			backdrop-filter $transition-duration;
		max-width: $desktop-width;
		background-color: white;

		&.right {
			order: -1;
		}

		&.active {
			backdrop-filter: blur($blur);
			transform: scale(1.02);
			box-shadow: 0 0 2rem rgba(0, 0, 0, 0.2);
			cursor: pointer;
		}

		&::selection {
			background: var(--card-selection-color);
			color: white;
			text-shadow: 1px 1px 1px $background-color;
		}

		@include smallScreen {
			max-width: $mobile-width;
			display: block;
			width: 80vw;
			height: auto;
			overflow: hidden;
			padding: 2rem;

			&.active {
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35), inset 0 0 5rem $background-color;
			}
		}

		@include bigScreen {
			&::after {
				content: '';
				background-color: $background-color;
				width: $timeline-width;
				height: 100%;
				position: absolute;
				top: 0;
				left: 50%;
				transform: translateX(-50%);
				transition: filter $transition-duration;
			}
			&.active::after {
				filter: blur($blur);
			}
		}
	}

	.content {
		$point-size: 3.2rem;

		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: flex-end;
		padding: 0 $gap 0 0;

		@include bigScreen {
			.right & {
				order: 1;
				align-items: flex-start;
				padding: 0 0 0 $gap;
			}
		}

		@include smallScreen {
			padding: 0;
			align-items: flex-start;
			width: 100%;
			opacity: 0;

			.active & {
				opacity: 1;
				display: flex;
				z-index: 1;
				color: white;
				animation: fadeIn $transition-duration ease;
			}
		}
	}

	.title {
		font-family: Archive;
		font-size: 38px;
		font-style: normal;
		font-weight: 400;
		line-height: normal;
		margin: 0 0 1rem;

		@include smallScreen {
			text-shadow: 1px 1px 1px $background-color;
		}
	}

	.tags {
		font-family: Roboto;
		font-size: 14px;
		font-style: normal;
		font-weight: 400;
		line-height: normal;

		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		gap: 0.8rem;

		.tag {
			margin: 0;
			color: white;
			background-color: $background-color;
			background-color: var(--card-selection-color);
			border-radius: 0.6rem;
			padding: 0.8rem 1.4rem;
			text-shadow: 1px 1px 1px $background-color;
		}

		@include smallScreen {
			gap: 0.6rem;
			font-size: 10px;

			.tag {
				padding: 0.6rem 1rem;
				border-radius: 0.6rem;
			}
		}
	}

	.image {
		margin-left: $gap;
		margin-right: 0;
		overflow: hidden;
		object-fit: cover;
		border-radius: $border-radius;
		height: $height;
		width: calc(#{$height} * 1.6);

		@include bigScreen {
			.right & {
				margin-left: 0;
				margin-right: $gap;
			}
		}

		@include smallScreen {
			position: absolute;
			top: 0;
			bottom: 0;
			left: 0;
			right: 0;
			width: 100%;
			height: 100%;
			margin: 0;
			transition: filter $transition-duration;

			.active & {
				filter: blur(1rem) brightness(1) grayscale(0.8);
			}
		}
	}

	.description {
		font-family: Roboto;
		font-size: 14px;
		font-style: normal;
		font-weight: 400;
		line-height: normal;
		text-align: end;
		margin: 0;
		padding: 1rem 0 1rem 2rem;

		@include bigScreen {
			display: none;
			opacity: 0;

			.right & {
				text-align: start;
				padding: 1rem 2rem 1rem 0;
			}

			.active & {
				display: block;
				opacity: 1;
				animation: fadeIn $transition-duration ease;
			}
		}

		@include smallScreen {
			display: none;
			opacity: 0;
			text-align: start;
			padding: 1rem 0 0;
			text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);

			.active & {
				display: block;
				opacity: 1;
			}
		}
	}
</style>
