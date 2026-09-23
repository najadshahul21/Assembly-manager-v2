import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Health check endpoint
app.get('/healthz', (_req, res) => {
  res.status(200).send('OK');
});

// Serve static assets from Vite build
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback to index.html for React SPA router
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Primary port: AI Studio Cloud Run Nginx reverse-proxies to 3000
const PRIMARY_PORT = 3000;
const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;

// Determine target port: if envPort is explicitly provided and not 8080 (which is used by nginx), use it;
// otherwise default to 3000 to accept traffic from nginx.
const targetPort = envPort && envPort !== 8080 ? envPort : PRIMARY_PORT;

const primaryServer = app.listen(targetPort, '0.0.0.0', () => {
  console.log(`Server listening on port ${targetPort}`);
});

primaryServer.on('error', (err) => {
  console.error(`Error on primary port ${targetPort}:`, err);
});

// If PORT environment variable is set to a different port (e.g., 8080 in environments without nginx),
// attempt to listen there too, gracefully ignoring EADDRINUSE if nginx is already bound.
if (envPort && envPort !== targetPort) {
  const secondaryServer = app.listen(envPort, '0.0.0.0', () => {
    console.log(`Server also listening on port ${envPort}`);
  });

  secondaryServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${envPort} is already in use by reverse proxy/nginx. Serving on port ${targetPort}.`);
    } else {
      console.error(`Secondary server error on port ${envPort}:`, err);
    }
  });
}
