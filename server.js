import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set('trust proxy', 1);

const PORT    = process.env.PORT || 8080;
const API_URL = process.env.VITE_API_URL
             || process.env.API_URL
             || 'https://avatar-rpg-server.discloud.app'; // ← fallback hardcoded

const distPath  = join(__dirname, 'dist');
const indexPath = join(distPath, 'index.html');

if (!existsSync(indexPath)) {
  console.error('❌ FATAL: dist/index.html não encontrado!');
}

// Cabeçalhos de segurança
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ✅ /config.js — injeta a API_URL antes do React carregar
app.get('/config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.__API_URL__ = "${API_URL}"; window.__DEV__ = false;`);
});

// Arquivos estáticos
app.use(express.static(distPath, { maxAge: '1d', etag: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    apiUrl: API_URL,
    distExists: existsSync(distPath),
    indexExists: existsSync(indexPath),
    ts: new Date().toISOString(),
  });
});

// ✅ SPA fallback — injeta o config inline no HTML para garantir que
// window.__API_URL__ esteja disponível ANTES do bundle React executar
app.get('*', (req, res) => {
  if (!existsSync(indexPath)) {
    return res.status(503).send('<h1>Build não encontrado. Rode npm run build.</h1>');
  }

  try {
    let html = readFileSync(indexPath, 'utf-8');

    // Injeta o script de config inline logo após o <head>
    // Isso garante que window.__API_URL__ existe antes de qualquer JS do React
    const inlineConfig = `<script>window.__API_URL__="${API_URL}";window.__DEV__=false;</script>`;
    html = html.replace('<head>', `<head>${inlineConfig}`);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store'); // nunca cacheia o HTML
    res.send(html);
  } catch (err) {
    console.error('❌ Erro ao servir index.html:', err.message);
    res.status(500).send('Erro interno.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌍 Frontend servindo na porta ${PORT}`);
  console.log(`🔗 API URL: ${API_URL}`);
  console.log(`📁 Dist: ${distPath}`);
  console.log(`✅ index.html: ${existsSync(indexPath) ? 'encontrado' : '❌ NÃO ENCONTRADO'}`);
});
