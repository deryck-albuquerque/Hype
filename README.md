# Hype

Plataforma para organizar solicitações de desenvolvimento, atribuir responsáveis e acompanhar o andamento até a conclusão dos testes.

## Funcionalidades

- Login e controle de acesso por perfil: PO, Tech Lead, Developer e QA.
- Gestão de usuários por PO e Tech Lead: listagem, criação e exclusão.
- Proteção contra exclusão de usuários vinculados a solicitações ou ao histórico, da própria conta ou do último PO.
- Criação, atribuição, consulta e exclusão de solicitações.
- Atualização de status conforme o papel do usuário.
- Filtros por status, responsável, prioridade e data.
- Histórico de mudanças e comentários.
- Atualização de nome, e-mail e senha do perfil.

## Tecnologias

- Frontend: React, TypeScript, Tailwind CSS e Vite.
- Backend: Python, FastAPI e SQLAlchemy assíncrono.
- Banco de dados: PostgreSQL.
- Infraestrutura: Docker Compose e Nginx.
- Testes da API: pytest e SQLite temporário.

## Executar localmente

É necessário ter Docker e Docker Compose instalados. Crie um arquivo `.env` na raiz do projeto com as variáveis abaixo e substitua os valores de exemplo:

```env
POSTGRES_USER=hype
POSTGRES_PASSWORD=defina-uma-senha
POSTGRES_DB=hype
POSTGRES_HOST_PORT=5433

JWT_SECRET_KEY=substitua-por-um-segredo-longo
JWT_EXPIRE_MINUTES=60
FRONTEND_ORIGIN=http://localhost

INITIAL_PO_NAME=Product Owner
INITIAL_PO_EMAIL=po@example.com
INITIAL_PO_PASSWORD=defina-uma-senha
```

Suba a aplicação:

```bash
docker compose up -d --build
```

A interface estará em `http://localhost`. A documentação da API estará em `http://localhost:8000/docs`.

Para criar o usuário PO inicial:

```bash
docker compose --profile seed run --rm seed-po
```

## Testes

```bash
docker compose --profile test run --rm tests
```

Os testes usam um banco SQLite temporário e não alteram os dados do PostgreSQL local.


## Autor

Desenvolvido por **Deryck Henrique Albuquerque**