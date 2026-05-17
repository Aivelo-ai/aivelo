require('dotenv').config();
const express = require('express');
const cors = require('cors');

const qualificationRoute = require('./routes/qualification');
const annoncesRoute = require('./routes/annonces');
const relancesRoute = require('./routes/relances');
const matchingRoute = require('./routes/matching');
const importBienRoute = require('./routes/importBien');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'https://aivelo.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
}));
app.use(express.json({ limit: '10mb' }));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/qualify', qualificationRoute);
app.use('/api/annonces', annoncesRoute);
app.use('/api/relances', relancesRoute);
app.use('/api/matching', matchingRoute);
app.use('/api/import-bien', importBienRoute);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    agents: ['qualification', 'annonces', 'relances', 'matching', 'import-bien'],
    timestamp: new Date().toISOString(),
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

app.listen(PORT, () => {
  console.log(`🚀 Aivelo Backend — http://localhost:${PORT}`);
  console.log(`   Agent 1 Qualification : POST /api/qualify`);
  console.log(`   Agent 4 Matching      : POST /api/matching`);
  console.log(`   Agent 5 Import Bien   : POST /api/import-bien`);
  console.log(`   Health check          : GET  /health`);
});

module.exports = app;
