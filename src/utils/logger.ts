export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface Logger {
  debug: (msg: string, ctx?: LogContext) => void;
  info: (msg: string, ctx?: LogContext) => void;
  warn: (msg: string, ctx?: LogContext) => void;
  error: (msg: string, ctx?: LogContext) => void;
}

// single shared instance in the worker
let loggerInstance: Logger | null = null;

function makeLogger(env: Env): Logger {
  const flag = (env as any)?.DEV_MODE;
  const envLevel = (env as any)?.LOG_LEVEL as string | undefined;

  const isDev = flag === "true" || flag === true;
  const levelOrder: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };

  const minLevel: LogLevel =
    envLevel === "debug" ||
    envLevel === "info" ||
    envLevel === "warn" ||
    envLevel === "error"
      ? (envLevel as LogLevel)
      : isDev
      ? "debug"
      : "info";

  function log(level: LogLevel, msg: string, ctx: LogContext = {}) {
    if (levelOrder[level] < levelOrder[minLevel]) return;

    const record = {
      level,
      msg,
      ...ctx,
      ts: new Date().toISOString(),
    };

    // structured JSON, easy to search in CF logs
    console.log(JSON.stringify(record));
  }

  return {
    debug: (msg, ctx) => log("debug", msg, ctx),
    info: (msg, ctx) => log("info", msg, ctx),
    warn: (msg, ctx) => log("warn", msg, ctx),
    error: (msg, ctx) => log("error", msg, ctx),
  };
}

// called once per request (or first request) from index.ts
export function initLogger(env: Env) {
  if (!loggerInstance) {
    loggerInstance = makeLogger(env);
  }
}

// used everywhere else
export function logger(): Logger {
  if (!loggerInstance) {
    // if this ever happens, you forgot to call initLogger in your app middleware
    throw new Error("Logger not initialized. Call initLogger(env) first.");
  }
  return loggerInstance;
}
