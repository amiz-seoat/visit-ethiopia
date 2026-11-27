/**
 * Minimal OpenAI-compatible chat-completions client (fetch, no SDK).
 *
 * Default provider: Groq free tier (https://console.groq.com), model
 * openai/gpt-oss-120b. Any OpenAI-compatible endpoint works by setting
 * LLM_BASE_URL / LLM_MODEL — e.g. Google Gemini's free tier:
 *   LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
 *   LLM_MODEL=gemini-2.5-flash
 * The API key is read from LLM_API_KEY and never logged or returned.
 */

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1'
const DEFAULT_MODEL = 'openai/gpt-oss-120b'

export function llmConfig() {
  return {
    apiKey: process.env.LLM_API_KEY || '',
    baseUrl: (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: process.env.LLM_MODEL || DEFAULT_MODEL,
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 25000,
  }
}

export const isLlmConfigured = () => Boolean(llmConfig().apiKey)

export class LlmError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'LlmError'
    this.status = status
  }
}

/** Test hook: replace the transport (fetch) with a stub. */
let transport = (...args) => fetch(...args)
export function setLlmTransport(fn) {
  transport = fn || ((...args) => fetch(...args))
}

export async function chatComplete(messages, { maxTokens = 1400, temperature = 0.2 } = {}) {
  const cfg = llmConfig()
  if (!cfg.apiKey) throw new LlmError('LLM not configured', 503)

  const body = { model: cfg.model, messages, temperature, max_tokens: maxTokens }
  // gpt-oss models spend part of the budget on reasoning; keep it short for chat latency.
  if (/gpt-oss/i.test(cfg.model)) body.reasoning_effort = 'low'

  let res
  try {
    res = await transport(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    })
  } catch (err) {
    throw new LlmError(err?.name === 'TimeoutError' ? 'LLM request timed out' : 'LLM request failed', 504)
  }
  if (!res.ok) {
    // Do not surface provider bodies (may echo request details); status is enough.
    throw new LlmError(`LLM provider returned ${res.status}`, res.status)
  }
  const json = await res.json()
  const text = json?.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string') throw new LlmError('LLM returned no content', 502)
  return { text: text.trim(), usage: json.usage || null }
}
