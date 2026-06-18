import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Setup Gemini client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey || "MOCK_KEY_IF_UNDEFINED",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API chat route FIRST
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid request. messages array is required." });
      }

      // Safeguard in case GEMINI_API_KEY is not defined yet
      if (!process.env.GEMINI_API_KEY) {
        return res.json({ 
          text: "Greetings, collector! I am ARCANE.ai, fully active and ready to guide you. However, the `GEMINI_API_KEY` secret is not configured. Please open **Settings > Secrets** in the top navigation menu, add `GEMINI_API_KEY` with your Gemini API key, and restart the developer server. I will then have full cognitive intelligence!" 
        });
      }

      // Convert format to SDK compatible format: { role: string, parts: [{ text: string }] }
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: [{ text: m.content || m.text || "" }]
      }));

      // Set a robust system instruction
      const systemInstruction = 
        "You are ARCANE.ai, an elegant, omniscient cyber-wizard intelligence specialized in the Arcane Card Game and NFT ecosystem. " +
        "You are wise, futuristic, incredibly helpful, and a bit magical. Speak with clarity, occasional digital wizardry terminologies, " +
        "and maintain high visual formatting (use bullet points, elegant paragraphs, short code snippets). " +
        "Answer questions about cards, blockchain, tactics, lore, or general chat beautifully.";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      res.status(500).json({ error: err.message || "Something went wrong in the AI mainframe." });
    }
  });

  // Serve raw media files from /media path
  app.use('/media', express.static(path.join(process.cwd(), 'media')));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
