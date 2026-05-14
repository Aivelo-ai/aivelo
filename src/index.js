require('dotenv').config();
const express = require('express');
const cors = require('cors');

const qualificationRoute = require('./routes/qualification');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'https://aivelo.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
}));
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/qualify', qualificationRoute);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    agents: ['qualification'],
    timestamp: new Date().toISOString(),
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

app.listen(PORT, () => {
  console.log(`🚀 Aivelo Backend — http://localhost:${PORT}`);
  console.log(`   Agent 1 Qualification : POST /api/qualify`);
  console.log(`   Health check          : GET  /health`);
});

module.exports = app;
