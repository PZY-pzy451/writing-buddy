import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import 'monaco-editor/languages/definitions/markdown/register.js';

declare global {
	interface Window {
		MonacoEnvironment?: {
			getWorker(_moduleId: string, _label: string): Worker;
		};
	}
}

window.MonacoEnvironment = {
	getWorker: () => new EditorWorker()
};

loader.config({ monaco });
