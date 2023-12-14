<script lang="ts">
	import { videoSet, type Quality, type VideoSet } from './videos';
	import { onMount } from 'svelte';

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

<video class="video" class:visible={videoVisible} bind:this={videoElement} autoplay muted loop />

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
</style>
