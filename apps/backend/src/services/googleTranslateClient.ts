import { v2 as Translate } from "@google-cloud/translate";

type GoogleTranslateClient = InstanceType<typeof Translate.Translate>;

let client: GoogleTranslateClient | null = null;

function resolveCredentials(): {
  clientOptions?: {
    credentials?: { client_email: string; private_key: string };
  };
} {
  const raw =
    process.env.GOOGLE_TRANSLATE_CREDENTIALS_JSON?.trim() ||
    process.env.GOOGLE_TTS_CREDENTIALS_JSON?.trim();

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const clientEmail =
      typeof parsed.client_email === "string" ? parsed.client_email : "";
    const privateKey =
      typeof parsed.private_key === "string" ? parsed.private_key : "";

    if (!clientEmail || !privateKey) {
      throw new Error("GOOGLE_TRANSLATE_CREDENTIALS_JSON_MISSING_FIELDS");
    }

    return {
      clientOptions: {
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
      },
    };
  } catch {
    throw new Error("GOOGLE_TRANSLATE_CREDENTIALS_JSON_INVALID");
  }
}

function getClient(): GoogleTranslateClient {
  if (client) {
    return client;
  }

  const { clientOptions } = resolveCredentials();
  client = clientOptions
    ? new Translate.Translate(clientOptions)
    : new Translate.Translate();

  return client;
}

export async function translateTextWithGoogleCloud(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
): Promise<string> {
  const safeText = String(text).trim();
  if (!safeText) {
    return "";
  }

  const normalizedTarget = targetLanguage.trim().toLowerCase();
  const normalizedSource = sourceLanguage?.trim().toLowerCase();

  if (normalizedSource && normalizedTarget === normalizedSource) {
    return safeText;
  }

  const translateClient = getClient();
  let translated: string | string[];

  try {
    [translated] = await translateClient.translate(safeText, {
      to: normalizedTarget,
      from: normalizedSource,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `GOOGLE_TRANSLATE_CALL_FAILED(to=${normalizedTarget}, from=${normalizedSource ?? "auto"}): ${reason}`,
    );
  }

  if (Array.isArray(translated)) {
    return String(translated[0] ?? safeText).trim();
  }

  return String(translated ?? safeText).trim();
}
