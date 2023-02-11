<script lang="ts">
	import BottomCard from '../components/BottomCard.svelte';
	import TopCard from '../components/TopCard.svelte';

	let hovered: boolean = false;

	const handleHover = (e: CustomEvent) => {
		hovered = e.detail;
	};
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

{#if hovered}
	<BottomCard on:hover={handleHover} {hovered} />
{/if}
<TopCard on:hover={handleHover} {hovered} />

<style lang="scss">
	@import '../styling/base.scss';
</style>
