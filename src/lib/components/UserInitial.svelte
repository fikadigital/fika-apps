<script>
	import { onMount } from 'svelte';
	import { clerkState, initClerk } from '$lib/auth/clerk.svelte.js';

	onMount(initClerk);

	const user = $derived(clerkState.user);
	const email = $derived(user?.primaryEmailAddress?.emailAddress ?? '');
	const name = $derived(
		user?.firstName ?? user?.username ?? user?.primaryEmailAddress?.emailAddress ?? ''
	);
</script>

{#if name}
	<div class="flex flex-col items-center gap-1">
		<div
			class="flex h-10 w-10 items-center justify-center rounded-full bg-green-700 font-semibold text-white shadow"
			title={user.fullName ?? name}>
			{name.charAt(0).toUpperCase()}
		</div>
		{#if email}
			<span class="rounded bg-white/90 px-2 py-0.5 text-xs text-gray-700 shadow">{email}</span>
		{/if}
	</div>
{/if}
