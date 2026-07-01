// Changes: OpenAI image generation — default API resolution (no imageSize param).
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';
import {
  generateImageDataUrl,
  OPENAI_IMAGE_MODELS,
} from './_utils/imageGeneration';

type Body = {
  prompt?: string;
  aspectRatio?: string;
  model?: string;
  referenceImage?: string;
  referenceImages?: string[];
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = requireAuth(request, env);
  if (denied) return denied;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const { prompt, aspectRatio, model, referenceImage, referenceImages } = body;
  if (typeof prompt !== 'string' || prompt.length === 0) {
    return jsonResponse({ error: 'Missing prompt.' }, 400);
  }
  if (typeof aspectRatio !== 'string') {
    return jsonResponse({ error: 'Missing aspectRatio.' }, 400);
  }
  if (!model || !OPENAI_IMAGE_MODELS.has(model)) {
    return jsonResponse({ error: 'Invalid model.' }, 400);
  }

  try {
    const image = await generateImageDataUrl(env, {
      prompt,
      aspectRatio,
      model,
      referenceImage,
      referenceImages,
    });
    return jsonResponse({ image });
  } catch (err: any) {
    return jsonResponse(
      {
        error: err?.message || 'Image generation failed.',
        raw: err?.raw,
      },
      502
    );
  }
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
