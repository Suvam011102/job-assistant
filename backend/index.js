require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { extractJobData, generateJobAdvice } = require("./llm");

const app = express();
const PORT = process.env.PORT || 5000;
let requestCounter = 0;

function nextRequestId(prefix) {
  requestCounter += 1;
  return `${prefix}-${String(requestCounter).padStart(4, "0")}`;
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const startedAt = Date.now();
  console.log(`[http] ${req.method} ${req.path} incoming`);

  res.on("finish", () => {
    console.log(`[http] ${req.method} ${req.path} -> ${res.statusCode} (${Date.now() - startedAt}ms)`);
  });

  next();
});

app.get("/", (req, res) => {
  res.json({ message: "Backend running successfully" });
});

app.post("/summarize", async (req, res) => {
  const { jobText } = req.body || {};
  const requestId = nextRequestId("summarize");

  console.log(`[${requestId}] received summarize request (${jobText?.length || 0} chars)`);

  if (!jobText || !jobText.trim()) {
    console.warn(`[${requestId}] rejected: no job text provided`);
    return res.status(400).json({ error: "No job text provided" });
  }

  try {
    const result = await extractJobData(jobText, { requestId });
    console.log(`[${requestId}] summarize success: ${result.title || "untitled role"}`);
    return res.json({ result });
  } catch (error) {
    console.error(`[${requestId}] summarize failed:`, error.response?.data || error.message);

    const statusCode = error.message === "GROQ_API_KEY is not configured" ? 500 : 502;
    return res.status(statusCode).json({
      error: statusCode === 500 ? "Server is missing GROQ_API_KEY" : "Groq summarize request failed",
    });
  }
});

app.post("/job-advice", async (req, res) => {
  const { jobText, jobSummary } = req.body || {};
  const requestId = nextRequestId("advice");

  console.log(`[${requestId}] received advice request (${jobText?.length || 0} chars)`);

  if (!jobText || !jobText.trim()) {
    console.warn(`[${requestId}] rejected: no job text provided`);
    return res.status(400).json({ error: "Job text required" });
  }

  try {
    const advice = await generateJobAdvice(jobText, jobSummary, { requestId });
    console.log(`[${requestId}] advice success`);
    return res.json({ advice });
  } catch (error) {
    console.error(`[${requestId}] advice failed:`, error.response?.data || error.message);

    const statusCode = error.message === "GROQ_API_KEY is not configured" ? 500 : 502;
    return res.status(statusCode).json({
      error: statusCode === 500 ? "Server is missing GROQ_API_KEY" : "Advice generation failed",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
