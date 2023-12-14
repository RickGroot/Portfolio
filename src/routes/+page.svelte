<script lang="ts">
	import CardRow from '../components/CardRow/CardRow.svelte';
	import WorkList from '../components/work-list/WorkList.svelte';
</script>

<svelte:head>
	<title>Rick Groot</title>
	<meta name="description" content="Rick Groot's portfolio website" />
</svelte:head>

<WorkList />
<CardRow />

<style lang="scss">
	@import '../styling/base.scss';
</style>
