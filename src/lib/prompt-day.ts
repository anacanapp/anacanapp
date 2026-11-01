// At most one rating/feedback prompt per calendar day: the 5★ store prompt (AppRatingPrompt) and the
// in-app feedback form share this marker so they never both appear on the same day.
const KEY = 'anacan.prompt.lastShownDay';

const today = (now = new Date()) => `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

export function promptShownToday(now?: Date): boolean {
  try {return localStorage.getItem(KEY) === today(now);} catch {return false;}
}

export function markPromptShown(now?: Date): void {
  try {localStorage.setItem(KEY, today(now));} catch {/* optional */}
}
