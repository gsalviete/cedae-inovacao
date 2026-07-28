import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { CLASSIFICACAO_LABEL, RELEVANCIA_LABEL } from './dominio-iniciativa';

/** Uma linha de iniciativa como devolvida por IniciativasService.listar(). */
export interface IniciativaExport {
  codigo_publico?: string | null;
  titulo_iniciativa?: string | null;
  nome_colaborador?: string | null;
  area_proponente?: string | null;
  estagio_desenvolvimento?: string | null;
  status?: string | null;
  canal_codigo?: string | null;
  proponente_tipo?: string | null;
  organizacao_externa?: string | null;
  relevancia_estrategica?: string | null;
  classificacao_iniciativa?: string | null;
  criado_em?: string | Date | null;
}

const CANAL_LABEL: Record<string, string> = {
  VIA_1: 'SGE/SGP',
  VIA_2: 'Formulário',
  VIA_3: 'Reunião',
  MAPEAMENTO_EXTERNO: 'Externa',
};
const ESTAGIO_LABEL: Record<string, string> = {
  ideacao: 'Ideação',
  piloto: 'Piloto',
  escala: 'Escala',
  paralisada: 'Paralisada',
};
const STATUS_LABEL: Record<string, string> = {
  SUBMETIDA: 'Submetida',
  EM_ANALISE: 'Em Análise',
  HOMOLOGADA: 'Homologada',
  DESCLASSIFICADA: 'Desclassificada',
};

/** Colunas exportadas (ADR-014 §11.4), na ordem de exibição. */
const COLUNAS: Array<{ header: string; get: (r: IniciativaExport) => string; width: number }> = [
  { header: 'Protocolo', get: (r) => r.codigo_publico ?? '—', width: 16 },
  { header: 'Título', get: (r) => r.titulo_iniciativa ?? '—', width: 40 },
  { header: 'Canal', get: (r) => CANAL_LABEL[r.canal_codigo ?? 'VIA_2'] ?? (r.canal_codigo ?? '—'), width: 14 },
  { header: 'Proponente', get: (r) => r.nome_colaborador ?? '—', width: 26 },
  { header: 'Área', get: (r) => r.area_proponente ?? '—', width: 24 },
  { header: 'Organização externa', get: (r) => r.organizacao_externa ?? '—', width: 24 },
  { header: 'Estágio', get: (r) => ESTAGIO_LABEL[r.estagio_desenvolvimento ?? ''] ?? '—', width: 14 },
  { header: 'Relevância estratégica', get: (r) => RELEVANCIA_LABEL[r.relevancia_estrategica ?? ''] ?? '—', width: 34 },
  { header: 'Classificação', get: (r) => CLASSIFICACAO_LABEL[r.classificacao_iniciativa ?? ''] ?? '—', width: 14 },
  { header: 'Status', get: (r) => STATUS_LABEL[r.status ?? 'SUBMETIDA'] ?? (r.status ?? '—'), width: 16 },
  { header: 'Registrada em', get: (r) => fmtData(r.criado_em), width: 20 },
];

function fmtData(val: string | Date | null | undefined): string {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

@Injectable()
export class ExportService {
  /** Planilha Excel (.xlsx) com uma linha por iniciativa. */
  async toExcel(rows: IniciativaExport[]): Promise<Buffer> {
    const wb = new Workbook();
    wb.creator = 'CEDAE Inovação';
    wb.created = new Date();
    const ws = wb.addWorksheet('Iniciativas', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = COLUNAS.map((c) => ({ header: c.header, key: c.header, width: c.width }));

    // Cabeçalho estilizado com o azul institucional.
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0067AC' } };
    head.alignment = { vertical: 'middle' };
    head.height = 22;

    for (const r of rows) {
      ws.addRow(COLUNAS.map((c) => c.get(r)));
    }

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /** Relatório PDF (A4 paisagem) em formato de tabela. */
  async toPdf(rows: IniciativaExport[]): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageLeft = doc.page.margins.left;
      const pageRight = doc.page.width - doc.page.margins.right;
      const usable = pageRight - pageLeft;

      // Cabeçalho do documento.
      doc.fillColor('#0067AC').fontSize(16).text('CEDAE Inovação — Iniciativas', { align: 'left' });
      doc.moveDown(0.2);
      doc.fillColor('#666').fontSize(9)
        .text(`Gerado em ${fmtData(new Date())} · ${rows.length} iniciativa(s)`);
      doc.moveDown(0.6);

      // Colunas do PDF (subconjunto enxuto do Excel para caber na página).
      const cols: Array<{ header: string; get: (r: IniciativaExport) => string; w: number }> = [
        { header: 'Protocolo', get: (r) => r.codigo_publico ?? '—', w: 0.11 },
        { header: 'Título', get: (r) => r.titulo_iniciativa ?? '—', w: 0.26 },
        { header: 'Canal', get: (r) => CANAL_LABEL[r.canal_codigo ?? 'VIA_2'] ?? '—', w: 0.09 },
        { header: 'Proponente', get: (r) => r.nome_colaborador ?? '—', w: 0.17 },
        { header: 'Área', get: (r) => r.area_proponente ?? '—', w: 0.15 },
        { header: 'Estágio', get: (r) => ESTAGIO_LABEL[r.estagio_desenvolvimento ?? ''] ?? '—', w: 0.10 },
        { header: 'Status', get: (r) => STATUS_LABEL[r.status ?? 'SUBMETIDA'] ?? '—', w: 0.12 },
      ];
      const widths = cols.map((c) => c.w * usable);

      const drawRow = (cells: string[], y: number, bold: boolean): number => {
        doc.fontSize(8).font(bold ? 'Helvetica-Bold' : 'Helvetica');
        let x = pageLeft;
        let maxH = 0;
        cells.forEach((txt, i) => {
          const h = doc.heightOfString(txt, { width: widths[i] - 6 });
          if (h > maxH) maxH = h;
          x += widths[i];
        });
        const rowH = maxH + 8;
        x = pageLeft;
        cells.forEach((txt, i) => {
          doc.fillColor(bold ? '#ffffff' : '#222')
            .text(txt, x + 3, y + 4, { width: widths[i] - 6, height: rowH, ellipsis: true });
          x += widths[i];
        });
        return rowH;
      };

      let y = doc.y;
      // Faixa do cabeçalho da tabela.
      const headerCells = cols.map((c) => c.header);
      const headH = 18;
      doc.rect(pageLeft, y, usable, headH).fill('#0067AC');
      drawRow(headerCells, y, true);
      y += headH;

      doc.font('Helvetica').fillColor('#222');
      rows.forEach((r, idx) => {
        const cells = cols.map((c) => c.get(r));
        // Estima a altura antes de desenhar para saber se quebra a página.
        doc.fontSize(8);
        const estH = Math.max(...cells.map((txt, i) => doc.heightOfString(txt, { width: widths[i] - 6 }))) + 8;
        if (y + estH > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          y = doc.page.margins.top;
          doc.rect(pageLeft, y, usable, headH).fill('#0067AC');
          drawRow(headerCells, y, true);
          y += headH;
        }
        if (idx % 2 === 1) {
          doc.rect(pageLeft, y, usable, estH).fill('#f2f6fa');
        }
        const h = drawRow(cells, y, false);
        y += h;
      });

      doc.end();
    });
  }
}
