/**
 * Envio de email.
 * - Com RESEND_API_KEY definida, usa o pacote `resend` (produção).
 * - Sem RESEND_API_KEY, cai num fallback que loga no console (dev local).
 */

let resendClient = null;

function getClient() {
  if (resendClient !== null) return resendClient;
  if (!process.env.RESEND_API_KEY) return null;
  const { Resend } = require('resend');
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

async function enviarEmail(destinatario, assunto, corpo) {
  const from = process.env.EMAIL_FROM || 'CustoChef <onboarding@resend.dev>';

  // Fallback: dev local sem chave. Loga no console.
  const client = getClient();
  if (!client) {
    console.log('\n📧 ============ EMAIL (modo console) ============');
    console.log('De:', from);
    console.log('Para:', destinatario);
    console.log('Assunto:', assunto);
    console.log('Corpo:');
    console.log(corpo);
    console.log('===============================================\n');
    return { ok: true, mode: 'console' };
  }

  try {
    const { data, error } = await client.emails.send({
      from,
      to: destinatario,
      subject: assunto,
      text: corpo,
    });
    if (error) {
      console.error('[email] Resend devolveu erro:', error);
      return { ok: false, error };
    }
    console.log('[email] Enviado id:', data?.id);
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error('[email] Falha ao enviar via Resend:', err);
    return { ok: false, error: err };
  }
}

module.exports = { enviarEmail };
