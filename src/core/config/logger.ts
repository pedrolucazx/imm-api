import pino from "pino";

const isTest = process.env.NODE_ENV === "test";
const isDev = process.env.NODE_ENV !== "production" && !isTest;

export const prettyTransport = isDev
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:mm:ss",
        ignore: "pid,hostname",
        singleLine: true,
      },
    }
  : undefined;

export const logger = pino(
  {
    level: isTest ? "silent" : process.env.LOG_LEVEL || "info",
    transport: prettyTransport,
  },
  isTest ? pino.destination({ sync: false }) : undefined
);
