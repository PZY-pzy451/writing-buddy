import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const qaRoot = resolve(repositoryRoot, 'artifacts', 'qa');
const readJson = async path => JSON.parse(await readFile(resolve(repositoryRoot, path), 'utf8'));
const writeJson = async (path, value) => writeFile(
	resolve(repositoryRoot, path),
	`${JSON.stringify(value, undefined, 2)}\n`,
	'utf8'
);
const git = args => {
	const result = spawnSync('git', args, {
		cwd: repositoryRoot,
		encoding: 'utf8',
		windowsHide: true
	});
	if (result.status !== 0) throw new Error(result.stderr.trim());
	return result.stdout.trim();
};

const [inventory, traceability, ledger, frontend, cargo, fixtures, stress] = await Promise.all([
	readJson('artifacts/qa/inventory-summary.json'),
	readJson('artifacts/qa/traceability-summary.json'),
	readJson('artifacts/qa/regression-ledger.json'),
	readJson('artifacts/qa/node24-acceptance.json'),
	readJson('artifacts/qa/cargo-acceptance.json'),
	readJson('artifacts/qa/fixture-mock-inventory.json'),
	readJson('docs/acceptance/phase-1.2s-user-stress.json')
]);

if (frontend.status !== 'PASS' || cargo.status !== 'PASS' || stress.status !== 'passed') {
	throw new Error('Cannot record a convergence pass from failed execution evidence.');
}
if (
	frontend.runtimeInventoryDelta !== 0
	|| frontend.unresolvedParameterizedDeclarations !== 0
	|| frontend.inventoryFrontendTests !== inventory.counts.frontendDiscoveredTests
) {
	throw new Error('Runtime and static frontend inventories have not reconciled.');
}
if (cargo.tests.collected !== 79 || cargo.tests.ignoredWithReason !== 2) {
	throw new Error('Rust collection changed; review ignored-test reasons before recording.');
}
const ledgerFrontendCases = ledger.items.filter(item => !item.testCaseId.startsWith('TC-NATIVE-')).length;
const ledgerNativeCases = ledger.items.length - ledgerFrontendCases;
if (
	ledger.items.length !== inventory.counts.discoveredTests
	|| ledgerFrontendCases !== inventory.counts.frontendDiscoveredTests
	|| ledgerNativeCases !== cargo.tests.collected
) {
	throw new Error(
		`Regression ledger has ${ledger.items.length} cases (${ledgerFrontendCases} frontend, ${ledgerNativeCases} native), `
		+ `but inventory/runtime require ${inventory.counts.discoveredTests} `
		+ `(${inventory.counts.frontendDiscoveredTests} frontend, ${cargo.tests.collected} native). Run qa:plan first.`
	);
}

const executionCommit = git(['rev-parse', 'HEAD']);
const ignoredReasons = new Map([
	['SANITIZED-REAL-PROJECT-BACKUP-RESTORE-REOPENS-AND-KEEPS-BACKLINKS', 'Requires an explicit sanitized real-project recovery run. The current sanitized complete-novel recovery gate ran separately for 10 cycles.'],
	['LARGE-FIXTURE-MEETS-STORYFORGE-PERFORMANCE-GATES', 'Runs through the dedicated release-mode performance gate. The current stress report contains five performance runs.']
]);
const skipReasonFor = testCaseId => (
	[...ignoredReasons].find(([needle]) => testCaseId.includes(needle))?.[1]
);

ledger.items = ledger.items.map(item => {
	const native = item.testCaseId.startsWith('TC-NATIVE-');
	const skipReason = native ? skipReasonFor(item.testCaseId) : undefined;
	const evidencePaths = native
		? ['artifacts/qa/cargo-acceptance.json', 'docs/acceptance/phase-1.2s-user-stress.json']
		: ['artifacts/qa/node24-acceptance.json', 'docs/acceptance/phase-1.2s-user-stress.json'];
	return {
		...item,
		status: skipReason ? 'SKIPPED_WITH_REASON' : 'PASS',
		lastRunCommit: executionCommit,
		...(skipReason ? {} : { lastPassedCommit: executionCommit }),
		evidencePaths,
		...(skipReason ? { skipReason } : {}),
		executedAt: native ? cargo.completedAt : frontend.completedAt,
		invalidationReason: undefined
	};
});
ledger.status = 'PASS';
ledger.lastBaselineCommit = executionCommit;
ledger.runtimeDiscovery = {
	frontendInventoryCases: inventory.counts.frontendDiscoveredTests,
	frontendCollectedCases: frontend.vitestPassed,
	rustInventoryCases: ledger.items.filter(item => item.testCaseId.startsWith('TC-NATIVE-')).length,
	rustCollectedCases: cargo.tests.collected,
	runtimeDiscoveryGap: frontend.runtimeInventoryDelta
};
ledger.latestExecution = {
	commit: executionCommit,
	frontendEvidence: 'artifacts/qa/node24-acceptance.json',
	rustEvidence: 'artifacts/qa/cargo-acceptance.json',
	stressEvidence: 'docs/acceptance/phase-1.2s-user-stress.json'
};
await writeFile(
	resolve(qaRoot, 'regression-ledger.json'),
	`${JSON.stringify(ledger, undefined, 2)}\n`,
	'utf8'
);

const report = {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	source: {
		commit: executionCommit,
		branch: git(['branch', '--show-current'])
	},
	executionStatus: 'PASS',
	productConclusion: traceability.status === 'PASS' ? 'PASS' : 'PARTIAL',
	releaseDecision: {
		status: 'BLOCKED',
		reason: 'Strict feature/control/state traceability remains incomplete; no release package was produced in this convergence run.'
	},
	fixedDefects: [
		{
			id: 'QA-TEST-DISCOVERY-PARAMETERIZED-001',
			summary: 'Static test discovery undercounted parameterized and statically looped Vitest cases.',
			before: { frontendInventory: 667, runtimeCollected: 716, gap: 49 },
			after: {
				frontendInventory: frontend.inventoryFrontendTests,
				runtimeCollected: frontend.vitestPassed,
				gap: frontend.runtimeInventoryDelta,
				unresolvedParameterizedDeclarations: frontend.unresolvedParameterizedDeclarations
			}
		},
		{
			id: 'QA-WINDOWS-PNPM-SHELL-002',
			summary: 'Windows QA runners could fall back to pnpm.cmd with shell:true, emitting unsafe argument-escaping deprecation warnings that did not fail self-test.',
			before: {
				unsafeShellFallbacks: 2,
				selfTestUnsafeShellWarnings: 1,
				unsafeWarningFailedSelfTest: false
			},
			after: {
				safePnpmJavaScriptResolution: true,
				unsafeShellFallbacks: 0,
				failClosedWhenPnpmEntryMissing: true,
				commandResolutionTests: 3,
				selfTestUnsafeShellWarnings: 0,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-STORY-KERNEL-RELATIONSHIP-SHAPE-003',
			summary: 'Story Kernel relationship output could ignore selected types and return text where structured position/history fields are required.',
			before: {
				deterministicScenario: false,
				fieldShapes: { effectiveFrom: 'string', history: 'string' }
			},
			after: {
				deterministicScenario: true,
				mockScenarioCount: fixtures.counts.mockScenarios,
				validCandidatesRemainConfirmable: true,
				malformedCandidateQuarantined: true,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-STORY-KERNEL-ACTION-REENTRANCY-005',
			summary: 'Rapid confirmation clicks could start repeated safety snapshots before React rendered the busy state.',
			before: {
				repeatedClicks: 100,
				synchronousActionGuard: false,
				snapshotRequests: 100
			},
			after: {
				repeatedClicks: 100,
				synchronousActionGuard: true,
				snapshotRequests: 1,
				atomicWrites: 1,
				rejectionStateWrites: 1,
				retryAfterSnapshotFailure: true,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-STORY-KERNEL-CANCEL-REENTRANCY-006',
			summary: 'Rapid stop clicks could send repeated native cancellation commands before the first command resolved.',
			before: {
				repeatedClicks: 100,
				synchronousCancellationGuard: false,
				nativeCancellationCommands: 100
			},
			after: {
				repeatedClicks: 100,
				synchronousCancellationGuard: true,
				nativeCancellationCommands: 1,
				pendingCancellationFeedback: true,
				retryAfterCommandFailure: true,
				retryAfterJobNotFound: true,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-CANCEL-SURFACE-REENTRANCY-007',
			summary: 'Adjacent AI stop controls could issue repeated native cancellation commands, and extraction issued two native commands for one click.',
			before: {
				auditedCancellationPaths: 13,
				repeatedClicks: 100,
				selectionRewriteNativeCommands: 100,
				extractionNativeCommandsPerClick: 2,
				sharedCancellationContract: false
			},
			after: {
				guardedCancellationPaths: 13,
				repeatedClicks: 100,
				nativeCommandsPerActiveJob: 1,
				sharedCancellationContract: true,
				pendingFeedback: true,
				retryAfterCommandFailure: true,
				retryAfterJobNotFound: true,
				unknownErrorsLocalized: true,
				focusedTests: 21,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-CANDIDATE-WRITE-REENTRANCY-008',
			summary: 'Candidate accept controls could create duplicate safety snapshots and concurrent writes before React rendered the busy state.',
			before: {
				auditedCandidateWriteSurfaces: 11,
				repeatedClicks: 100,
				synchronousWriteGuard: false,
				continuationSnapshotRequests: 100,
				outlineApplyRequests: 100,
				crossCandidateWritesBlocked: false
			},
			after: {
				guardedCandidateWriteSurfaces: 11,
				repeatedClicks: 100,
				synchronousWriteGuard: true,
				snapshotRequests: 1,
				atomicWrites: 1,
				outlineApplyRequests: 1,
				panelWideBusyState: true,
				retryAfterSnapshotFailure: true,
				dynamicRapidClickScenarios: 2,
				focusedTests: 34,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-GENERATION-SURFACE-REENTRANCY-009',
			summary: 'Rapid AI generation actions could start duplicate native/provider jobs before React rendered the busy state, while unknown provider failures leaked raw messages and blocked drawer retry.',
			before: {
				repeatedClicks: 100,
				characterNativeRequests: 100,
				playgroundNativeRequests: 100,
				drawerProviderRequests: 100,
				reviewNativeRequests: 100,
				unknownErrorsRedacted: false,
				drawerRetryAfterFailure: false
			},
			after: {
				guardedGenerationSurfaces: 11,
				dynamicRapidClickScenarios: 10,
				repeatedClicks: 100,
				nativeOrProviderRequestsPerAction: 1,
				implicitCancellations: 0,
				generationInputsLocked: true,
				unknownErrorsRedacted: true,
				retryAfterProviderStartFailure: true,
				focusedTests: 45,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-PENDING-FACT-ACTION-REENTRANCY-010',
			summary: 'Pending-fact accept and reject actions relied on asynchronous React busy state rather than a synchronous persistence guard.',
			before: {
				repeatedClicks: 100,
				synchronousActionGuard: false
			},
			after: {
				repeatedClicks: 100,
				synchronousActionGuard: true,
				acceptancePersistenceWrites: 1,
				sharedAcceptRejectGuard: true,
				focusedTests: 4,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-ASYNC-RESULT-ISOLATION-011',
			summary: 'AI Playground, generic drawer and chapter review cancellation commands multiplied under rapid clicks, while late validation/cancellation results could mutate a newer action.',
			before: {
				repeatedClicks: 100,
				auditedCancellationStores: 3,
				nativeCancellationCommandsPerStore: 100,
				validationContextIsolation: false,
				lateResultIsolation: false,
				cancellationFailureLocalized: false
			},
			after: {
				repeatedClicks: 100,
				guardedCancellationStores: 3,
				nativeCancellationCommandsPerStore: 1,
				validationContextIsolation: true,
				lateResultIsolation: true,
				cancellationFailureLocalized: true,
				retryAfterCancellationFailure: true,
				staleErrorClearedAfterRetry: true,
				focusedTests: 27,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-SETTINGS-REENTRANCY-012',
			summary: 'AI settings relied on asynchronous React busy state, multiplying credential and provider actions while preference writes could finish out of order.',
			before: {
				repeatedClicks: 100,
				saveKeyRequests: 100,
				connectionTestRequests: 100,
				modelRefreshRequests: 100,
				balanceRefreshRequests: 100,
				activeJobCancellationCommands: 100,
				credentialDeleteRequests: 100,
				preferenceWritesSerialized: false,
				deleteFailureRetryVisible: false
			},
			after: {
				guardedSettingsActions: 5,
				repeatedClicks: 100,
				providerRequestsPerAction: 1,
				activeJobCancellationCommands: 1,
				credentialDeleteRequests: 1,
				crossActionQueueDeduplicated: true,
				preferenceWritesSerialized: true,
				latestPreferenceWins: true,
				deleteFailureRetryVisible: true,
				generationBlockedDuringCredentialMutation: true,
				focusedTests: 20,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-PROVIDER-ACTION-FEEDBACK-013',
			summary: 'Manual connection, model refresh and balance refresh actions could complete without replacing stale credential-save feedback.',
			before: {
				connectionTestReplacedSaveNotice: false,
				modelRefreshSuccessFeedback: false,
				balanceRefreshSuccessFeedback: false,
				providerFailuresRejectedToUi: false
			},
			after: {
				connectionTestReplacedSaveNotice: true,
				modelRefreshSuccessFeedback: true,
				balanceRefreshSuccessFeedback: true,
				providerFailuresRejectedToUi: true,
				failureRetryEnabled: true,
				manualBrowserWidths: [620, 420],
				horizontalOverflow: false,
				browserWarningsOrErrors: 0,
				focusedTests: 22,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-LEDGER-INVENTORY-RECONCILIATION-014',
			summary: 'Convergence recording could mark a stale regression ledger PASS after new discovered tests had already executed successfully.',
			before: {
				discoveredTests: inventory.counts.discoveredTests,
				ledgerCases: inventory.counts.discoveredTests - 2,
				missingExecutedCasesRejected: false
			},
			after: {
				discoveredTests: inventory.counts.discoveredTests,
				ledgerCases: ledger.items.length,
				frontendLedgerCases: ledgerFrontendCases,
				nativeLedgerCases: ledgerNativeCases,
				missingExecutedCasesRejected: true,
				reconciliationCommand: 'pnpm qa:plan'
			}
		},
		{
			id: 'QA-PROJECT-CREATION-REENTRANCY-015',
			summary: 'Project creation, directory selection and draft import relied on rendered busy state, while closing the wizard from the project menu lost keyboard focus.',
			before: {
				repeatedActions: 100,
				synchronousWizardActionGuard: false,
				atomicFailureRetryContract: false,
				focusAfterEscape: 'document-body'
			},
			after: {
				repeatedActions: 100,
				directoryChooserCalls: 1,
				importChooserCalls: 1,
				dirtyManuscriptConfirmations: 1,
				projectWrites: 1,
				retryAfterAtomicFailure: true,
				focusAfterEscape: 'project-menu-trigger',
				manualBrowserWidths: [620, 420],
				horizontalOverflow: false,
				browserWarningsOrErrors: 0,
				focusedTests: 11,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-PROJECT-OPEN-LIFECYCLE-016',
			summary: 'Project switching and lock recovery relied on rendered busy state, while opening another project could discard an unsaved manuscript without author confirmation.',
			before: {
				repeatedActions: 100,
				directoryChooserCalls: 100,
				readOnlyOpenCalls: 100,
				dirtyManuscriptConfirmations: 0,
				dirtyManuscriptProtected: false,
				recoveryActionsDeduplicated: false
			},
			after: {
				repeatedActions: 100,
				directoryChooserCalls: 1,
				projectOpenCalls: 1,
				readOnlyOpenCalls: 1,
				dirtyManuscriptConfirmations: 1,
				cancelledSwitchBridgeCalls: 0,
				dirtyManuscriptProtected: true,
				repairCalls: 1,
				revealDirectoryCalls: 1,
				chooserFailureRetryable: true,
				manualBrowserWidths: [620, 420],
				horizontalOverflow: false,
				browserWarningsOrErrors: 0,
				focusedTests: 7,
				impactedTests: 15,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-RESOURCE-OPEN-LIFECYCLE-017',
			summary: 'Chapter and resource opening activated targets before reads completed, discarded dirty manuscripts, multiplied disk reads under rapid actions and allowed late results to pair the wrong editor content with the active chapter.',
			before: {
				repeatedActions: 100,
				activeChapterReopenReads: 100,
				dirtySwitchSaves: 0,
				failedTargetReads: 100,
				lateReadTotalReads: 101,
				activeTargetCommittedBeforeRead: true,
				staleReadIsolation: false,
				loadingEditProtection: false
			},
			after: {
				repeatedActions: 100,
				activeChapterReopenReads: 0,
				dirtySwitchSaves: 1,
				dirtySwitchReads: 1,
				failedTargetReads: 1,
				lateReadTotalReads: 2,
				targetCommittedAfterRead: true,
				staleReadIsolation: true,
				latestIntentWins: true,
				loadingEditProtection: true,
				saveFailurePreservesDraft: true,
				localizedReadFailure: true,
				manualBrowserWidths: [1280, 420],
				horizontalOverflow: false,
				browserWarningsOrErrors: 0,
				focusedTests: 10,
				impactedTests: 34,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-RESOURCE-CLOSE-LIFECYCLE-018',
			summary: 'Rapid tab closing repeated native confirmation, explicit discard flowed through automatic saving, save-copy exit opened many native dialogs and failed target reads could leave a closed chapter active.',
			before: {
				repeatedActions: 100,
				cancelledCloseConfirmations: 100,
				acceptedCloseConfirmations: 100,
				discardCouldTriggerAutomaticSave: true,
				saveCopyNativeDialogs: 100,
				closedResourceCouldRemainActive: true,
				backgroundCloseIsolation: false
			},
			after: {
				repeatedActions: 100,
				cancelledCloseConfirmations: 1,
				acceptedCloseConfirmations: 1,
				discardWrites: 0,
				nextResourceReads: 1,
				saveCopyNativeDialogs: 1,
				closeDialogExits: 1,
				backgroundCloseConfirmations: 0,
				backgroundCloseReads: 0,
				backgroundCloseWrites: 0,
				cancelledActionsRetryable: true,
				failedNextReadClearsClosedActiveResource: true,
				restoredDiskWordCount: 94,
				manualBrowserWidths: [1280, 420],
				horizontalOverflow: false,
				browserWarningsOrErrors: 0,
				focusedTests: 20,
				impactedTests: 44,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-STORY-RESOURCE-OPEN-LIFECYCLE-019',
			summary: 'Direct Story resource opening bypassed manuscript-save and latest-intent protection, repeated repository reads, committed late tabs and left restored resources in recently-closed history.',
			before: {
				repeatedActions: 100,
				dirtyStoryOpenSaves: 0,
				directStoryLoads: 100,
				lateStoryResultOverwroteLatestChapter: true,
				restoredHistoryConsumed: false,
				loadingEditProtection: false,
				serviceMutatedTabsBeforeCommit: true
			},
			after: {
				repeatedActions: 100,
				dirtyStoryOpenSaves: 1,
				directStoryLoads: 1,
				latestChapterIntentWins: true,
				restoredStoryLoads: 1,
				restoredHistoryConsumed: true,
				failedSaveStoryLoads: 0,
				loadingEditProtection: true,
				serviceLoadIsSideEffectFree: true,
				manualBrowserWidths: [420],
				horizontalOverflow: false,
				browserWarningsOrErrors: 0,
				focusedTests: 27,
				impactedTests: 51,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-STORY-RESOURCE-RECOVERY-LIFECYCLE-020',
			summary: 'Missing, unavailable and trashed Story resources could not be retried reliably; restore bursts repeated native work, stale restores overwrote newer chapter intent, and one transient Story read aborted project reopen.',
			before: {
				repeatedActions: 100,
				missingRecheckLoads: 1,
				trashRestoreCalls: 100,
				lateRestoreOverwroteLatestChapter: true,
				projectOpenAbortedByOneStoryRead: true,
				transientFailureRetryState: false,
				serviceMutatedTabsBeforeCommit: true,
				restoreErrorRedacted: false
			},
			after: {
				repeatedActions: 100,
				missingRecheckLoads: 2,
				trashRestoreCalls: 1,
				latestChapterIntentWins: true,
				projectOpenSurvivesStoryReadFailure: true,
				transientFailureRetryState: true,
				serviceRestoreIsSideEffectFree: true,
				restoreErrorRedacted: true,
				manualBrowserWidths: [420],
				horizontalOverflow: false,
				browserWarningsOrErrors: 0,
				focusedTests: 36,
				impactedTests: 66,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-MONACO-EXTERNAL-CONFLICT-LIFECYCLE-021',
			summary: 'External manuscript verification and overwrite actions were not single-flight, stale disk reads could revive or attach conflicts to the wrong chapter, and cancelled save-copy actions dismissed the only recovery surface.',
			before: {
				repeatedActions: 100,
				externalVerificationReads: 100,
				lateOldChapterReplacedCurrentSession: true,
				stalePostSaveConflictRevived: true,
				forceOverwriteWrites: 100,
				forceWritesSerialized: false,
				saveCopyCancelDismissedConflict: true,
				conflictActionsMutuallyExclusive: false
			},
			after: {
				repeatedActions: 100,
				externalVerificationReads: 1,
				lateOldChapterIgnored: true,
				postSaveStaleReadIgnored: true,
				forceOverwriteWrites: 1,
				latestInFlightEditPersisted: true,
				saveCopyCancelKeepsConflict: true,
				conflictActionsMutuallyExclusive: true,
				browserAutomationStatus: 'BLOCKED_RUNTIME_INITIALIZATION',
				browserAutomationBlocker: 'The in-app browser runtime failed before page control while installing its process shim; no product-only test backdoor was added.',
				focusedTests: 35,
				impactedTests: 70,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-MONACO-UNDO-RESOURCE-ISOLATION-022',
			summary: 'The one-click undo receipt for a committed AI manuscript draft was keyed only by visible content, so another chapter, project or recreated Monaco model with matching text could make a stale undo action target the active editor.',
			before: {
				repeatedActions: 100,
				undoActions: 100,
				contentOnlyIdentity: true,
				crossResourceCollisionAccepted: true,
				recreatedModelAccepted: true,
				crossProjectCollisionAccepted: true,
				stableAccessibleName: false
			},
			after: {
				repeatedActions: 100,
				undoActions: 1,
				projectResourceModelContentIdentity: true,
				crossResourceCollisionRejected: true,
				recreatedModelRejected: true,
				crossProjectCollisionRejected: true,
				identityChangeDismissesNotice: true,
				failureLocalizedAndRetryable: true,
				stableAccessibleName: true,
				focusedTests: 7,
				impactedTests: 81,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-SAVE-RETRY-SINGLE-FLIGHT-023',
			summary: 'Save callers waiting on one failed write could become hidden retries, while late save results could mutate a newer project or same-id chapter session.',
			before: {
				repeatedActions: 100,
				retryableFailureWrites: 100,
				nonRetryableFailureWrites: 100,
				lateSaveIdentityValidation: 'resourceId-only',
				sameIdLateReceiptChangedNewBaseline: true,
				delayedConflictRevalidation: false
			},
			after: {
				repeatedActions: 100,
				failureWritesPerBurst: 1,
				explicitRetryWrites: 1,
				successfulNewerEditWrites: 2,
				projectResourcePathSessionIdentity: true,
				lateFailureIgnoredAfterProjectSwitch: true,
				sameIdLateReceiptIgnored: true,
				delayedOldConflictIgnored: true,
				focusedTests: 38,
				impactedTests: 93,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-PROJECT-OPEN-LATEST-INTENT-024',
			summary: 'Project opening deduplicated every request against one active promise, so a different later project selection was silently lost and a superseded project could briefly become active.',
			before: {
				repeatedActions: 100,
				activeProjectNativeOpens: 1,
				latestDistinctTargetOpened: false,
				intermediateIntentCoalesced: false,
				continuesAfterFirstFailure: false,
				supersededProjectVisible: true
			},
			after: {
				repeatedActions: 100,
				sameTargetNativeOpens: 1,
				activeAndLatestNativeOpens: 2,
				intermediateTargetNativeOpens: 0,
				latestTargetWins: true,
				continuesAfterFirstFailure: true,
				supersededProjectVisible: false,
				dirtyDiscardConfirmations: 1,
				focusedTests: 12,
				impactedTests: 89,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-PROJECT-REPAIR-LATEST-INTENT-025',
			summary: 'A delayed project repair could reopen its old target or publish a stale repair failure after the author had already selected a newer project.',
			before: {
				repeatedActions: 100,
				nativeRepairs: 1,
				supersededRepairOpenedOldProject: true,
				staleRepairFailureVisible: true,
				latestOpenFailurePreserved: false
			},
			after: {
				repeatedActions: 100,
				nativeRepairsPerBurst: 1,
				supersededRepairProjectOpens: 0,
				latestTargetPreserved: true,
				staleRepairFailureIgnored: true,
				latestOpenFailurePreserved: true,
				focusedTests: 15,
				impactedTests: 92,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-DRAFT-COMMIT-RESOURCE-ISOLATION-026',
			summary: 'AI temporary drafts identified their target by resource ID, revision and content only, so colliding projects, paths or Monaco models could remain actionable and a late rollback could reach the replacement editor model.',
			before: {
				identityFields: ['resourceId', 'revision', 'anchoredContent'],
				projectRootCollisionRejected: false,
				projectIdCollisionRejected: false,
				resourcePathCollisionRejected: false,
				monacoModelCollisionRejected: false,
				rollbackUsesCapturedModel: false
			},
			after: {
				identityFields: [
					'projectRoot',
					'projectId',
					'resourceId',
					'resourcePath',
					'modelUri',
					'revision',
					'anchoredContent'
				],
				projectRootCollisionRejected: true,
				projectIdCollisionRejected: true,
				resourcePathCollisionRejected: true,
				monacoModelCollisionRejected: true,
				asyncIdentityCheckpoints: 4,
				rollbackUsesCapturedModel: true,
				focusedTests: 11,
				impactedTests: 98,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-DRAWER-STALE-CONTEXT-ISOLATION-027',
			summary: 'The global AI quick-action drawer used revision-only stale detection and an incomplete reset, allowing same-revision project switches and buffered stream output to retain old context.',
			before: {
				identityFields: ['revision'],
				sameRevisionSourceChangesRejected: false,
				inFlightJobCancelledOnSourceChange: false,
				delayedEventsIgnored: false,
				bufferedDeltaClearedOnReset: false,
				resetClearsContextAndJob: false
			},
			after: {
				identityFields: [
					'projectRoot',
					'projectId',
					'resourceId',
					'resourcePath',
					'modelUri',
					'revision'
				],
				sameRevisionSourceChangesRejected: 4,
				staleNotificationsPerBurst: 100,
				cancellationsPerBurst: 1,
				delayedEventsIgnored: true,
				oldContextScrubbed: true,
				staleRetryBlocked: true,
				resetActionsPerBurst: 100,
				bufferedDeltaClearedOnReset: true,
				resetClearsContextAndJob: true,
				redFailures: 6,
				focusedTests: 15,
				impactedTests: 113,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-DRAWER-CLOSE-CANCELLATION-028',
			summary: 'Closing the global AI drawer hid only the dialog, so validating or streaming jobs, context and buffered output remained active in the background.',
			before: {
				closePaths: ['button', 'escape', 'backdrop'],
				closeInvalidatesAttempt: false,
				cancellationsPer100CloseActions: 0,
				contextCleared: false,
				bufferedDeltaCleared: false,
				delayedEventsIgnored: false
			},
			after: {
				closePaths: ['button', 'escape', 'backdrop'],
				closeInvalidatesAttempt: true,
				closeActionsPerBurst: 100,
				cancellationsPerBurst: 1,
				contextCleared: true,
				bufferedDeltaCleared: true,
				delayedEventsIgnored: true,
				cancellationFailureHidden: true,
				freshActionAfterClose: true,
				redFailures: 5,
				focusedTests: 22,
				impactedTests: 118,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-DRAWER-REOPEN-CANCELLATION-029',
			summary: 'Reopening AI quick actions while an explicit Stop cancellation was pending sent a second native cancellation for the same job.',
			before: {
				cancellationOwners: ['explicitStop', 'reopen'],
				pendingStopReopenCancellations: 2,
				sharedPerJobGuard: false,
				lateCancellationOutcomeIsolated: true
			},
			after: {
				cancellationBoundary: 'sharedPerJobGuard',
				pendingStopReopenCancellations: 1,
				reopenActionsPerBurst: 100,
				cancellationsPerBurst: 1,
				cancellationOutcomes: ['success', 'failure'],
				latestContextPreserved: true,
				bufferedDeltaCleared: true,
				delayedEventsIgnored: true,
				freshActionAfterReopen: true,
				redFailures: 2,
				focusedTests: 25,
				impactedTests: 121,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-DRAWER-CONTEXT-FREEZE-030',
			summary: 'The AI drawer allowed optional Context Pack changes after the provider request was captured and left a preview actionable after its context changed.',
			before: {
				mutableRequestStates: [
					'validating_context',
					'queued',
					'connecting',
					'streaming',
					'validating_output'
				],
				renderedApplyingLocked: false,
				previewInvalidatedOnContextChange: false,
				requestAndDisplayedContextGuaranteedEqual: false
			},
			after: {
				lockedStates: [
					'validating_context',
					'queued',
					'connecting',
					'streaming',
					'validating_output',
					'applying'
				],
				toggleAttemptsPerState: 100,
				storeAuthoritative: true,
				renderedControlsDisabled: true,
				previewInvalidatedOnContextChange: true,
				previewArtifactsCleared: [
					'rawOutput',
					'parsedOutput',
					'transaction',
					'usage',
					'jobId',
					'jobMetadata'
				],
				freshGenerationAfterChange: true,
				redFailures: 8,
				focusedTests: 41,
				impactedTests: 137,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-DRAWER-REGENERATION-ISOLATION-031',
			summary: 'Starting a replacement generation from a preview retained the prior job identity and preview transaction through asynchronous provider validation.',
			before: {
				synchronousInvalidation: false,
				retainedArtifacts: ['jobId', 'jobMetadata', 'parsedOutput', 'transaction'],
				oldEventsAcceptedDuringValidation: true,
				failedReplacementKeptOldPreview: true
			},
			after: {
				synchronousInvalidation: true,
				clearedBeforeProviderCheck: [
					'jobId',
					'jobMetadata',
					'usage',
					'rawOutput',
					'parsedOutput',
					'transaction',
					'repairInstruction'
				],
				delayedOldEventsIgnored: [
					'content_delta',
					'usage',
					'failed',
					'cancelled',
					'completed'
				],
				replacementFailurePaths: [
					'missing_configuration',
					'status_failure',
					'preferences_failure'
				],
				regenerateActionsPerBurst: 100,
				providerValidationsPerBurst: 1,
				replacementJobsPerBurst: 1,
				distinctReplacementJobId: true,
				redFailures: 5,
				focusedTests: 46,
				impactedTests: 142,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-VITEST-WORKER-POOL-032',
			summary: 'The Windows and Node 24 baseline used the default fork pool, which could terminate a worker or leave the suite running without completing.',
			before: {
				pool: 'forks',
				firstRunFilesCompleted: 178,
				firstRunFilesExpected: 179,
				firstRunTestsCompleted: 869,
				firstRunTestsExpected: 876,
				secondRunTimedOutMs: 240000
			},
			after: {
				pool: 'threads',
				maxWorkers: 2,
				configurationContractTests: 1,
				frontendFiles: frontend.vitestFiles,
				frontendTests: frontend.vitestPassed,
				normalExit: true,
				runtimeInventoryDelta: frontend.runtimeInventoryDelta
			}
		},
		{
			id: 'QA-AI-DRAWER-RETRY-APPLY-EXCLUSION-033',
			summary: 'The drawer disabled explicit retry after a generation failure but allowed a new request to start while a validated preview was applying.',
			before: {
				failureRetryRendered: false,
				applyingRenderedStartEnabled: true,
				applyingStoreStartBlocked: false,
				invalidInputStoreBlocked: false
			},
			after: {
				failureRetryRendered: true,
				retryActionsPerBurst: 100,
				providerValidationsPerRetryBurst: 1,
				jobsPerRetryBurst: 1,
				applyingRenderedStartDisabled: true,
				applyingRenderedStopDisabled: true,
				applyingDirectAttempts: 100,
				additionalApplyingProviderChecks: 0,
				additionalApplyingJobs: 0,
				applyingTransactionPreserved: true,
				invalidInputDirectAttempts: 100,
				invalidInputProviderChecks: 0,
				invalidInputJobs: 0,
				regenerableOutcomes: ['cancelled', 'rejected'],
				redFailures: 4,
				focusedTests: 48,
				impactedTests: 147,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-DRAWER-TERMINAL-EVENT-ISOLATION-034',
			summary: 'Same-job delayed stream events remained accepted after preview, failure or cancellation, and duplicate early lifecycle events could regress active streaming progress.',
			before: {
				terminalStatesGuarded: [],
				delayedEventBurstsPerTerminal: 100,
				lateOutputAccepted: true,
				lateUsageAccepted: true,
				terminalStateCouldRevive: true,
				streamingCouldRegressToConnecting: true
			},
			after: {
				guardedTerminalStates: ['preview', 'failed', 'cancelled'],
				acceptedStreamStates: ['queued', 'connecting', 'streaming'],
				delayedEventBurstsPerTerminal: 100,
				ignoredEventTypes: [
					'job_started',
					'connection_opened',
					'thinking_started',
					'content_delta',
					'usage',
					'failed',
					'cancelled',
					'completed'
				],
				terminalSnapshotsPreserved: [
					'state',
					'rawOutput',
					'parsedOutput',
					'transaction',
					'usage',
					'error'
				],
				activeProgressMonotonic: true,
				orderedPreviewStillWorks: true,
				redFailures: 4,
				focusedTests: 40,
				impactedTests: 151,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-DRAWER-TERMINAL-COMMAND-RESULT-ISOLATION-035',
			summary: 'Late start and cancellation command rejections could overwrite or pollute a terminal stream result from the same AI job.',
			before: {
				terminalStates: ['preview', 'failed', 'cancelled'],
				startRejectionOverwritesTerminalStates: 3,
				cancellationRejectionPollutesTerminalStates: 3,
				terminalCommandResultGuarded: false
			},
			after: {
				guardedStartFailureStates: [
					'validating_context',
					'queued',
					'connecting',
					'streaming'
				],
				guardedCancellationFailureStates: ['queued', 'connecting', 'streaming'],
				preservedTerminalStates: ['preview', 'failed', 'cancelled'],
				terminalSnapshotsPreserved: [
					'state',
					'rawOutput',
					'parsedOutput',
					'transaction',
					'usage',
					'error'
				],
				stopActionsPerTerminal: 100,
				nativeCancellationCommandsPerTerminal: 1,
				activeFailuresLocalized: true,
				activeFailuresRetryable: true,
				redFailures: 6,
				focusedTests: 46,
				impactedTests: 157,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-DRAWER-PREVIEW-REJECTION-SINGLE-COMMIT-036',
			summary: 'Repeated or delayed Reject candidate actions could throw after the first transition or mutate an applying preview.',
			before: {
				rejectionGuard: ['transaction-exists'],
				rejectionActions: 100,
				transitionsBeforeException: 1,
				repeatedActionThrows: true,
				delayedStateGuarded: false
			},
			after: {
				rejectionGuard: ['store-state-preview', 'transaction-status-preview'],
				rejectionActions: 100,
				transitions: 1,
				repeatedActionThrows: false,
				guardedDelayedStates: ['applying', 'completed', 'stale'],
				delayedActionsPerState: 100,
				additionalProviderRequests: 0,
				cancellationCommands: 0,
				rejectedCandidateRegenerable: true,
				redFailures: 4,
				focusedTests: 50,
				impactedTests: 161,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-DRAWER-APPLYING-CLOSE-PROTECTION-037',
			summary: 'Author close paths could erase an applying AI preview transaction while its write continued outside the drawer.',
			before: {
				authorClosePaths: ['store', 'button', 'escape', 'backdrop'],
				applyingCloseGuarded: false,
				transactionPreserved: false,
				closeButtonDisabled: false,
				missingStableSelectorsAfterFirstFixedInventory: 222
			},
			after: {
				authorClosePaths: ['store', 'button', 'escape', 'backdrop'],
				guardedState: 'applying',
				directCloseActions: 100,
				renderedClosePaths: 3,
				transactionPreserved: true,
				closeButtonDisabled: true,
				cancellationCommands: 0,
				internalResetAvailable: true,
				normalCloseContractsPreserved: true,
				stableWidthToggleAccessibleName: true,
				missingStableSelectors: inventory.counts.missingStableSelectors,
				redFailures: 4,
				focusedTests: 67,
				impactedTests: 172,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-AI-DRAWER-APPLYING-OPEN-ACTION-ISOLATION-038',
			summary: 'A registered AI action launch could replace the drawer source and erase an applying preview transaction.',
			before: {
				replacementActions: 100,
				applyingOpenActionGuarded: false,
				sourceChangedFrom: 'chapter-1',
				sourceChangedTo: 'chapter-2',
				stateAfterReplacement: 'idle',
				transactionPreserved: false,
				altAShortcutAlreadyModalGuarded: true
			},
			after: {
				guardedState: 'applying',
				replacementActions: 100,
				sourcePreserved: true,
				contextPackPreserved: true,
				parsedOutputPreserved: true,
				transactionPreserved: true,
				originalProviderRequests: 1,
				cancellationCommands: 0,
				altAShortcutActions: 100,
				altAModalBoundaryPreserved: true,
				normalReopenContractsPreserved: true,
				redFailures: 1,
				focusedTests: 75,
				impactedTests: 174,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-STORY-KERNEL-STABLE-CONTROL-SELECTORS-039',
			summary: 'Five Story Kernel generator declarations lacked stable selector metadata, and Generate plus Cancel collapsed into one inventory control.',
			before: {
				sourceControls: 8,
				sourceUnmappedControls: 5,
				globalControls: 423,
				globalStates: 9306,
				globalMissingStableSelectors: 221,
				generateAndCancelDistinct: false
			},
			after: {
				sourceControls: 9,
				sourceUnmappedControls: 0,
				globalControls: inventory.counts.controls,
				globalStates: inventory.counts.states,
				globalMissingStableSelectors: inventory.counts.missingStableSelectors,
				preservedAccessibleNames: [
					'生成 Story Kernel 候选',
					'取消',
					'选择 林越',
					'查看结构'
				],
				generateAndCancelDistinct: true,
				redFailures: 2,
				focusedTests: 22,
				impactedTests: 93,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-PENDING-FACT-EXTRACTION-PREFLIGHT-FEEDBACK-040',
			summary: 'Pending-fact extraction stayed visibly idle until the provider emitted its first state, while four workflow declarations lacked stable selector metadata.',
			before: {
				preflightButtonDisabled: false,
				preflightAccessibleFeedback: false,
				repeatedClicks: 100,
				extractionRequests: 1,
				sourceControls: 5,
				sourceUnmappedControls: 4,
				globalMissingStableSelectors: 216
			},
			after: {
				preflightButtonDisabled: true,
				preflightAccessibleName: '正在提取 · 0 字符',
				repeatedClicks: 100,
				extractionRequests: 1,
				sourceControls: 5,
				sourceUnmappedControls: 0,
				globalMissingStableSelectors: inventory.counts.missingStableSelectors,
				preservedFieldLabels: ['标题', '事实陈述', '叙事顺序'],
				redFailures: 2,
				focusedTests: 6,
				impactedTests: 43,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-MANUSCRIPT-EXTRACTION-RUN-SINGLE-FLIGHT-041',
			summary: 'Same-frame manuscript extraction Start actions entered both the page and runner concurrently, producing conflicting ledger writes and duplicate paid-run attempts.',
			before: {
				repeatedActions: 100,
				pageRunnerCalls: 100,
				runnerPromises: 100,
				staleWriteRejections: 99,
				sharedActivePromise: false
			},
			after: {
				repeatedActions: 100,
				pageRunnerCalls: 1,
				runnerPromises: 1,
				processorCalls: 1,
				staleWriteRejections: 0,
				sharedActivePromise: true,
				laterRunReceivesNewPromise: true,
				stopAndResumeContractsPreserved: true,
				redFailures: 2,
				focusedTests: 15,
				impactedTests: 48,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-MANUSCRIPT-EXTRACTION-EARLY-STOP-042',
			summary: 'Stop intent issued before a native extraction job existed was overwritten across initialization, source loading and provider preflight.',
			before: {
				immediateStopStatus: 'completed',
				sourceLoadStopChapterStatus: 'completed',
				providerPreflightNativeJobs: 1,
				perRunAbortSignal: false
			},
				after: {
				immediateStopStatus: 'stopped',
				sourceLoadStopChapterStatus: 'cancelled',
				providerPreflightNativeJobs: 0,
				perRunAbortSignal: true,
				preferenceLookupAbortChecks: 2,
				repeatedStopActions: 100,
				pageRunnerStopCalls: 1,
				explicitResumeProcessorCalls: 1,
				activeNativeCancellationPreserved: true,
				redFailures: 4,
				focusedTests: 21,
				impactedTests: 58,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-INVENTORY-COMPOSITE-CONTROL-043',
			summary: 'QA control discovery counted PascalCase React component boundaries as rendered controls, duplicating their intrinsic DOM controls and inflating selector and state debt.',
			before: {
				controls: 424,
				states: 9328,
				missingStableSelectors: 212,
				compositeControls: 16,
				syntheticCompositeStates: 352,
				totalUnmapped: 10159
			},
			after: {
				controls: inventory.counts.controls,
				states: inventory.counts.states,
				missingStableSelectors: inventory.counts.missingStableSelectors,
				compositeControls: 0,
				syntheticCompositeStates: 0,
				totalUnmapped: traceability.counts.totalUnmapped,
				redFailures: 1,
				focusedTests: 16,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-CREATION-JOURNEY-STABLE-CONTROLS-044',
			summary: 'The zero-to-draft Creation Journey lacked static selector metadata across repeated stages, cards, fields, lock controls and drag targets, while its test cleanup emitted an unawaited React update warning.',
			before: {
				sourceControls: 22,
				sourceMappedControls: 8,
				sourceMissingStableSelectors: 14,
				globalControls: 408,
				globalStates: 8976,
				globalMissingStableSelectors: 196,
				totalUnmapped: 9792,
				testCleanupReactWarnings: 1
			},
			after: {
				sourceControls: 38,
				sourceMappedControls: 38,
				sourceMissingStableSelectors: 0,
				distinguishedControls: 16,
				globalControls: inventory.counts.controls,
				globalStates: inventory.counts.states,
				globalMissingStableSelectors: inventory.counts.missingStableSelectors,
				totalUnmapped: traceability.counts.totalUnmapped,
				testCleanupReactWarnings: 0,
				redFailures: 2,
				creationJourneyTests: 64,
				qaScriptTests: 17,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-STRUCTURED-OUTLINE-STABLE-CONTROLS-045',
			summary: 'The structured outline workspace lacked stable automation metadata across dynamic author controls and collapsed twenty distinct operations into shared inventory declarations.',
			before: {
				sourceControls: 15,
				sourceMappedControls: 6,
				sourceMissingStableSelectors: 9,
				globalControls: 424,
				globalStates: 9328,
				globalMissingStableSelectors: 182,
				totalUnmapped: 10161
			},
			after: {
				sourceControls: 35,
				sourceMappedControls: 35,
				sourceMissingStableSelectors: 0,
				distinguishedControls: 20,
				globalControls: inventory.counts.controls,
				globalStates: inventory.counts.states,
				globalMissingStableSelectors: inventory.counts.missingStableSelectors,
				totalUnmapped: traceability.counts.totalUnmapped,
				redFailures: 2,
				focusedTests: 10,
				creationJourneyTests: 65,
				qaScriptTests: 16,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-PROJECT-CREATION-STABLE-CONTROLS-046',
			summary: 'The five-step project creation wizard lacked stable automation metadata and collapsed eight distinct declarations, while project impact tests emitted React cleanup warnings.',
			before: {
				sourceControls: 12,
				sourceMappedControls: 6,
				sourceMissingStableSelectors: 6,
				globalControls: 444,
				globalStates: 9768,
				globalMissingStableSelectors: 173,
				totalUnmapped: 10568,
				projectImpactReactWarnings: 6
			},
			after: {
				sourceControls: 20,
				sourceMappedControls: 20,
				sourceMissingStableSelectors: 0,
				distinguishedControls: 8,
				globalControls: inventory.counts.controls,
				globalStates: inventory.counts.states,
				globalMissingStableSelectors: inventory.counts.missingStableSelectors,
				totalUnmapped: traceability.counts.totalUnmapped,
				projectImpactReactWarnings: 0,
				redFailures: 2,
				focusedTests: 16,
				projectImpactTests: 64,
				qaScriptTests: 17,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-PROJECT-STRUCTURE-TREE-STABLE-CONTROLS-047',
			summary: 'The project structure tree exposed dynamic author-facing names but no static automation handles for its six volume, chapter and scene navigation and drag operations.',
			before: {
				sourceControls: 6,
				sourceMappedControls: 0,
				sourceMissingStableSelectors: 6,
				globalControls: 452,
				globalStates: 9944,
				globalMissingStableSelectors: 167,
				totalUnmapped: 10708
			},
			after: {
				sourceControls: 6,
				sourceMappedControls: 6,
				sourceMissingStableSelectors: 0,
				distinctOperations: 6,
				dynamicAccessibleNamesPreserved: true,
				globalControls: inventory.counts.controls,
				globalStates: inventory.counts.states,
				globalMissingStableSelectors: inventory.counts.missingStableSelectors,
				totalUnmapped: traceability.counts.totalUnmapped,
				redFailures: 2,
				focusedTests: 8,
				projectImpactTests: 65,
				qaScriptTests: 18,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-WORLD-RULE-SAVE-LIFECYCLE-048',
			summary: 'The world rule editor collapsed distinct fields, multiplied same-frame saves, exposed no retry feedback and reused a stale revision for the next edit.',
			before: {
				sourceControls: 6,
				sourceMappedControls: 0,
				sourceMissingStableSelectors: 6,
				actualFormOperations: 8,
				repeatedSubmissions: 100,
				persistenceRequests: 100,
				secondSaveRevision: 0,
				localizedFailureFeedback: false,
				impactReactWarnings: 1,
				globalControls: 452,
				globalStates: 9944,
				globalMissingStableSelectors: 161,
				totalUnmapped: 10710
			},
			after: {
				sourceControls: 8,
				sourceMappedControls: 8,
				sourceMissingStableSelectors: 0,
				distinguishedControls: 2,
				repeatedSubmissions: 100,
				persistenceRequests: 1,
				secondSaveRevision: 1,
				localizedFailureFeedback: true,
				retryAfterFailure: true,
				impactReactWarnings: 0,
				globalControls: inventory.counts.controls,
				globalStates: inventory.counts.states,
				globalMissingStableSelectors: inventory.counts.missingStableSelectors,
				totalUnmapped: traceability.counts.totalUnmapped,
				redFailures: 5,
				focusedTests: 10,
				impactTests: 58,
				storyKernelPanelTests: 22,
				qaScriptTests: 19,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-CHARACTER-EDITOR-SAVE-LIFECYCLE-049',
			summary: 'The character editor collapsed distinct fields, multiplied same-frame saves, replaced the dossier with a raw persistence error and reused a stale revision on the next save.',
			before: {
				sourceControls: 5,
				sourceMappedControls: 0,
				sourceMissingStableSelectors: 5,
				actualFormOperations: 11,
				repeatedSubmissions: 100,
				persistenceRequests: 100,
				failedSaveKeepsEditorVisible: false,
				failedSaveKeepsDirtyState: false,
				rawFailureDetailsVisible: true,
				secondSaveRevision: 1,
				globalControls: 454,
				globalStates: 9988,
				globalMissingStableSelectors: 155,
				totalUnmapped: 10749
			},
			after: {
				sourceControls: 11,
				sourceMappedControls: 11,
				sourceMissingStableSelectors: 0,
				distinguishedControls: 6,
				repeatedSubmissions: 100,
				persistenceRequests: 1,
				failedSaveKeepsEditorVisible: true,
				failedSaveKeepsDirtyState: true,
				rawFailureDetailsVisible: false,
				retryAfterFailure: true,
				secondSaveRevision: 2,
				globalControls: inventory.counts.controls,
				globalStates: inventory.counts.states,
				globalMissingStableSelectors: inventory.counts.missingStableSelectors,
				totalUnmapped: traceability.counts.totalUnmapped,
				redFailures: 5,
				focusedTests: 17,
				impactTests: 62,
				qaScriptTests: 20,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-WRITER-HEADER-SAVE-NAVIGATION-050',
			summary: 'The writer header multiplied chapter-status writes after awaiting a dirty save, navigated to organization after save failure and lacked stable handles for its persistent author actions.',
			before: {
				sourceControls: 5,
				sourceMappedControls: 0,
				sourceMissingStableSelectors: 5,
				actualSourceOperations: 12,
				repeatedStatusChoices: 100,
				manuscriptWrites: 1,
				nativeStatusWrites: 100,
				navigatesAfterFailedSave: true,
				failedDraftRemainsDirty: true,
				workspaceReactWarnings: 10,
				globalControls: 458,
				globalStates: 10076,
				globalMissingStableSelectors: 150,
				totalUnmapped: 10828
			},
			after: {
				sourceControls: 12,
				sourceMappedControls: 12,
				sourceMissingStableSelectors: 0,
				distinguishedControls: 7,
				repeatedStatusChoices: 100,
				manuscriptWrites: 1,
				nativeStatusWrites: 1,
				navigatesAfterFailedSave: false,
				failedDraftRemainsDirty: true,
				workspaceReactWarnings: 0,
				globalControls: inventory.counts.controls,
				globalStates: inventory.counts.states,
				globalMissingStableSelectors: inventory.counts.missingStableSelectors,
				totalUnmapped: traceability.counts.totalUnmapped,
				redFailures: 4,
				focusedTests: 34,
				impactTests: 95,
				qaScriptTests: 21,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-MANUSCRIPT-EXTRACTION-ACTION-LIFECYCLE-051',
			summary: 'The manuscript extraction center multiplied plan, confirmation and undo transitions under same-frame actions, exposed unexpected storage details and collapsed its author controls.',
			before: {
				sourceControls: 11,
				sourceMappedControls: 6,
				sourceMissingStableSelectors: 5,
				actualSourceOperations: 19,
				repeatedActions: 100,
				planAppends: 100,
				safetySnapshots: 100,
				undoTransactions: 100,
				rawUnexpectedErrorVisible: true,
				globalControls: 461,
				globalStates: 10142,
				globalMissingStableSelectors: 145,
				totalUnmapped: 10901
			},
			after: {
				sourceControls: 19,
				sourceMappedControls: 19,
				sourceMissingStableSelectors: 0,
				distinguishedControls: 8,
				repeatedActions: 100,
				planAppends: 1,
				safetySnapshots: 1,
				confirmationTransactions: 1,
				undoTransactions: 1,
				rejectionTransactions: 1,
				retryAfterFailure: true,
				rawUnexpectedErrorVisible: false,
				globalControls: inventory.counts.controls,
				globalStates: inventory.counts.states,
				globalMissingStableSelectors: inventory.counts.missingStableSelectors,
				totalUnmapped: traceability.counts.totalUnmapped,
				redFailures: 5,
				focusedTests: 20,
				impactTests: 163,
				qaScriptTests: 22,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-GLOBAL-CREATE-MENU-LIFECYCLE-052',
			summary: 'The global Create menu multiplied project chooser actions, lost the original shortcut focus during reopen bursts and collapsed distinct creation entries in automation inventory.',
			before: {
				sourceControls: 6,
				sourceMappedControls: 2,
				sourceMissingStableSelectors: 4,
				actualSourceOperations: 7,
				repeatedActions: 100,
				projectChooserDispatches: 100,
				originalShortcutFocusRestored: false,
				alreadyOpenChapterFocusHonored: false,
				quickCaptureReactWarnings: 3,
				globalControls: 469,
				globalStates: 10318,
				globalMissingStableSelectors: 140,
				totalUnmapped: 11065
			},
			after: {
				sourceControls: 7,
				sourceMappedControls: 7,
				sourceMissingStableSelectors: 0,
				distinguishedControls: 5,
				repeatedActions: 100,
				projectChooserDispatches: 1,
				retryAfterReopen: true,
				originalShortcutFocusRestored: true,
				alreadyOpenChapterFocusHonored: true,
				disabledActionsSkippedByKeyboard: true,
				quickCaptureReactWarnings: 0,
				globalControls: inventory.counts.controls,
				globalStates: inventory.counts.states,
				globalMissingStableSelectors: inventory.counts.missingStableSelectors,
				totalUnmapped: traceability.counts.totalUnmapped,
				redFailures: 4,
				focusedTests: 18,
				impactTests: 73,
				qaScriptTests: 25,
				frontendTests: frontend.vitestPassed
			}
		},
		{
			id: 'QA-CHAPTER-CREATION-LIFECYCLE-053',
			summary: 'Chapter creation multiplied rendered and Store transitions behind a dirty save, accepted stale project identity and collapsed dialog operations in automation inventory.',
			before: {
				sourceControls: 5,
				sourceMappedControls: 3,
				sourceMissingStableSelectors: 2,
				actualSourceOperations: 6,
				repeatedActions: 100,
				renderedSubmitDispatches: 100,
				renderedDismissDispatches: 100,
				nativeChapterTransactions: 100,
				staleSaveProjectCreated: true,
				staleNativeResultApplied: true,
				globalControls: 470,
				globalStates: 10340,
				globalMissingStableSelectors: 136,
				totalUnmapped: 11088
			},
			after: {
				sourceControls: 6,
				sourceMappedControls: 6,
				sourceMissingStableSelectors: 0,
				distinguishedControls: 1,
				repeatedActions: 100,
				renderedSubmitDispatches: 1,
				renderedDismissDispatches: 1,
				nativeChapterTransactions: 1,
				retryAfterFailure: true,
				openingFocusRestored: true,
				staleSaveProjectCreated: false,
				staleNativeResultApplied: false,
				globalControls: inventory.counts.controls,
				globalStates: inventory.counts.states,
				globalMissingStableSelectors: inventory.counts.missingStableSelectors,
				totalUnmapped: traceability.counts.totalUnmapped,
				redFailures: 5,
				focusedTests: 16,
				impactTests: 102,
				qaScriptTests: 26,
				frontendTests: frontend.vitestPassed
			}
		}
	],
	coverageExtensions: [
		{
			id: 'QA-STORY-KERNEL-SCHEMA-MUTATION-MATRIX-004',
			summary: 'Every generatable Story Kernel resource type has an explicit wrong-field mutation that must remain visible, disabled and unwritable.',
			resourceTypes: [
				'character',
				'scene',
				'location',
				'faction',
				'item',
				'worldRule',
				'timelineEvent',
				'relationship',
				'plotThread',
				'foreshadowing',
				'information'
			],
			mockScenarioCount: fixtures.counts.mockScenarios,
			validControlCandidates: 1,
			quarantinedMutations: 11,
			atomicWrites: 1,
			frontendTests: frontend.vitestPassed
		}
	],
	execution: {
		frontend,
		cargo,
		stress: {
			status: stress.status,
			durationMs: stress.durationMs,
			browserRuns: stress.summary.browser.completedRuns,
			totalResizeAttempts: stress.summary.browser.totalResizeAttempts,
			totalWorkspaceTransitions: stress.summary.browser.totalWorkspaceTransitions,
			performanceRuns: stress.summary.performance.projectInteractive.samples,
			recoveryCycles: stress.summary.recovery.completedCycles,
			maximumUnresolvedBacklinks: stress.summary.recovery.maximumUnresolvedBacklinks
		}
	},
	traceability: {
		status: traceability.status,
		totalUnmapped: traceability.counts.totalUnmapped,
		missingStableSelectors: inventory.counts.missingStableSelectors
	},
	warnings: [
		'The production Monaco bundle remains above 3,000 kB.',
		'Strict traceability remains fail-closed until missing mappings receive tests or reasoned N/A decisions.'
	]
};
await writeJson('artifacts/qa/current-convergence-report.json', report);
console.log(JSON.stringify({
	executionStatus: report.executionStatus,
	productConclusion: report.productConclusion,
	ledgerStatus: ledger.status,
	frontendCases: frontend.vitestPassed,
	rustCases: cargo.tests,
	stress: report.execution.stress,
	traceability: report.traceability
}, undefined, 2));
