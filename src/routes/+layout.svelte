<script lang="ts">
	import '../styling/normalize.css';
</script>

<div class="app">
	<header />

	<main class="main">
		<slot />
	</main>

	<footer />
</div>

<style lang="scss">
	@import '../styling/base.scss';

	.app {
		min-height: 100vh;
		min-width: 100vw;
		opacity: 1;
	}

	.main {
		position: relative;
	}
</style>
