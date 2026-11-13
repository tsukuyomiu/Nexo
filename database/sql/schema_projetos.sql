-- ============================================================================
-- PROJETO NEXO - ENGENHARIA DE BANCO DE DADOS
-- Arquivo: database/sql/schema_projetos.sql
-- Descrição: Modelagem física do núcleo operacional e financeiro do Nexo
--            (Categorias padronizadas e Lançamentos de Receitas/Despesas).
-- Compatibilidade: SQLite 3.35+ / PostgreSQL 14+
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. TABELA: categorias_padrao
-- Catálogo oficial de categorias de Receitas (income) e Despesas (expense)
-- alinhado com `INCOME_CATEGORIES` e `EXPENSE_CATEGORIES` do Front-End.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias_padrao (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                TEXT NOT NULL,
    tipo                TEXT NOT NULL CHECK (tipo IN ('income', 'expense')),
    descricao           TEXT,
    ativo               INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    UNIQUE(nome, tipo)
);

-- Carga inicial idempotente das categorias oficiais do Nexo
INSERT OR IGNORE INTO categorias_padrao (nome, tipo, descricao) VALUES
    ('Salário',       'income',  'Remuneração fixa, pró-labore ou folha de pagamento'),
    ('Vendas',        'income',  'Receitas provenientes de vendas de produtos ou mercadorias'),
    ('Serviços',      'income',  'Prestação de serviços, consultorias e freelas'),
    ('Investimentos', 'income',  'Dividendos, rendimentos, juros e ganhos de capital'),
    ('Outros',        'income',  'Outras entradas financeiras diversas'),
    ('Alimentação',   'expense', 'Restaurantes, lanches, delivery e refeições'),
    ('Transporte',    'expense', 'Combustível, transporte público, aplicativos e manutenção'),
    ('Moradia',       'expense', 'Aluguel, condomínio, energia, água, internet e IPTU'),
    ('Saúde',         'expense', 'Plano de saúde, farmácia, consultas e exames'),
    ('Lazer',         'expense', 'Viagens, streaming, cinema, hobbies e eventos'),
    ('Educação',      'expense', 'Cursos, faculdade, livros e certificações'),
    ('Supermercado',  'expense', 'Compras de mercado, feira e insumos domésticos'),
    ('Serviços',      'expense', 'Assinaturas, softwares, taxas bancárias e serviços terceiros'),
    ('Fornecedores',  'expense', 'Compra de estoque, matéria-prima, mercadorias e insumos'),
    ('Impostos',      'expense', 'DAS MEI, Simples Nacional, ISS, ICMS, IRPJ e taxas fiscais'),
    ('Marketing',     'expense', 'Tráfego pago, anúncios, redes sociais e divulgação'),
    ('Folha & RH',    'expense', 'Salários de equipe, pró-labore, comissões e encargos'),
    ('Outros',        'expense', 'Outras despesas diversas');

-- ----------------------------------------------------------------------------
-- 2. TABELA: lancamentos
-- Armazena todas as movimentações financeiras (Receitas e Despesas) dos
-- usuários com integridade referencial, controle empresarial e validações.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lancamentos (
    id                  TEXT PRIMARY KEY,
    usuario_id          TEXT NOT NULL,
    descricao           TEXT NOT NULL CHECK (length(trim(descricao)) >= 1 AND length(descricao) <= 100),
    valor               REAL NOT NULL CHECK (valor > 0),
    data_lancamento     TEXT NOT NULL CHECK (length(data_lancamento) = 10 AND data_lancamento LIKE '____-__-__'),
    categoria           TEXT NOT NULL CHECK (length(trim(categoria)) >= 1 AND length(categoria) <= 60),
    tipo                TEXT NOT NULL CHECK (tipo IN ('income', 'expense')),
    status              TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'pendente')),
    forma_pagamento     TEXT NOT NULL DEFAULT 'Pix',
    contato             TEXT NOT NULL DEFAULT '',
    documento_ref       TEXT NOT NULL DEFAULT '',
    recorrente          INTEGER NOT NULL DEFAULT 0 CHECK (recorrente IN (0, 1)),
    observacoes         TEXT NOT NULL DEFAULT '',
    criado_em           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    atualizado_em       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Índices otimizados para as consultas de Dashboard, filtros mensais e ordenação
CREATE INDEX IF NOT EXISTS idx_lancamentos_usuario_data
    ON lancamentos(usuario_id, data_lancamento DESC, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_lancamentos_usuario_mes
    ON lancamentos(usuario_id, substr(data_lancamento, 1, 7));

CREATE INDEX IF NOT EXISTS idx_lancamentos_filtros
    ON lancamentos(usuario_id, tipo, categoria, status);

-- ----------------------------------------------------------------------------
-- 3. TABELA: metas_financeiras
-- Permite ao empreendedor definir Meta de Faturamento (Receita) e Teto de
-- Gastos (Orçamento de Despesas) por mês de referência (YYYY-MM).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metas_financeiras (
    id                  TEXT PRIMARY KEY,
    usuario_id          TEXT NOT NULL,
    mes_referencia      TEXT NOT NULL CHECK (length(mes_referencia) = 7 AND mes_referencia LIKE '____-__'),
    meta_receita        REAL NOT NULL DEFAULT 0 CHECK (meta_receita >= 0),
    teto_despesa        REAL NOT NULL DEFAULT 0 CHECK (teto_despesa >= 0),
    criado_em           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    atualizado_em       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(usuario_id, mes_referencia),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metas_usuario_mes
    ON metas_financeiras(usuario_id, mes_referencia);
