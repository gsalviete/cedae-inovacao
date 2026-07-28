/**
 * Domínios de valor da iniciativa compartilhados por DTOs, serviço e exportação
 * (ADR-002 — domínio de valores; ADR-015 §2/§3/§6).
 *
 * São a fonte única de verdade da aplicação: as CHECK constraints do banco
 * (V28/V31) reforçam os mesmos conjuntos, mas a validação primária é aqui.
 */

/** Relevância estratégica da iniciativa (ADR-015 §2). */
export const RELEVANCIAS = [
  'FINANCEIRO',
  'PLANEJAMENTO_ESTRATEGICO',
  'INDETERMINADA',
  'SEM_RELEVANCIA',
] as const;
export type Relevancia = (typeof RELEVANCIAS)[number];

/** Valor atribuído quando a avaliação ainda não foi feita. */
export const RELEVANCIA_PADRAO: Relevancia = 'INDETERMINADA';

/** Toda iniciativa da Via 1 (SGE/SGP) vem do Planejamento Estratégico (RN-14). */
export const RELEVANCIA_VIA_1: Relevancia = 'PLANEJAMENTO_ESTRATEGICO';

export const RELEVANCIA_LABEL: Record<string, string> = {
  FINANCEIRO: 'Sim, por retorno financeiro',
  PLANEJAMENTO_ESTRATEGICO: 'Sim, por estar no Planejamento Estratégico',
  INDETERMINADA: 'Ainda não é possível determinar',
  SEM_RELEVANCIA: 'Não possui relevância estratégica',
};

/** Classificação Ação/Projeto — administrada só por ADM na edição (ADR-015 §3). */
export const CLASSIFICACOES = ['ACAO', 'PROJETO'] as const;
export type Classificacao = (typeof CLASSIFICACOES)[number];

export const CLASSIFICACAO_LABEL: Record<string, string> = {
  ACAO: 'Ação',
  PROJETO: 'Projeto',
};

/**
 * Tipos de instituição aceitos em NOVOS cadastros da Captação Externa.
 * `PARCERIA` saiu do domínio (ADR-015 §6) mas continua no CHECK do banco e no
 * mapa de rótulos: existem registros gravados com esse valor.
 */
export const TIPOS_INSTITUICAO = [
  'ICT',
  'UNIVERSIDADE',
  'EMPRESA_PUBLICA',
  'EMPRESA_PRIVADA',
  'STARTUP',
  'OUTRO',
] as const;

export const TIPO_INSTITUICAO_LABEL: Record<string, string> = {
  ICT: 'ICT',
  UNIVERSIDADE: 'Universidade',
  EMPRESA_PUBLICA: 'Empresa Pública',
  EMPRESA_PRIVADA: 'Empresa Privada',
  STARTUP: 'Startup',
  PARCERIA: 'Parceria (legado)',
  OUTRO: 'Outro',
};
