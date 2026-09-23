import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');
const rootIndexPath = path.join(__dirname, 'index.html');

// Health check endpoints for Cloud Run and internal probes
app.get(['/healthz', '/health', '/api/health'], (_req, res) => {
  res.status(200).send('OK');
});

// Serve static assets from Vite build output if present
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Fallback to index.html for React SPA router
app.get('*', (_req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else if (fs.existsSync(rootIndexPath)) {
    res.sendFile(rootIndexPath);
  } else {
    res.status(200).send('<!DOCTYPE html><html><head><title>Assembly Manager</title></head><body><div id="root"></div></body></html>');
  }
});

// Port configuration:
// In AI Studio Cloud Run, Nginx listens on 8080 and reverse-proxies to port 3000.
// In direct container environments, Cloud Run routes directly to process.env.PORT (8080).
const primaryPort = parseInt(process.env.DEFAULT_APP_PORT || '3000', 10);
const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;

const primaryServer = app.listen(primaryPort, '0.0.0.0', () => {
  console.log(`Server listening on port ${primaryPort}`);
});

primaryServer.on('error', (err: any) => {
  console.log(`Primary port ${primaryPort} note:`, err.message);
});

if (envPort && envPort !== primaryPort) {
  const secondaryServer = app.listen(envPort, '0.0.0.0', () => {
    console.log(`Server also listening on port ${envPort}`);
  });

  secondaryServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${envPort} handled by reverse-proxy/nginx; routing traffic to ${primaryPort}.`);
    } else {
      console.error(`Secondary port ${envPort} error:`, err);
    }
  });
}
