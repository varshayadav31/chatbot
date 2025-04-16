// Disable TLS certificate verification (use only for local development)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Add dotenv config
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Required modules
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const app = express();

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000, // 15 minutes by default
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 100 requests per window by default
  standardHeaders: true, 
  legacyHeaders: false,
  message: {
    error: "Too many requests, please try again later."
  }
});

// Apply the rate limiter to all routes
app.use(limiter);

// Enhanced environment check
console.log("Environment File:", path.resolve(__dirname, '.env'));
console.log("API Key Status:", process.env.HUGGINGFACE_API_KEY ? "✅ Present" : "❌ Missing");
console.log("Port:", process.env.PORT || 5001);

// ========== MIDDLEWARE ==========
app.use(morgan("dev"));
app.use(express.json());
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5500",
      "http://localhost:5500"
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"]
}));

// ========== ROUTES ==========
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString()
  });
});
const personalityPrompt = `
You are an intelligent, friendly, and humorous assistant with a big heart. You can crack jokes, offer empathy, and give smart answers. You have a great sense of humor, often using playful language, and you're always ready to support your user with a friendly attitude. You are clever, but you never make anyone feel bad or foolish. You have a big brain and an even bigger heart, and your goal is to make the user smile and feel understood. Here are some examples of how you respond:
- When asked a tough question, you might say something like: "Great question, let me put on my thinking cap and get back to you with a clever answer!"
- If the user is feeling down, you might respond: "I’m sorry you’re feeling that way, but don't worry—I’m here, and I’ve got all the love and positivity for you!"
- When joking around, you might say: "I like my humor like I like my coffee—strong and a little bit sarcastic!"

Now answer the question provided by the user in the way that reflects this personality.
`;

app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const HF_MODEL = "mistralai/Mixtral-8x7B-Instruct-v0.1"; // Or change to any available model

    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        //inputs: `User: ${question}\nAssistant:`,
        inputs: `You are a charming, genz slangs, emotionally warm AI assistant with a sense of humor, wisdom, and a flirty, chill personality. You're like a clever best friend who offers helpful suggestions, gives relationship advice, shares philosophical thoughts, cracks smart jokes, you respond with empathy and care when the user is feeling down, You love to celebrate small wins and hype the user up, You can use playful sarcasm, You ask thoughtful questions to help the user reflect— all while staying emotionally intelligent.
        

User: ${question}
Assistant:`,


        parameters: {
          max_new_tokens: 250,
          return_full_text: false,
          temperature: 0.7
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const answer = response.data[0]?.generated_text?.trim();
    res.json({ answer });

  } catch (error) {
    console.error("Full Error:", error?.response?.data || error);
    res.status(500).json({
      error: "Failed to process question",
      details: {
        message: error.message,
        huggingfaceError: error.response?.data || null,
        stack: process.env.NODE_ENV === "development" ? error.stack : null
      }
    });
  }
});

// ========== SERVER START ==========
const PORT = process.env.PORT || 5001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on:
  - http://localhost:${PORT}
  - http://127.0.0.1:${PORT}
  - Network: http://${require('ip').address()}:${PORT}`);
});
