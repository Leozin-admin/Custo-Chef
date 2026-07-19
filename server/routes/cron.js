const express = require('express');
const { enviarRelatoriosPendentes } = require('../jobs/enviarRelatorios');

const router = express.Router();

// POST /cron/relatorios — protegido por chave secreta (não usa login normal)
router.post('/relatorios', async (req, res) => {
  const chave = req.headers['x-cron-secret'];
  if (!chave || chave !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  try {
    const resultado = await enviarRelatoriosPendentes();
    res.json({ message: 'Job executado', ...resultado });
  } catch (err) {
    console.error('Erro no job de relatórios:', err);
    res.status(500).json({ message: 'Erro ao executar job' });
  }
});

module.exports = router;