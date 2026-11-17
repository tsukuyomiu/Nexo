-- ============================================================================
-- PROJETO NEXO - ENGENHARIA DE BANCO DE DADOS
-- Arquivo: database/sql/schema_relatorios.sql
-- Descrição: Tabela de histórico de relatórios gerados/exportados e Views
--            analíticas para o Dashboard Financeiro e consolidação mensal.
-- Compatibilidade: SQLite 3.35+ / PostgreSQL 14+
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. TABELA: relatorios_exportados
-- Registra cada geração ou exportação de relatório financeiro ou de auditoria,
-- preservando os parâmetros e métricas utilizadas.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relatorios_exportados (
    id                  TEXT PRIMARY KEY,
    usuario_id          TEXT NOT NULL,
    titulo              TEXT NOT NULL,
    tipo_relatorio      TEXT NOT NULL CHECK (tipo_relatorio IN ('FINANCEIRO_MENSAL', 'EXTRATO_LANCAMENTOS', 'AUDITORIA_SISTEMA')),
    periodo_referencia  TEXT NOT NULL, -- Ex: '2026-11' ou 'ALL'
    formato             TEXT NOT NULL DEFAULT 'JSON' CHECK (formato IN ('JSON', 'CSV', 'PDF')),
    filtros_json        TEXT NOT NULL DEFAULT '{}',
    resumo_metricas     TEXT NOT NULL DEFAULT '{}',
    ip_solicitante      TEXT,
    criado_em           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_relatorios_usuario ON relatorios_exportados(usuario_id, criado_em DESC);

-- ----------------------------------------------------------------------------
-- 2. VIEW ANALÍTICA: vw_resumo_mensal_usuario
-- Consolida Receitas (income), Despesas (expense), Saldo (balance) e
-- quantidade de lançamentos por usuário e mês (YYYY-MM).
-- Mesma regra de negócio de `calcTotals` do Front-End.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS vw_resumo_mensal_usuario;
CREATE VIEW vw_resumo_mensal_usuario AS
SELECT
    l.usuario_id,
    u.nome AS usuario_nome,
    u.email AS usuario_email,
    substr(l.data_lancamento, 1, 7) AS mes_referencia,
    COUNT(l.id) AS total_lancamentos,
    ROUND(COALESCE(SUM(CASE WHEN l.tipo = 'income'  THEN l.valor ELSE 0 END), 0.0), 2) AS total_receitas,
    ROUND(COALESCE(SUM(CASE WHEN l.tipo = 'expense' THEN l.valor ELSE 0 END), 0.0), 2) AS total_despesas,
    ROUND(
        COALESCE(SUM(CASE WHEN l.tipo = 'income'  THEN l.valor ELSE 0 END), 0.0) -
        COALESCE(SUM(CASE WHEN l.tipo = 'expense' THEN l.valor ELSE 0 END), 0.0),
        2
    ) AS saldo_mensal
FROM lancamentos l
JOIN usuarios u ON u.id = l.usuario_id
GROUP BY l.usuario_id, substr(l.data_lancamento, 1, 7);

-- ----------------------------------------------------------------------------
-- 3. VIEW ANALÍTICA: vw_despesas_por_categoria
-- Consolida o total gasto e a contagem de despesas por categoria e mês,
-- alimentando diretamente o gráfico de rosca do Dashboard (/dashboard).
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS vw_despesas_por_categoria;
CREATE VIEW vw_despesas_por_categoria AS
SELECT
    l.usuario_id,
    substr(l.data_lancamento, 1, 7) AS mes_referencia,
    l.categoria,
    COUNT(l.id) AS quantidade_lancamentos,
    ROUND(SUM(l.valor), 2) AS total_categoria
FROM lancamentos l
WHERE l.tipo = 'expense'
GROUP BY l.usuario_id, substr(l.data_lancamento, 1, 7), l.categoria
ORDER BY total_categoria DESC;

-- ----------------------------------------------------------------------------
-- 4. VIEW ANALÍTICA: vw_dre_gerencial_mensal
-- Consolida o DRE Gerencial do Empreendedor por mês:
-- Receita Realizada vs A Receber, Despesa Paga vs A Pagar,
-- Custos Fixos (Recorrentes) vs Variáveis, Resultado Líquido e Margem (%).
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS vw_dre_gerencial_mensal;
CREATE VIEW vw_dre_gerencial_mensal AS
SELECT
    l.usuario_id,
    substr(l.data_lancamento, 1, 7) AS mes_referencia,
    ROUND(COALESCE(SUM(CASE WHEN l.tipo = 'income' AND l.status = 'confirmado' THEN l.valor ELSE 0 END), 0.0), 2) AS receita_realizada,
    ROUND(COALESCE(SUM(CASE WHEN l.tipo = 'income' AND l.status = 'pendente'   THEN l.valor ELSE 0 END), 0.0), 2) AS receita_pendente,
    ROUND(COALESCE(SUM(CASE WHEN l.tipo = 'expense' AND l.status = 'confirmado' THEN l.valor ELSE 0 END), 0.0), 2) AS despesa_paga,
    ROUND(COALESCE(SUM(CASE WHEN l.tipo = 'expense' AND l.status = 'pendente'   THEN l.valor ELSE 0 END), 0.0), 2) AS despesa_pendente,
    ROUND(COALESCE(SUM(CASE WHEN l.tipo = 'expense' AND l.recorrente = 1        THEN l.valor ELSE 0 END), 0.0), 2) AS custos_fixos,
    ROUND(COALESCE(SUM(CASE WHEN l.tipo = 'expense' AND l.recorrente = 0        THEN l.valor ELSE 0 END), 0.0), 2) AS custos_variaveis,
    ROUND(
        COALESCE(SUM(CASE WHEN l.tipo = 'income'  THEN l.valor ELSE 0 END), 0.0) -
        COALESCE(SUM(CASE WHEN l.tipo = 'expense' THEN l.valor ELSE 0 END), 0.0),
        2
    ) AS resultado_liquido
FROM lancamentos l
GROUP BY l.usuario_id, substr(l.data_lancamento, 1, 7);
