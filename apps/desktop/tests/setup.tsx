import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

class MemoryStorage implements Storage {
	readonly values = new Map<string, string>();

	get length(): number { return this.values.size; }
	clear(): void { this.values.clear(); }
	getItem(key: string): string | null { return this.values.get(key) ?? null; }
	key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
	removeItem(key: string): void { this.values.delete(key); }
	setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

Object.defineProperty(globalThis, 'localStorage', {
	configurable: true,
	value: new MemoryStorage()
});

vi.mock('@monaco-editor/react', () => ({
	default: ({ value }: { value?: string }) => <textarea aria-label="正文编辑器" value={value ?? ''} readOnly />,
	DiffEditor: ({ original, modified }: { original?: string; modified?: string }) => (
		<div aria-label="修改对比"><pre>{original}</pre><pre>{modified}</pre></div>
	)
}));

class ResizeObserverStub implements ResizeObserver {
	readonly observed = new Set<Element>();
	observe(target: Element): void { this.observed.add(target); }
	unobserve(target: Element): void { this.observed.delete(target); }
	disconnect(): void { this.observed.clear(); }
}

globalThis.ResizeObserver = ResizeObserverStub;
