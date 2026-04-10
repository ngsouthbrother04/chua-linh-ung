import ApiError from "../utils/ApiError";
import {
  normalizePoiLanguage,
  POI_TARGET_LANGUAGES,
  type PoiLanguage,
} from "./poiLanguageConfig";
import { translateTextWithGoogleCloud } from "./googleTranslateClient";

function isStrictTranslationMode(): boolean {
  const raw = String(process.env.POI_TRANSLATION_STRICT_MODE ?? "false").trim();
  return raw === "1" || raw.toLowerCase() === "true";
}

function normalizeInputMap(
  input: Record<string, string>,
): Record<PoiLanguage, string> {
  const normalized: Partial<Record<PoiLanguage, string>> = {};

  for (const [rawLanguage, rawText] of Object.entries(input)) {
    const language = normalizePoiLanguage(rawLanguage);
    const text = String(rawText).trim();
    if (!language || !text) {
      continue;
    }

    normalized[language] = text;
  }

  if (Object.keys(normalized).length === 0) {
    throw new ApiError(400, "Không có dữ liệu ngôn ngữ hợp lệ để dịch.");
  }

  return normalized as Record<PoiLanguage, string>;
}

function resolveSourceLanguage(
  input: Record<PoiLanguage, string>,
): PoiLanguage {
  if (input.vi) {
    return "vi";
  }

  return Object.keys(input)[0] as PoiLanguage;
}

export async function ensurePoiLocalizedTextMap(
  input: Record<string, string>,
  options?: { strict?: boolean },
): Promise<Record<PoiLanguage, string>> {
  const normalizedInput = normalizeInputMap(input);
  const sourceLanguage = resolveSourceLanguage(normalizedInput);
  const sourceText = normalizedInput[sourceLanguage];
  const strictMode = options?.strict ?? isStrictTranslationMode();
  const targetLanguages = Array.from(
    new Set(
      POI_TARGET_LANGUAGES.map((language) =>
        normalizePoiLanguage(language),
      ).filter((language): language is PoiLanguage => Boolean(language)),
    ),
  );

  const entries = await Promise.all(
    targetLanguages.map(async (targetLanguage) => {
      const existing = normalizedInput[targetLanguage];
      if (existing) {
        return [targetLanguage, existing] as const;
      }

      try {
        const translated = await translateTextWithGoogleCloud(
          sourceText,
          targetLanguage,
          sourceLanguage,
        );

        if (!translated) {
          throw new Error("EMPTY_TRANSLATION_RESULT");
        }

        return [targetLanguage, translated] as const;
      } catch (error) {
        if (strictMode) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new ApiError(
            500,
            `Không thể dịch nội dung sang ngôn ngữ ${targetLanguage}. Chi tiết: ${reason}. Vui lòng kiểm tra GOOGLE_APPLICATION_CREDENTIALS/GOOGLE_TRANSLATE_CREDENTIALS_JSON và bật Cloud Translation API.`,
          );
        }

        console.warn(
          `[POI_TRANSLATION_FALLBACK] language=${targetLanguage}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return [targetLanguage, sourceText] as const;
      }
    }),
  );

  return Object.fromEntries(entries) as Record<PoiLanguage, string>;
}
