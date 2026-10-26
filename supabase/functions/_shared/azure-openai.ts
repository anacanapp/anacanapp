// ============================================================
// Azure OpenAI (GPT) — paylaşılan helper.
// Alternativ AI provayderi kimi istifadə olunur (Claude əsas, GPT seçim/fallback).
// Secrets:
//   AZURE_OPENAI_ENDPOINT    — vacib, məs. https://<resource>.openai.azure.com
//                              (və ya https://<resource>.cognitiveservices.azure.com)
//   AZURE_OPENAI_API_KEY     — vacib
//   AZURE_OPENAI_DEPLOYMENT  — vacib, GPT deployment adı (məs. gpt-5.6-sol)
//   AZURE_OPENAI_API_VERSION — istəyə bağlı (default: 2024-10-21)
// ============================================================

export function isAzureGptConfigured(): boolean {
  return !!(
    Deno.env.get('AZURE_OPENAI_ENDPOINT') &&
    Deno.env.get('AZURE_OPENAI_API_KEY') &&
    Deno.env.get('AZURE_OPENAI_DEPLOYMENT')
  );
}

export function azureGptModelName(): string {
  return Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt';
}

export interface AzureGptCallOptions {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
}

/** Tək cavablıq Azure OpenAI chat çağırışı — mətn qaytarır, xətada throw edir. */
export async function callAzureGpt(opts: AzureGptCallOptions): Promise<string> {
  const endpoint = (Deno.env.get('AZURE_OPENAI_ENDPOINT') || '').replace(/\/$/, '');
  const key = Deno.env.get('AZURE_OPENAI_API_KEY');
  const deployment = Deno.env.get('AZURE_OPENAI_DEPLOYMENT');
  if (!endpoint || !key || !deployment) {
    throw new Error('Azure OpenAI is not configured (AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY / AZURE_OPENAI_DEPLOYMENT)');
  }
  const apiVersion = Deno.env.get('AZURE_OPENAI_API_VERSION') || '2024-10-21';

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': key,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      // Yeni Azure modelləri max_completion_tokens istəyir; köhnələr max_tokens.
      // max_completion_tokens göndəririk, 400 alsaq max_tokens ilə təkrar cəhd edirik.
      max_completion_tokens: opts.maxTokens,
      temperature: opts.temperature ?? 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (resp.status === 400) {
    const errText = await resp.text();
    if (/max_completion_tokens|unsupported parameter/i.test(errText)) {
      const retry = await fetch(url, {
        method: 'POST',
        headers: { 'api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: opts.system },
            { role: 'user', content: opts.user },
          ],
          max_tokens: opts.maxTokens,
          temperature: opts.temperature ?? 0.2,
          response_format: { type: 'json_object' },
        }),
      });
      if (!retry.ok) {
        const body = await retry.text();
        throw new Error(`Azure GPT HTTP ${retry.status}: ${body.slice(0, 300)}`);
      }
      const retryData = await retry.json();
      const retryText = retryData?.choices?.[0]?.message?.content || '';
      if (!retryText) throw new Error('Azure GPT returned empty response');
      return retryText;
    }
    throw new Error(`Azure GPT HTTP 400: ${errText.slice(0, 300)}`);
  }

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Azure GPT HTTP ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Azure GPT returned empty response');
  return text;
}
