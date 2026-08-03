import type { AiStreamEvent } from '@writing-buddy/ai';
import aiScenarioData from './fixtures/ai-scenarios.json';

export const DETERMINISTIC_AI_MOCK_VERSION = 'qa-ai-mock-v1';

export type DeterministicAiScenarioId = typeof aiScenarioData[number]['id'];

export interface DeterministicAiScenarioDefinition {
	readonly id: DeterministicAiScenarioId;
	readonly category: string;
	readonly expectedOutcome: string;
}

export const deterministicAiScenarios = aiScenarioData as readonly DeterministicAiScenarioDefinition[];

function failed(jobId: string, code: Extract<AiStreamEvent, { type: 'failed' }>['error']['code'], message: string, httpStatus?: number): AiStreamEvent {
	return { type: 'failed', jobId, error: { code, message, retryable: !['authentication_failed', 'invalid_request'].includes(code), ...(httpStatus ? { httpStatus } : {}) } };
}

function content(jobId: string, text: string): AiStreamEvent {
	return { type: 'content_delta', jobId, text };
}

function eventsFor(jobId: string, scenarioId: DeterministicAiScenarioId): readonly AiStreamEvent[] {
	const started: AiStreamEvent = { type: 'job_started', jobId };
	const opened: AiStreamEvent = { type: 'connection_opened', jobId };
	const completed: AiStreamEvent = { type: 'completed', jobId, finishReason: 'stop' };
	switch (scenarioId) {
		case 'success_text': return [started, opened, content(jobId, 'Sanitized QA text.'), completed];
		case 'success_stream': return [started, opened, content(jobId, 'Sanitized '), content(jobId, 'stream.'), completed];
		case 'success_structured': return [started, opened, content(jobId, '{"result":"qa"}'), completed];
		case 'success_usage': return [started, opened, content(jobId, 'QA'), { type: 'usage', jobId, usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4 } }, completed];
		case 'slow_stream': return [started, opened, content(jobId, 'one'), content(jobId, 'two'), content(jobId, 'three'), completed];
		case 'stop_success': return [started, opened, { type: 'cancelled', jobId }];
		case 'timeout': return [started, failed(jobId, 'connection_timeout', 'QA timeout')];
		case 'connection_reset': return [started, opened, failed(jobId, 'network_unavailable', 'QA connection reset')];
		case 'rate_limit': return [started, failed(jobId, 'rate_limited', 'QA rate limit', 429)];
		case 'unauthorized': return [started, failed(jobId, 'authentication_failed', 'QA unauthorized', 401)];
		case 'forbidden': return [started, failed(jobId, 'authentication_failed', 'QA forbidden', 403)];
		case 'server_error': return [started, failed(jobId, 'provider_server_error', 'QA server error', 500)];
		case 'empty_response': return [started, opened, failed(jobId, 'empty_response', 'QA empty response')];
		case 'invalid_json': return [started, opened, content(jobId, '{invalid'), completed];
		case 'schema_repair_success': return [started, opened, content(jobId, '{"candidate":{"title":"QA"}}'), completed];
		case 'schema_repair_failure': return [started, opened, content(jobId, '{"candidate":null}'), completed];
		case 'partial_stream_then_error': return [started, opened, content(jobId, '{"partial":'), failed(jobId, 'stream_incomplete', 'QA partial stream')];
		case 'duplicate_delta': return [started, opened, content(jobId, 'same'), content(jobId, 'same'), completed];
		case 'out_of_order_event': return [started, content(jobId, 'early'), opened, completed];
		case 'stale_candidate': return [started, opened, content(jobId, '{"sourceRevision":"stale"}'), completed];
		case 'anchor_not_found': return [started, opened, content(jobId, '{"anchor":"missing"}'), completed];
		case 'revision_conflict': return [started, opened, content(jobId, '{"expectedRevision":1,"actualRevision":2}'), completed];
		case 'save_after_apply_failure': return [started, opened, content(jobId, '{"apply":"ok","save":"fail"}'), completed];
		case 'privacy_redaction': return [started, opened, content(jobId, '{"retainedRequest":false}'), completed];
	}
	throw new Error('unknownQaAiScenario');
}

export class DeterministicAiMockRun {
	private cursor = 0;
	private cancelled = false;

	constructor(readonly jobId: string, readonly scenarioId: DeterministicAiScenarioId, private readonly events = eventsFor(jobId, scenarioId)) {}

	next(): AiStreamEvent | undefined {
		if (this.cancelled) return undefined;
		return this.events[this.cursor++];
	}

	drain(): readonly AiStreamEvent[] {
		const result: AiStreamEvent[] = [];
		for (let event = this.next(); event; event = this.next()) result.push(event);
		return result;
	}

	cancel(): AiStreamEvent | undefined {
		if (this.cancelled || this.cursor >= this.events.length) return undefined;
		this.cancelled = true;
		return { type: 'cancelled', jobId: this.jobId };
	}
}

export class DeterministicAiMockProvider {
	readonly version = DETERMINISTIC_AI_MOCK_VERSION;
	private calls: { readonly jobId: string; readonly scenarioId: DeterministicAiScenarioId }[] = [];

	createRun(jobId: string, scenarioId: DeterministicAiScenarioId): DeterministicAiMockRun {
		if (!deterministicAiScenarios.some(scenario => scenario.id === scenarioId)) throw new Error('unknownQaAiScenario');
		this.calls.push({ jobId, scenarioId });
		return new DeterministicAiMockRun(jobId, scenarioId);
	}

	callLog(): readonly { readonly jobId: string; readonly scenarioId: DeterministicAiScenarioId }[] {
		return this.calls.map(call => ({ ...call }));
	}

	reset(): void {
		this.calls = [];
	}
}
