/**
 * Geração de arquivos "Excel" (XLS) no formato SpreadsheetML 2003 (XML).
 * Funciona no Microsoft Excel e LibreOffice. Mais leve que XLSX e sem dependências.
 */

function escapeXml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cellRef(col, row) {
  // col é 0-indexado, row é 0-indexado
  let colName = '';
  let c = col;
  while (c >= 0) {
    colName = String.fromCharCode(65 + (c % 26)) + colName;
    c = Math.floor(c / 26) - 1;
  }
  return `${colName}${row + 1}`;
}

function cell(value, type = 'String') {
  const v = escapeXml(value);
  if (type === 'Number') {
    return `<Cell><Data ss:Type="Number">${v}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="${type}">${v}</Data></Cell>`;
}

function buildWorksheet(name, rows) {
  const safeName = (name || 'Planilha').replace(/[\\\/\[\]\:]/g, '_').substring(0, 31);
  return `
    <Worksheet ss:Name="${escapeXml(safeName)}">
      <Table>
        ${rows.map(row => `<Row>${row.map((c, i) => {
          if (c === null || c === undefined) return cell('');
          if (typeof c === 'number') return cell(c, 'Number');
          if (c instanceof Date) return cell(c.toISOString().split('T')[0], 'String');
          if (typeof c === 'object' && c.formula) {
            return `<Cell ss:Formula="${escapeXml(c.formula)}"><Data ss:Type="Number">0</Data></Cell>`;
          }
          return cell(c);
        }).join('')}</Row>`).join('\n')}
      </Table>
    </Worksheet>
  `;
}

function buildXls(worksheets) {
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#C45C00" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 ${worksheets.map(w => buildWorksheet(w.name, w.rows)).join('\n')}
</Workbook>`;
}

module.exports = { buildXls };
