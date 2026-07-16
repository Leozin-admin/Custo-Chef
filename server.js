const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./server/routes/auth');
const restauranteRoutes = require('./server/routes/restaurante');
const ingredientesRoutes = require('./server/routes/ingredientes');
const pratosRoutes = require('./server/routes/pratos');
const fornecedoresRoutes = require('./server/routes/fornecedores');
const estoqueRoutes = require('./server/routes/estoque');
const dashboardRoutes = require('./server/routes/dashboard');
const simuladorRoutes = require('./server/routes/simulador');
const membrosRoutes = require('./server/routes/membros');
const relatoriosRoutes = require('./server/routes/relatorios');
const billingRoutes = require('./server/routes/billing');
const alertasRoutes = require('./server/routes/alertas');

const app = express();
const { webhookHandler } = require('./server/webhook');

app.use(cors());

// Webhook do Stripe precisa vir ANTES do express.json()
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), webhookHandler);

app.use(express.json({ limit: '5mb' }));

// Log de requisições em dev
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    if (!req.path.startsWith('/relatorios') && !req.path.startsWith('/dashboard')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
  });
}

// Rotas
app.use('/auth', authRoutes);
app.use('/restaurante', restauranteRoutes);
app.use('/ingredientes', ingredientesRoutes);
app.use('/pratos', pratosRoutes);
app.use('/fornecedores', fornecedoresRoutes);
app.use('/estoque', estoqueRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/simulador', simuladorRoutes);
app.use('/membros', membrosRoutes);
app.use('/relatorios', relatoriosRoutes);
app.use('/billing', billingRoutes);
app.use('/alertas', alertasRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ message: 'Endpoint não encontrado' });
});

// Erro genérico
app.use((err, _req, res, _next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ message: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🍳 CustoChef rodando na porta ${PORT}!`);
  console.log(`Endpoints:`);
  console.log(`  Auth:        /auth/{cadastro,login,perfil,refresh,recuperar-senha,redefinir-senha}`);
  console.log(`  Restaurante: /restaurante (GET, POST, PUT)`);
  console.log(`  Negocio:     /ingredientes, /pratos, /fornecedores, /membros`);
  console.log(`  Insights:    /estoque, /dashboard, /simulador, /relatorios, /alertas`);
  console.log(`  Billing:     /billing`);
});
