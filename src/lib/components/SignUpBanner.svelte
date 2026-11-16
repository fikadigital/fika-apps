<script>
	const STORAGE_KEY = 'fika-signup-banner-dismissed';

	let isVisible = $state(false);

	$effect(() => {
		try {
			isVisible = localStorage.getItem(STORAGE_KEY) !== 'true';
		} catch (e) {
			isVisible = true;
		}
	});

	function dismiss() {
		isVisible = false;
		try {
			localStorage.setItem(STORAGE_KEY, 'true');
		} catch (e) {
			// ignore
		}
	}
</script>

{#if isVisible}
	<div class="sticky top-0 z-50 flex w-full items-center gap-3 bg-secondary py-3 pl-4 pr-12 text-white sm:justify-center sm:pr-4">
		<div class="flex flex-1 flex-wrap items-center justify-center gap-3 text-center sm:flex-initial">
			<p class="text-sm md:text-base">
				Sign up for full access to every Fika Digital application
			</p>
			<a
				href="https://apps.fikadigital.org/sign-up"
				class="btn btn-sm shrink-0 border-none bg-primary text-white hover:bg-primary/90 md:btn-md">
				Sign Up
			</a>
		</div>
		<button
			type="button"
			onclick={dismiss}
			aria-label="Dismiss banner"
			class="absolute right-3 shrink-0 text-xl leading-none text-white/80 hover:text-white sm:static sm:ml-2">
			&times;
		</button>
	</div>
{/if}
