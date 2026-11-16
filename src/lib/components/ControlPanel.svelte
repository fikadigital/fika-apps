<script>
	import { XmarkSolid } from 'svelte-awesome-icons';
	import { generalState } from '$lib/utils/state.svelte';

	function toggleControlPanel() {
		generalState.controlPanelOpen = !generalState.controlPanelOpen;
	}
</script>

<div class="panel-container shadow-lg" class:closed={!generalState.controlPanelOpen}>
	<div class="panel-card flex flex-col px-2 py-2" class:closed={!generalState.controlPanelOpen}>
		<div class="header shrink-0">
			<div class="content-area">
				<slot name="header"></slot>
			</div>
			<button onclick={toggleControlPanel} class="close-button" aria-label="Close Panel">
				<XmarkSolid />
			</button>
		</div>
		<div class="panel-content min-h-0 flex-1 overflow-y-auto">
			<slot></slot>
		</div>
	</div>
</div>

<style>
	.panel-container {
		transition: transform 0.3s ease-in-out;
		transform: translateX(0);
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.panel-card {
		width: 280px;
		height: 100%;
		max-height: 100%;
		border-radius: 0px 10px 10px 0px;
		background-color: rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(5px);
		position: relative;
		z-index: 1;
		border: 1px solid rgba(255, 255, 255, 0.3);
		transition: transform 0.3s ease-in-out;
		transform: translateX(0);
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		position: relative;
	}

	.content-area {
		flex: 1;
		padding-right: 40px; /* Make space for the close button */
	}

	.close-button {
		position: absolute;
		top: 0;
		right: 0;
		padding: 8px;
		background: none;
		border: none;
		cursor: pointer;
		color: rgba(0, 0, 0, 0.8);
		transition: color 0.2s ease;
	}

	.close-button:hover {
		color: rgb(125, 125, 125);
	}

	.panel-container.closed {
		transform: translateX(calc(-340px));
	}

	.panel-content {
		margin-top: 8px;
	}
</style>
