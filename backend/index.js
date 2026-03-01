require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Backend running successfully" });
});

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
`
          },
          {
            role: "user",
            content: jobText
          }
        ],
        temperature: 0.3
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
    } catch (err) {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { raw: content };
    }

    res.json({ result: parsed });

  } catch (error) {
    console.error("Groq error:", error.response?.data || error.message);
    res.status(500).json({ error: "Groq request failed" });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 5000}`);
});