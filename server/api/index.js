/**
 * Vercel serverless entry point.
 * Exposes the same Express app that `npm start` runs, so the API behaves
 * identically whether it is deployed to Render, a VPS or Vercel Functions.
 */
import { createApp } from '../src/app.js';

const app = createApp();

export default app;
