<script lang="ts">
	import Bokeh from './Bokeh.svelte';
	// import HeaderHover from './HeaderHover.svelte';
</script>

<header class="container" id="particles">
	<Bokeh />
	<!-- <HeaderHover /> -->
	<section class="content">
		<h1 class="title">Rick Groot</h1>
		<h2 class="sub-title">Creative Connected TV developer</h2>
		<div class="curve" />
	</section>
</header>

<style lang="scss">
	@import '../../styling/base.scss';

	%absolute {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
		width: 100%;
		height: 100%;
	}

	.container {
		position: relative;
		overflow: hidden;
		background-color: $background-color;
		height: 94vh;
		width: 100%;
		cursor: url('/images/pointer_circle_1.svg') 6 6, pointer;
	}

	.content {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		width: 90%;
	}

	.title {
		color: #fff;
		font-family: Archive;
		font-size: 56px;
		font-style: normal;
		font-weight: 400;
		line-height: normal;
		margin: 0 20px;
	}

	.sub-title {
		color: #fff;
		font-family: Lato;
		font-size: 24px;
		font-weight: 300;
		line-height: normal;
		margin: 0 20px;
	}
</style>
