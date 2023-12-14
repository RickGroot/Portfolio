<script lang="ts">
	import { fade } from 'svelte/transition';

	let imageActive = true;
</script>

<button
	class="container"
	on:mouseenter={() => (imageActive = false)}
	on:mouseleave={() => (imageActive = true)}
	on:click={() => (imageActive = !imageActive)}
>
	<div class="content">
		<p class="work">Work</p>
	</div>
	{#if imageActive}
		<img class="image" src="/rick-1.jpg" alt="Rick Groot" transition:fade={{ duration: 100 }} />
	{/if}
</button>

<style lang="scss">
	@import '../../styling/base.scss';

	$size: 250px;
	$inside-radius: 0.95;

	@include tablet {
		$size: 320px;
	}

	.container {
		@include removeButton;
		cursor: crosshair;
		position: absolute;
		top: calc(-#{$size} / 2);
		left: calc(50% - #{$size} / 2);
		width: $size;
		height: $size;
		border-radius: 50%;
		background-color: $background-color;
		transition: transform 0.5s ease-in-out;
		z-index: $z-portrait;

		&:hover {
			transform: rotate(360deg);
		}
	}

	%shape {
		width: $size * $inside-radius;
		height: $size * $inside-radius;
		border-radius: 50%;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.image {
		@extend %shape;
		object-fit: cover;
	}

	.content {
		@extend %shape;
		background-color: $background-highlight;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		opacity: 1;
	}

	.work {
		position: relative;
		text-align: center;
		margin: 0;
		color: #fff;
		font-family: Lato;
		font-size: 40px;
		font-weight: 200;
		line-height: normal;

		&::after {
			content: '';
			position: absolute;
			top: 100%;
			left: 50%;
			transform: translateX(-50%);
			width: 0;
			height: 0;
			border-left: 15px solid transparent;
			border-right: 15px solid transparent;
			border-top: 15px solid #fff;
			font-size: 0;
			line-height: 0;
			float: left;
			margin-top: 8px;
		}
	}
</style>
