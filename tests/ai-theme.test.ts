import { describe, expect, it } from 'vitest';
import { createAiThemeRequest, parseAiThemeResponse, type PageStyleSnapshot } from '../utils/ai-theme';
import { SLATE_BLUE } from '../utils/theme';

const snapshot: PageStyleSnapshot = {
  version: 1,
  viewport: { category: 'desktop' },
  document: { colorScheme: 'light', visibleElements: 12, stylesheetRules: 20 },
  colors: { background: [], text: [], border: [] },
  typography: [],
  surfaces: [],
  spacing: [],
  semantics: { headings: 1 },
};

describe('AI theme integration', () => {
  it('uses the free router with structured output and ZDR routing', () => {
    expect(createAiThemeRequest(snapshot)).toMatchObject({
      model: 'openrouter/free',
      provider: { require_parameters: true, zdr: true },
      max_tokens: 1_800,
      stream: false,
      reasoning: { effort: 'minimal', exclude: true },
      response_format: { type: 'json_schema' },
    });
  });

  it('can omit ZDR only after an explicit opt-out', () => {
    expect(createAiThemeRequest(snapshot, false)).toMatchObject({
      model: 'openrouter/free',
      provider: { require_parameters: true },
    });
    expect((createAiThemeRequest(snapshot, false) as { provider: object }).provider).not.toHaveProperty('zdr');
  });

  it('parses a constrained palette from a chat completion', () => {
    const palette = { ...SLATE_BLUE, id: undefined, label: undefined };
    const result = parseAiThemeResponse({
      choices: [{ message: { content: JSON.stringify(palette) } }],
    });
    expect(result.id).toBe('ai');
    expect(result.pageBackground).toBe(SLATE_BLUE.pageBackground);
  });

  it('discards arbitrary CSS returned by the model and recovers safely', () => {
    const palette = { ...SLATE_BLUE, pageBackground: 'var(--stolen)' };
    expect(parseAiThemeResponse({
      choices: [{ message: { content: JSON.stringify(palette) } }],
    }).pageBackground).toBe(SLATE_BLUE.pageBackground);
  });

  it('fills missing properties and repairs inaccessible core colors', () => {
    const result = parseAiThemeResponse({
      choices: [{ message: { content: JSON.stringify({
        pageBackground: '#FFFFFF',
        textPrimary: '#000000',
        focusRing: '#FFB000',
      }) } }],
    });
    expect(result.pageBackground).toBe(SLATE_BLUE.pageBackground);
    expect(result.textPrimary).toBe(SLATE_BLUE.textPrimary);
    expect(result.focusRing).toBe('#FFB000');
  });

  it('accepts JSON fenced by a free model', () => {
    const result = parseAiThemeResponse({
      choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(SLATE_BLUE)}\n\`\`\`` } }],
    });
    expect(result.id).toBe('ai');
  });

  it('reports an empty OpenRouter response without crashing', () => {
    expect(() => parseAiThemeResponse(undefined)).toThrow('empty response');
  });
});
