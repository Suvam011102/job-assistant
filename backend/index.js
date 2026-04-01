require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { extractJobData, generateJobAdvice } = require("./llm");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ message: "Backend running successfully" });
});

app.post("/summarize", async (req, res) => {
  const { jobText } = req.body || {};

  if (!jobText || !jobText.trim()) {
    return res.status(400).json({ error: "No job text provided" });
  }

  try {
    const result = await extractJobData(jobText);
    return res.json({ result });
  } catch (error) {
    console.error("Groq summarize error:", error.response?.data || error.message);

    const statusCode = error.message === "GROQ_API_KEY is not configured" ? 500 : 502;
    return res.status(statusCode).json({
      error: statusCode === 500 ? "Server is missing GROQ_API_KEY" : "Groq summarize request failed",
    });
  }
});

app.post("/job-advice", async (req, res) => {
  const { jobText, jobSummary } = req.body || {};

  if (!jobText || !jobText.trim()) {
    return res.status(400).json({ error: "Job text required" });
  }

  try {
    const advice = await generateJobAdvice(jobText, jobSummary);
    return res.json({ advice });
  } catch (error) {
    console.error("Job advice error:", error.response?.data || error.message);

    const statusCode = error.message === "GROQ_API_KEY is not configured" ? 500 : 502;
    return res.status(statusCode).json({
      error: statusCode === 500 ? "Server is missing GROQ_API_KEY" : "Advice generation failed",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
