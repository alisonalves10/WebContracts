# Gestão de Contratos

Aplicação React + TypeScript com API Node e PostgreSQL local.

## Requisitos

- Node.js 22+
- Docker com o daemon em execução

## Executar localmente

```bash
cp .env.example .env
npm install
npm run dev
```

O comando inicia o PostgreSQL, aplica as migrations, popula os dados de exemplo e sobe:

- Front-end: http://localhost:3000
- API: http://localhost:4000
- Health check: http://localhost:4000/api/health

## Banco de dados

```bash
npm run db:up       # inicia somente o PostgreSQL
npm run db:migrate  # aplica migrations pendentes
npm run db:seed     # carrega dados de exemplo de forma idempotente
npm run db:studio   # abre o explorador do Drizzle
npm run db:down     # encerra o PostgreSQL
npm run db:reset    # apaga o volume e recria o banco
```

O banco local usa a porta `54329` para evitar conflito com instalações de PostgreSQL na porta padrão.

## Estrutura

- `server/db/schema.ts`: schema relacional
- `server/repositories`: acesso e transações do banco
- `server/routes`: endpoints HTTP
- `drizzle`: migrations versionadas
- `docker-compose.yml`: PostgreSQL local

O histórico de auditoria é imutável no próprio banco: alterações e exclusões em `audit_logs` são bloqueadas por trigger.
