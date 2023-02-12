<script lang="ts">
	import '../styling/normalize.css';
</script>

<div class="app">
	<header />

	<main>
		<slot />
	</main>

	<footer>
		<p>
			Portfolio
			<a target="_blank" rel="noopener noreferrer" href="https://www.linkedin.com/in/r-groot/">
				Rick Groot
			</a>
		</p>
	</footer>
</div>

<style lang="scss">
	@import '../styling/base.scss';

	.app {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		min-width: 100vw;

		$c-1: #eeeeee;
		$c-2: #e2e2f1;
		background: radial-gradient($c-2 15%, transparent 16%),
			linear-gradient(45deg, transparent 49%, $c-2 49% 51%, transparent 51%),
			linear-gradient(-45deg, transparent 49%, $c-2 49% 51%, transparent 51%);
		background-size: 3em 3em;
		background-color: $c-1;
		opacity: 1;
	}

	main {
		position: relative;
		margin: 5rem 0 auto;

		@include tablet {
			margin: 0;
		}
	}

	footer {
		font-family: 'roboto';
		font-weight: 300;
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100vw;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		margin-bottom: 12px;
	}

	footer a {
		font-weight: 400;
	}
</style>
