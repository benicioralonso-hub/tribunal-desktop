/**
 * Cliente Gemini (OpenAI-compat) para el proceso main.
 * La API key nunca llega al renderer.
 */

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmJsonSchema = {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
};

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  models: string[];
  provider: "gemini";
};

/** Cadena corta por defecto; override con GEMINI_MODEL / GEMINI_MODELS. */
export const DEFAULT_GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
] as const;

const GEMINI_OPENAI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai";

const exhaustedUntil = new Map<string, number>();
const DEFAULT_COOLDOWN_MS = 60 * 60 * 1000;
const INVALID_MODEL_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function parseModelsEnv(
  raw: string | undefined,
  preferred?: string,
): string[] {
  const fromEnv = (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const chain =
    fromEnv.length > 0 ? fromEnv : [...DEFAULT_GEMINI_MODELS];
  if (preferred?.trim()) {
    const first = preferred.trim();
    return [first, ...chain.filter((m) => m !== first)];
  }
  return chain;
}

export function getLlmConfig(): LlmConfig | null {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) return null;
  return {
    apiKey: geminiKey,
    baseUrl: (
      process.env.GEMINI_BASE_URL?.trim() || GEMINI_OPENAI_BASE
    ).replace(/\/$/, ""),
    models: parseModelsEnv(
      process.env.GEMINI_MODELS,
      process.env.GEMINI_MODEL,
    ),
    provider: "gemini",
  };
}

export function isGeminiConfigured(): boolean {
  return Boolean(getLlmConfig());
}

export function geminiConfigHint(): string {
  return "Definí GEMINI_API_KEY en .env (Google AI Studio).";
}

function isQuotaExhausted(status: number, body: string): boolean {
  if (status === 429) return true;
  return /RESOURCE_EXHAUSTED|quota|rate.?limit|exceeded your current quota|Too Many Requests|limit:\s*0/i.test(
    body,
  );
}

function isInvalidModel(status: number, body: string): boolean {
  if (status === 404) return true;
  return /not\s*found|invalid\s*model|model\s*.*\s*does\s*not\s*exist|is not found|NOT_FOUND/i.test(
    body,
  );
}

function markExhausted(
  model: string,
  retryAfterHeader: string | null,
  cooldownMs = DEFAULT_COOLDOWN_MS,
): void {
  let cooldown = cooldownMs;
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds > 0) {
      cooldown = Math.min(
        Math.max(seconds * 1000, 30_000),
        6 * 60 * 60 * 1000,
      );
    }
  }
  exhaustedUntil.set(model, Date.now() + cooldown);
}

function availableModels(models: string[]): string[] {
  const now = Date.now();
  const ready = models.filter((m) => (exhaustedUntil.get(m) || 0) <= now);
  return ready.length > 0 ? ready : models;
}

export function extractJsonContent(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

async function postChatCompletion(input: {
  config: LlmConfig;
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  responseFormat?:
    | { type: "json_object" }
    | { type: "json_schema"; json_schema: LlmJsonSchema };
}): Promise<
  | { ok: true; content: string; model: string }
  | { ok: false; status: number; detail: string; quota: boolean }
> {
  const response = await fetch(`${input.config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature ?? 0.1,
      response_format: input.responseFormat,
      messages: input.messages,
    }),
  });

  const detail = await response.text();
  if (!response.ok) {
    const quota = isQuotaExhausted(response.status, detail);
    const invalid = isInvalidModel(response.status, detail);
    if (quota) {
      markExhausted(input.model, response.headers.get("retry-after"));
    } else if (invalid) {
      markExhausted(input.model, null, INVALID_MODEL_COOLDOWN_MS);
    }
    return {
      ok: false,
      status: response.status,
      detail,
      quota: quota || invalid,
    };
  }

  let payload: { choices?: Array<{ message?: { content?: string } }> };
  try {
    payload = JSON.parse(detail) as typeof payload;
  } catch {
    return {
      ok: false,
      status: 502,
      detail: `Respuesta inválida del proveedor: ${detail.slice(0, 200)}`,
      quota: false,
    };
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return {
      ok: false,
      status: 502,
      detail: "La IA no devolvió contenido.",
      quota: false,
    };
  }

  return { ok: true, content, model: input.model };
}

/**
 * Chat completion JSON con rotación de modelos ante cuota agotada.
 */
export async function chatJsonCompletion(input: {
  messages: LlmMessage[];
  jsonSchema?: LlmJsonSchema;
  temperature?: number;
}): Promise<{ content: string; model: string; provider: string }> {
  const config = getLlmConfig();
  if (!config) {
    throw new Error(geminiConfigHint());
  }

  const models = availableModels(config.models);
  const errors: string[] = [];

  for (const model of models) {
    if (input.jsonSchema) {
      const withSchema = await postChatCompletion({
        config,
        model,
        messages: input.messages,
        temperature: input.temperature,
        responseFormat: {
          type: "json_schema",
          json_schema: input.jsonSchema,
        },
      });

      if (withSchema.ok) {
        return {
          content: extractJsonContent(withSchema.content),
          model: withSchema.model,
          provider: config.provider,
        };
      }

      if (withSchema.quota) {
        errors.push(`${model}: cuota/rate limit`);
        continue;
      }

      if (withSchema.status === 401 || withSchema.status === 403) {
        throw new Error(
          `Gemini auth ${withSchema.status}: ${withSchema.detail.slice(0, 300)}. Revisá GEMINI_API_KEY.`,
        );
      }
    }

    const messagesForObject = input.jsonSchema
      ? input.messages.map((m, i) =>
          i === 0 && m.role === "system"
            ? {
                ...m,
                content: `${m.content}\nRespondé únicamente un JSON válido con las claves del schema.`,
              }
            : m,
        )
      : input.messages;

    const withObject = await postChatCompletion({
      config,
      model,
      messages: messagesForObject,
      temperature: input.temperature,
      responseFormat: { type: "json_object" },
    });

    if (withObject.ok) {
      return {
        content: extractJsonContent(withObject.content),
        model: withObject.model,
        provider: config.provider,
      };
    }

    if (withObject.quota) {
      errors.push(`${model}: cuota/rate limit`);
      continue;
    }

    if (withObject.status === 401 || withObject.status === 403) {
      throw new Error(
        `Gemini auth ${withObject.status}: ${withObject.detail.slice(0, 300)}. Revisá GEMINI_API_KEY.`,
      );
    }

    errors.push(
      `${model}: ${withObject.status} ${withObject.detail.slice(0, 120)}`,
    );
  }

  throw new Error(
    `Todos los modelos Gemini agotaron cuota o fallaron. ${errors.slice(0, 4).join(" | ")}`,
  );
}
