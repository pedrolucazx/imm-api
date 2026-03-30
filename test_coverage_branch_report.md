# Branch Test Coverage Analysis

## Branch Information

- Branch: `feat/117-onboarding-tour`
- Base: `origin/main`
- Total files changed: 82
- Files with test coverage concerns: 3 (onboarding module + auth.service register flow)

## Executive Summary

O módulo de onboarding é bem coberto no nível E2E. O arquivo `tests/e2e/onboarding.e2e.test.ts`
existe e cobre os cenários principais de GET e PUT. Porém há lacunas relevantes:

1. Não existem testes **unitários** para `onboarding.service.ts`, `onboarding.repository.ts` e
   `onboarding.controller.ts` — os três arquivos novos do módulo.
2. O `auth.service.test.ts` **já referencia** `mockOnboardingRepo` e passa o repo ao service, mas
   **nenhum teste verifica** que `onboardingRepo.create` é chamado durante o `register` — o
   comportamento crítico desta feature.
3. O E2E cobre o caminho feliz, mas falta cobrir o comportamento do `getStatus` quando não existe
   sessão (retorno de `DEFAULT_STATUS` pela service), validação de schema do PUT com body vazio, e o
   cenário de erro de DB no `upsert`.

---

## Changed Files Analysis

### 1. `src/modules/users/onboarding.service.ts`

**Changes Made**:

- Arquivo novo. Implementa `getStatus` (retorna DEFAULT_STATUS quando sessão não existe; caso
  contrário mapeia via `toResponse`) e `update` (lógica de `completedAt` condicional + chamada ao
  `repo.upsert` somente com campos fornecidos).

**Current Test Coverage**:

- Test file: nenhum arquivo unitário para esta service (`tests/unit/` não contém
  `onboarding.service.test.ts`)
- Coverage status: Parcialmente coberto (somente via E2E)

**Missing Tests**:

- [ ] `getStatus` retorna `DEFAULT_STATUS` quando `repo.findByUserId` retorna `undefined`
- [ ] `getStatus` retorna o status mapeado quando a sessão existe (`toResponse` com `completedAt`
      como string ISO)
- [ ] `getStatus` retorna `completedAt: null` quando sessão existe mas `completedAt` é `null`
- [ ] `update` chama `repo.upsert` apenas com os campos presentes no input (partial update)
- [ ] `update` define `completedAt` como `new Date()` quando `input.completed === true`
- [ ] `update` define `completedAt` como `null` quando `input.completed === false`
- [ ] `update` não inclui `completedAt` no payload quando `input.completed` é `undefined`
- [ ] `update` retorna o resultado de `toResponse` aplicado à sessão retornada pelo `upsert`

**Priority**: High
**Rationale**: A lógica de `completedAt` condicional (3 ramos) é complexa e silenciosa — um bug
aqui corrompe o estado persistido sem lançar erro. Testes unitários isolam essa lógica sem depender
do banco.

---

### 2. `src/modules/users/onboarding.repository.ts`

**Changes Made**:

- Arquivo novo. Três métodos: `findByUserId`, `create`, `upsert` (com `onConflictDoUpdate`).

**Current Test Coverage**:

- Test file: nenhum (`tests/unit/` não contém `onboarding.repository.test.ts`)
- Coverage status: Parcialmente coberto (somente via E2E)

**Missing Tests**:

- [ ] `findByUserId` retorna `undefined` quando não há sessão para o userId
- [ ] `findByUserId` retorna a sessão quando ela existe
- [ ] `create` insere uma sessão com valores padrão e retorna o registro criado
- [ ] `upsert` insere nova sessão quando não existe conflito
- [ ] `upsert` atualiza a sessão existente quando há conflito no `userId` (verifica
      `onConflictDoUpdate`)
- [ ] Todos os métodos aceitam `tx` como segundo argumento e usam a transação em vez do `db`
      direto

**Priority**: Medium
**Rationale**: O padrão `onConflictDoUpdate` do `upsert` tem comportamento específico. Já existe
precedente no projeto — ver `tests/unit/user-profiles.repository.test.ts` e
`tests/unit/users.repository.test.ts` — portanto o padrão de mock está estabelecido.

---

### 3. `src/modules/users/onboarding.controller.ts`

**Changes Made**:

- Arquivo novo. Dois handlers: `getStatus` e `update` (com parse via `updateOnboardingSchema`).

**Current Test Coverage**:

- Test file: nenhum (`tests/unit/` não contém `onboarding.controller.test.ts`)
- Coverage status: Parcialmente coberto (somente via E2E)

**Missing Tests**:

- [ ] `getStatus` chama `service.getStatus(request.user.id)` e responde 200 com o resultado
- [ ] `getStatus` repassa o erro para `handleControllerError` quando a service lança
- [ ] `update` chama `updateOnboardingSchema.parse(request.body)` antes de chamar a service
- [ ] `update` chama `service.update(request.user.id, parsedData)` e responde 200
- [ ] `update` repassa o erro para `handleControllerError` quando a service lança

**Priority**: Low
**Rationale**: O E2E já cobre a integração completa dos handlers. Testes unitários do controller
têm valor baixo aqui, mas seguem o padrão existente no projeto (ver `auth.controller.test.ts`,
`users.controller.test.ts`, `journal.controller.test.ts`). Recomendado para consistência.

---

### 4. `src/modules/auth/auth.service.ts` — fluxo `register`

**Changes Made**:

- `onboardingRepo` adicionado como dependência do service.
- Dentro da transação do `register`, após criar `user` e `profile`, chama
  `await onboardingRepo.create(user.id, tx)`.

**Current Test Coverage**:

- Test file: `tests/unit/auth.service.test.ts` — existe e já mocka `mockOnboardingRepo`
- Coverage status: **Parcialmente coberto** — o mock existe, mas nenhum teste faz `expect` sobre
  ele

**Missing Tests**:

- [ ] `register` chama `onboardingRepo.create(userId, tx)` no caminho feliz (dentro da transação)
- [ ] `register` chama `onboardingRepo.create` após `emailVerificationTokensRepo.create` (verifica
      a ordem de criação dos registros na transação)
- [ ] `register` **não** chama `onboardingRepo.create` quando o usuário já existe (caminho de
      `ConflictError`)
- [ ] `register` propaga o erro corretamente se `onboardingRepo.create` rejeitar (falha de DB
      durante criação da sessão)

**Priority**: Critical
**Rationale**: Esta é a integração central da feature — garante que todo novo usuário sempre terá
uma sessão de onboarding. O teste "creates user and profile successfully" (linha 264) verifica
`mockTx.insert` com `toHaveBeenCalledTimes(2)` — isso não detecta se `onboardingRepo.create`
deixou de ser chamado, pois o onboarding usa o repo diretamente, não `mockTx.insert`. Portanto o
comportamento está **desprotegido por testes unitários**.

---

## Test Implementation Plan

### Critical — Implementar antes do merge

#### `auth.service.test.ts` — cobertura do `register` com onboarding

O mock `mockOnboardingRepo` já existe na função `makeMocks()`. Basta adicionar `expect` nos testes
existentes e criar o cenário de falha.

**Testes a adicionar no `describe("register")`:**

```typescript
it("calls onboardingRepo.create with userId inside the transaction on success", async () => {
  const newUser = { ...mockUser, email: "new@example.com" };

  mocks.mockTx.select = jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    }),
  });

  (mocks.mockTx.insert as jest.Mock).mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValueOnce([newUser]).mockResolvedValueOnce([mockProfile]),
    }),
  });

  mocks.mockRefreshTokensRepo.create.mockResolvedValue({} as RefreshToken);

  await authService.register({
    email: "new@example.com",
    password: "password123",
    name: "New User",
  });

  expect(mocks.mockOnboardingRepo.create).toHaveBeenCalledTimes(1);
  expect(mocks.mockOnboardingRepo.create).toHaveBeenCalledWith(
    newUser.id,
    expect.anything() // tx
  );
});

it("does not call onboardingRepo.create when user already exists", async () => {
  mocks.mockTx.select = jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([mockUser]),
      }),
    }),
  });

  await expect(
    authService.register({ email: "test@example.com", password: "pass", name: "X" })
  ).rejects.toBeInstanceOf(ConflictError);

  expect(mocks.mockOnboardingRepo.create).not.toHaveBeenCalled();
});

it("propagates error if onboardingRepo.create fails inside the transaction", async () => {
  mocks.mockTx.select = jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    }),
  });

  (mocks.mockTx.insert as jest.Mock).mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValueOnce([mockUser]).mockResolvedValueOnce([mockProfile]),
    }),
  });

  const dbError = new Error("onboarding insert failed");
  mocks.mockOnboardingRepo.create.mockRejectedValue(dbError);

  await expect(
    authService.register({ email: "new@example.com", password: "pass", name: "X" })
  ).rejects.toBe(dbError);
});
```

**Ajuste no teste existente "creates user and profile successfully":**

Adicionar ao final do teste:

```typescript
expect(mocks.mockOnboardingRepo.create).toHaveBeenCalledTimes(1);
```

---

### High Priority — Implementar junto com o merge ou na sequência imediata

#### `tests/unit/onboarding.service.test.ts` — arquivo novo

```typescript
import { createOnboardingService } from "@/modules/users/onboarding.service.js";
import type { OnboardingRepository } from "@/modules/users/onboarding.repository.js";

function makeMockRepo(): jest.Mocked<OnboardingRepository> {
  return {
    findByUserId: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  };
}

const baseSession = {
  id: "session-id",
  userId: "user-id",
  currentStep: 0,
  skipped: false,
  completed: false,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("OnboardingService", () => {
  let repo: jest.Mocked<OnboardingRepository>;
  let service: ReturnType<typeof createOnboardingService>;

  beforeEach(() => {
    repo = makeMockRepo();
    service = createOnboardingService({ repo });
  });

  describe("getStatus", () => {
    it("returns DEFAULT_STATUS when no session exists");
    it("returns mapped status when session exists");
    it("returns completedAt as ISO string when session has completedAt");
    it("returns completedAt as null when session has null completedAt");
  });

  describe("update", () => {
    it("calls upsert with only the fields present in input");
    it("sets completedAt to a Date when completed is true");
    it("sets completedAt to null when completed is false");
    it("does not include completedAt when completed is undefined");
    it("returns mapped response from upsert result");
  });
});
```

---

### Medium Priority — Implementar em sprint seguinte

#### `tests/unit/onboarding.repository.test.ts` — arquivo novo

Seguir o padrão de `tests/unit/user-profiles.repository.test.ts`. Cobrir:

- `findByUserId`: retorna `undefined` / retorna sessão existente
- `create`: insere e retorna o registro
- `upsert`: path de insert e path de update por conflito no `userId`
- Cada método deve ser testado com e sem o argumento `tx`

---

### Low Priority — Opcional, por consistência com o padrão do projeto

#### `tests/unit/onboarding.controller.test.ts` — arquivo novo

Seguir o padrão de `tests/unit/users.controller.test.ts`. Cobrir:

- `getStatus`: delega para `service.getStatus`, responde 200
- `getStatus`: repassa erro para `handleControllerError`
- `update`: valida body via `updateOnboardingSchema.parse`, delega para `service.update`, responde 200
- `update`: repassa erro para `handleControllerError`

---

## Análise do `onboarding.e2e.test.ts` — Status Atual

O arquivo está **bem implementado** para cobertura E2E de caminho feliz. Cobre:

| Cenário                                               | Status  |
| ----------------------------------------------------- | ------- |
| GET sem token → 401                                   | Coberto |
| GET com token → retorna status inicial (step 0)       | Coberto |
| Register cria sessão automaticamente (verifica no DB) | Coberto |
| PUT sem token → 401                                   | Coberto |
| PUT currentStep                                       | Coberto |
| PUT completed=true → popula completedAt               | Coberto |
| PUT reset (completed=false, skipped=false, step=0)    | Coberto |
| PUT skipped=true                                      | Coberto |
| PUT currentStep fora do range (99) → 400              | Coberto |

**Lacunas opcionais no E2E** (baixa prioridade — o E2E já é extenso):

- [ ] PUT com body vazio `{}` → deve retornar 200 sem alterar o estado (nenhum campo obrigatório
      no schema Zod, todos são `optional()`)
- [ ] PUT com tipo errado, ex: `{ currentStep: "string" }` → deve retornar 400 via validação do
      Fastify JSON schema
- [ ] GET para usuário cujo registro existia antes desta feature (sem sessão no banco) — o service
      retorna `DEFAULT_STATUS` em vez de 404; confirmar via E2E se necessário

---

## Summary Statistics

- Files analyzed: 4 (3 novos + auth.service.ts modificado)
- Files with adequate test coverage: 1 (onboarding.e2e.test.ts — E2E completo)
- Files needing additional tests: 3
- Total test scenarios identified: 23
- Estimated effort: ~3-4h (críticos: 1h, high: 1.5h, medium/low: 1h)

---

## Recommendations

1. **Antes do merge**: Adicionar os 3 casos do `register` no `auth.service.test.ts` e corrigir o
   teste "creates user and profile successfully" para incluir o `expect` no `onboardingRepo.create`.
   São adições de ~30 linhas no arquivo existente — custo mínimo, proteção máxima para o fluxo
   central da feature.

2. **Alta prioridade pós-merge**: Criar `tests/unit/onboarding.service.test.ts`. A lógica de
   `completedAt` condicional no `update` tem 3 ramos que só testes unitários cobrem de forma
   precisa e rápida — o E2E não distingue "completedAt foi null porque foi setado como null" de
   "completedAt estava null porque o campo não foi incluído no upsert".

3. **Média prioridade**: Criar `tests/unit/onboarding.repository.test.ts`. O padrão já existe no
   projeto para outros repos. O método `upsert` com `onConflictDoUpdate` merece teste específico
   para garantir que o path de atualização funciona independente de mudanças no schema.

4. **Opcional**: `onboarding.controller.test.ts` e os E2E extras são por consistência com o padrão
   do projeto, não por risco real — o E2E existente já garante o comportamento end-to-end.
