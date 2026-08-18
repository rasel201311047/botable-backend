const { openai } = require('../../../config/openai');

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-3.5-turbo";

async function getJsonCompletion(prompt, temperature = 0.2) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  
  // Convert response_format={"type": "json_object"} from Python to Node
  // Note: For gpt-3.5-turbo/gpt-4, response_format works, but the prompt must contain the word "JSON"
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: temperature,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content;
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to parse JSON from OpenAI response:", content);
    throw new Error("Invalid JSON response from AI");
  }
}

module.exports = {
  getJsonCompletion,
  OPENAI_MODEL
};
