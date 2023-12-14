<script lang="ts">
	import Footer from '../components/footer/Footer.svelte';
	import Header from '../components/header/Header.svelte';
	import '../styling/normalize.css';
</script>

<div class="app">
	<Header />

	<main class="main">
		<slot />
	</main>

	<Footer />
</div>

<style lang="scss">
	@import '../styling/base.scss';

	.app {
		min-height: 100vh;
		opacity: 1;
		position: relative;
	}
</style>
