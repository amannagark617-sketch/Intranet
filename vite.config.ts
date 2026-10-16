import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { GoogleGenAI } from '@google/genai';

function geminiApiPlugin(geminiKey?: string): Plugin {
  return {
    name: 'gemini-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/gemini/chat' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { message, history, context, uploadedDataset } = JSON.parse(body || '{}');
              const apiKey = geminiKey || process.env.GEMINI_API_KEY || process.env.API_KEY || '';
              if (!apiKey) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured', fallback: true }));
                return;
              }

              const ai = new GoogleGenAI({
                apiKey,
                httpOptions: {
                  headers: {
                    'User-Agent': 'aistudio-build',
                  }
                }
              });

              let prompt = `You are a helpful and concise operations assistant for Little Nap Recliners.\n`;
              prompt += `Answer the user's question directly, clearly, and specifically. Do NOT provide unsolicited background summaries, do NOT dump long lists or complex tables unless explicitly asked, and keep your answer short (1-3 sentences or a quick bulleted answer).\n\n`;

              if (uploadedDataset) {
                prompt += `=== USER UPLOADED FILE: ${uploadedDataset.fileName} (${uploadedDataset.rowCount} rows) ===\n`;
                prompt += `Columns: ${uploadedDataset.columns?.join(', ')}\n`;
                prompt += `Preview Data:\n${JSON.stringify(uploadedDataset.previewRows?.slice(0, 50), null, 2)}\n\n`;
              }

              if (context) {
                prompt += `=== FACTORY DATA CONTEXT ===\n`;
                prompt += `${JSON.stringify(context, null, 2)}\n\n`;
              }

              if (history && history.length > 0) {
                prompt += `=== RECENT CONVERSATION ===\n`;
                history.slice(-6).forEach((h: any) => {
                  prompt += `${h.author === 'user' ? 'User' : 'Assistant'}: ${h.content}\n`;
                });
                prompt += `\n`;
              }

              prompt += `=== USER QUESTION ===\n${message}\n\n`;
              prompt += `Give a direct, simple, and specific answer. If asked about a single order or item, state only its current status, stage, and owner clearly without extra padding.`;

              const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: prompt,
                config: {
                  systemInstruction: "You are a clean, concise plant assistant. Answer questions directly in 1-3 simple sentences. Do not dump unnecessary data, metrics, or jargon."
                }
              });

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ text: response.text || '' }));
            } catch (err: any) {
              console.error('Error in /api/gemini/chat middleware:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Internal error in Gemini generation', fallback: true }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const geminiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), geminiApiPlugin(geminiKey)],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
