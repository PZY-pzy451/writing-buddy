import { flattenChapters } from '@writing-buddy/domain';
import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import type { ReviewIssue } from '@writing-buddy/review';
import type { ChapterExportReceipt } from '../export/ChapterExportModel';
import type { SaveState } from '../save/SaveStateModel';

export type PublishReadinessStatus = 'blocked' | 'attention' | 'passed';

export type PublishReadinessAction =
	| { readonly type: 'save'; readonly label: string }
	| { readonly type: 'planning'; readonly label: string }
	| { readonly type: 'chapter'; readonly label: string; readonly resourceId: string }
	| { readonly type: 'review'; readonly label: string; readonly resourceId?: string; readonly offset?: number }
	| { readonly type: 'history'; readonly label: string };

export interface PublishReadinessCheck {
	readonly id: 'manuscript' | 'save' | 'completion' | 'integrity' | 'review' | 'delivery';
	readonly title: string;
	readonly status: PublishReadinessStatus;
	readonly detail: string;
	readonly action?: PublishReadinessAction;
}

export interface PublishReadinessModel {
	readonly status: PublishReadinessStatus;
	readonly title: string;
	readonly summary: string;
	readonly chapterCount: number;
	readonly wordCount: number;
	readonly blockedCount: number;
	readonly attentionCount: number;
	readonly passedCount: number;
	readonly checks: readonly PublishReadinessCheck[];
}

export type PublishSourceInspection =
	| { readonly status: 'checking' }
	| { readonly status: 'ready'; readonly fingerprint: string }
	| { readonly status: 'stale-project' }
	| { readonly status: 'unavailable' };

export interface PublishReadinessInput {
	readonly snapshot: ProjectSnapshot;
	readonly saveState: SaveState;
	readonly issues: readonly ReviewIssue[];
	readonly receipts: readonly ChapterExportReceipt[];
	readonly sourceInspection: PublishSourceInspection;
	readonly activeChapter?: {
		readonly resourceId: string;
		readonly wordCount: number;
	};
}

function saveCheck(state: SaveState): PublishReadinessCheck {
	switch (state.type) {
		case 'clean':
			return {
				id: 'save',
				title: '保存安全',
				status: 'passed',
				detail: '当前正文已经安全写入本地项目。'
			};
		case 'saving':
			return {
				id: 'save',
				title: '保存安全',
				status: 'blocked',
				detail: '正文仍在保存中；等待保存完成后再交付。'
			};
		case 'dirty':
			return {
				id: 'save',
				title: '保存安全',
				status: 'blocked',
				detail: '当前正文包含尚未写入项目的修改。',
				action: { type: 'save', label: '立即保存' }
			};
		case 'offline':
			return {
				id: 'save',
				title: '保存安全',
				status: 'blocked',
				detail: `${state.pendingChanges} 份修改正在等待可用的存储位置。`,
				action: { type: 'save', label: '重试保存' }
			};
		case 'failed':
			return {
				id: 'save',
				title: '保存安全',
				status: 'blocked',
				detail: state.retryable
					? '最近一次保存失败；正文仍保留在当前编辑器中。'
					: '当前项目位置不可写，不能生成可信交付件。',
				...(state.retryable ? { action: { type: 'save' as const, label: '重试保存' } } : {})
			};
		case 'external_conflict':
			return {
				id: 'save',
				title: '保存安全',
				status: 'blocked',
				detail: '磁盘版本与当前正文发生冲突，请先处理外部修改。'
			};
	}
}

function receiptTimestamp(receipt: ChapterExportReceipt): number {
	const timestamp = Date.parse(receipt.exportedAt);
	return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatLabel(receipt: ChapterExportReceipt): string {
	switch (receipt.format) {
		case 'docx': return 'Word';
		case 'markdown': return 'Markdown';
		case 'plain-text': return '纯文本';
	}
}

export function selectPublishReadiness(
	input: PublishReadinessInput
): PublishReadinessModel {
	const chapters = flattenChapters(input.snapshot.project);
	const wordCounts = { ...input.snapshot.wordCounts };
	if (input.activeChapter) {
		wordCounts[input.activeChapter.resourceId] = Math.max(0, input.activeChapter.wordCount);
	}
	const wordCount = chapters.reduce(
		(total, chapter) => total + Math.max(0, wordCounts[chapter.id] ?? 0),
		0
	);
	const emptyChapters = chapters.filter(chapter => (wordCounts[chapter.id] ?? 0) <= 0);
	const unfinishedChapters = chapters.filter(chapter => chapter.status !== 'completed');
	const projectIssues = input.issues.filter(issue => (
		issue.projectId === input.snapshot.project.projectId && issue.status === 'open'
	));
	const errorIssues = projectIssues.filter(issue => issue.severity === 'error');
	const firstReviewIssue = errorIssues[0] ?? projectIssues[0];
	const chapterIds = new Set(chapters.map(chapter => chapter.id));
	const integrityErrors = input.snapshot.integrityIssues.filter(issue => issue.severity === 'error');
	const integrityWarnings = input.snapshot.integrityIssues.filter(issue => issue.severity === 'warning');
	const latestWorkReceipt = input.receipts
		.filter(receipt => (
			receipt.projectId === input.snapshot.project.projectId && receipt.scope === 'work'
		))
		.slice()
		.sort((left, right) => receiptTimestamp(right) - receiptTimestamp(left))[0];
	const sourceReady = input.sourceInspection.status === 'ready';
	const matchingReceipt = Boolean(
		latestWorkReceipt
		&& input.saveState.type === 'clean'
		&& sourceReady
		&& latestWorkReceipt.sourceFingerprint === input.sourceInspection.fingerprint
	);

	const checks: PublishReadinessCheck[] = [
		chapters.length === 0
			? {
					id: 'manuscript',
					title: '正文覆盖',
					status: 'blocked',
					detail: '当前作品还没有章节，无法生成整书交付件。',
					action: { type: 'planning', label: '先规划章节' }
				}
			: emptyChapters.length > 0
				? {
						id: 'manuscript',
						title: '正文覆盖',
						status: 'blocked',
						detail: `${emptyChapters.length} 章仍为空；当前整书共 ${wordCount.toLocaleString()} 字。`,
						action: {
							type: 'chapter',
							label: '打开第一处空章',
							resourceId: emptyChapters[0].id
						}
					}
				: {
						id: 'manuscript',
						title: '正文覆盖',
						status: 'passed',
						detail: `${chapters.length} 章均有正文，共 ${wordCount.toLocaleString()} 字。`
					},
		saveCheck(input.saveState),
		chapters.length > 0 && unfinishedChapters.length === 0
			? {
					id: 'completion',
					title: '章节完成度',
					status: 'passed',
					detail: `${chapters.length} 章均已标记完成。`
				}
			: {
					id: 'completion',
					title: '章节完成度',
					status: 'attention',
					detail: chapters.length === 0
						? '创建章节后才会显示完成度。'
						: `${unfinishedChapters.length}/${chapters.length} 章尚未标记完成；这不会自动改写正文。`,
					...(unfinishedChapters[0] ? {
						action: {
							type: 'chapter' as const,
							label: '打开第一处',
							resourceId: unfinishedChapters[0].id
						}
					} : {})
				},
		integrityErrors.length > 0
			? {
					id: 'integrity',
					title: '项目完整性',
					status: 'blocked',
					detail: `${integrityErrors.length} 个项目结构错误需要先修复：${integrityErrors[0].message}`
				}
			: integrityWarnings.length > 0 || input.snapshot.readOnly
				? {
						id: 'integrity',
						title: '项目完整性',
						status: 'attention',
						detail: input.snapshot.readOnly
							? `项目当前为只读${integrityWarnings.length ? `，另有 ${integrityWarnings.length} 条结构提醒` : ''}；可以导出，但不能在此修正。`
							: `${integrityWarnings.length} 条项目结构提醒需要作者判断：${integrityWarnings[0].message}`
					}
				: {
						id: 'integrity',
						title: '项目完整性',
						status: 'passed',
						detail: '项目打开时没有发现结构错误或警告。'
					},
		errorIssues.length > 0
			? {
					id: 'review',
					title: '审校待办',
					status: 'blocked',
					detail: `${errorIssues.length} 条错误级问题尚未处理；全部待办共 ${projectIssues.length} 条。`,
					action: {
						type: 'review',
						label: '处理第一项',
						...(firstReviewIssue && chapterIds.has(firstReviewIssue.resourceId)
							? {
								resourceId: firstReviewIssue.resourceId,
								offset: firstReviewIssue.anchor.start
							}
							: {})
					}
				}
			: projectIssues.length > 0
				? {
						id: 'review',
						title: '审校待办',
						status: 'attention',
						detail: `${projectIssues.length} 条警告或建议仍待作者确认；没有错误级问题。`,
						action: {
							type: 'review',
							label: '查看待办',
							...(firstReviewIssue && chapterIds.has(firstReviewIssue.resourceId)
								? {
									resourceId: firstReviewIssue.resourceId,
									offset: firstReviewIssue.anchor.start
								}
								: {})
						}
					}
				: {
						id: 'review',
						title: '审校待办',
						status: 'passed',
						detail: '当前没有未处理的审校建议；这不代表已经运行过全书 AI 扫描。'
					},
		matchingReceipt && latestWorkReceipt
			? {
					id: 'delivery',
					title: '整书交付回执',
					status: 'passed',
					detail: `最近一次${formatLabel(latestWorkReceipt)}整书导出的源指纹与当前项目结构及逐章正文哈希完全一致；未回读目标文件。`,
					action: { type: 'history', label: '查看交付记录' }
				}
			: {
					id: 'delivery',
					title: '整书交付回执',
					status: 'attention',
					detail: input.saveState.type !== 'clean'
						? '当前正文仍有未安全保存的修改，旧交付不能视为当前版本。'
						: input.sourceInspection.status === 'checking'
							? '正在只读核对本地项目结构与逐章正文哈希。'
							: input.sourceInspection.status === 'stale-project'
								? '磁盘上的项目结构已变化，请重新打开项目后再核对交付。'
								: input.sourceInspection.status === 'unavailable'
									? '暂时无法读取完整的本地源指纹；不会把旧交付误报为最新。'
									: latestWorkReceipt?.sourceFingerprint
										? `最近整书回执为 ${latestWorkReceipt.chapterCount} 章、${latestWorkReceipt.wordCount.toLocaleString()} 字，但项目结构或正文内容已经变化；相同字数也不会视为同一版本。`
										: latestWorkReceipt
											? '最近整书回执来自旧版本，未包含逐章内容指纹，需要重新导出后才能精确核对。'
											: '还没有整书导出回执；最终导出会先保存当前原稿并记录精确源指纹。',
					action: { type: 'history', label: latestWorkReceipt ? '重新导出整书' : '前往整书导出' }
				}
	];

	const blockedCount = checks.filter(check => check.status === 'blocked').length;
	const attentionCount = checks.filter(check => check.status === 'attention').length;
	const passedCount = checks.length - blockedCount - attentionCount;
	const status: PublishReadinessStatus = blockedCount > 0
		? 'blocked'
		: attentionCount > 0 ? 'attention' : 'passed';
	return {
		status,
		title: status === 'blocked'
			? '暂不建议交付'
			: status === 'attention' ? '可以继续，但需作者确认' : '可以交付',
		summary: status === 'blocked'
			? `${blockedCount} 项条件会阻止可信交付，请先处理。`
			: status === 'attention'
				? `${attentionCount} 项需要作者确认，系统不会替你做决定。`
				: '当前确定性检查全部通过，可以前往历史生成最终交付件。',
		chapterCount: chapters.length,
		wordCount,
		blockedCount,
		attentionCount,
		passedCount,
		checks
	};
}
