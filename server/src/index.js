import 'dotenv/config';
import { createApp } from './app.js';
import { isSupabaseConfigured } from './lib/db.js';
import { isGeminiConfigured } from './lib/ai.js';

const app = createApp();
const PORT = Number(process.env.PORT) || 8787;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Student Wallet AI API listening on http://0.0.0.0:${PORT}`);
  console.log(`  database: ${isSupabaseConfigured() ? 'configured' : 'NOT CONFIGURED'}`);
  console.log(`  ai:       ${isGeminiConfigured() ? 'configured' : 'NOT CONFIGURED'}`);
});
