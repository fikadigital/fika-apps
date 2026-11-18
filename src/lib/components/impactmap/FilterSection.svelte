<script>
	import { ChevronDownSolid } from 'svelte-awesome-icons';

	/**
	 * One collapsible block inside the report generator's Filters card. When folded, the
	 * header shows `summary` so the choice stays visible.
	 * @type {{ title: string, id: string, summary?: string, open?: boolean, children: import('svelte').Snippet }}
	 */
	let { title, id, summary = '', open = $bindable(true), children } = $props();
</script>

<section aria-label={title} class="rounded-lg border border-gray-200 bg-white">
	<button
		type="button"
		class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
		aria-expanded={open}
		aria-controls={id}
		onclick={() => (open = !open)}>
		<span class="min-w-0">
			<span class="block text-sm font-semibold text-secondary">{title}</span>
			{#if !open && summary}
				<span class="block truncate text-xs text-gray-500">{summary}</span>
			{/if}
		</span>
		<ChevronDownSolid
			class="h-4 w-4 shrink-0 text-secondary transition-transform {open ? 'rotate-180' : ''}" />
	</button>

	{#if open}
		<div {id} class="border-t border-gray-200 px-3 py-3">
			{@render children()}
		</div>
	{/if}
</section>
