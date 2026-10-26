// ============================================================
// Claude (Anthropic Messages API) — paylaşılan helper.
// Həm birbaşa Anthropic, həm də Azure AI Foundry üzərindən Claude dəstəklənir.
// Secrets:
//   ANTHROPIC_API_KEY  — vacib (yoxdursa isClaudeConfigured()=false).
//                        Azure istifadəsində Azure resursunun API açarını yazın.
//   CLAUDE_MODEL       — istəyə bağlı (default: claude-sonnet-4-5;
//                        Azure-da deployment adınızı yazın, məs. claude-fable-5)
//   CLAUDE_BASE_URL    — istəyə bağlı (default: https://api.anthropic.com;
//                        Azure üçün: https://<resource>.services.ai.azure.com/anthropic)
// Qeyd: auth başlıqları hər iki variantı əhatə edir (x-api-key + api-key),
// ona görə eyni kod dəyişikliksiz Anthropic və Azure ilə işləyir.
// ============================================================

export function isClaudeConfigured(): boolean {
  return !!Deno.env.get('ANTHROPIC_API_KEY');
}

export function claudeModelName(): string {
  return Deno.env.get('CLAUDE_MODEL') || 'claude-sonnet-4-5';
}

export interface ClaudeCallOptions {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
}

/** Tək cavablıq Claude çağırışı — mətn qaytarır, xətada throw edir. */
export async function callClaude(opts: ClaudeCallOptions): Promise<string> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY is not configured');
  const baseUrl = (Deno.env.get('CLAUDE_BASE_URL') || 'https://api.anthropic.com').replace(/\/$/, '');

  const resp = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      // Anthropic birbaşa API 'x-api-key', Azure AI Foundry isə 'api-key' gözləyir —
      // hər ikisini göndəririk ki, CLAUDE_BASE_URL dəyişməklə hər ikisi işləsin.
      'x-api-key': key,
      'api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: claudeModelName(),
      max_tokens: opts.maxTokens,
      temperature: opts.temperature ?? 0.2,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Claude HTTP ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  const text = (data?.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');
  if (!text) throw new Error('Claude returned empty response');
  return text;
}
