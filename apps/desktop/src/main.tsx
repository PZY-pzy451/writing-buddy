import './theme/tokens.css';
import './theme/workspace.css';

function describeStartupError(error: unknown): string {
	if (error instanceof Error) {
		return `${error.name}: ${error.message}`;
	}
	return String(error);
}

async function startApplication(): Promise<void> {
	const root = document.getElementById('root');
	if (!root) {
		throw new Error('Writing Buddy root element is missing.');
	}

	root.innerHTML = `
		<main class="startup-surface" role="status" aria-live="polite">
			<div class="startup-mark" aria-hidden="true">WB</div>
			<h1>Writing Buddy</h1>
			<p>正在启动本地写作工作台…</p>
		</main>
	`;

	try {
		const [{ default: React }, { default: ReactDOM }, { App }] = await Promise.all([
			import('react'),
			import('react-dom/client'),
			import('./app/App'),
			import('./editor/monacoBootstrap')
		]);

		ReactDOM.createRoot(root).render(
			<React.StrictMode>
				<App />
			</React.StrictMode>
		);
	} catch (error) {
		const detail = describeStartupError(error);
		root.innerHTML = `
			<main class="startup-surface startup-error" role="alert">
				<div class="startup-mark" aria-hidden="true">!</div>
				<h1>Writing Buddy 启动失败</h1>
				<p>工作台资源未能加载。项目文件没有被修改。</p>
				<pre></pre>
			</main>
		`;
		const errorDetail = root.querySelector('pre');
		if (errorDetail) {
			errorDetail.textContent = detail;
		}
	}
}

void startApplication();
