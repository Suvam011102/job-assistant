require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= ROOT ================= */

app.get("/", (req, res) => {
  res.json({ message: "Backend running successfully" });
});

/* ================= SUMMARIZE JOB ================= */

app.post("/summarize", async (req, res) => {
  try {
    const { jobText } = req.body;

    if (!jobText || jobText.trim().length === 0) {
      return res.status(400).json({ error: "No job text provided" });
    }

    const groqResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `
You are an expert job listing analyzer.

Extract structured data from the job listing.

Return STRICT JSON only in this format:

{
  "title": "",
  "company": "",
  "summary": "",
  "skills": [],
  "tech_stack": [],
  "experience_required": "",
  "location": "",
  "job_type": ""
}
`,
          },
          {
            role: "user",
            content: jobText,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = groqResponse.data.choices[0].message.content;

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { raw: content };
    }

    res.json({ result: parsed });

  } catch (error) {
    console.error("Groq summarize error:", error.response?.data || error.message);
    res.status(500).json({ error: "Groq summarize request failed" });
  }
});

/* ================= JOB ADVICE ================= */

app.post("/job-advice", async (req, res) => {
  try {

    const { jobText, jobSummary } = req.body;

    if (!jobText) {
      return res.status(400).json({ error: "Job text required" });
    }

    const summaryString = JSON.stringify(jobSummary || {}, null, 2);

    const prompt = `
JOB SUMMARY:
${summaryString}

JOB DESCRIPTION:
${jobText}
`;

    const groqResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `
You are a senior tech recruiter and career advisor.

Analyze the job posting and provide preparation advice for a candidate.

Return STRICT JSON in this format:

{
  "company_insight": "",
  "key_strengths_to_highlight": [],
  "important_topics_to_prepare": [],
  "likely_interview_focus": [],
  "recommended_preparation_steps": [],
  "resume_focus": [],
  "questions_to_ask_interviewer": []
}
`
          },
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const content = groqResponse.data.choices[0].message.content;

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { raw: content };
    }

    res.json({ advice: parsed });

  } catch (error) {
    console.error("Job advice error:", error.response?.data || error.message);
    res.status(500).json({ error: "Advice generation failed" });
  }
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
