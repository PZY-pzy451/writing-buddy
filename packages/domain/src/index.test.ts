import { countWords, normalizeProjectRelativePath } from './index';

describe('domain', () => {
	it('counts Chinese characters and Latin words without entity markers', () => {
		expect(countWords('夜雨落下。 Hello world. [[character:lin-mo]]')).toBe(6);
	});

	it('rejects traversal and Windows absolute paths', () => {
		expect(() => normalizeProjectRelativePath('../secret.txt')).toThrow('unsafePath');
		expect(() => normalizeProjectRelativePath('C:/secret.txt')).toThrow('unsafePath');
		expect(normalizeProjectRelativePath('chapters/chapter-001.md')).toBe('chapters/chapter-001.md');
	});
});
