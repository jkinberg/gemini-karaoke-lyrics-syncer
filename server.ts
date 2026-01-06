import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from the Vite build
// Use process.cwd() to find dist - works in both dev (tsx) and prod (node dist-server/server.js)
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

// Parse JSON bodies - increase limit for audio files (base64 encoded)
app.use(express.json({ limit: '100mb' }));

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Gemini API proxy endpoint
app.post('/api/gemini', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY environment variable is not set');
      res.status(500).json({ error: 'API key not configured on server' });
      return;
    }

    const { model, contents, config } = req.body;

    if (!model || !contents) {
      res.status(400).json({ error: 'Missing required fields: model and contents' });
      return;
    }

    console.log(`[Gemini Proxy] Request received for model: ${model}`);

    const ai = new GoogleGenAI({ apiKey });

    const result = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Gemini Proxy] Response received in ${duration}s`);

    // Return the response text directly
    res.json({
      text: result.text,
      // Include candidates for additional metadata if needed
      candidates: result.candidates,
    });

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[Gemini Proxy] Error after ${duration}s:`, error);

    // Parse error message for client
    let errorMessage = 'Gemini API request failed';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    res.status(500).json({ error: errorMessage });
  }
});

// SPA fallback - serve index.html for all other routes
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API Key configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`);
});
