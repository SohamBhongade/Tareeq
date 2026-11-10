/**
 * Anti-AI check, layer 1 (runs in the browser, on the ORIGINAL file).
 *
 * Most AI image tools stamp their output with metadata: the IPTC
 * "digital source type" (Google, OpenAI, Adobe, Meta…), a C2PA content
 * credential naming the generator, or the generation settings themselves
 * (Stable Diffusion, ComfyUI, NovelAI…). The photo is shrunk and re-encoded
 * before upload, which wipes all of that, so it has to be read here first.
 *
 * Layer 2 is the vision AI looking at the picture itself (lib/gemini.ts) —
 * that catches AI images whose metadata was stripped (screenshots, WhatsApp).
 */

/** [text to look for (lower-case), name shown to the user] */
const MARKERS: [string, string][] = [
  // IPTC digital source type — the industry standard "made by AI" label.
  ["trainedalgorithmicmedia", "an AI image generator"],
  ["compositewithtrainedalgorithmicmedia", "AI editing"],
  ["algorithmicmedia", "an AI image generator"],
  // C2PA / XMP tool names written by the generators.
  ["made with google ai", "Google AI (Gemini / Imagen)"],
  ["edited with google ai", "Google AI editing"],
  ["google imagen", "Google Imagen"],
  ["openai", "OpenAI (ChatGPT / DALL·E)"],
  ["dall-e", "DALL·E"],
  ["dall·e", "DALL·E"],
  ["chatgpt", "ChatGPT"],
  ["adobe firefly", "Adobe Firefly"],
  ["midjourney", "Midjourney"],
  ["stable diffusion", "Stable Diffusion"],
  ["stablediffusion", "Stable Diffusion"],
  ["stability.ai", "Stability AI"],
  ["black-forest-labs", "FLUX"],
  ["flux.1", "FLUX"],
  ["novelai", "NovelAI"],
  ["invokeai", "InvokeAI"],
  ["fooocus", "Fooocus"],
  ["leonardo.ai", "Leonardo AI"],
  ["ideogram", "Ideogram"],
  ["bing image creator", "Bing Image Creator"],
  ["microsoft designer", "Microsoft Designer"],
  ["imagined with ai", "Meta AI"],
  ["grok imagine", "Grok"],
  // Generation settings saved inside PNGs by SD front-ends / ComfyUI.
  ["negative prompt:", "an AI image generator"],
  ["cfg scale:", "an AI image generator"],
  ["\"ksampler\"", "ComfyUI"],
];

/** How much of the file to read. Metadata sits at the start (JPEG/WebP) or
 *  in text chunks (PNG) — but some tools append it, so read the end too. */
const HEAD = 512 * 1024;
const TAIL = 256 * 1024;

function asLowerText(bytes: Uint8Array): string {
  // Latin-1 keeps one character per byte, so ASCII markers survive intact.
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return s.toLowerCase();
}

/**
 * Returns the name of the AI tool the file says it came from,
 * or null if the file carries no AI markers.
 */
export async function findAiMarker(file: Blob): Promise<string | null> {
  try {
    const parts: Blob[] =
      file.size <= HEAD + TAIL ? [file] : [file.slice(0, HEAD), file.slice(file.size - TAIL)];
    for (const part of parts) {
      const text = asLowerText(new Uint8Array(await part.arrayBuffer()));
      for (const [needle, tool] of MARKERS) {
        if (text.includes(needle)) return tool;
      }
    }
  } catch {
    // Couldn't read the file — layer 2 (the vision AI) still checks it.
  }
  return null;
}
