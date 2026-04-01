const axios = require("axios");
const crypto = require("crypto");
const { z } = require("zod");
const { getCachedValue, setCachedValue } = require("./redisClient");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const CACHE_TTL_SECONDS = 600;
const MAX_JOB_TEXT_LENGTH = 12000;

const JobSchema = z.object({
  title: z.string(),
  company: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  tech_stack: z.array(z.string()),
  experience_required: z.string(),
  location: z.string(),
  job_type: z.string(),
  remote: z.boolean().default(false),
  salary_range: z.string().nullable().default(null),
});

const AdviceSchema = z.object({
  company_insight: z.string(),
  key_strengths_to_highlight: z.array(z.string()),
  important_topics_to_prepare: z.array(z.string()),
  likely_interview_focus: z.array(z.string()),
  recommended_preparation_steps: z.array(z.string()),
  resume_focus: z.array(z.string()),
  questions_to_ask_interviewer: z.array(z.string()),
});

function requireGroqApiKey() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }
}

function cleanJobText(text = "") {
  return text
    .replace(/Privacy Policy[\s\S]*/gi, "")
    .replace(/Terms of Service[\s\S]*/gi, "")
    .replace(/Apply Now[\s\S]*/gi, "")
    .trim()
    .slice(0, MAX_JOB_TEXT_LENGTH);
}

function createCacheKey(prefix, value) {
  const digest = crypto.createHash("sha256").update(value).digest("hex");
  return `${prefix}:${digest}`;
}

async function callGroq(messages, temperature = 0) {
  requireGroqApiKey();

  const response = await axios.post(
    GROQ_URL,
    {
      model: GROQ_MODEL,
      messages,
      temperature,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  return response.data.choices?.[0]?.message?.content || "";
}

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

async function requestStructuredData({ cacheKey, schema, messages, temperature = 0, retries = 1 }) {
  if (cacheKey) {
    const cached = await getCachedValue(cacheKey);
    if (cached) {
      return schema.parse(JSON.parse(cached));
    }
  }

  try {
    const raw = await callGroq(messages, temperature);
    const parsed = safeParseJSON(raw);
    const validated = schema.parse(parsed);

    if (cacheKey) {
      await setCachedValue(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(validated));
    }

    return validated;
  } catch (error) {
    if (retries > 0) {
      console.warn("Retrying Groq request...");
      return requestStructuredData({
        cacheKey,
        schema,
        messages,
        temperature,
        retries: retries - 1,
      });
    }

    throw error;
  }
}

async function extractJobData(jobText) {
  const cleanedText = cleanJobText(jobText);
  const cacheKey = createCacheKey("job", cleanedText);

  return requestStructuredData({
    cacheKey,
    schema: JobSchema,
    messages: [
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
`,
      },
      {
        role: "user",
        content: cleanedText,
      },
    ],
  });
}

async function generateJobAdvice(jobText, jobSummary = {}) {
  const cleanedText = cleanJobText(jobText);
  const summaryString = JSON.stringify(jobSummary, null, 2);
  const cacheKey = createCacheKey("advice", `${cleanedText}:${summaryString}`);

  return requestStructuredData({
    cacheKey,
    schema: AdviceSchema,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: `
You are a senior tech recruiter and career advisor.

Analyze the job posting and provide preparation advice for a candidate.

Return ONLY valid JSON in this format:
{
  "company_insight": string,
  "key_strengths_to_highlight": string[],
  "important_topics_to_prepare": string[],
  "likely_interview_focus": string[],
  "recommended_preparation_steps": string[],
  "resume_focus": string[],
  "questions_to_ask_interviewer": string[]
}
`,
      },
      {
        role: "user",
        content: `
JOB SUMMARY:
${summaryString}

JOB DESCRIPTION:
${cleanedText}
`,
      },
    ],
  });
}

module.exports = {
  extractJobData,
  generateJobAdvice,
};
