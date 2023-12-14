<script lang="ts">
	import type { WorkItem } from '$lib/work-items';

	export let side: 'left' | 'right' = 'left';
	export let item: WorkItem;
</script>

<article class="container" class:left={side === 'left'} class:right={side === 'right'}>
	<div class="content">
		<h1 class="title">{item.title}</h1>
		<div class="tags">
			{#each item.tags as tag}
				<p class="tag">{tag}</p>
			{/each}
		</div>
	</div>
	<img src="/images/projects/{item.imageUrl}" alt={item.title} class="image" />
</article>

<style lang="scss">
	@import '../../styling/base.scss';

	$height: 20rem;
	$padding: 5rem;
	$gap: 8rem;

	.container {
		height: $height;
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr;
		margin: $padding 0;
		order: 1;

		&.right {
			order: -1;
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
		order: -1;

		&::after {
			content: '';
			position: absolute;
			top: 50%;
			right: auto;
			left: calc(100% - #{$point-size} / 2);
			transform: translateY(-50%);
			height: $point-size;
			width: $point-size;
			border-radius: 50%;
			background-color: $background-color;
		}

		.right & {
			order: 1;
			align-items: flex-start;
			padding: 0 0 0 $gap;

			&::after {
				left: auto;
				right: calc(100% - #{$point-size} / 2);
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
	}

	.tags {
		font-family: Roboto;
		font-size: 14px;
		font-style: normal;
		font-weight: 400;
		line-height: normal;

		display: flex;
		flex-direction: row;
		gap: 1.5rem;

		.tag {
			margin: 0;
			background-color: aqua;
			border-radius: 0.6rem;
			padding: 0.8rem 1.4rem;
		}
	}

	.image {
		margin-left: $gap;
		margin-right: 0;
		overflow: hidden;
		object-fit: cover;
		border-radius: 1rem;
		height: $height;
		width: calc(#{$height} * 1.6);

		.right & {
			margin-left: 0;
			margin-right: $gap;
		}
	}
</style>
