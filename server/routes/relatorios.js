const express = require('express');
const prisma = require('../lib/prisma');
const { verificarToken } = require('../middleware/auth');
const { cmv: calcCmv, margem: calcMargem, classificarMargem } = require('../lib/calculos');
const { buildPdf } = require('../lib/pdf');
const { buildXls } = require('../lib/excel');

const router = express.Router();

async function getRestaurante(usuarioId) {
  return prisma.restaurante.findUnique({ where: { usuarioId } });
}

function brl(v) {
  return `R$ ${(parseFloat(v) || 0).toFixed(2).replace('.', ',')}`;
}

function fmtMargem(v) {
  return `${(parseFloat(v) || 0).toFixed(1)}%`;
}

// GET /relatorios/ficha-tecnica/:pratoId
router.get('/ficha-tecnica/:pratoId', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const prato = await prisma.prato.findUnique({
      where: { id: parseInt(req.params.pratoId) },
      include: { fichas: { include: { ingrediente: true } } }
    });

    if (!prato || prato.restauranteId !== restaurante.id) {
      return res.status(404).json({ message: 'Prato não encontrado' });
    }

    const cmvCalculado = calcCmv(prato.fichas);
    const margemCalculada = calcMargem(prato.precoVenda, cmvCalculado);
    const lucro = prato.precoVenda - cmvCalculado;
    const status = classificarMargem(margemCalculada);

    const secoes = [
      {
        titulo: 'Informacoes do Prato',
        linhas: [
          [`Nome: ${prato.nome}`],
          [`Descricao: ${prato.descricao || '-'}`],
          [`Categoria: ${prato.categoria || '-'}`],
          [`Tempo de preparo: ${prato.tempoPreparo || '-'} min`],
          [`Rendimento: ${prato.rendimento || 1} porcoes`],
          [`Preco de venda: ${brl(prato.precoVenda)}`]
        ]
      },
      {
        titulo: 'Ficha Tecnica',
        linhas: [
          [{ separador: true }],
          [`${'Ingrediente'.padEnd(28)} ${'Qtd'.padStart(8)} ${'Un'.padStart(6)} ${'Preco un'.padStart(12)} ${'Custo'.padStart(12)}`],
          [{ separador: true }]
        ]
      }
    ];

    prato.fichas.forEach(f => {
      const custo = f.quantidade * f.ingrediente.precoPorUnidade;
      secoes[1].linhas.push([
        `${f.ingrediente.nome.padEnd(28)} ${String(f.quantidade).padStart(8)} ${(f.ingrediente.unidade || '').padStart(6)} ${brl(f.ingrediente.precoPorUnidade).padStart(12)} ${brl(custo).padStart(12)}`
      ]);
    });

    secoes.push({
      titulo: 'Resultado',
      linhas: [
        [{ separador: true }],
        [`CMV (Custo de Mercadoria Vendida): ${brl(cmvCalculado)}`],
        [`Lucro por porcao: ${brl(lucro)}`],
        [`Margem de contribuicao: ${fmtMargem(margemCalculada)}`],
        [`Classificacao: ${status.label}`]
      ]
    });

    const pdf = buildPdf(`Ficha Tecnica - ${prato.nome}`, secoes);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="ficha-tecnica-${prato.nome.replace(/\s+/g, '-')}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('Erro em /relatorios/ficha-tecnica:', err);
    res.status(500).json({ message: 'Erro ao gerar relatório' });
  }
});

// GET /relatorios/cardapio
router.get('/cardapio', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const pratos = await prisma.prato.findMany({
      where: { restauranteId: restaurante.id },
      include: { fichas: { include: { ingrediente: true } } },
      orderBy: { categoria: 'asc' }
    });

    const secoes = [{
      titulo: 'Cardapio - ' + restaurante.nome,
      linhas: []
    }];

    let categoriaAtual = null;
    pratos.forEach(p => {
      if (p.categoria !== categoriaAtual) {
        categoriaAtual = p.categoria;
        if (categoriaAtual) secoes[0].linhas.push([`>> ${categoriaAtual}`, 12, 0, true]);
      }
      const cmv = calcCmv(p.fichas);
      const margem = calcMargem(p.precoVenda, cmv);
      secoes[0].linhas.push([
        `${p.nome.padEnd(30)} ${brl(p.precoVenda).padStart(12)}   CMV: ${brl(cmv)}   Margem: ${fmtMargem(margem)}`
      ]);
      if (p.descricao) {
        secoes[0].linhas.push([`    ${p.descricao}`, 9]);
      }
    });

    if (pratos.length === 0) {
      secoes[0].linhas.push(['Nenhum prato cadastrado.']);
    }

    const pdf = buildPdf('Cardapio', secoes);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="cardapio.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('Erro em /relatorios/cardapio:', err);
    res.status(500).json({ message: 'Erro ao gerar cardápio' });
  }
});

// GET /relatorios/exportar?formato=excel|csv
router.get('/exportar', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const { formato = 'excel' } = req.query;

    const [ingredientes, pratos] = await Promise.all([
      prisma.ingrediente.findMany({ where: { restauranteId: restaurante.id }, include: { fornecedor: true } }),
      prisma.prato.findMany({
        where: { restauranteId: restaurante.id },
        include: { fichas: { include: { ingrediente: true } } }
      })
    ]);

    const pratosComCalculo = pratos.map(p => {
      const cmv = calcCmv(p.fichas);
      return { ...p, cmv, margem: calcMargem(p.precoVenda, cmv) };
    });

    if (formato === 'csv') {
      // CSV de pratos
      const csvRows = [
        ['Nome', 'Categoria', 'Preco Venda', 'CMV', 'Margem %']
      ];
      pratosComCalculo.forEach(p => {
        csvRows.push([p.nome, p.categoria || '', p.precoVenda.toFixed(2), p.cmv.toFixed(2), p.margem.toFixed(1)]);
      });

      const csv = csvRows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="cardapio.csv"`);
      return res.send(csv);
    }

    // Excel (XLS) com 2 planilhas
    const ingRows = [
      ['Nome', 'Unidade', 'Preco/un', 'Estoque atual', 'Estoque minimo', 'Categoria', 'Fornecedor']
    ];
    ingredientes.forEach(i => {
      ingRows.push([i.nome, i.unidade, i.precoPorUnidade, i.estoqueAtual, i.estoqueMinimo, i.categoria || '', i.fornecedor?.nome || '']);
    });

    const pratoRows = [
      ['Nome', 'Categoria', 'Preco Venda', 'CMV', 'Margem %', 'Status']
    ];
    pratosComCalculo.forEach(p => {
      const status = classificarMargem(p.margem);
      pratoRows.push([p.nome, p.categoria || '', p.precoVenda, p.cmv, p.margem.toFixed(1), status.label]);
    });

    const xls = buildXls([
      { name: 'Ingredientes', rows: ingRows },
      { name: 'Pratos', rows: pratoRows }
    ]);

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio.xls"`);
    res.send(xls);
  } catch (err) {
    console.error('Erro em /relatorios/exportar:', err);
    res.status(500).json({ message: 'Erro ao exportar relatório' });
  }
});

module.exports = router;
