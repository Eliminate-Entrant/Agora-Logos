const OpenAI = require("openai");

class LLMClient {
  constructor({
    apiKey = process.env.LLM_API_KEY,
    baseURL = process.env.LLM_API_URL,
    model = process.env.LLM_MODEL || "gpt-4o-mini",
    maxRetries = 3,
    maxTokens = 100000,
    retryDelayMs = 1500
  } = {}) {
    if (!apiKey) throw new Error("Missing LLM_API_KEY");
    this.client = new OpenAI({ apiKey: apiKey, baseURL: baseURL });
    this.model = model;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
    this.maxTokens = maxTokens;
  }

  async _retry(fn) {
    let lastErr;
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        console.warn(`LLM call failed (attempt ${i + 1}): ${err.message}`);
        if (i < this.maxRetries - 1) {
          await new Promise(res => setTimeout(res, this.retryDelayMs));
        }
      }
    }
    throw lastErr;
  }


  async callLLM(system_prompt, user_prompt) {
    return this._retry(async () => {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "system", content: system_prompt }, { role: "user", content: user_prompt }],
        temperature: 0.2,
        max_tokens: this.maxTokens
      });
      return response.choices[0]?.message?.content?.trim();
    });
  }

  async callLLMJson(system_prompt, user_prompt, schema_validation = null) {
    return this._retry(async () => {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: system_prompt }, 
          { role: "user", content: user_prompt }
        ],
        temperature: 0.1,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0,
        response_format: { type: "json_object" },
        max_tokens: 2000
      });

      let text = response.choices[0]?.message?.content || "{}";
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        throw new Error("Invalid JSON returned by LLM");
      }

      if (schema_validation) {
        const valid = schema_validation.safeParse ? schema_validation.safeParse(parsed) : { success: true };
        if (!valid.success) {
          throw new Error("Validation failed: " + JSON.stringify(valid.error));
        }
        return valid.data;
      }

      return parsed;
    });
  }
}

module.exports = { LLMClient };
