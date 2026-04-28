# Backoffice

Interface inicial de backoffice para o contador.

## Fluxo atual

- `auth/login.html` valida o utilizador a partir de `assets/db/database.json`.
- A `role` do utilizador fica guardada em `sessionStorage`.
- A role `admin` entra no dashboard em `admin/index.html`.
- O dashboard grava as alterações no browser via `localStorage`, usando `assets/db/database.json` como base inicial.
- O dashboard já traz áreas preparadas para:
  - criar, editar e remover partidos;
  - criar, editar e remover utilizadores;
  - criar temas e atribuir minutos por tema e por partido;
  - futura integração com a restante equipa.
- As áreas do admin estão separadas em páginas próprias:
  - `admin/partidos.html`
  - `admin/utilizadores.html`
  - `admin/temas.html`
  - `admin/tempofala.html`

## Dependências

- Bootstrap 5 via CDN.
- Boxicons via CDN.

## Observação

Os utilizadores no `database.json` não precisam de email.
Sem backend, a persistência fica no browser. O ficheiro `database.json` serve como semente inicial, e as alterações do admin ficam guardadas em `localStorage`.