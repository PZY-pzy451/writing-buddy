import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import {
	buildAiContextPack,
	type AiActionDefinition
} from '@writing-buddy/ai-actions';
import { ContextPreview } from './ContextPreview';

const action: AiActionDefinition = {
	id: 'character.generateProfile',
	title: '生成人物',
	description: 'test',
	category: 'character',
	availability: () => ({ available: true }),
	inputSchema: z.object({}),
	outputSchema: z.object({}),
	outputSchemaName: 'Character',
	outputSchemaVersion: 1,
	contextPolicy: {
		requiredKinds: ['project'],
		optionalKinds: ['entity'],
		maximumTokens: 500
	},
	applyPolicy: { type: 'create_resources', selectableItems: true },
	promptTemplateId: 'character.generateProfile',
	defaultModelClass: 'reasoning'
};

describe('ContextPreview', () => {
	it('shows missing-project guidance', () => {
		render(<ContextPreview onToggle={() => undefined} />);
		expect(screen.getByText('尚未打开作品')).toBeInTheDocument();
	});

	it('locks required context and allows explicit secret consent', async () => {
		const user = userEvent.setup();
		const onToggle = vi.fn();
		const pack = buildAiContextPack(action, {
			project: { id: 'project-1', title: '作品', summary: '悬疑长篇' },
			entities: [{
				id: 'character:secret',
				title: '作者秘密',
				summary: '隐藏身份',
				authorSecret: true
			}]
		});
		render(<ContextPreview pack={pack} onToggle={onToggle} />);

		expect(screen.getByRole('checkbox', { name: /作品/ })).toBeDisabled();
		const secret = screen.getByRole('checkbox', { name: /作者秘密/ });
		expect(secret).not.toBeChecked();
		await user.click(secret);
		expect(onToggle).toHaveBeenCalledWith('entity:character:secret', true);
	});

	it('renders an eligible current resource without claiming project metadata is sent', () => {
		const reviewAction: AiActionDefinition = {
			...action,
			id: 'review.consistency',
			category: 'review',
			contextPolicy: {
				requiredKinds: ['current-resource'],
				optionalKinds: [],
				maximumTokens: 500
			},
			applyPolicy: { type: 'review_issues', maximumSeverity: 'warning' }
		};
		const pack = buildAiContextPack(reviewAction, {
			project: { id: 'project-1', title: 'Project metadata', summary: 'Not sent' },
			currentResource: {
				id: 'chapter-1',
				title: 'Current chapter',
				summary: 'The exact review input.'
			}
		});

		render(<ContextPreview pack={pack} onToggle={() => undefined} />);

		expect(screen.getByText('Current chapter')).toBeInTheDocument();
		expect(screen.queryByText('Project metadata')).not.toBeInTheDocument();
	});
});
