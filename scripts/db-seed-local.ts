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
  const envFile = process.env.DRIZZLE_ENV_FILE ?? ".env";
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    config({ path: envPath, quiet: true, override: true });
  }
}

const DAYS_TO_SEED = 66;
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
const MEDITATION_HABIT_ID = "4b3a7f15-7f1a-4bf2-a5de-4f5c6f9c0a04";
const SPANISH_HABIT_ID = "4b3a7f15-7f1a-4bf2-a5de-4f5c6f9c0a05";

const ENGLISH_SKIPS = new Set([6, 15, 16, 45]);
const GYM_SKIPS = new Set([0, 4, 6, 9, 11, 14, 16, 19, 24, 26, 29, 31, 34, 36, 39, 41, 50, 55]);
const READING_SKIPS = new Set([15, 43]);
const MEDITATION_SKIPS = new Set([3, 28, 55]);
const SPANISH_SKIPS = new Set([4, 12, 22, 35, 49]);

function makeIndexArray(total: number, skips: Set<number>): number[] {
  return Array.from({ length: total }, (_, i) => i).filter((i) => !skips.has(i));
}

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
  const todayIdx = SEEDED_DATES.length - 1;
  return SEEDED_DATES.map((date, i) => {
    const completed = completedSet.has(i) && i !== todayIdx;
    return {
      habitId,
      logDate: date,
      completed,
      completedAt: completed ? new Date(`${date}T07:30:00.000Z`) : null,
    };
  });
}

interface MoodEntry {
  dayIdx: number;
  habitId: string;
  mood: number;
  energy: number;
  wordCount: number;
  content: string;
  hour: string;
}

const MOOD_ENTRIES: MoodEntry[] = [
  {
    dayIdx: 39,
    habitId: MEDITATION_HABIT_ID,
    mood: 4,
    energy: 3,
    wordCount: 20,
    hour: "06:30",
    content:
      "Sessão de 10 minutos de mindfulness. Difícil manter o foco no início, mas melhorou. A leveza que fica depois está valendo a pena.",
  },
  {
    dayIdx: 44,
    habitId: MEDITATION_HABIT_ID,
    mood: 4,
    energy: 4,
    wordCount: 22,
    hour: "06:20",
    content:
      "Focado na respiração por 10 minutos completos sem distração. Clareza mental notavelmente melhor durante o trabalho hoje.",
  },
  {
    dayIdx: 49,
    habitId: MEDITATION_HABIT_ID,
    mood: 5,
    energy: 4,
    wordCount: 24,
    hour: "06:15",
    content:
      "Melhor sessão até agora. A mente ficou quieta naturalmente. Começo a notar padrões de pensamento ansioso antes que tomem conta.",
  },
  {
    dayIdx: 54,
    habitId: MEDITATION_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 26,
    hour: "06:10",
    content:
      "A meditação virou parte do amanhecer. 10 minutos de presença completa. Estou mais paciente no trabalho e nas relações.",
  },
  {
    dayIdx: 59,
    habitId: MEDITATION_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 28,
    hour: "06:05",
    content:
      "Estado de flow durante a meditação. Nenhum esforço para manter o foco — apenas presença. Esse hábito transformou minha manhã.",
  },
  {
    dayIdx: 64,
    habitId: MEDITATION_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 25,
    hour: "06:00",
    content:
      "Penúltimo dia do ciclo. A meditação matinal é tão automática quanto escovar os dentes. Serei uma pessoa mais presente.",
  },
  {
    dayIdx: 5,
    habitId: SPANISH_HABIT_ID,
    mood: 3,
    energy: 2,
    wordCount: 14,
    hour: "20:30",
    content:
      "Primer día real de práctica. Repasé el alfabeto y los números. Me siento como un niño aprendiendo todo desde cero.",
  },
  {
    dayIdx: 10,
    habitId: SPANISH_HABIT_ID,
    mood: 3,
    energy: 3,
    wordCount: 16,
    hour: "20:15",
    content:
      "Practiqué saludos y frases básicas. El acento todavía es muy rígido pero empiezo a reconocer patrones.",
  },
  {
    dayIdx: 15,
    habitId: SPANISH_HABIT_ID,
    mood: 3,
    energy: 3,
    wordCount: 18,
    hour: "20:00",
    content:
      "Verbos en presente. Ser vs estar sigue siendo confuso pero entiendo la lógica básica ahora.",
  },
  {
    dayIdx: 20,
    habitId: SPANISH_HABIT_ID,
    mood: 4,
    energy: 3,
    wordCount: 20,
    hour: "20:10",
    content:
      "Escuché mi primer podcast en español a velocidad normal. Entendí cerca del 40%. Más de lo que esperaba.",
  },
  {
    dayIdx: 25,
    habitId: SPANISH_HABIT_ID,
    mood: 4,
    energy: 4,
    wordCount: 22,
    hour: "19:50",
    content:
      "Escribí mis primeras 5 oraciones completas sin consultar nada. La gramática tiene errores pero el mensaje fue claro.",
  },
  {
    dayIdx: 30,
    habitId: SPANISH_HABIT_ID,
    mood: 4,
    energy: 4,
    wordCount: 22,
    hour: "20:05",
    content:
      "Conversé 5 minutos en español con un nativo. Cometí errores pero pude comunicarme. Momento de gran motivación.",
  },
  {
    dayIdx: 35,
    habitId: SPANISH_HABIT_ID,
    mood: 4,
    energy: 3,
    wordCount: 20,
    hour: "20:00",
    content:
      "Medio ciclo completado. El vocabulario crece pero la fluidez todavía necesita mucho trabajo. Sigo adelante.",
  },
  {
    dayIdx: 40,
    habitId: SPANISH_HABIT_ID,
    mood: 3,
    energy: 3,
    wordCount: 18,
    hour: "20:00",
    content:
      "Practiqué conjugaciones del pasado por 20 minutos. El pretérito indefinido vs imperfecto todavía me confunde bastante.",
  },
  {
    dayIdx: 45,
    habitId: SPANISH_HABIT_ID,
    mood: 4,
    energy: 3,
    wordCount: 22,
    hour: "19:45",
    content:
      "Escuché un podcast en español. Entendí el 80% sin pausar. El vocabulario crece naturalmente con la exposición diaria.",
  },
  {
    dayIdx: 50,
    habitId: SPANISH_HABIT_ID,
    mood: 4,
    energy: 4,
    wordCount: 24,
    hour: "19:30",
    content:
      "Escribí un párrafo completo sobre mi rutina sin consultar diccionario. El español empieza a fluir con más naturalidad.",
  },
  {
    dayIdx: 55,
    habitId: SPANISH_HABIT_ID,
    mood: 5,
    energy: 4,
    wordCount: 26,
    hour: "20:15",
    content:
      "Conversación de práctica con nativo por 15 minutos. Me mantuve hablando sin grandes bloqueos. Progreso real y emocionante.",
  },
  {
    dayIdx: 60,
    habitId: SPANISH_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 28,
    hour: "19:20",
    content:
      "Entendí una serie en español sin subtítulos por primera vez. La comprensión auditiva mejoró radicalmente estas últimas semanas.",
  },
  {
    dayIdx: 65,
    habitId: SPANISH_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 30,
    hour: "19:00",
    content:
      "Último día del ciclo. El español ya no es extranjero para mí — es una herramienta que uso con confianza. Ciclo completado.",
  },
  {
    dayIdx: 8,
    habitId: ENGLISH_HABIT_ID,
    mood: 3,
    energy: 3,
    wordCount: 22,
    hour: "08:20",
    content:
      "Watched a 10-minute YouTube video in English without subtitles. Caught about 70% of it. Vocabulary is growing slowly.",
  },
  {
    dayIdx: 12,
    habitId: ENGLISH_HABIT_ID,
    mood: 3,
    energy: 4,
    wordCount: 24,
    hour: "08:00",
    content:
      "Read two news articles and highlighted unknown words. Building my vocabulary list now. Consistent input matters.",
  },
  {
    dayIdx: 18,
    habitId: ENGLISH_HABIT_ID,
    mood: 4,
    energy: 3,
    wordCount: 26,
    hour: "07:50",
    content:
      "Had my first real conversation with a native speaker online. Short but meaningful — the words came out naturally.",
  },
  {
    dayIdx: 24,
    habitId: ENGLISH_HABIT_ID,
    mood: 4,
    energy: 4,
    wordCount: 28,
    hour: "08:05",
    content:
      "Wrote a short story in English. Grammar mistakes still there but the ideas flowed well. Getting more comfortable.",
  },
  {
    dayIdx: 30,
    habitId: ENGLISH_HABIT_ID,
    mood: 4,
    energy: 4,
    wordCount: 30,
    hour: "08:00",
    content:
      "Half way through the cycle. My English has noticeably improved. Thinking in English more naturally now.",
  },
  {
    dayIdx: 36,
    habitId: ENGLISH_HABIT_ID,
    mood: 3,
    energy: 3,
    wordCount: 22,
    hour: "08:10",
    content:
      "Practiced shadowing with a podcast about productivity. Rhythm is still inconsistent but improving.",
  },
  {
    dayIdx: 37,
    habitId: GYM_HABIT_ID,
    mood: 3,
    energy: 4,
    wordCount: 19,
    hour: "18:00",
    content:
      "Treino de costas. Puxada 4x10, remada curvada 3x12. Bom ritmo, corpo respondendo bem.",
  },
  {
    dayIdx: 38,
    habitId: READING_HABIT_ID,
    mood: 4,
    energy: 3,
    wordCount: 24,
    hour: "21:30",
    content:
      "Capítulo 8 de Atomic Habits. A ideia de sistemas sobre metas faz cada vez mais sentido.",
  },
  {
    dayIdx: 39,
    habitId: ENGLISH_HABIT_ID,
    mood: 3,
    energy: 4,
    wordCount: 26,
    hour: "07:55",
    content:
      "Vocabulary deep dive. Learned 8 professional expressions and used them in sample sentences.",
  },
  {
    dayIdx: 40,
    habitId: GYM_HABIT_ID,
    mood: 4,
    energy: 4,
    wordCount: 20,
    hour: "17:45",
    content:
      "Treino de ombros. Desenvolvimento 4x8 com 40kg. Me senti forte e focado durante toda a sessão.",
  },
  {
    dayIdx: 41,
    habitId: READING_HABIT_ID,
    mood: 4,
    energy: 3,
    wordCount: 27,
    hour: "22:00",
    content:
      "Leitura mais difícil hoje, muitos conceitos novos sobre identidade e mudança de comportamento.",
  },
  {
    dayIdx: 42,
    habitId: ENGLISH_HABIT_ID,
    mood: 4,
    energy: 4,
    wordCount: 30,
    hour: "08:00",
    content:
      "Wrote a full diary entry in English without stopping to translate. That is a real milestone.",
  },
  {
    dayIdx: 43,
    habitId: GYM_HABIT_ID,
    mood: 3,
    energy: 3,
    wordCount: 18,
    hour: "18:30",
    content:
      "Treino leve — perna cansada do dia anterior. Optei por cardio e mobilidade. Decisão inteligente.",
  },
  {
    dayIdx: 44,
    habitId: READING_HABIT_ID,
    mood: 4,
    energy: 4,
    wordCount: 25,
    hour: "21:15",
    content:
      "Terminei mais um capítulo. Já estou na fase de consolidação e a leitura flui mais naturalmente.",
  },
  {
    dayIdx: 45,
    habitId: ENGLISH_HABIT_ID,
    mood: 3,
    energy: 3,
    wordCount: 23,
    hour: "07:40",
    content: "Shadowing session focused on stress patterns in compound nouns and connected speech.",
  },
  {
    dayIdx: 46,
    habitId: GYM_HABIT_ID,
    mood: 4,
    energy: 5,
    wordCount: 21,
    hour: "17:30",
    content:
      "Treino de peito. Supino 4x8 com 72kg — novo PR! Energia excelente, cada série foi limpa.",
  },
  {
    dayIdx: 47,
    habitId: READING_HABIT_ID,
    mood: 5,
    energy: 4,
    wordCount: 28,
    hour: "21:45",
    content:
      "Insights sobre identidade de leitor. Essa mudança de perspectiva está transformando como penso.",
  },
  {
    dayIdx: 48,
    habitId: ENGLISH_HABIT_ID,
    mood: 4,
    energy: 4,
    wordCount: 29,
    hour: "08:05",
    content:
      "Recorded myself speaking. Much more natural flow than week 3. The hesitations are decreasing.",
  },
  {
    dayIdx: 49,
    habitId: GYM_HABIT_ID,
    mood: 4,
    energy: 4,
    wordCount: 22,
    hour: "18:10",
    content:
      "Treino de braços. Rosca direta + tríceps. Volume alto, boa recuperação entre as séries.",
  },
  {
    dayIdx: 50,
    habitId: READING_HABIT_ID,
    mood: 4,
    energy: 4,
    wordCount: 26,
    hour: "22:10",
    content:
      "Reflexão sobre a jornada de leitura. 50 dias lendo diariamente mudou meu ritmo completamente.",
  },
  {
    dayIdx: 51,
    habitId: ENGLISH_HABIT_ID,
    mood: 5,
    energy: 4,
    wordCount: 32,
    hour: "07:50",
    content:
      "Complex conversation practice. Can handle idioms and phrasal verbs now without pausing to think.",
  },
  {
    dayIdx: 52,
    habitId: GYM_HABIT_ID,
    mood: 4,
    energy: 5,
    wordCount: 20,
    hour: "17:20",
    content:
      "Treino de pernas. Agachamento 4x8 com 65kg — 5kg a mais que há 3 semanas. Progresso real.",
  },
  {
    dayIdx: 53,
    habitId: READING_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 30,
    hour: "21:00",
    content:
      "Comecei novo livro. A identidade de leitor já está tão consolidada que começo sem esforço.",
  },
  {
    dayIdx: 54,
    habitId: ENGLISH_HABIT_ID,
    mood: 5,
    energy: 4,
    wordCount: 35,
    hour: "08:15",
    content:
      "Grammar feels automatic now. Writing flows without constant self-correction. This is the shift.",
  },
  {
    dayIdx: 55,
    habitId: GYM_HABIT_ID,
    mood: 4,
    energy: 4,
    wordCount: 19,
    hour: "18:00",
    content:
      "Treino de costas. Completei todas as séries sem descanso extra pela primeira vez. Marco importante.",
  },
  {
    dayIdx: 56,
    habitId: READING_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 31,
    hour: "07:30",
    content:
      "Leitura de manhã hoje pela primeira vez. Esse hábito virou piloto automático sem perceber.",
  },
  {
    dayIdx: 57,
    habitId: ENGLISH_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 38,
    hour: "07:45",
    content:
      "Best session yet. Wrote a full essay in English with minimal grammar errors. Almost fluent now.",
  },
  {
    dayIdx: 58,
    habitId: GYM_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 22,
    hour: "17:15",
    content:
      "Treino completo. Bati PR em três exercícios diferentes. Forma física no melhor momento dos 66 dias.",
  },
  {
    dayIdx: 59,
    habitId: READING_HABIT_ID,
    mood: 5,
    energy: 4,
    wordCount: 29,
    hour: "21:30",
    content:
      "Insight profundo sobre aprendizado contínuo. Estou aplicando diretamente na minha rotina diária.",
  },
  {
    dayIdx: 60,
    habitId: ENGLISH_HABIT_ID,
    mood: 4,
    energy: 5,
    wordCount: 33,
    hour: "08:00",
    content:
      "Practiced with a native speaker online for 20 minutes. Held the full conversation without freezing.",
  },
  {
    dayIdx: 61,
    habitId: GYM_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 24,
    hour: "17:30",
    content:
      "Treino intenso e recompensador. O corpo responde exatamente como eu espero agora. 66 dias valem.",
  },
  {
    dayIdx: 62,
    habitId: READING_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 32,
    hour: "21:00",
    content:
      "Finalizei o segundo livro do ciclo. O impacto na minha forma de pensar é mensurável e real.",
  },
  {
    dayIdx: 63,
    habitId: ENGLISH_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 36,
    hour: "07:40",
    content:
      "Near-perfect session. English is becoming second nature. I think in English without translating.",
  },
  {
    dayIdx: 64,
    habitId: GYM_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 25,
    hour: "17:00",
    content:
      "Penúltimo treino do ciclo de 66 dias. Força, disciplina e foco em cada série. Quase lá.",
  },
  {
    dayIdx: 65,
    habitId: READING_HABIT_ID,
    mood: 5,
    energy: 5,
    wordCount: 34,
    hour: "21:45",
    content:
      "Último dia. Hábito de leitura consolidado definitivamente. Já escolhi o próximo livro. Ciclo completo.",
  },
];

function generateMoodFeedback(
  habitId: string,
  mood: number,
  energy: number,
  targetSkill: string
): { aiAgentType: string; aiFeedback: object } {
  if (habitId === ENGLISH_HABIT_ID || habitId === SPANISH_HABIT_ID) {
    const grammarScore = Math.min(70 + mood * 4, 100);
    const vocabScore = Math.min(grammarScore - 3, 100);
    const fluencyScore = Math.min(65 + mood * 4 + (energy > 3 ? 5 : 0), 100);
    const isSpanish = habitId === SPANISH_HABIT_ID;
    return {
      aiAgentType: "language-teacher",
      aiFeedback: {
        agentType: "language-teacher",
        targetSkill,
        linguistic: { grammarScore, vocabularyScore: vocabScore, fluencyScore },
        errors: [],
        modelSentence:
          mood >= 4
            ? isSpanish
              ? "La práctica diaria constante está construyendo una fluidez real y duradera."
              : "Consistent daily practice is steadily building real fluency."
            : isSpanish
              ? "Cada sesión importa — sigue adelante y el progreso se acumula."
              : "Every session matters — keep going and the progress compounds.",
        nextChallenge:
          energy >= 4
            ? isSpanish
              ? "Escribe mañana un párrafo sobre un tema nuevo que nunca hayas intentado en español."
              : "Write one full paragraph tomorrow on a topic you have never tried in English."
            : isSpanish
              ? "Escucha un segmento corto de podcast y resúmelo en 3 oraciones."
              : "Listen to a short podcast segment and summarize it in 3 sentences.",
      },
    };
  }

  const moodDetected = mood >= 4 ? "motivated" : mood === 3 ? "neutral" : "tired";
  const energyLevel = energy >= 4 ? "high" : energy === 3 ? "medium" : "low";
  const habitAlignmentScore = Math.min(60 + mood * 7 + (energy > 3 ? 5 : 0), 100);

  if (habitId === MEDITATION_HABIT_ID) {
    return {
      aiAgentType: "behavioral-coach",
      aiFeedback: {
        agentType: "behavioral-coach",
        targetSkill,
        behavioral: { moodDetected, energyLevel },
        habitAlignmentScore,
        insights: [
          mood >= 4
            ? "Sua mente está mais receptiva ao silêncio — isso indica amadurecimento da prática."
            : "Praticar mesmo quando a mente está agitada é exatamente quando a meditação mais importa.",
        ],
        actionSuggestion:
          mood >= 4
            ? "Experimente estender para 12 minutos amanhã para testar seus limites com conforto."
            : "Amanhã, antes de começar, respire fundo 3 vezes e solte o julgamento sobre a sessão.",
      },
    };
  }

  return {
    aiAgentType: "behavioral-coach",
    aiFeedback: {
      agentType: "behavioral-coach",
      targetSkill,
      behavioral: { moodDetected, energyLevel },
      habitAlignmentScore,
      insights: [
        mood >= 4
          ? "Ótimo estado emocional — aproveite esse momentum para solidificar o hábito."
          : "Completar a sessão mesmo sem energia total é onde a consistência real é forjada.",
      ],
      actionSuggestion:
        mood >= 4
          ? "Documente o que tornou essa sessão boa para replicar nas próximas."
          : "Descanso ativo faz parte do processo — amanhã você começa de um nível mais alto.",
    },
  };
}

async function main(): Promise<void> {
  loadEnvFiles();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      `DATABASE_URL is not set. Check your ${process.env.DRIZZLE_ENV_FILE ?? ".env"} file.`
    );
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
          .values({
            email: demoEmail,
            passwordHash: hashedPassword,
            name: "João",
            emailVerifiedAt: new Date(),
          })
          .returning();
      } else {
        [user] = await tx
          .update(schema.users)
          .set({
            name: "João",
            passwordHash: hashedPassword,
            emailVerifiedAt: new Date(),
            updatedAt: new Date(),
          })
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
          aiRequestsToday: 12,
        });
      } else {
        await tx
          .update(schema.userProfiles)
          .set({ uiLanguage: "pt-BR", timezone: "America/Fortaleza", aiRequestsToday: 12 })
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
          targetDays: 7,
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
          targetDays: 7,
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
          targetDays: 7,
          isActive: true,
          sortOrder: 2,
          startDate: START_DATE,
          planStatus: "ready",
          habitPlan: readingPlan,
        },
        {
          id: MEDITATION_HABIT_ID,
          userId: user.id,
          name: "Meditação 10 minutos",
          targetSkill: "mindfulness",
          icon: "🧘",
          color: "bg-surface-sky",
          frequency: "daily",
          targetDays: 7,
          isActive: true,
          sortOrder: 3,
          startDate: START_DATE,
          planStatus: "active",
          habitPlan: {},
        },
        {
          id: SPANISH_HABIT_ID,
          userId: user.id,
          name: "Aprender Espanhol 20m",
          targetSkill: "es-ES",
          icon: "🇪🇸",
          color: "bg-surface-yellow",
          frequency: "daily",
          targetDays: 7,
          isActive: true,
          sortOrder: 4,
          startDate: START_DATE,
          planStatus: "active",
          habitPlan: {},
        },
      ]);

      const englishLogs = buildLogs(ENGLISH_HABIT_ID, makeIndexArray(DAYS_TO_SEED, ENGLISH_SKIPS));
      const gymLogs = buildLogs(GYM_HABIT_ID, makeIndexArray(DAYS_TO_SEED, GYM_SKIPS));
      const readingLogs = buildLogs(READING_HABIT_ID, makeIndexArray(DAYS_TO_SEED, READING_SKIPS));
      const meditationLogs = buildLogs(
        MEDITATION_HABIT_ID,
        makeIndexArray(DAYS_TO_SEED, MEDITATION_SKIPS)
      );
      const spanishLogs = buildLogs(SPANISH_HABIT_ID, makeIndexArray(DAYS_TO_SEED, SPANISH_SKIPS));

      await tx
        .insert(schema.habitLogs)
        .values([...englishLogs, ...gymLogs, ...readingLogs, ...meditationLogs, ...spanishLogs]);

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
            ],
            modelSentence:
              "My pronunciation is gradually improving, especially with multisyllabic words like 'particularly'.",
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
          aiAgentType: "behavioral-coach",
          aiFeedback: {
            agentType: "behavioral-coach",
            targetSkill: "general",
            behavioral: { moodDetected: "focused", energyLevel: "medium" },
            habitAlignmentScore: 78,
            insights: [
              "Aplicar 'torne-o óbvio' com o livro na cama é exatamente a lei 1 em ação — você está construindo o hábito corretamente.",
              "O fato de você notar a conexão com sua própria experiência indica absorção ativa do conteúdo.",
            ],
            actionSuggestion:
              "Amanhã, identifique um segundo gatilho visual para o hábito de leitura além do livro na cama.",
          },
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
            errors: [],
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
              "'Never miss twice' é uma das regras mais poderosas do livro.",
            ],
            actionSuggestion:
              "Antes de dormir, anote um hábito atual onde o 'never miss twice' se aplicaria.",
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
          aiAgentType: "language-teacher",
          aiFeedback: {
            agentType: "language-teacher",
            targetSkill: "en-US",
            linguistic: { grammarScore: 88, vocabularyScore: 83, fluencyScore: 86 },
            errors: [],
            modelSentence:
              "Writing spontaneously in English without translation is a strong indicator that your brain is rewiring for the language.",
            nextChallenge:
              "Escreva amanhã sobre um tópico novo que você nunca tentou em inglês — culinária, política ou tecnologia.",
          },
          createdAt: new Date(`${SEEDED_DATES[5]}T09:10:00.000Z`),
          updatedAt: new Date(`${SEEDED_DATES[5]}T09:10:00.000Z`),
        },
      ]);

      await tx.insert(schema.journalEntries).values(
        MOOD_ENTRIES.map((e) => {
          const targetSkillSnap =
            e.habitId === ENGLISH_HABIT_ID
              ? "en-US"
              : e.habitId === SPANISH_HABIT_ID
                ? "es-ES"
                : e.habitId === GYM_HABIT_ID
                  ? "fitness"
                  : e.habitId === MEDITATION_HABIT_ID
                    ? "mindfulness"
                    : "general";
          const { aiAgentType, aiFeedback } = generateMoodFeedback(
            e.habitId,
            e.mood,
            e.energy,
            targetSkillSnap
          );
          return {
            id: randomUUID(),
            userId: user.id,
            habitId: e.habitId,
            entryDate: SEEDED_DATES[e.dayIdx]!,
            content: e.content,
            wordCount: e.wordCount,
            uiLanguageSnap: "pt-BR",
            targetSkillSnap,
            moodScore: e.mood,
            energyScore: e.energy,
            aiAgentType,
            aiFeedback,
            createdAt: new Date(`${SEEDED_DATES[e.dayIdx]}T${e.hour}:00.000Z`),
            updatedAt: new Date(`${SEEDED_DATES[e.dayIdx]}T${e.hour}:00.000Z`),
          };
        })
      );

      return { userId: user.id, email: user.email };
    });

    logger.info(
      {
        ...seeded,
        seed: {
          days: DAYS_TO_SEED,
          habits: 5,
          journalEntries: 9 + MOOD_ENTRIES.length,
          moodTimelineEntries: MOOD_ENTRIES.length,
        },
        localLogin: { email: demoEmail, password: demoPassword },
      },
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
