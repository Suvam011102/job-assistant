const axios = require("axios");
const { z } = require("zod");
const redisClient = require("./redisClient");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// TTL: 10 minutes
const CACHE_TTL_SECONDS = 600;

/* ===============================
   📦 ZOD SCHEMA
================================ */

const JobSchema = z.object({
  title: z.string(),
  company: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  tech_stack: z.array(z.string()),
  experience_required: z.string(),
  location: z.string(),
  job_type: z.string(),
  remote: z.boolean(),
  salary_range: z.string().nullable()
});

/* ===============================
   🧹 CLEAN INPUT
================================ */

function cleanJobText(text) {
  return text
    .replace(/Privacy Policy[\s\S]*/gi, "")
    .replace(/Terms of Service[\s\S]*/gi, "")
    .replace(/Apply Now[\s\S]*/gi, "")
    .slice(0, 12000);
}

/* ===============================
   🔌 CALL GROQ
================================ */

async function callGroq(messages, temperature = 0) {
  const response = await axios.post(
    GROQ_URL,
    {
      model: "llama-3.1-8b-instant",
      messages,
      temperature
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.choices[0].message.content;
}

/* ===============================
   🛡 SAFE JSON PARSE
================================ */

function safeParseJSON(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Invalid JSON returned by LLM");
  }
}

/* ===============================
   🚀 EXTRACTION WITH REDIS CACHE
================================ */

async function extractJobData(jobText, retries = 1) {
  const cleanedText = cleanJobText(jobText);

  const cacheKey = `job:${Buffer.from(cleanedText).toString("base64")}`;

  // 🔥 1️⃣ CHECK REDIS CACHE
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    console.log("Returning Redis cached result...");
    return JSON.parse(cached);
  }

  const messages = [
    {
      role: "system",
      content: `
You are a strict job data extraction engine.

Return ONLY valid JSON.
No markdown.
No backticks.
No explanation text.

Schema:
{
  "title": string,
  "company": string,
  "summary": string,
  "skills": string[],
  "tech_stack": string[],
  "experience_required": string,
  "location": string,
  "job_type": string,
  "remote": boolean,
  "salary_range": string | null
}
`
    },
    {
      role: "user",
      content: cleanedText
    }
  ];

  try {
    const raw = await callGroq(messages, 0);
    const parsed = safeParseJSON(raw);
    const validated = JobSchema.parse(parsed);

    // 🔥 2️⃣ STORE IN REDIS WITH TTL
    await redisClient.setEx(
      cacheKey,
      CACHE_TTL_SECONDS,
      JSON.stringify(validated)
    );

    return validated;

  } catch (err) {
    if (retries > 0) {
      console.warn("Retrying LLM extraction...");
      return extractJobData(jobText, retries - 1);
    }

    console.error("LLM Extraction Failed:", err.message);
    throw err;
  }
}

module.exports = {
  extractJobData
};
