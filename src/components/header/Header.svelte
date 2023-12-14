<script lang="ts">
	import { videoSet, type Quality, type VideoSet } from '$lib/videos';
	import { onMount } from 'svelte';
	import HeaderHover from './HeaderHover.svelte';

	function decideQuality(
		screenWidth: number,
		screenHeight: number,
		internetSpeed: number,
		videoSet: VideoSet
	): Quality | undefined {
		// Your dynamic logic to determine quality based on screen width, dynamic internet speed, and optional qualitySet
		// You can use if statements, calculations, or any other criteria

		// TODO: Dynamically determine threshold:
		const thresholdHiFi = 0;

		if (videoSet.qualitySet) {
			if (
				(screenWidth > 1920 || screenHeight > 1080) &&
				internetSpeed > thresholdHiFi &&
				videoSet.qualitySet.includes('high')
			) {
				return 'high';
			} else if (videoSet.qualitySet.includes('low')) {
				return 'low';
			}
		}

		// Return undefined if no suitable quality is found
		return undefined;
	}

	function getRandomVideo(): VideoSet {
		const hasReducedMotion = !!window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;
		const videos = hasReducedMotion ? videoSet.filter((video) => video.hasLowMotion) : videoSet;
		return videos[Math.floor(Math.random() * videos.length)];
	}

	let video: VideoSet;
	let videoVisible = false;
	let videoElement: HTMLVideoElement;

	onMount(() => {
		video = getRandomVideo();

		const internetSpeed = 10;
		const videoQuality = decideQuality(window.innerWidth, window.innerHeight, internetSpeed, video);

		videoElement.setAttribute('src', `/video/${video.title}/${videoQuality}.mp4`);
		videoElement.addEventListener('canplaythrough', () => (videoVisible = true));
	});
</script>

<header class="container" id="particles">
	<video class="video" class:visible={videoVisible} bind:this={videoElement} autoplay muted loop />
	<HeaderHover />
	<section class="content">
		<h1 class="title">Rick Groot</h1>
		<h2 class="sub-title">Creative Front-end / SmartTV developer</h2>
		<div class="curve" />
	</section>
</header>

<style lang="scss">
	@import '../../styling/base.scss';

	$text-shadow: 2px 2px 2px #000;

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

	.video {
		@extend %absolute;
		object-fit: cover;
		background-color: $background-color;
		opacity: 0;
		transition: opacity 1s ease-in-out;

		&.visible {
			opacity: 1;
		}
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
	}

	.title {
		color: #fff;
		font-family: Archive;
		font-size: 56px;
		font-style: normal;
		font-weight: 400;
		line-height: normal;
		margin: 0 20px;
		text-shadow: $text-shadow;
	}

	.sub-title {
		color: #fff;
		font-family: Lato;
		font-size: 24px;
		font-style: italic;
		font-weight: 600;
		line-height: normal;
		margin: 0 20px;
		text-shadow: $text-shadow;
	}
</style>
