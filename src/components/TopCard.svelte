<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let hovered: boolean;

	const dispatch = createEventDispatcher();
</script>

<button
	class="card"
	class:hovered
	on:mouseenter={() => dispatch('hover', true)}
	on:mouseleave={() => dispatch('hover', false)}
	on:click={() => dispatch('hover', !hovered)}
>
	<div class="image-container">
		<img src="/rick-1.jpg" alt="Rick Groot" class="image" />
	</div>
	<div class="content">
		<h1 class="name">Rick Groot</h1>
		<p class="desc">Creative Front-end developer</p>
	</div>
</button>

<style lang="scss">
	@import '../styling/base.scss';

	$background: rgb(240, 244, 255);
	$card-gap: 0rem;
	$transition: 0.3s ease-in-out;

	@function imageBorder($direction) {
		$gap: 5%;
		@return linear-gradient(
			$direction,
			rgba($background, 1) -1% ($gap * 3 + 0.1%),
			rgba($background, 0.75) ($gap * 3) ($gap * 4 + 0.1%),
			rgba($background, 0.5) ($gap * 4) ($gap * 5 + 0.1%),
			rgba($background, 0.25) ($gap * 5) ($gap * 6 + 0.1%),
			transparent ($gap * 6) 100%
		);
	}

	@mixin absolute {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}

	.card {
		@include removeButton;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		width: $card-width-mobile;
		height: $card-height-mobile;
		background-color: $background;
		border-radius: calc($card-width-mobile / 32);
		transition: transform $transition;

		&::after {
			@include absolute;
			content: '';
			box-shadow: 0 5px 10px rgba(0, 0, 0, 0.3);
			transition: box-shadow $transition;
			border-radius: calc($card-width-mobile / 32);
		}

		&.hovered {
			transform: scale(1.1);

			&::after {
				box-shadow: 0 15px 25px rgba(0, 0, 0, 0.3);
			}
		}
	}

	.image {
		width: 100%;
		height: calc(100% - 1px);
		object-fit: cover;
		object-position: top;
		border-radius: 0;
		border-top-left-radius: calc($card-width-mobile / 32);
		border-top-right-radius: calc($card-width-mobile / 32);

		&-container {
			position: relative;
			width: 100%;
			height: calc(($card-height-mobile - $card-gap) * (2 / 3));
		}

		&-container::after {
			@include absolute;
			content: '';
			background: imageBorder(5deg);
		}
	}

	.content {
		height: calc(($card-height-mobile - $card-gap) * (1 / 3));
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.name {
		font-size: calc($card-width-mobile / 10);
		margin: 0 0 1rem;
		font-family: 'Archive';
	}

	.desc {
		font-size: calc($card-width-mobile / 20);
		margin: 0;
		font-family: 'roboto';
		font-weight: 300;
		font-style: italic;
	}

	@include tablet {
		.card {
			border-radius: calc($card-width-desktop / 32);
			flex-direction: row;
			width: $card-width-desktop;
			height: $card-height-desktop;

			&::after {
				border-radius: calc($card-width-desktop / 32);
			}
		}

		.image {
			width: calc(100% - 1px);
			height: 100%;
			border-radius: 0;
			border-top-left-radius: calc($card-width-desktop / 32);
			border-bottom-left-radius: calc($card-width-desktop / 32);
			&-container {
				width: calc(($card-width-desktop - $card-gap) * (5 / 9));
				height: 100%;
			}

			&-container::after {
				background: imageBorder(-100deg);
			}
		}

		.content {
			width: calc(($card-width-desktop - $card-gap) * (4 / 9));
			height: 100%;
			align-items: flex-start;
		}

		.name {
			font-size: calc($card-width-desktop / 16);
		}

		.desc {
			font-size: calc($card-width-desktop / 32);
		}
	}
</style>
