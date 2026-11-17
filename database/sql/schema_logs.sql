-- ============================================================================
-- PROJETO NEXO - BANCO DE DADOS E AUDITORIA DE LOGS
-- Arquivo: database/sql/schema_logs.sql
-- Descrição: Tabelas de Trilha de Auditoria (Quem fez, Quando fez, O que fez,
--            Antes e Depois) e Logs de Acesso HTTP.
-- Compatibilidade: SQLite 3.35+ / PostgreSQL 14+
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. TABELA: audit_logs (Trilha de Auditoria de Negócio)
-- Registra as operações realizadas no sistema:
--   - QUEM FEZ: usuario_id, usuario_email, usuario_nome, ip_origem, user_agent
--   - QUANDO FEZ: data_hora_utc (ISO 8601) e data_hora_local (America/Sao_Paulo)
--   - O QUE FEZ: acao, categoria_evento, entidade_afetada, entidade_id,
--                resumo_humano, dados_anteriores (JSON) e dados_novos (JSON)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id                  TEXT PRIMARY KEY,
    data_hora_utc       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    data_hora_local     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f-03:00', 'now', '-3 hours')),
    usuario_id          TEXT,
    usuario_email       TEXT NOT NULL DEFAULT 'anonimo@nexo.local',
    usuario_nome        TEXT NOT NULL DEFAULT 'Visitante / Sistema',
    ip_origem           TEXT NOT NULL DEFAULT '127.0.0.1',
    user_agent          TEXT NOT NULL DEFAULT 'Unknown',
    metodo_http         TEXT,
    rota_http           TEXT,
    request_id          TEXT,
    acao                TEXT NOT NULL,
    categoria_evento    TEXT NOT NULL CHECK (categoria_evento IN (
                            'AUTH', 'TRANSACTION', 'PROFILE', 'PREFERENCES',
                            'SECURITY', 'REPORT', 'FRONTEND', 'DATABASE', 'SYSTEM'
                        )),
    severidade          TEXT NOT NULL DEFAULT 'INFO' CHECK (severidade IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    entidade_afetada    TEXT NOT NULL,
    entidade_id         TEXT,
    resumo_humano       TEXT NOT NULL,
    dados_anteriores    TEXT,
    dados_novos         TEXT,
    metadados_extras    TEXT,
    origem_registro     TEXT NOT NULL DEFAULT 'API_PYTHON' CHECK (origem_registro IN (
                            'API_PYTHON', 'FRONTEND_TELEMETRY', 'SYSTEM'
                        ))
);

-- Índices para buscas rápidas por usuário, data/hora, ação e entidade
CREATE INDEX IF NOT EXISTS idx_audit_logs_data_utc ON audit_logs(data_hora_utc DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_usuario ON audit_logs(usuario_id, data_hora_utc DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_email ON audit_logs(usuario_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_acao ON audit_logs(acao, categoria_evento);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entidade ON audit_logs(entidade_afetada, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severidade ON audit_logs(severidade);

-- ----------------------------------------------------------------------------
-- 2. TABELA: access_logs (Tráfego HTTP das Requisições da API)
-- Registra cada chamada HTTP recebida pelo servidor, tempo de resposta em ms,
-- status code, rota, query string e IP.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_logs (
    id                      TEXT PRIMARY KEY,
    data_hora_utc           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    data_hora_local         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f-03:00', 'now', '-3 hours')),
    request_id              TEXT NOT NULL UNIQUE,
    usuario_id              TEXT,
    usuario_email           TEXT,
    metodo_http             TEXT NOT NULL,
    rota                    TEXT NOT NULL,
    query_params            TEXT,
    status_code             INTEGER NOT NULL,
    tempo_resposta_ms       REAL NOT NULL,
    ip_origem               TEXT NOT NULL,
    user_agent              TEXT,
    erro_detalhe            TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_logs_data ON access_logs(data_hora_utc DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_usuario ON access_logs(usuario_id, data_hora_utc DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_status ON access_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_access_logs_rota ON access_logs(rota);

-- ----------------------------------------------------------------------------
-- 3. VIEW DE AUDITORIA COMPLETA (vw_auditoria_completa)
-- Facilita consultas diretas no banco exibindo Quem fez, Quando fez, O que fez,
-- Rota, IP, Severidade e os estados Antes/Depois lado a lado.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS vw_auditoria_completa;
CREATE VIEW vw_auditoria_completa AS
SELECT
    a.id AS log_id,
    a.data_hora_local AS quando_fez_brasilia,
    a.data_hora_utc AS quando_fez_utc,
    a.usuario_nome AS quem_fez_nome,
    a.usuario_email AS quem_fez_email,
    a.usuario_id AS quem_fez_id,
    a.ip_origem AS de_qual_ip,
    a.acao AS codigo_acao,
    a.categoria_evento AS modulo,
    a.severidade,
    a.resumo_humano AS o_que_fez,
    a.entidade_afetada,
    a.entidade_id,
    a.dados_anteriores AS como_estava_antes,
    a.dados_novos AS como_ficou_depois,
    a.metodo_http,
    a.rota_http,
    a.origem_registro
FROM audit_logs a
ORDER BY a.data_hora_utc DESC;
