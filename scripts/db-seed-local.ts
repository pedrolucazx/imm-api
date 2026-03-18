import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as schema from "../src/core/database/schema/index.js";
import { hashPassword } from "../src/shared/utils/password.js";
import { logger } from "../src/core/config/logger.js";

function loadEnvFiles(): void {
  const selectedEnvFile = process.env.DRIZZLE_ENV_FILE ?? ".env.local";
  const fallbackEnvFile = ".env";
  const envFiles = [selectedEnvFile, fallbackEnvFile].filter(
    (file, index, array) => array.indexOf(file) === index
  );

  const [primaryEnvFile, ...secondaryEnvFiles] = envFiles;

  const primaryEnvPath = resolve(process.cwd(), primaryEnvFile);
  if (existsSync(primaryEnvPath)) {
    config({ path: primaryEnvPath, quiet: true, override: true });
  }

  for (const file of secondaryEnvFiles) {
    const envPath = resolve(process.cwd(), file);
    if (existsSync(envPath)) {
      config({ path: envPath, quiet: true });
    }
  }
}

const DAYS_TO_SEED = 7;
const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
const buildLastNDates = (n: number, now = new Date()): string[] => {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (n - 1 - i));
    return toIsoDate(d);
  });
};

const SEEDED_DATES = buildLastNDates(DAYS_TO_SEED);
const START_DATE = SEEDED_DATES[0]!;

const ENGLISH_HABIT_ID = "4b3a7f15-7f1a-4bf2-a5de-4f5c6f9c0a01";
const GYM_HABIT_ID = "4b3a7f15-7f1a-4bf2-a5de-4f5c6f9c0a02";
const READING_HABIT_ID = "4b3a7f15-7f1a-4bf2-a5de-4f5c6f9c0a03";

const englishPlan = {
  strategy: "Shadowing + Vocabulary Immersion + Spaced Repetition",
  total_time_per_day_minutes: 30,
  success_metrics: "Journaling diário consistente + Grammar Score > 80 no dia 66",
  phases: [
    {
      phase: 1,
      days: "1-14",
      theme: "Fundação & Pronúncia",
      daily_tasks: [
        "Ouça e repita 1 episódio de podcast (shadowing) — 15 min",
        "Escreva 5 novas palavras de vocabulário profissional em contexto — 10 min",
        "Grave a si mesmo falando por 2 minutos — 5 min",
      ],
      journal_prompt: "O que você praticou hoje? Descreva uma palavra ou expressão nova que usou.",
    },
    {
      phase: 2,
      days: "15-44",
      theme: "Produção Ativa",
      daily_tasks: [
        "Escreva uma entrada de diário sobre o dia em inglês — 15 min",
        "Pratique 3 frases do vocabulário de ontem — 5 min",
        "Shadowing: 1 segmento de TED talk — 10 min",
      ],
      journal_prompt:
        "Escreva sobre seu dia em inglês. Que erros você cometeu e o que aprendeu com eles?",
    },
    {
      phase: 3,
      days: "45-66",
      theme: "Consolidação & Fluência",
      daily_tasks: [
        "Entrada completa no diário + autocrítica — 20 min",
        "Roleplay de cenário profissional (escrito) — 10 min",
      ],
      journal_prompt: "Em que situação real você usou inglês hoje? O que fluiu naturalmente?",
    },
  ],
};

const readingPlan = {
  strategy: "Consistency Anchoring + Progressive Immersion",
  total_time_per_day_minutes: 25,
  success_metrics: "66 dias consecutivos com pelo menos 1 capítulo lido",
  phases: [
    {
      phase: 1,
      days: "1-14",
      theme: "Ancorar o Gatilho",
      weekly_focus:
        "Leia no mesmo horário todos os dias. Comece com 15 páginas se 1 capítulo parecer muito.",
      tip: "Deixe o livro visível — na travesseira ou na mesa.",
      journal_prompt: "Como foi sua sessão de leitura hoje? Conseguiu manter o horário planejado?",
    },
    {
      phase: 2,
      days: "15-44",
      theme: "Aprofundar a Rotina",
      weekly_focus: "Capítulo completo diariamente. Após ler, escreva 2 frases sobre o que leu.",
      tip: "Sempre tenha o próximo livro escolhido antes de terminar o atual.",
      journal_prompt: "Qual ideia do capítulo de hoje mais te impactou? Por quê?",
    },
    {
      phase: 3,
      days: "45-66",
      theme: "Consolidação de Identidade",
      weekly_focus:
        "Você é um leitor agora. Reflita semanalmente sobre o que a leitura mudou no seu pensamento.",
      tip: "Compartilhe um insight por semana com alguém.",
      journal_prompt: "Como este hábito de leitura está mudando sua forma de pensar?",
    },
  ],
};

function buildLogs(habitId: string, completedIndexes: number[]): schema.NewHabitLog[] {
  const completedSet = new Set(completedIndexes);
  return SEEDED_DATES.map((date, i) => {
    const completed = completedSet.has(i);
    return {
      habitId,
      logDate: date,
      completed,
      completedAt: completed ? new Date(`${date}T07:30:00.000Z`) : null,
    };
  });
}

async function main(): Promise<void> {
  loadEnvFiles();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Check .env.local / .env configuration.");
  }

  const hostname = new URL(databaseUrl).hostname;
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!localHosts.has(hostname) && process.env.ALLOW_NON_LOCAL_SEED !== "true") {
    throw new Error(
      `Refusing to seed non-local database (${hostname}). Set ALLOW_NON_LOCAL_SEED=true to override.`
    );
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql, { schema });

  const demoEmail = "joao.demo@inside-my-mind.local";
  const demoPassword = "12345678";
  const hashedPassword = await hashPassword(demoPassword);

  try {
    const seeded = await db.transaction(async (tx) => {
      let [user] = await tx
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, demoEmail))
        .limit(1);

      if (!user) {
        [user] = await tx
          .insert(schema.users)
          .values({ email: demoEmail, passwordHash: hashedPassword, name: "João" })
          .returning();
      } else {
        [user] = await tx
          .update(schema.users)
          .set({ name: "João", passwordHash: hashedPassword, updatedAt: new Date() })
          .where(eq(schema.users.id, user.id))
          .returning();
      }

      const [existingProfile] = await tx
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, user.id))
        .limit(1);

      if (!existingProfile) {
        await tx.insert(schema.userProfiles).values({
          userId: user.id,
          uiLanguage: "pt-BR",
          timezone: "America/Fortaleza",
        });
      } else {
        await tx
          .update(schema.userProfiles)
          .set({ uiLanguage: "pt-BR", timezone: "America/Fortaleza" })
          .where(eq(schema.userProfiles.userId, user.id));
      }

      await tx.delete(schema.habits).where(eq(schema.habits.userId, user.id));

      await tx.insert(schema.habits).values([
        {
          id: ENGLISH_HABIT_ID,
          userId: user.id,
          name: "Practice English 30m daily",
          targetSkill: "en-US",
          icon: "🌍",
          color: "bg-surface-mint",
          frequency: "daily",
          targetDays: 66,
          isActive: true,
          sortOrder: 0,
          startDate: START_DATE,
          planStatus: "ready",
          habitPlan: englishPlan,
        },
        {
          id: GYM_HABIT_ID,
          userId: user.id,
          name: "Go to the gym",
          targetSkill: "fitness",
          icon: "💪",
          color: "bg-surface-coral",
          frequency: "daily",
          targetDays: 66,
          isActive: true,
          sortOrder: 1,
          startDate: START_DATE,
          planStatus: "active",
          habitPlan: {},
        },
        {
          id: READING_HABIT_ID,
          userId: user.id,
          name: "Read 1 chapter (non-technical book)",
          targetSkill: "general",
          icon: "📚",
          color: "bg-surface-lavender",
          frequency: "daily",
          targetDays: 66,
          isActive: true,
          sortOrder: 2,
          startDate: START_DATE,
          planStatus: "ready",
          habitPlan: readingPlan,
        },
      ]);

      // Índice 6 = hoje — não completado para simular início do dia
      const englishLogs = buildLogs(ENGLISH_HABIT_ID, [2, 3, 4, 5]);
      const gymLogs = buildLogs(GYM_HABIT_ID, [3, 4, 5]);
      const readingLogs = buildLogs(READING_HABIT_ID, [1, 2, 3, 4, 5]);

      await tx.insert(schema.habitLogs).values([...englishLogs, ...gymLogs, ...readingLogs]);

      await tx.delete(schema.journalEntries).where(eq(schema.journalEntries.userId, user.id));

      await tx.insert(schema.journalEntries).values([
        {
          id: randomUUID(),
          userId: user.id,
          habitId: ENGLISH_HABIT_ID,
          entryDate: SEEDED_DATES[2]!,
          content:
            "Today I practiced shadowing with a TED talk about habits. My pronunciation of 'particularly' is still off but getting better. I noticed I can follow most of the conversation without pausing.",
          wordCount: 33,
          uiLanguageSnap: "pt-BR",
          targetSkillSnap: "en-US",
          moodScore: 4,
          energyScore: 3,
          aiAgentType: "language-teacher",
          aiFeedback: {
            agentType: "language-teacher",
            targetSkill: "en-US",
            linguistic: { grammarScore: 72, vocabularyScore: 68, fluencyScore: 65 },
            errors: [
              {
                original: "My pronunciation of 'particularly' is still off",
                corrected: "My pronunciation of 'particularly' still needs work",
                explanation:
                  "'is still off' é informal; 'still needs work' é mais natural em contexto de aprendizado.",
              },
              {
                original: "I noticed I can follow most of the conversation without pausing",
                corrected:
                  "I noticed I can follow most of the conversation without pausing — great progress!",
                explanation:
                  "Gramaticalmente correto. Considere adicionar contexto emocional para enriquecer o diário.",
              },
            ],
            modelSentence:
              "My pronunciation is gradually improving, especially with multisyllabic words like 'particularly' and 'specifically'.",
            nextChallenge:
              "Escolha 3 palavras difíceis do episódio e use cada uma em uma frase diferente amanhã.",
          },
          createdAt: new Date(`${SEEDED_DATES[2]}T08:15:00.000Z`),
          updatedAt: new Date(`${SEEDED_DATES[2]}T08:15:00.000Z`),
        },
        {
          id: randomUUID(),
          userId: user.id,
          habitId: READING_HABIT_ID,
          entryDate: SEEDED_DATES[2]!,
          content:
            "Terminei o terceiro capítulo de Atomic Habits. A parte sobre identidade me impactou muito — a ideia de que você não atinge suas metas, você cai ao nível dos seus sistemas.",
          wordCount: 32,
          uiLanguageSnap: "pt-BR",
          targetSkillSnap: "general",
          moodScore: 5,
          energyScore: 4,
          aiAgentType: "behavioral-coach",
          aiFeedback: {
            agentType: "behavioral-coach",
            targetSkill: "general",
            behavioral: { moodDetected: "motivated", energyLevel: "high" },
            habitAlignmentScore: 88,
            insights: [
              "Você demonstrou alta conexão emocional com o conteúdo lido, o que acelera a retenção.",
              "A citação que escolheu reflete pensamento sistêmico — exatamente o que hábitos de longo prazo exigem.",
              "Energia e humor acima da média indicam que este é um bom horário para sua leitura.",
            ],
            actionSuggestion:
              "Escreva amanhã uma versão própria da frase que mais te impactou. Isso consolida o aprendizado.",
          },
          createdAt: new Date(`${SEEDED_DATES[2]}T21:30:00.000Z`),
          updatedAt: new Date(`${SEEDED_DATES[2]}T21:30:00.000Z`),
        },
        {
          id: randomUUID(),
          userId: user.id,
          habitId: ENGLISH_HABIT_ID,
          entryDate: SEEDED_DATES[3]!,
          content:
            "Recorded myself speaking for 2 minutes about my morning routine. The words came out more naturally today. Still hesitate before complex sentences but the flow is improving steadily.",
          wordCount: 30,
          uiLanguageSnap: "pt-BR",
          targetSkillSnap: "en-US",
          moodScore: 4,
          energyScore: 4,
          aiAgentType: "language-teacher",
          aiFeedback: {
            agentType: "language-teacher",
            targetSkill: "en-US",
            linguistic: { grammarScore: 78, vocabularyScore: 74, fluencyScore: 71 },
            errors: [
              {
                original: "The words came out more naturally today",
                corrected: "The words came out more naturally today",
                explanation: "Perfeito. Sem correção necessária — uso idiomático correto.",
              },
              {
                original: "Still hesitate before complex sentences",
                corrected: "I still hesitate before complex sentences",
                explanation:
                  "Sujeito omitido. Em inglês o sujeito é obrigatório na maioria das orações.",
              },
            ],
            modelSentence:
              "My fluency is steadily improving; I no longer hesitate as much before complex structures.",
            nextChallenge:
              "Grave-se novamente amanhã mas desta vez sem roteiro. Fale sobre seus planos para a semana.",
          },
          createdAt: new Date(`${SEEDED_DATES[3]}T07:50:00.000Z`),
          updatedAt: new Date(`${SEEDED_DATES[3]}T07:50:00.000Z`),
        },
        {
          id: randomUUID(),
          userId: user.id,
          habitId: GYM_HABIT_ID,
          entryDate: SEEDED_DATES[3]!,
          content:
            "Treino de pernas hoje. Agachamento 4x8 com 60kg, leg press 3x12. Senti um pouco de dor no joelho esquerdo mas passei. Preciso aquecer mais antes de começar.",
          wordCount: 29,
          uiLanguageSnap: "pt-BR",
          targetSkillSnap: "fitness",
          moodScore: 3,
          energyScore: 3,
          aiAgentType: "behavioral-coach",
          aiFeedback: {
            agentType: "behavioral-coach",
            targetSkill: "fitness",
            behavioral: { moodDetected: "neutral", energyLevel: "medium" },
            habitAlignmentScore: 62,
            insights: [
              "Você completou o treino apesar do desconforto — isso é consistência real.",
              "A dor no joelho é um sinal importante. Ignorar pode comprometer semanas de treino.",
              "Humor e energia neutros neste dia sugerem que talvez o horário do treino não seja o ideal.",
            ],
            actionSuggestion:
              "Adicione 10 minutos de aquecimento articular antes do agachamento. Se a dor persistir, priorize exercícios sem impacto por 2 dias.",
          },
          createdAt: new Date(`${SEEDED_DATES[3]}T18:20:00.000Z`),
          updatedAt: new Date(`${SEEDED_DATES[3]}T18:20:00.000Z`),
        },
        {
          id: randomUUID(),
          userId: user.id,
          habitId: READING_HABIT_ID,
          entryDate: SEEDED_DATES[3]!,
          content:
            "Capítulo 4 — sobre as quatro leis da mudança de comportamento. 'Torne-o óbvio' faz muito sentido com minha experiência. Colocar o livro na cama tem funcionado.",
          wordCount: 27,
          uiLanguageSnap: "pt-BR",
          targetSkillSnap: "general",
          moodScore: 4,
          energyScore: 3,
          createdAt: new Date(`${SEEDED_DATES[3]}T22:00:00.000Z`),
          updatedAt: new Date(`${SEEDED_DATES[3]}T22:00:00.000Z`),
        },
        {
          id: randomUUID(),
          userId: user.id,
          habitId: ENGLISH_HABIT_ID,
          entryDate: SEEDED_DATES[4]!,
          content:
            "Shadowing session with a podcast episode on productivity. I am getting more comfortable with connected speech. Words like 'gonna' and 'wanna' feel natural now when listening.",
          wordCount: 30,
          uiLanguageSnap: "pt-BR",
          targetSkillSnap: "en-US",
          moodScore: 5,
          energyScore: 5,
          aiAgentType: "language-teacher",
          aiFeedback: {
            agentType: "language-teacher",
            targetSkill: "en-US",
            linguistic: { grammarScore: 85, vocabularyScore: 80, fluencyScore: 82 },
            errors: [
              {
                original: "I am getting more comfortable with connected speech",
                corrected: "I am getting more comfortable with connected speech",
                explanation:
                  "Correto e natural. Ótimo uso do present continuous para progresso contínuo.",
              },
            ],
            modelSentence:
              "After weeks of consistent shadowing practice, connected speech patterns are becoming second nature to me.",
            nextChallenge:
              "Tente reproduzir uma sequência de 30 segundos do podcast de memória, focando nas ligações entre palavras.",
          },
          createdAt: new Date(`${SEEDED_DATES[4]}T07:30:00.000Z`),
          updatedAt: new Date(`${SEEDED_DATES[4]}T07:30:00.000Z`),
        },
        {
          id: randomUUID(),
          userId: user.id,
          habitId: GYM_HABIT_ID,
          entryDate: SEEDED_DATES[4]!,
          content:
            "Treino de peito e tríceps. Supino plano 4x8 com 70kg, crucifixo 3x10, tríceps corda 3x12. Energia alta, ótima sessão. Bati PR no supino.",
          wordCount: 23,
          uiLanguageSnap: "pt-BR",
          targetSkillSnap: "fitness",
          moodScore: 5,
          energyScore: 5,
          aiAgentType: "behavioral-coach",
          aiFeedback: {
            agentType: "behavioral-coach",
            targetSkill: "fitness",
            behavioral: { moodDetected: "motivated", energyLevel: "high" },
            habitAlignmentScore: 95,
            insights: [
              "PR no supino é um marco significativo — comemore isso conscientemente.",
              "Energia e humor máximos indicam que este horário e este split de treino funcionam muito bem para você.",
              "A consistência dos últimos dias está claramente se traduzindo em performance física.",
            ],
            actionSuggestion:
              "Registre o PR e defina o próximo alvo (+2,5kg em 2 semanas). Metas específicas mantêm a motivação alta.",
          },
          createdAt: new Date(`${SEEDED_DATES[4]}T17:45:00.000Z`),
          updatedAt: new Date(`${SEEDED_DATES[4]}T17:45:00.000Z`),
        },
        {
          id: randomUUID(),
          userId: user.id,
          habitId: READING_HABIT_ID,
          entryDate: SEEDED_DATES[4]!,
          content:
            "Li o capítulo 5 — sobre recompensas imediatas. Difícil manter hábitos quando a recompensa é distante. O truque do 'never miss twice' vai entrar na minha rotina agora.",
          wordCount: 27,
          uiLanguageSnap: "pt-BR",
          targetSkillSnap: "general",
          moodScore: 4,
          energyScore: 4,
          aiAgentType: "behavioral-coach",
          aiFeedback: {
            agentType: "behavioral-coach",
            targetSkill: "general",
            behavioral: { moodDetected: "relaxed", energyLevel: "medium" },
            habitAlignmentScore: 80,
            insights: [
              "Você está absorvendo os conceitos de forma aplicada — não apenas lendo, mas conectando ao seu próprio comportamento.",
              "'Never miss twice' é uma das regras mais poderosas do livro. O fato de você já querer aplicá-la é ótimo sinal.",
              "Humor relaxado à noite é ideal para leitura reflexiva.",
            ],
            actionSuggestion:
              "Antes de dormir, anote um hábito atual onde o 'never miss twice' se aplicaria. Amanhã releia essa nota.",
          },
          createdAt: new Date(`${SEEDED_DATES[4]}T22:15:00.000Z`),
          updatedAt: new Date(`${SEEDED_DATES[4]}T22:15:00.000Z`),
        },
        {
          id: randomUUID(),
          userId: user.id,
          habitId: ENGLISH_HABIT_ID,
          entryDate: SEEDED_DATES[5]!,
          content:
            "Morning session today. I wrote about my weekend plans entirely in English without stopping to translate. Vocabulary is expanding naturally through context. Feeling very confident.",
          wordCount: 28,
          uiLanguageSnap: "pt-BR",
          targetSkillSnap: "en-US",
          moodScore: 5,
          energyScore: 4,
          createdAt: new Date(`${SEEDED_DATES[5]}T09:10:00.000Z`),
          updatedAt: new Date(`${SEEDED_DATES[5]}T09:10:00.000Z`),
        },
      ]);

      return { userId: user.id, email: user.email };
    });

    logger.info(
      { ...seeded, localLogin: { email: demoEmail, password: "(see scripts/db-seed-local.ts)" } },
      "Local demo seed completed"
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  logger.error(error, "Failed to run local database seed");
  process.exit(1);
});
