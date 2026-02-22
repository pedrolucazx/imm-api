import pino from "pino";

// Create a logger instance with pretty printing in development
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname,reqId,req,res,responseTime",
            messageFormat: "{levelLabel} {msg}",
            customColors: "info:cyan,warn:yellow,error:red",
            customLevels: "info:30,warn:40,error:50",
            levelFirst: false,
            singleLine: false,
          },
        }
      : undefined,
});
