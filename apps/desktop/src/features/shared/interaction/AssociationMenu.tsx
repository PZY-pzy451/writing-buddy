import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useModalFocus } from '../../../accessibility/useModalFocus';
import './interaction.css';

export function AssociationMenu({
	title,
	eyebrow = 'CONFIRM ASSOCIATION',
	description,
	children,
	footer,
	onClose,
	className = ''
}: {
	readonly title: string;
	readonly eyebrow?: string;
	readonly description?: ReactNode;
	readonly children: ReactNode;
	readonly footer: ReactNode;
	readonly onClose: () => void;
	readonly className?: string;
}): React.JSX.Element {
	const dialogRef = useModalFocus(onClose);
	const titleId = 'interaction-association-menu-title';
	return (
		<div className="interaction-association-backdrop">
			<section
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				className={`interaction-association-menu ${className}`.trim()}
			>
				<header className="interaction-association-menu-header">
					<div>
						<span className="eyebrow">{eyebrow}</span>
						<h2 id={titleId}>{title}</h2>
					</div>
					<button type="button" aria-label="关闭关联确认" onClick={onClose}>
						<X size={18} />
					</button>
				</header>
				{description ? (
					<div className="interaction-association-menu-description">{description}</div>
				) : null}
				<div className="interaction-association-menu-body">{children}</div>
				<footer className="interaction-association-menu-footer">{footer}</footer>
			</section>
		</div>
	);
}
