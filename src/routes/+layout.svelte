<script lang="ts">
	import '../app.css';
	import { loadSettings } from '../state/settings.svelte.ts';
	import '../state/ports.svelte.ts';

	let { children } = $props();

	$effect(() => {
		loadSettings();
	});
</script>

{@render children()}
