const axios = require("axios");
const crypto = require("crypto");
const { z } = require("zod");
const { getCachedValue, setCachedValue } = require("./redisClient");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const CACHE_TTL_SECONDS = 600;
const MAX_JOB_TEXT_LENGTH = 12000;

function log(requestId, message) {
  const prefix = requestId ? `[${requestId}]` : "[llm]";
  console.log(`${prefix} ${message}`);
}

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

async function callGroq(messages, temperature = 0, requestId) {
  requireGroqApiKey();
  log(requestId, `calling Groq model=${GROQ_MODEL} temperature=${temperature}`);

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

  log(requestId, `Groq responded with status ${response.status}`);
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

async function requestStructuredData({
  cacheKey,
  schema,
  messages,
  temperature = 0,
  retries = 1,
  requestId,
}) {
  if (cacheKey) {
    const cached = await getCachedValue(cacheKey);
    if (cached) {
      log(requestId, `cache hit for ${cacheKey}`);
      return schema.parse(JSON.parse(cached));
    }

    log(requestId, `cache miss for ${cacheKey}`);
  }

  try {
    const raw = await callGroq(messages, temperature, requestId);
    const parsed = safeParseJSON(raw);
    log(requestId, "Groq response parsed as JSON");
    const validated = schema.parse(parsed);
    log(requestId, "schema validation passed");

    if (cacheKey) {
      await setCachedValue(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(validated));
      log(requestId, `cache store attempted for ${cacheKey}`);
    }

    return validated;
  } catch (error) {
    if (retries > 0) {
      console.warn(`[${requestId || "llm"}] retrying Groq request...`);
      return requestStructuredData({
        cacheKey,
        schema,
        messages,
        temperature,
        retries: retries - 1,
        requestId,
      });
    }

    throw error;
  }
}

async function extractJobData(jobText, { requestId } = {}) {
  const cleanedText = cleanJobText(jobText);
  const cacheKey = createCacheKey("job", cleanedText);
  log(requestId, `extracting job data (${cleanedText.length} cleaned chars)`);

  return requestStructuredData({
    cacheKey,
    schema: JobSchema,
    requestId,
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

async function generateJobAdvice(jobText, jobSummary = {}, { requestId } = {}) {
  const cleanedText = cleanJobText(jobText);
  const summaryString = JSON.stringify(jobSummary, null, 2);
  const cacheKey = createCacheKey("advice", `${cleanedText}:${summaryString}`);
  log(requestId, `generating advice (${cleanedText.length} cleaned chars)`);

  return requestStructuredData({
    cacheKey,
    schema: AdviceSchema,
    temperature: 0.4,
    requestId,
    messages: [
      {
        role: "system",
        content: `
You are a senior tech recruiter and career advisor.

Analyze the job posting and provide high-signal preparation advice for a candidate.

Your advice must be specific to THIS job posting.
Do not give generic interview tips unless they clearly connect to the role.
Anchor your advice in the responsibilities, qualifications, tech stack, domain, seniority, and company context from the posting.

Quality bar:
- Be concrete and role-specific.
- Prefer 3-6 high-value items per list.
- Mention the actual technologies, team scope, systems, leadership expectations, and domain context when relevant.
- Focus on what would materially improve interview performance or resume alignment.
- Avoid filler like "be a good communicator" unless you tie it to a real responsibility in the posting.
- Infer likely interview focus areas from the job, but do not invent unsupported facts.
- When the company or domain matters, explain why it matters for this role.

Interpretation rules:
- For company_insight, summarize what the role appears to optimize for and what the company/team likely values in this job.
- For key_strengths_to_highlight, identify candidate qualities or experiences that best match the posting.
- For important_topics_to_prepare, identify technical, product, system, or leadership areas the candidate should study.
- For likely_interview_focus, predict what interviewers are most likely to probe deeply.
- For recommended_preparation_steps, give practical actions the candidate can do before interviewing.
- For resume_focus, identify what the candidate should emphasize or move higher on the resume.
- For questions_to_ask_interviewer, generate thoughtful, role-specific questions that show good judgment.

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

Create advice for a candidate applying to this role.
Assume the candidate wants actionable, specific guidance for interview preparation and resume positioning.
Return only JSON.
`,
      },
    ],
  });
}

module.exports = {
  extractJobData,
  generateJobAdvice,
};
