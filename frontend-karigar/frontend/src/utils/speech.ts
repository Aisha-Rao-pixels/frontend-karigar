import * as Speech from "expo-speech";

// Maps our in-app language codes to the locale codes expo-speech expects.
const SPEECH_LOCALE: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  te: "te-IN",
};

const femaleVoiceCache: Record<string, string | undefined> = {};

async function pickFemaleVoice(locale: string): Promise<string | undefined> {
  if (locale in femaleVoiceCache) return femaleVoiceCache[locale];
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const base = locale.split("-")[0];
    const match = voices.find(
      (v) =>
        v.language?.toLowerCase().startsWith(base) &&
        /female|woman/i.test(v.name || v.identifier || "")
    );
    femaleVoiceCache[locale] = match?.identifier;
  } catch {
    femaleVoiceCache[locale] = undefined;
  }
  return femaleVoiceCache[locale];
}

/** Speaks `text` aloud in the given app language ("en" | "hi" | "te"),
 *  preferring a female voice where the device offers a choice. */
export async function speakLabel(text: string, lang: string) {
  const locale = SPEECH_LOCALE[lang] || "en-IN";
  Speech.stop();
  const voice = await pickFemaleVoice(locale);
  Speech.speak(text, { language: locale, voice, pitch: 1.05, rate: 0.9 });
}
