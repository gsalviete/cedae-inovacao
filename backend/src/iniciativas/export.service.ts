import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import * as PDFDocument from 'pdfkit';
import {
  CLASSIFICACAO_LABEL,
  RELEVANCIA_LABEL,
  TIPO_INSTITUICAO_LABEL,
} from './dominio-iniciativa';

/**
 * Uma iniciativa como devolvida por IniciativasService.listarParaExport() —
 * o registro inteiro, não só as colunas da tabela do painel. O ID interno não
 * está aqui de propósito: quem identifica a iniciativa é o protocolo.
 */
export interface IniciativaExport {
  codigo_publico?: string | null;
  titulo_iniciativa?: string | null;
  nome_colaborador?: string | null;
  canal_contato?: string | null;
  email_proponente?: string | null;
  area_proponente?: string | null;
  local_aplicacao?: string | null;
  problema_pratico?: string | null;
  solucao_proposta?: string | null;
  risco_mitigado?: string | null;
  estagio_desenvolvimento?: string | null;
  macrodimensao?: string | null;
  macrodimensao_observacao?: string | null;
  perfil_impacto?: string | null;
  aporte_financeiro?: string | null;
  valor_aporte?: string | null;
  retorno_economico?: number | string | null;
  suporte_necessario?: string | null;
  diagnostico_observacao?: string | null;
  comentarios_adicionais?: string | null;
  status?: string | null;
  canal_codigo?: string | null;
  proponente_tipo?: string | null;
  organizacao_externa?: string | null;
  tipo_instituicao?: string | null;
  sistema_origem?: string | null;
  codigo_origem?: string | null;
  registrado_por_login?: string | null;
  relevancia_estrategica?: string | null;
  classificacao_iniciativa?: string | null;
  criado_em?: string | Date | null;
  atualizado_em?: string | Date | null;
}

/* ── Rótulos ──────────────────────────────────────────────
   Espelham os mapas do frontend (api.js / detalhe.js): o arquivo exportado
   mostra o mesmo texto que a tela, nunca a chave crua gravada no banco. */
const CANAL_LABEL: Record<string, string> = {
  VIA_1: 'Registro de Sistemas Corporativos (SGE/SGP)',
  VIA_2: 'Formulário Interno de Submissão',
  VIA_3: 'Registro de Reuniões com Áreas',
  MAPEAMENTO_EXTERNO: 'Captação Externa',
};
const ESTAGIO_LABEL: Record<string, string> = {
  ideacao: 'Ideação',
  piloto: 'Teste / Piloto (MVP)',
  escala: 'Escala / Operação Ativa',
  paralisada: 'Paralisada',
};
const MACRODIMENSAO_LABEL: Record<string, string> = {
  tecnologica: 'Tecnológica',
  operacional: 'Operacional',
  gerencial: 'Gerencial / Administrativa',
  social_ambiental: 'Social e Ambiental',
  outros: 'Outros / Multidimensionais',
};
const PERFIL_IMPACTO_LABEL: Record<string, string> = {
  incremental: 'Incremental',
  radical: 'Radical / Disruptivo',
};
const SUPORTE_LABEL: Record<string, string> = {
  instrumentos_juridicos: 'Instrumentos Técnicos e Jurídicos',
  academia: 'Conexão com Academia',
  mercado_startups: 'Conexão com Mercado / Startups',
  sinergia_interna: 'Sinergia Interdepartamental',
  monitoramento: 'Monitoramento Corporativo',
  diagnostico: 'Apoio Diagnóstico',
};
const STATUS_LABEL: Record<string, string> = {
  SUBMETIDA: 'Submetida',
  EM_ANALISE: 'Em Análise',
  EM_OBSERVACAO: 'Em Observação',
  HOMOLOGADA: 'Homologada',
  DESCLASSIFICADA: 'Desclassificada',
};

/** Valor mostrado quando o campo está vazio na planilha (o PDF omite a linha). */
const VAZIO = '—';

/**
 * Aplica o mapa de rótulos. Valor fora do domínio — dado legado ou gravado por
 * fora — aparece como está, em vez de sumir do documento.
 */
function rotulo(mapa: Record<string, string>, val: unknown): string {
  const v = (val ?? '').toString().trim();
  if (!v) return '';
  return mapa[v] ?? mapa[v.toUpperCase()] ?? mapa[v.toLowerCase()] ?? v;
}

function texto(val: unknown): string {
  const v = (val ?? '').toString().trim();
  return v;
}

function fmtData(val: string | Date | null | undefined): string {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/** RETORNO_ECONOMICO é NUMBER(15,2) no banco; sai como moeda. */
function fmtMoeda(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  const n = typeof val === 'number' ? val : Number(String(val).replace(',', '.'));
  if (Number.isNaN(n)) return String(val);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** SUPORTE_NECESSARIO guarda várias opções separadas por "|". */
function fmtSuporte(val: unknown): string {
  const v = texto(val);
  if (!v) return '';
  return v.split('|').filter(Boolean).map((s) => SUPORTE_LABEL[s] ?? s).join(' · ');
}

function fmtSimNao(val: unknown): string {
  const v = texto(val).toLowerCase();
  if (v === 'sim') return 'Sim';
  if (v === 'nao' || v === 'não') return 'Não';
  return texto(val);
}

interface Campo {
  header: string;
  get: (r: IniciativaExport) => string;
  /** Largura da coluna no Excel. */
  width: number;
  /** Campo descritivo e longo: ganha a linha inteira na ficha do PDF. */
  longo?: boolean;
}

/**
 * Todos os campos da iniciativa, agrupados como no detalhe da tela. A mesma
 * definição alimenta a planilha (uma coluna por campo) e o PDF (uma ficha por
 * iniciativa, com os grupos como seções) — não há duas listas para divergir.
 */
const GRUPOS: Array<{ titulo: string; campos: Campo[] }> = [
  {
    titulo: 'Identificação',
    campos: [
      { header: 'Protocolo', get: (r) => texto(r.codigo_publico), width: 16 },
      { header: 'Título', get: (r) => texto(r.titulo_iniciativa), width: 40 },
      { header: 'Status', get: (r) => rotulo(STATUS_LABEL, r.status ?? 'SUBMETIDA'), width: 16 },
      { header: 'Canal de captação', get: (r) => rotulo(CANAL_LABEL, r.canal_codigo ?? 'VIA_2'), width: 34 },
      {
        header: 'Tipo de proponente',
        get: (r) => ((r.proponente_tipo ?? 'INTERNO') === 'EXTERNO' ? 'Externo' : 'Interno'),
        width: 16,
      },
      { header: 'Registrada em', get: (r) => fmtData(r.criado_em), width: 20 },
      { header: 'Atualizada em', get: (r) => fmtData(r.atualizado_em), width: 20 },
    ],
  },
  {
    titulo: 'Proponente',
    campos: [
      { header: 'Proponente', get: (r) => texto(r.nome_colaborador), width: 26 },
      { header: 'Canal de contato', get: (r) => texto(r.canal_contato), width: 24 },
      { header: 'E-mail do proponente', get: (r) => texto(r.email_proponente), width: 30 },
      { header: 'Área proponente', get: (r) => texto(r.area_proponente), width: 26 },
    ],
  },
  {
    titulo: 'Origem do registro',
    campos: [
      { header: 'Organização externa', get: (r) => texto(r.organizacao_externa), width: 26 },
      { header: 'Tipo de instituição', get: (r) => rotulo(TIPO_INSTITUICAO_LABEL, r.tipo_instituicao), width: 20 },
      { header: 'Sistema de origem', get: (r) => texto(r.sistema_origem), width: 16 },
      { header: 'Código de origem', get: (r) => texto(r.codigo_origem), width: 18 },
      { header: 'Registrado por', get: (r) => texto(r.registrado_por_login), width: 26 },
    ],
  },
  {
    titulo: 'Escopo',
    campos: [
      { header: 'Local de aplicação', get: (r) => texto(r.local_aplicacao), width: 26 },
      { header: 'Problema prático', get: (r) => texto(r.problema_pratico), width: 60, longo: true },
      { header: 'Solução proposta', get: (r) => texto(r.solucao_proposta), width: 60, longo: true },
      { header: 'Risco mitigado', get: (r) => texto(r.risco_mitigado), width: 50, longo: true },
    ],
  },
  {
    titulo: 'Classificação',
    campos: [
      { header: 'Estágio de desenvolvimento', get: (r) => rotulo(ESTAGIO_LABEL, r.estagio_desenvolvimento), width: 24 },
      { header: 'Macrodimensão', get: (r) => rotulo(MACRODIMENSAO_LABEL, r.macrodimensao), width: 26 },
      { header: 'Macrodimensão (observação)', get: (r) => texto(r.macrodimensao_observacao), width: 34, longo: true },
      { header: 'Perfil de impacto', get: (r) => rotulo(PERFIL_IMPACTO_LABEL, r.perfil_impacto), width: 20 },
      { header: 'Relevância estratégica', get: (r) => rotulo(RELEVANCIA_LABEL, r.relevancia_estrategica), width: 34 },
      { header: 'Classificação', get: (r) => rotulo(CLASSIFICACAO_LABEL, r.classificacao_iniciativa), width: 14 },
    ],
  },
  {
    titulo: 'Aporte financeiro',
    campos: [
      { header: 'Possui aporte financeiro?', get: (r) => fmtSimNao(r.aporte_financeiro), width: 18 },
      { header: 'Valor estimado', get: (r) => texto(r.valor_aporte), width: 20 },
      { header: 'Retorno econômico', get: (r) => fmtMoeda(r.retorno_economico), width: 20 },
    ],
  },
  {
    titulo: 'Suporte e observações',
    campos: [
      { header: 'Suporte necessário', get: (r) => fmtSuporte(r.suporte_necessario), width: 40, longo: true },
      { header: 'Observação do diagnóstico', get: (r) => texto(r.diagnostico_observacao), width: 40, longo: true },
      { header: 'Comentários adicionais', get: (r) => texto(r.comentarios_adicionais), width: 50, longo: true },
    ],
  },
];

/** Lista achatada, na ordem dos grupos — é a ordem das colunas da planilha. */
const COLUNAS: Campo[] = GRUPOS.flatMap((g) => g.campos);

const AZUL = '#0067AC';

@Injectable()
export class ExportService {
  /**
   * Planilha Excel (.xlsx): uma linha por iniciativa, uma coluna por campo.
   * Campos vazios ficam como "—" — na grade, a coluna precisa existir sempre.
   */
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

    // Sem `wrapText`: os campos descritivos têm milhares de caracteres e a
    // quebra automática faria o Excel esticar a linha inteira até ela ocupar a
    // tela. O texto está inteiro na célula, visível na barra de fórmulas e em
    // qualquer filtro — só não é derramado na grade.
    for (const r of rows) {
      ws.addRow(COLUNAS.map((c) => c.get(r) || VAZIO)).alignment = { vertical: 'top' };
    }

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Relatório PDF (A4 retrato): uma ficha por iniciativa, com todos os campos
   * preenchidos em pares rótulo/valor, agrupados como no detalhe da tela.
   *
   * Campo vazio não vira linha: metade dos campos é condicional à via de
   * captação (sistema de origem só existe na Via 1, instituição só na Captação
   * Externa) e uma ficha com trinta traços não se lê. A planilha continua com
   * todas as colunas, inclusive as vazias.
   */
  async toPdf(rows: IniciativaExport[]): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const esq = doc.page.margins.left;
      const dir = doc.page.width - doc.page.margins.right;
      const largura = dir - esq;
      const topo = doc.page.margins.top;
      const base = doc.page.height - doc.page.margins.bottom;

      // Coluna do rótulo à esquerda, valor à direita; campos descritivos ocupam
      // a linha inteira, abaixo do próprio rótulo.
      const LARG_ROTULO = 150;
      const ESPACO = 10;
      const LARG_VALOR = largura - LARG_ROTULO - ESPACO;

      let y = topo;

      const novaPagina = (): void => {
        doc.addPage();
        y = topo;
      };

      /** Quebra a página quando o bloco não cabe no espaço restante. */
      const reservar = (altura: number): void => {
        if (y + altura > base && y > topo) novaPagina();
      };

      const alturaTexto = (txt: string, w: number, tamanho: number): number => {
        doc.fontSize(tamanho).font('Helvetica');
        return doc.heightOfString(txt, { width: w });
      };

      // ── Capa/cabeçalho do documento ──────────────────────
      doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(18)
        .text('CEDAE Inovação — Iniciativas', esq, y);
      y = doc.y + 2;
      doc.fillColor('#666').font('Helvetica').fontSize(9)
        .text(`Gerado em ${fmtData(new Date())} · ${rows.length} iniciativa(s)`, esq, y);
      y = doc.y + 14;

      if (!rows.length) {
        doc.fillColor('#222').font('Helvetica').fontSize(11)
          .text('Nenhuma iniciativa corresponde aos filtros aplicados.', esq, y);
      }

      rows.forEach((r, idx) => {
        const linhas = GRUPOS
          .map((g) => ({
            titulo: g.titulo,
            campos: g.campos
              .map((c) => ({ header: c.header, valor: c.get(r), longo: c.longo === true }))
              .filter((c) => c.valor !== ''),
          }))
          .filter((g) => g.campos.length > 0);

        // ── Faixa de identificação da ficha ────────────────
        const titulo = `${texto(r.codigo_publico) || 'Sem protocolo'} · ${texto(r.titulo_iniciativa) || 'Sem título'}`;
        doc.font('Helvetica-Bold').fontSize(11);
        const hTitulo = doc.heightOfString(titulo, { width: largura - 16 }) + 12;

        if (idx > 0) y += 8;
        // A faixa nunca fica sozinha no pé da página: exige espaço para ela e
        // para as primeiras linhas da ficha.
        reservar(hTitulo + 46);

        doc.rect(esq, y, largura, hTitulo).fill(AZUL);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
          .text(titulo, esq + 8, y + 6, { width: largura - 16 });
        y += hTitulo + 8;

        for (const grupo of linhas) {
          // ── Título da seção ─────────────────────────────
          reservar(30);
          doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(8.5)
            .text(grupo.titulo.toUpperCase(), esq, y, { width: largura, characterSpacing: 0.6 });
          y = doc.y + 3;
          doc.moveTo(esq, y).lineTo(dir, y).lineWidth(0.5).strokeColor('#d6e2ee').stroke();
          y += 6;

          for (const campo of grupo.campos) {
            if (campo.longo) {
              // Rótulo em cima, texto ocupando a largura inteira.
              const hRot = alturaTexto(campo.header, largura, 8);
              reservar(hRot + 24);
              doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(8)
                .text(campo.header, esq, y, { width: largura });
              y = doc.y + 1;

              const hVal = alturaTexto(campo.valor, largura, 9);
              // Texto maior que uma página inteira: deixa o PDFKit paginar e
              // acompanha por doc.y, em vez de estourar a margem.
              if (hVal <= base - topo) reservar(hVal);
              doc.fillColor('#222').font('Helvetica').fontSize(9)
                .text(campo.valor, esq, y, { width: largura });
              y = doc.y + 7;
            } else {
              const hRot = alturaTexto(campo.header, LARG_ROTULO, 8);
              const hVal = alturaTexto(campo.valor, LARG_VALOR, 9);
              const h = Math.max(hRot, hVal) + 6;
              reservar(h);

              doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(8)
                .text(campo.header, esq, y + 1, { width: LARG_ROTULO });
              doc.fillColor('#222').font('Helvetica').fontSize(9)
                .text(campo.valor, esq + LARG_ROTULO + ESPACO, y, { width: LARG_VALOR });
              y += h;
            }
          }
          y += 4;
        }

        y += 6;
      });

      // ── Rodapé com paginação ─────────────────────────────
      // O rodapé mora dentro da margem inferior; zerá-la antes de escrever
      // impede o PDFKit de entender que o texto "não coube" e criar páginas em
      // branco a cada rodapé.
      const total = doc.bufferedPageRange().count;
      for (let i = 0; i < total; i++) {
        doc.switchToPage(i);
        const margemBase = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.fillColor('#999').font('Helvetica').fontSize(7.5)
          .text(
            `Página ${i + 1} de ${total}`,
            esq,
            doc.page.height - margemBase + 12,
            { width: largura, align: 'right', lineBreak: false },
          );
        doc.page.margins.bottom = margemBase;
      }

      doc.end();
    });
  }
}
