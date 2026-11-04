<script lang="ts">
	import '../app.css';
	import { loadSettings } from '../state/settings.svelte.ts';
	import { ports } from '../state/ports.svelte.ts';

	let { children } = $props();
	let reminderAlarmsCleared = $state(false);

	$effect(() => {
		loadSettings();
		if (reminderAlarmsCleared || typeof window === 'undefined') return;
		reminderAlarmsCleared = true;
		void ports.alarmPort.syncAlarms([]);
	});
</script>

{@render children()}
