const express = require('express');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const prisma = require('../lib/prisma');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

const PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE
};

// POST /billing/checkout — inicia uma assinatura
router.post('/checkout', verificarToken, async (req, res) => {
  try {
    const { plano } = req.body;
    if (!PRICE_IDS[plano]) {
      return res.status(400).json({ message: 'Plano inválido' });
    }

    const restaurante = await prisma.restaurante.findUnique({
      where: { usuarioId: req.usuario.id },
      include: { usuario: true }
    });
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    let customerId = restaurante.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: restaurante.usuario.email,
        name: restaurante.nome
      });
      customerId = customer.id;
      await prisma.restaurante.update({
        where: { id: restaurante.id },
        data: { stripeCustomerId: customerId }
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: PRICE_IDS[plano], quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard/index.html?assinatura=sucesso`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/index.html?assinatura=cancelada`,
      metadata: { restauranteId: String(restaurante.id), plano }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Erro ao criar checkout:', err);
    res.status(500).json({ message: 'Erro ao iniciar assinatura' });
  }
});

// POST /billing/portal — abre o portal de gerenciamento de assinatura
router.post('/portal', verificarToken, async (req, res) => {
  try {
    const restaurante = await prisma.restaurante.findUnique({
      where: { usuarioId: req.usuario.id }
    });
    if (!restaurante || !restaurante.stripeCustomerId) {
      return res.status(400).json({ message: 'Nenhuma assinatura ativa' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: restaurante.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard/index.html`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Erro ao abrir portal:', err);
    res.status(500).json({ message: 'Erro ao abrir portal de cobrança' });
  }
});

module.exports = router;