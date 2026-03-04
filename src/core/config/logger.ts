import pino from "pino";

const isDev = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

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

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: prettyTransport,
});
