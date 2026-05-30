// server.ts
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import os from "os";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Set up Groq Client
  const apiKey = process.env.GROQ_API_KEY;
  const groq = new Groq({ apiKey: apiKey || "dummy" });

  // API routing
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      if (!apiKey) {
        return res.status(500).json({ error: "Missing GROQ_API_KEY" });
      }
      
      const { systemInstruction, history, message } = req.body;
      
      // Convert history to Groq format
      const messages = [];
      if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
      }

      if (history && Array.isArray(history)) {
        for (const msg of history) {
          const role = msg.role === 'model' ? 'assistant' : msg.role;
          const content = msg.parts ? msg.parts[0].text : (msg.content || "");
          messages.push({ role, content });
        }
      }

      messages.push({ role: "user", content: message });

      const completion = await groq.chat.completions.create({
        messages,
        model: "llama-3.3-70b-versatile",
      });

      res.json({ text: completion.choices[0]?.message?.content || "" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

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
    // Mendapatkan alamat IP lokal untuk ditampilkan
    const interfaces = os.networkInterfaces();
    let localIp = '127.0.0.1';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
        }
      }
    }

    console.log(`\n🚀 Tallyfy POS Server is up and running!\n`);
    console.log(`   ➜  Local:   http://localhost:${PORT}`);
    console.log(`   ➜  Network: http://${localIp}:${PORT}\n`);
  });
}

startServer();
