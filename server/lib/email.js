/**
 * "Envio" de email simulado. Loga no console.
 * Em produção, trocar por nodemailer / SendGrid / Resend.
 */
async function enviarEmail(destinatario, assunto, corpo) {
  console.log('\n📧 ============ EMAIL ENVIADO ============');
  console.log('Para:', destinatario);
  console.log('Assunto:', assunto);
  console.log('Corpo:');
  console.log(corpo);
  console.log('=========================================\n');
  return { ok: true };
}

module.exports = { enviarEmail };
