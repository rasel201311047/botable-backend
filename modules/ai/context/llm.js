/**
 * Thin OpenAI wrapper for the AI Assistant: fast model, hard timeout, model fallback.
 */
const logger = require('../../../utils/logger');

const PRIMARY_MODEL = process.env.OPENAI_ASSISTANT_MODEL || 'gpt-4o-mini';
const FALLBACK_MODEL = 'gpt-3.5-turbo';

const isConfigured = () => Boolean(process.env.OPENAI_API_KEY);

const isModelUnavailable = error =>
  error?.status === 404 || error?.code === 'model_not_found' || /model/i.test(error?.message || '') && error?.status === 400;

const getClient = () => require('../../../config/openai').openai;

/**
 * @param {{messages: object[], json?: boolean, maxTokens?: number, temperature?: number, timeoutMs?: number}} opts
 * @returns {Promise<{content: string, model: string}>}
 */
const complete = async ({ messages, json = false, maxTokens = 300, temperature = 0.4, timeoutMs = 9000 }) => {
  const openai = getClient();
  const run = async model => {
    const completion = await openai.chat.completions.create(
      {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      },
      { timeout: timeoutMs, maxRetries: 0 },
    );
    return { content: completion.choices?.[0]?.message?.content || '', model };
  };

  try {
    return await run(PRIMARY_MODEL);
  } catch (error) {
    if (PRIMARY_MODEL !== FALLBACK_MODEL && isModelUnavailable(error)) {
      logger.warn(`AI assistant model ${PRIMARY_MODEL} unavailable, falling back to ${FALLBACK_MODEL}`);
      return run(FALLBACK_MODEL);
    }
    throw error;
  }
};

module.exports = { complete, isConfigured, PRIMARY_MODEL };
