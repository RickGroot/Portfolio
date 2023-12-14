<script lang="ts">
	import { socialLinks } from '../CardRow/constants';
	import Icon from '../Icon.svelte';
</script>

<section class="container">
	<h2 class="title">Want to talk? Contact me!</h2>
	<div class="socials">
		{#each socialLinks as link}
			<a href={link.url} target="_blank" rel="noopener noreferrer" class="link">
				<Icon name={link.icon} width="3rem" />
			</a>
		{/each}
	</div>
</section>

<style lang="scss">
	@import '../../styling/base.scss';

	$gap: 40px;
	$icon-margin: 30px;

	.container {
		height: 40vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background-color: $background-color;
	}

	.title {
		position: relative;
		color: #fff;
		font-family: Archive;
		font-size: 32px;
		font-style: normal;
		font-weight: 400;
		line-height: normal;
		text-align: center;
		margin: $icon-margin 0 0;
		padding: 0 0 $gap;

		&::after {
			$height: 2px;
			content: '';
			position: absolute;
			top: calc(100% - #{$height} / 2);
			left: 50%;
			transform: translateX(-50%);
			display: block;
			width: 80%;
			height: $height;
			background-color: #fff;
			border-radius: calc(#{$height} / 2);
		}
	}

	.socials {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		margin: 0;
		padding: $gap 0 0;
	}

	.link {
		margin: 0 $icon-margin $icon-margin;
		transition: transform 0.2s ease-in-out;

		&:hover {
			transform: scale(1.1);
		}
	}
</style>
