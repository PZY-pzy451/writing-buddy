interface LayoutNode {
	readonly id: string;
}

interface LayoutRequest {
	readonly nodes: readonly LayoutNode[];
	readonly width: number;
	readonly height: number;
}

const workerScope = self as unknown as {
	onmessage: ((event: MessageEvent<LayoutRequest>) => void) | null;
	postMessage: (value: unknown) => void;
};

workerScope.onmessage = event => {
	const { nodes, width, height } = event.data;
	const centerX = width / 2;
	const centerY = height / 2;
	const radius = Math.max(90, Math.min(width, height) * 0.36);
	const positions = Object.fromEntries(nodes.map((node, index) => {
		const angle = (Math.PI * 2 * index) / Math.max(1, nodes.length) - Math.PI / 2;
		return [node.id, {
			x: centerX + Math.cos(angle) * radius,
			y: centerY + Math.sin(angle) * radius
		}];
	}));
	workerScope.postMessage(positions);
};

export {};
