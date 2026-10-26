// One-shot hand-off of a question typed elsewhere (search, home ask bar) into the AI chat input.
const KEY = 'anacan-ai-draft';

export function setAiDraft(text: string) {
  try { sessionStorage.setItem(KEY, text.slice(0, 2000)); } catch { /* optional */ }
}

export function takeAiDraft(): string {
  try {
    const value = sessionStorage.getItem(KEY) || '';
    sessionStorage.removeItem(KEY);
    return value;
  } catch { return ''; }
}
