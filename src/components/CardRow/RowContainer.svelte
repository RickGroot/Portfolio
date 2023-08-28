<script lang="ts">
	import NameCard from './Cards/NameCard.svelte';
	import HobbiesCard from './Cards/HobbiesCard.svelte';
	import { cards } from './constants';
	import SkillsCard from './Cards/SkillsCard.svelte';
	import ContactCard from './Cards/ContactCard.svelte';

	let containerRef: HTMLElement | null = null;
	let offset: number;
	let hasOverflow = false;

	$: if (containerRef) hasOverflow = containerRef.scrollWidth > offset;
</script>

<section
	class="container"
	class:full-width={!hasOverflow}
	bind:this={containerRef}
	bind:offsetWidth={offset}
>
	<NameCard card={cards.name} />
	<SkillsCard card={cards.skills} />
	<HobbiesCard card={cards.hobbies} />
	<ContactCard card={cards.contact} />
</section>

<style lang="scss">
	@import '../../styling/base.scss';

	$padding: 50px;

	.container {
		width: calc(100vw - 2 * $padding);
		height: calc(100vh - 2 * $padding);
		background-color: rgb(175, 175, 175);
		background-image: url('/images/sand.jpg');
		background-size: cover;
		background-position: center center;
		background-repeat: no-repeat;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-start;
		overflow: scroll;
		scroll-snap-type: x mandatory;
		scroll-snap-align: center;
		padding: $padding;
	}

	.full-width {
		justify-content: space-around;
		overflow: hidden;
	}
</style>
