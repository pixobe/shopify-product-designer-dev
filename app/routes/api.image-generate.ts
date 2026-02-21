import {
  data,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { METADATA_FIELD_APP_SETTINGS } from "app/constants/settings";
import { authenticate } from "app/shopify.server";
import { getAppMetafield } from "app/utils/graphql/app-metadata";

const ENCRYPTED_VALUE_PREFIX = "enc:v1:";
const TEXT_ENCODER = new TextEncoder();

type GenerateImageRequestBody = {
  prompt?: string;
};

type GeminiPart = {
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[];
  };
};

type GeminiGeneratedImage = {
  image?: {
    imageBytes?: string;
    mimeType?: string;
  };
};

type GeminiGenerateResponse = {
  candidates?: GeminiCandidate[];
  generatedImages?: GeminiGeneratedImage[];
};

const base64ToBytes = (value: string): Uint8Array => {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(value, "base64"));
  }
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const getApiEncryptionKey = async (): Promise<CryptoKey | null> => {
  const encryptionSecret = process.env.APP_IMAGE_GEN_API_KEY_ENC_KEY?.trim();
  if (!encryptionSecret) {
    return null;
  }
  const hash = await crypto.subtle.digest(
    "SHA-256",
    TEXT_ENCODER.encode(encryptionSecret),
  );
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
};

const decryptSettingValue = async (value?: string): Promise<string> => {
  const storedValue = value?.trim() ?? "";
  if (!storedValue) {
    return "";
  }
  if (!storedValue.startsWith(ENCRYPTED_VALUE_PREFIX)) {
    return storedValue;
  }
  const key = await getApiEncryptionKey();
  if (!key) {
    return storedValue;
  }
  const payload = storedValue.slice(ENCRYPTED_VALUE_PREFIX.length);
  const [ivBase64, encryptedBase64] = payload.split(":");
  if (!ivBase64 || !encryptedBase64) {
    return "";
  }

  try {
    const iv = new Uint8Array(base64ToBytes(ivBase64));
    const encryptedBytes = new Uint8Array(base64ToBytes(encryptedBase64));
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encryptedBytes,
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Failed to decrypt APP image generator API key", error);
    return "";
  }
};

const buildColoringPrompt = (prompt: string): string => {
  return [
    "Create a clean black-and-white coloring book line art illustration.",
    "User request:",
    prompt,
    "Rules:",
    "- White background only (#FFFFFF), with no texture, gradient, shadow, or gray tones.",
    "- Subject outlines only in solid black (#000000).",
    "- Clear, closed, and well-defined borders suitable for coloring.",
    "- Minimal detail complexity, no photorealism, no color, no shading.",
    "- Keep composition centered and easy to isolate from the background.",
  ].join("\n");
};

const toDataUrls = (payload: GeminiGenerateResponse): string[] => {
  const urls: string[] = [];

  const generatedImages = Array.isArray(payload.generatedImages)
    ? payload.generatedImages
    : [];
  for (const generatedImage of generatedImages) {
    const imageData = generatedImage.image?.imageBytes;
    if (!imageData) {
      continue;
    }
    const mimeType = generatedImage.image?.mimeType || "image/png";
    urls.push(`data:${mimeType};base64,${imageData}`);
  }

  const candidates = Array.isArray(payload.candidates)
    ? payload.candidates
    : [];

  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? [];
    for (const part of parts) {
      const imageData = part.inlineData?.data;
      if (!imageData) {
        continue;
      }
      const mimeType = part.inlineData?.mimeType || "image/png";
      urls.push(`data:${mimeType};base64,${imageData}`);
    }
  }

  return urls;
};

const serializeHeaders = (headers: Headers): Record<string, string> => {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === "authorization" || normalizedKey === "cookie") {
      result[key] = "[redacted]";
      return;
    }
    result[key] = value;
  });
  return result;
};

const generateImages = async (
  apiKey: string,
  prompt: string,
  numberOfImages: number,
): Promise<string[]> => {
  console.info("[api.image-generate] Requesting Gemini image generation", {
    model: "gemini-2.0-flash-preview-image-generation",
    numberOfImages,
    promptLength: prompt.length,
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildColoringPrompt(prompt),
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          candidateCount: numberOfImages,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[api.image-generate] Gemini request failed", {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      headers: serializeHeaders(response.headers),
      body: errorText.slice(0, 1500),
    });
    throw new Error(
      `Gemini image generation failed (${response.status}): ${errorText}`,
    );
  }

  const payload = (await response.json()) as GeminiGenerateResponse;
  console.info("[api.image-generate] Gemini response received", {
    candidates: Array.isArray(payload.candidates)
      ? payload.candidates.length
      : 0,
    generatedImages: Array.isArray(payload.generatedImages)
      ? payload.generatedImages.length
      : 0,
  });
  return toDataUrls(payload);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  console.info("[api.image-generate] Incoming request", {
    requestId,
    method: request.method,
    url: request.url,
    hasCookie: Boolean(request.headers.get("cookie")),
    userAgent: request.headers.get("user-agent") ?? "unknown",
  });

  if (request.method !== "POST") {
    console.warn("[api.image-generate] Invalid method", {
      requestId,
      method: request.method,
    });
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    console.info("[api.image-generate] Authenticating app proxy request", {
      requestId,
    });
    const { admin, session } = await authenticate.public.appProxy(request);
    if (!admin) {
      console.warn("[api.image-generate] App proxy auth missing admin client", {
        requestId,
      });
      return data({ error: "Unauthorized" }, { status: 401 });
    }
    console.info("[api.image-generate] Authentication passed", {
      requestId,
      shop: session?.shop ?? "unknown",
    });

    const body = (await request.json()) as GenerateImageRequestBody;
    const userPrompt = body?.prompt?.trim() ?? "";
    console.info("[api.image-generate] Parsed request body", {
      requestId,
      hasPrompt: Boolean(userPrompt),
      promptLength: userPrompt.length,
    });

    if (!userPrompt) {
      console.warn("[api.image-generate] Missing prompt", { requestId });
      return data({ error: "Prompt is required" }, { status: 400 });
    }

    console.info("[api.image-generate] Loading app settings metafield", {
      requestId,
      shop: session?.shop ?? "unknown",
    });
    const appSettings = (await getAppMetafield(
      admin,
      METADATA_FIELD_APP_SETTINGS,
      { shop: session?.shop },
    )) as Record<string, unknown> | null;

    const metafieldApiKey = await decryptSettingValue(
      typeof appSettings?.imageGenerateApiKey === "string"
        ? appSettings.imageGenerateApiKey
        : undefined,
    );
    const apiKey =
      metafieldApiKey ||
      process.env.APP_IMAGE_GENERATE_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      "";
    console.info("[api.image-generate] API key lookup completed", {
      requestId,
      source: metafieldApiKey
        ? "metafield"
        : process.env.APP_IMAGE_GENERATE_API_KEY?.trim()
          ? "APP_IMAGE_GENERATE_API_KEY"
          : process.env.GEMINI_API_KEY?.trim()
            ? "GEMINI_API_KEY"
            : "missing",
    });

    if (!apiKey) {
      console.error("[api.image-generate] Missing API key", { requestId });
      return data(
        { error: "Image generation API key is not configured" },
        { status: 400 },
      );
    }

    const urls = await generateImages(apiKey, userPrompt, 1);
    console.info("[api.image-generate] Image generation completed", {
      requestId,
      returnedImages: urls.length,
      durationMs: Date.now() - startTime,
    });

    if (urls.length === 0) {
      console.error(
        "[api.image-generate] No image data in successful response",
        {
          requestId,
        },
      );
      return data(
        { success: false, message: "No image data returned from Gemini" },
        { status: 502 },
      );
    }

    return data(
      {
        success: true,
        result: {
          urls,
          format: "data-url",
          resolution: "normal",
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: any) {
    const isResponseError = error instanceof Response;
    const responseBody = isResponseError
      ? await error
          .clone()
          .text()
          .catch(() => "")
      : undefined;

    console.error("[api.image-generate] Failed to generate images", {
      requestId,
      durationMs: Date.now() - startTime,
      errorType: isResponseError ? "Response" : (error?.name ?? typeof error),
      message: error?.message,
      stack: error?.stack,
      response: isResponseError
        ? {
            status: error.status,
            statusText: error.statusText,
            url: error.url,
            redirected: error.redirected,
            headers: serializeHeaders(error.headers),
            body: responseBody?.slice(0, 1500),
          }
        : undefined,
    });
    return data(
      {
        success: false,
        message: error?.message ?? "Unexpected error while generating images",
      },
      { status: 500 },
    );
  }
};

export const loader = async (_args: LoaderFunctionArgs) =>
  data({ error: "Method not allowed" }, { status: 405 });
