import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../src/core/database/schema/index.js";
import { hashPassword } from "../src/shared/utils/password.js";
import { logger } from "../src/core/config/logger.js";

// Loads DRIZZLE_ENV_FILE (default: .env.local) with override:true so it takes
// precedence over the fallback .env, which fills in any missing variables.
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

// Static demo date — intentionally fixed so streak calculations are reproducible.
// Update this value when refreshing demo data after long periods of inactivity.
// startDate = 2026-03-07 → currentDay = 7 on 2026-03-13
const START_DATE = "2026-03-07";

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
    },
    {
      phase: 3,
      days: "45-66",
      theme: "Consolidação & Fluência",
      daily_tasks: [
        "Entrada completa no diário + autocrítica — 20 min",
        "Roleplay de cenário profissional (escrito) — 10 min",
      ],
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
    },
    {
      phase: 2,
      days: "15-44",
      theme: "Aprofundar a Rotina",
      weekly_focus: "Capítulo completo diariamente. Após ler, escreva 2 frases sobre o que leu.",
      tip: "Sempre tenha o próximo livro escolhido antes de terminar o atual.",
    },
    {
      phase: 3,
      days: "45-66",
      theme: "Consolidação de Identidade",
      weekly_focus:
        "Você é um leitor agora. Reflita semanalmente sobre o que a leitura mudou no seu pensamento.",
      tip: "Compartilhe um insight por semana com alguém.",
    },
  ],
};

// Logs para os últimos 7 dias (2026-03-07 a 2026-03-13)
// English  → streak 5: completo nos dias 09-13, não completo 07-08
// Gym      → streak 4: completo nos dias 10-13, não completo 07-09
// Reading  → streak 6: completo nos dias 08-13, não completo 07
function buildLogs(habitId: string, completedDates: string[]): schema.NewHabitLog[] {
  const allDates = [
    "2026-03-07",
    "2026-03-08",
    "2026-03-09",
    "2026-03-10",
    "2026-03-11",
    "2026-03-12",
    "2026-03-13",
  ];
  const completedSet = new Set(completedDates);
  return allDates.map((date) => {
    const completed = completedSet.has(date);
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

  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql, { schema });

  const demoEmail = "joao.demo@inside-my-mind.local";
  const demoPassword = "12345678";
  const hashedPassword = await hashPassword(demoPassword);

  try {
    const seeded = await db.transaction(async (tx) => {
      // ── User ──────────────────────────────────────────────────────────────
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

      // ── Profile ───────────────────────────────────────────────────────────
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

      // ── Habits ────────────────────────────────────────────────────────────
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

      // ── Logs (streaks: English=5, Gym=4, Reading=6) ───────────────────────
      const englishLogs = buildLogs(ENGLISH_HABIT_ID, [
        "2026-03-09",
        "2026-03-10",
        "2026-03-11",
        "2026-03-12",
        "2026-03-13",
      ]);
      const gymLogs = buildLogs(GYM_HABIT_ID, [
        "2026-03-10",
        "2026-03-11",
        "2026-03-12",
        "2026-03-13",
      ]);
      const readingLogs = buildLogs(READING_HABIT_ID, [
        "2026-03-08",
        "2026-03-09",
        "2026-03-10",
        "2026-03-11",
        "2026-03-12",
        "2026-03-13",
      ]);

      await tx.insert(schema.habitLogs).values([...englishLogs, ...gymLogs, ...readingLogs]);

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
