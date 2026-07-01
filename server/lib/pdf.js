/**
 * Geração de PDF "leve" sem dependências externas.
 * Cria PDFs minimalistas com texto formatado, ideal para fichas técnicas e cardápios.
 *
 * Limitações: sem imagens, sem fontes customizadas, sem tabelas complexas.
 * Para PDFs mais ricos, recomenda-se instalar pdfkit.
 */

function escapeText(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '');
}

/**
 * Cria um stream de PDF em chunks.
 * O caller faz: res.setHeader('Content-Type', 'application/pdf'); pdfStream.pipe(res);
 */
const { Readable } = require('stream');

function buildPdf(titulo, secoes) {
  // Header do PDF
  const objects = [];
  const xref = [];
  let contentChunks = [];

  function addObject(body) {
    const id = objects.length + 1;
    objects.push(`${id} 0 obj\n${body}\nendobj\n`);
    return id;
  }

  // Cria content stream
  function makePageContent(pageContent) {
    return `BT\n/F1 12 Tf\n14 TL\n50 780 Td\n${pageContent}ET\n`;
  }

  // Constrói texto de uma página a partir de uma lista de linhas
  function buildPageText(lines) {
    const content = lines.map(line => {
      const [size, x, y, text] = line;
      return `BT\n/F1 ${size} Tf\n${x} ${y} Td\n(${escapeText(text)}) Tj\nET\n`;
    }).join('\n');
    return content;
  }

  // Cria páginas
  const pageIds = [];
  const pagesContent = [];

  // Cabeçalho comum
  const today = new Date().toLocaleDateString('pt-BR');

  // Função para montar as linhas de uma página
  function buildPageLines(title, body, yStart = 750) {
    const lines = [];
    let y = yStart;

    // Logo / marca
    lines.push([10, 50, y, 'CustoChef']);
    y -= 16;
    lines.push([9, 50, y, `Gerado em ${today}`]);
    y -= 20;

    // Título
    lines.push([18, 50, y, title]);
    y -= 24;

    // Linha
    y -= 6;
    lines.push([1, 50, y, '']);
    y -= 18;

    // Corpo
    body.forEach(row => {
      if (Array.isArray(row)) {
        // [size, text, indent=0, bold=false]
        const [size, text, indent = 0, bold = false] = row;
        const x = 50 + indent;
        lines.push([size, x, y, text]);
        y -= size + 6;
      } else if (typeof row === 'object' && row.separador) {
        y -= 8;
      }
      // Quebra de página automática
      if (y < 60) {
        // Adiciona uma quebra simples
        y = 750;
      }
    });

    return lines;
  }

  // Constrói as páginas
  const pages = [];
  let currentY = 750;
  const headerLines = [
    [10, 50, currentY, 'CustoChef'],
    [9, 50, currentY - 16, `Gerado em ${today}`],
    [18, 50, currentY - 40, titulo]
  ];
  currentY -= 70;

  let pageLines = [...headerLines];
  pageLines.push([1, 50, currentY, '']);
  currentY -= 20;

  secoes.forEach(secao => {
    // Subtítulo da seção
    pageLines.push([14, 50, currentY, secao.titulo]);
    currentY -= 20;

    secao.linhas.forEach(linha => {
      if (currentY < 60) {
        pages.push(pageLines);
        pageLines = [...headerLines];
        pageLines.push([1, 50, currentY, '']);
        currentY = 750 - 70;
      }

      if (typeof linha === 'string') {
        pageLines.push([11, 50, currentY, linha]);
        currentY -= 16;
      } else {
        const [size, texto, indent, bold] = linha;
        pageLines.push([size || 11, 50 + (indent || 0), currentY, texto]);
        currentY -= (size || 11) + 4;
      }
    });
    currentY -= 12;
  });

  pages.push(pageLines);

  // Cria objects de página e content
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pages.forEach((lines) => {
    const contentStr = lines.map(line => {
      const [size, x, y, text] = line;
      return `BT\n/F1 ${size} Tf\n${x} ${y} Td\n(${escapeText(text)}) Tj\nET\n`;
    }).join('\n');
    pagesContent.push(contentStr);
  });

  const pageObjIds = [];
  const contentObjIds = [];
  pagesContent.forEach((content, idx) => {
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    contentObjIds.push(contentId);
    const pageId = addObject(`<< /Type /Page /Parent PLACEHOLDER /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`);
    pageObjIds.push(pageId);
  });

  const pagesId = addObject(`<< /Type /Pages /Count ${pageObjIds.length} /Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}] >>`);
  // Substitui PLACEHOLDER
  objects[pageObjIds[0] - 1] = objects[pageObjIds[0] - 1].replace('PLACEHOLDER', `${pagesId} 0 R`);
  pageObjIds.slice(1).forEach(id => {
    objects[id - 1] = objects[id - 1].replace('PLACEHOLDER', `${pagesId} 0 R`);
  });

  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  // Monta o PDF final
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [pdf.length];

  objects.forEach(obj => {
    offsets.push(pdf.length);
    pdf += obj;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(off => {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'binary');
}

module.exports = { buildPdf };
