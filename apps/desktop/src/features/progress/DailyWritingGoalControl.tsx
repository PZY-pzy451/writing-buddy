import { Check, Target } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
	selectTodayWritingProgress,
	useAppStore
} from '../../app/store';
import {
	MAX_DAILY_WRITING_GOAL,
	MIN_DAILY_WRITING_GOAL
} from './DailyWritingProgressModel';
import './DailyWritingGoalControl.css';

interface DailyWritingGoalControlProps {
	readonly placement: 'header' | 'dashboard';
}

export function DailyWritingGoalControl({
	placement
}: DailyWritingGoalControlProps): React.JSX.Element {
	const progress = useAppStore(useShallow(selectTodayWritingProgress));
	const setDailyWritingGoal = useAppStore(state => state.setDailyWritingGoal);
	const [message, setMessage] = useState('');

	const saveGoal = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const nextGoal = Number(new FormData(event.currentTarget).get('dailyGoal'));
		if (
			!Number.isInteger(nextGoal)
			|| nextGoal < MIN_DAILY_WRITING_GOAL
			|| nextGoal > MAX_DAILY_WRITING_GOAL
		) {
			setMessage(`请输入 ${MIN_DAILY_WRITING_GOAL.toLocaleString()}–${MAX_DAILY_WRITING_GOAL.toLocaleString()} 之间的整数。`);
			return;
		}
		if (!setDailyWritingGoal(nextGoal)) {
			setMessage('当前没有可设置目标的作品。');
			return;
		}
		setMessage(`今日目标已更新为 ${nextGoal.toLocaleString()} 字。`);
	};

	return (
		<details className={`daily-writing-goal is-${placement}`}>
			<summary
				aria-label={`今日写作进度 ${progress.words.toLocaleString()} / ${progress.goal.toLocaleString()} 字，打开设置`}
			>
				<span className={`daily-goal-icon ${progress.completed ? 'is-complete' : ''}`}>
					{progress.completed ? <Check size={16} /> : <Target size={16} />}
				</span>
				<span className="daily-goal-summary-copy">
					<small>{progress.completed ? '今日目标完成' : '今日新增'}</small>
					<strong>{progress.words.toLocaleString()} / {progress.goal.toLocaleString()} 字</strong>
				</span>
				<progress
					aria-label="今日写作目标完成度"
					value={progress.words}
					max={progress.goal}
				/>
			</summary>
			<div className="daily-goal-popover">
				<div className="daily-goal-status" aria-live="polite">
					<strong>{progress.completed ? '今天的目标已经完成' : `还差 ${progress.remaining.toLocaleString()} 字`}</strong>
					<span>当前完成 {progress.percent}% · 仅记录正文净增字数</span>
				</div>
				<form onSubmit={saveGoal} noValidate>
					<label htmlFor={`daily-writing-goal-${placement}`}>每日目标</label>
					<div>
						<input
							key={progress.goal}
							id={`daily-writing-goal-${placement}`}
							name="dailyGoal"
							type="number"
							min={MIN_DAILY_WRITING_GOAL}
							max={MAX_DAILY_WRITING_GOAL}
							step={100}
							inputMode="numeric"
							defaultValue={progress.goal}
							onChange={() => setMessage('')}
						/>
						<button type="submit">保存目标</button>
					</div>
					{message && (
						<p className="daily-goal-message" role={message.startsWith('请输入') ? 'alert' : 'status'}>
							{message}
						</p>
					)}
				</form>
				<p className="daily-goal-note">目标和进度保存在本机，不会改动作品文件。</p>
			</div>
		</details>
	);
}
