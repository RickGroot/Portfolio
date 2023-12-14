<script lang="ts">
	import WORK_ITEMS from '$lib/work-items';
	import Wave from '../wave/Wave.svelte';
	import TopImage from './TopImage.svelte';
	import WorkItem from './WorkItem.svelte';
</script>

<section class="container">
	<Wave location="top" />
	<Wave location="bottom" />

	<div class="timeline" />
	<TopImage />
	<div class="content">
		{#each WORK_ITEMS as item, index}
			<WorkItem {item} side={index % 2 === 0 ? 'right' : 'left'} />
		{/each}
	</div>
</section>

<style lang="scss">
	@import '../../styling/base.scss';

	$timeline-width: 3px;

	.container {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
	}

	.content {
		margin: 5rem 0;
	}

	.timeline {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		height: calc(95% - #{$timeline-width});
		width: $timeline-width;
		background-color: $background-color;

		&::before {
			content: '';
			position: absolute;
			top: calc(100% - #{$timeline-width});
			left: 50%;
			transform: translateX(-50%);
			height: calc(#{$timeline-width} * 2);
			width: calc(#{$timeline-width} * 2);
			border-radius: 50%;
			background-color: $background-color;
		}
	}
</style>
