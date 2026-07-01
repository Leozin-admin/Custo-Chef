const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const prisma = require('./lib/prisma');

async function webhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const restauranteId = session.metadata.restauranteId;
        const plano = session.metadata.plano;

        await prisma.restaurante.update({
          where: { id: parseInt(restauranteId) },
          data: {
            plano,
            stripeCustomerId: session.customer,
            validadePlano: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000)
          }
        });
        console.log(`✅ Restaurante ${restauranteId} assinou o plano ${plano}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const restaurante = await prisma.restaurante.findFirst({
          where: { stripeCustomerId: subscription.customer }
        });
        if (restaurante) {
          await prisma.restaurante.update({
            where: { id: restaurante.id },
            data: { plano: 'free', validadePlano: null }
          });
          console.log(`⚠️ Restaurante ${restaurante.id} voltou pro plano free`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const restaurante = await prisma.restaurante.findFirst({
          where: { stripeCustomerId: invoice.customer }
        });
        if (restaurante) {
          await prisma.restaurante.update({
            where: { id: restaurante.id },
            data: { validadePlano: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000) }
          });
        }
        break;
      }
    }
  } catch (err) {
    console.error('Erro ao processar webhook:', err);
  }

  res.json({ received: true });
}

module.exports = { webhookHandler };