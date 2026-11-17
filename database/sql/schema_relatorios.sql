-- ============================================================================
-- PROJETO NEXO - ENGENHARIA DE BANCO DE DADOS (PADRÃO SIMON HOLYWELL & MOZILLA)
-- Arquivo: database/sql/schema_relatorios.sql
-- Descrição: Tabela de histórico de relatórios e Views analíticas construídas
--            com CTEs (Common Table Expressions - cláusula WITH) e alinhamento
--            padronizado para eliminar subconsultas e condicionais repetidas.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. TABELA: relatorios_exportados
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relatorios_exportados (
    id                  TEXT PRIMARY KEY,
    usuario_id          TEXT NOT NULL,
    titulo              TEXT NOT NULL,
    tipo_relatorio      TEXT NOT NULL CHECK (tipo_relatorio IN ('FINANCEIRO_MENSAL', 'EXTRATO_LANCAMENTOS', 'AUDITORIA_SISTEMA')),
    periodo_referencia  TEXT NOT NULL,
    formato             TEXT NOT NULL DEFAULT 'JSON' CHECK (formato IN ('JSON', 'CSV', 'PDF')),
    filtros_json        TEXT NOT NULL DEFAULT '{}',
    resumo_metricas     TEXT NOT NULL DEFAULT '{}',
    ip_solicitante      TEXT,
    criado_em           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_relatorios_usuario
    ON relatorios_exportados(usuario_id, criado_em DESC);

-- ----------------------------------------------------------------------------
-- 2. VIEW ANALÍTICA COM CTE (WITH): vw_resumo_mensal_usuario
-- Usa Common Table Expression (WITH totais_mensais) para calcular Receitas e
-- Despesas uma única vez antes de consolidar o Saldo Mensal.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS vw_resumo_mensal_usuario;
CREATE VIEW vw_resumo_mensal_usuario AS
WITH totais_mensais AS (
    SELECT
        l.usuario_id,
        substr(l.data_lancamento, 1, 7) AS mes_referencia,
        COUNT(l.id) AS total_lancamentos,
        COALESCE(SUM(CASE WHEN l.tipo = 'income' THEN l.valor ELSE 0 END), 0.0) AS receitas_brutas,
        COALESCE(SUM(CASE WHEN l.tipo = 'expense' THEN l.valor ELSE 0 END), 0.0) AS despesas_brutas
    FROM lancamentos AS l
    GROUP BY
        l.usuario_id,
        substr(l.data_lancamento, 1, 7)
)
SELECT
    tm.usuario_id,
    u.nome AS usuario_nome,
    u.email AS usuario_email,
    tm.mes_referencia,
    tm.total_lancamentos,
    ROUND(tm.receitas_brutas, 2) AS total_receitas,
    ROUND(tm.despesas_brutas, 2) AS total_despesas,
    ROUND(tm.receitas_brutas - tm.despesas_brutas, 2) AS saldo_mensal
FROM totais_mensais AS tm
INNER JOIN usuarios AS u
    ON u.id = tm.usuario_id;

-- ----------------------------------------------------------------------------
-- 3. VIEW ANALÍTICA COM CTE (WITH): vw_despesas_por_categoria
-- Filtra apenas despesas na CTE antes de agrupar por categoria e mês.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS vw_despesas_por_categoria;
CREATE VIEW vw_despesas_por_categoria AS
WITH despesas_filtradas AS (
    SELECT
        l.id,
        l.usuario_id,
        substr(l.data_lancamento, 1, 7) AS mes_referencia,
        l.categoria,
        l.valor
    FROM lancamentos AS l
    WHERE l.tipo = 'expense'
)
SELECT
    df.usuario_id,
    df.mes_referencia,
    df.categoria,
    COUNT(df.id) AS quantidade_lancamentos,
    ROUND(SUM(df.valor), 2) AS total_categoria
FROM despesas_filtradas AS df
GROUP BY
    df.usuario_id,
    df.mes_referencia,
    df.categoria
ORDER BY
    total_categoria DESC;

-- ----------------------------------------------------------------------------
-- 4. VIEW ANALÍTICA COM CTE (WITH): vw_dre_gerencial_mensal
-- Estrutura o DRE Gerencial em duas etapas (agregação base -> cálculo líquido)
-- seguindo o Mozilla SQL Style Guide.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS vw_dre_gerencial_mensal;
CREATE VIEW vw_dre_gerencial_mensal AS
WITH base_dre AS (
    SELECT
        l.usuario_id,
        substr(l.data_lancamento, 1, 7) AS mes_referencia,
        COALESCE(SUM(CASE WHEN l.tipo = 'income' AND l.status = 'confirmado' THEN l.valor ELSE 0 END), 0.0) AS rec_realizada,
        COALESCE(SUM(CASE WHEN l.tipo = 'income' AND l.status = 'pendente' THEN l.valor ELSE 0 END), 0.0) AS rec_pendente,
        COALESCE(SUM(CASE WHEN l.tipo = 'expense' AND l.status = 'confirmado' THEN l.valor ELSE 0 END), 0.0) AS desp_paga,
        COALESCE(SUM(CASE WHEN l.tipo = 'expense' AND l.status = 'pendente' THEN l.valor ELSE 0 END), 0.0) AS desp_pendente,
        COALESCE(SUM(CASE WHEN l.tipo = 'expense' AND l.recorrente = 1 THEN l.valor ELSE 0 END), 0.0) AS fixos,
        COALESCE(SUM(CASE WHEN l.tipo = 'expense' AND l.recorrente = 0 THEN l.valor ELSE 0 END), 0.0) AS variaveis
    FROM lancamentos AS l
    GROUP BY
        l.usuario_id,
        substr(l.data_lancamento, 1, 7)
)
SELECT
    b.usuario_id,
    b.mes_referencia,
    ROUND(b.rec_realizada, 2) AS receita_realizada,
    ROUND(b.rec_pendente, 2) AS receita_pendente,
    ROUND(b.desp_paga, 2) AS despesa_paga,
    ROUND(b.desp_pendente, 2) AS despesa_pendente,
    ROUND(b.fixos, 2) AS custos_fixos,
    ROUND(b.variaveis, 2) AS custos_variaveis,
    ROUND((b.rec_realizada + b.rec_pendente) - (b.desp_paga + b.desp_pendente), 2) AS resultado_liquido
FROM base_dre AS b;
