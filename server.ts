import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');
const rootIndexPath = path.join(__dirname, 'index.html');

// Health check endpoints for Cloud Run and internal probes
app.get(['/healthz', '/health', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// In development, mount Vite's middle-wares
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      hmr: false,
    },
    appType: 'spa'
  });
  app.use(vite.middlewares);
} else {
  // Serve static assets from Vite build output if present
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }
}

// Fallback to index.html for React SPA router
app.get('*', async (req, res, next) => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      const html = fs.readFileSync(rootIndexPath, 'utf-8');
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      return;
    }

    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else if (fs.existsSync(rootIndexPath)) {
      res.sendFile(rootIndexPath);
    } else {
      res.status(200).send('<!DOCTYPE html><html><head><title>Assembly Manager</title></head><body><div id="root"></div></body></html>');
    }
  } catch (e) {
    next(e);
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
