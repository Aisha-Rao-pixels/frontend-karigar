import * as Speech from "expo-speech";

// Maps our in-app language codes to the locale codes expo-speech expects.
const SPEECH_LOCALE: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  te: "te-IN",
};

/** Speaks `text` aloud in the given app language ("en" | "hi" | "te").
 *  We use the phone's own default voice for that language instead of
 *  hand-picking one — on most phones that default is already clear and
 *  female, and a slightly slower rate makes it easier to follow. */
export async function speakLabel(text: string, lang: string) {
  const locale = SPEECH_LOCALE[lang] || "en-IN";
  Speech.stop();
  Speech.speak(text, { language: locale, rate: 0.8 });
}
