"use client";

/* ------------------------------------------------------------------
   Lightweight i18n. No heavy library — just typed dictionaries and a
   context. Language choice persists in localStorage. Add a locale by
   extending `dictionaries` and `LOCALES`.
   ------------------------------------------------------------------ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export const LOCALES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

type Dict = typeof dictionaries.en;

export const dictionaries = {
  en: {
    nav: { home: "Home", how: "How it works", impact: "For your MP", submit: "Raise your voice", signIn: "Sign in", profile: "Profile", myComplaints: "My complaints", guide: "Guide", about: "About" },
    hero: {
      badge: "Citizen voice, measured and mapped",
      titleA: "Your street knows",
      titleB: "what it needs.",
      titleC: "Now your MP will too.",
      sub: "Speak, type, or snap a photo of what your area needs. JanVaani turns thousands of voices — in your language — into a ranked, evidence-backed plan your representative can act on.",
      ctaPrimary: "Raise your voice",
      ctaSecondary: "See how it works",
      trust: "No literacy needed · Works by voice · Free & anonymous option",
    },
    stats: {
      voices: "Voices heard",
      themes: "Needs identified",
      areas: "Areas mapped",
      langs: "Languages",
    },
    how: {
      eyebrow: "How it works",
      title: "From a spoken word to a funded work.",
      s1t: "You speak up",
      s1d: "Record a voice note, type, or upload a photo in any of 5 languages. A broken road, a distant school, a dry borewell — whatever your area needs.",
      s2t: "AI listens & groups",
      s2d: "Your submission is transcribed, understood, and grouped with others raising the same need — so one road complained about 400 times counts as 400 voices, not 400 problems.",
      s3t: "Demand meets data",
      s3d: "Needs are weighed against real numbers — population, school enrolment, travel distance, existing gaps — not against who shouted loudest.",
      s4t: "Your MP acts",
      s4d: "Your representative sees a ranked, mapped, defensible list of priority works — and can direct development funds where demand truly is.",
    },
    forMp: {
      eyebrow: "For your representative",
      title: "An objective priority list, not a pile of letters.",
      body: "MPs receive requests through meetings, letters, social media and portals — while development plans hold dozens of competing projects. JanVaani consolidates every channel, spots recurring needs, maps demand hotspots, and ranks works against public data.",
      b1: "Every channel in one ledger",
      b2: "Recurring needs surfaced automatically",
      b3: "Demand hotspots on a live map",
      b4: "Competing proposals compared on evidence",
      cta: "MP / office sign-in",
    },
    submit: {
      eyebrow: "Raise your voice",
      title: "Tell us what your area needs.",
      sub: "It takes a minute. Speak in your own language — you don't need to write.",
      voiceTab: "Speak",
      textTab: "Type",
      photoTab: "Photo",
      voiceHint: "Tap the mic and describe the problem in your own words.",
      recordStart: "Tap to record",
      recordStop: "Tap to stop",
      recording: "Listening…",
      recorded: "Recorded — tap play to review",
      textLabel: "Describe the need",
      textPlaceholder: "e.g. The road to the government school floods every monsoon and children can't reach class…",
      photoLabel: "Add a photo (optional)",
      photoHint: "A picture of the issue helps your MP see it.",
      categoryLabel: "What is this about?",
      categories: ["Roads & transport", "Water & sanitation", "Education", "Health", "Electricity", "Livelihood", "Other"],
      locationLabel: "Which area?",
      locationPlaceholder: "Village / ward / landmark",
      useLocation: "Use my location",
      anonToggle: "Submit anonymously",
      submitBtn: "Send to my MP",
      privacy: "Your contact is never shown publicly. Anonymous submissions are still counted.",
      identity: {
        heading: "How do you want to submit?",
        anon: "Submit anonymously",
        anonDesc: "Your name is never attached — but your voice is still counted.",
        verified: "Verify with Aadhaar",
        verifiedDesc: "Adds weight to your voice and lets your MP follow up.",
        aadhaarLabel: "Aadhaar number",
        aadhaarPlaceholder: "1234 5678 9012",
        verify: "Verify",
        verifying: "Verifying…",
        verifiedBadge: "Verified",
        verifiedAs: "Verified as",
        popupTitle: "Identity verified",
        popupNote: "Demo only — these details are shown for illustration. Aadhaar API integration comes later.",
        popupContinue: "Looks good, continue",
        change: "Change",
        invalid: "Enter a valid 12-digit Aadhaar number.",
      },
    },
    auth: {
      eyebrow: "Sign in",
      citizenTitle: "Welcome. Your voice matters.",
      citizenSub: "Sign in with your phone number — no password to remember.",
      phoneLabel: "Mobile number",
      sendOtp: "Send OTP",
      otpLabel: "Enter the 6-digit code",
      verify: "Verify & continue",
      or: "or",
      google: "Continue with Google",
      mpTitle: "Representative & office",
      mpSub: "Access your constituency dashboard.",
      mpSignIn: "Sign in with Google",
      mpEmailLabel: "Official email",
      mpPasswordLabel: "Password",
      mpSignInEmail: "Sign in",
      switchToMp: "I'm an MP or staff member",
      switchToCitizen: "I'm a citizen",
      terms: "By continuing you agree to use JanVaani respectfully and truthfully.",
    },
    footer: {
      tagline: "Citizen voice, measured and mapped.",
      built: "A civic-tech platform for evidence-led development.",
      rights: "Built for the people, with the people.",
    },
    onboarding: {
      eyebrow: "One-time setup",
      title: "Tell us a little about you.",
      sub: "We ask this once so your voice reaches the right representative. You can edit it anytime in your profile.",
      firstName: "First name",
      lastName: "Last name",
      address: "Current address",
      addressPlaceholder: "House no. / street / area",
      constituency: "Constituency",
      constituencyPlaceholder: "Your assembly or parliamentary constituency",
      pincode: "PIN code",
      pincodePlaceholder: "6-digit PIN",
      state: "State / UT",
      statePlaceholder: "Select your state",
      aadhaar: "Aadhaar number",
      aadhaarTag: "optional",
      aadhaarHint: "Adding Aadhaar lets you submit verified suggestions later. Only the last 4 digits are ever stored.",
      save: "Save & continue",
      skip: "Skip for now",
      required: "Please fill your name and state to continue.",
    },
    profile: {
      eyebrow: "Your profile",
      title: "Your information",
      sub: "This is how your voice is attributed. Edit it anytime.",
      welcome: "Profile saved — welcome to JanVaani!",
      edit: "Edit",
      save: "Save changes",
      cancel: "Cancel",
      signOut: "Sign out",
      raiseVoice: "Raise your voice",
      contactHeading: "Sign-in contact",
      name: "Name",
      phone: "Mobile",
      email: "Email",
      notSet: "Not set",
    },
    dash: {
      badge: "Constituency dashboard",
      kpiVoices: "Voices heard",
      kpiThemes: "Needs identified",
      kpiAreas: "Areas mapped",
      kpiVerified: "Aadhaar-verified",
      rankedTitle: "Priority works, ranked",
      rankedSub: "Validated demand — citizen voice weighed against public data, not who shouted loudest.",
      score: "Priority score",
      confidence: "Confidence",
      sourceCitizen: "Citizen-raised",
      sourcePlan: "From dev. plan",
      weightsTitle: "Adjust priorities",
      weightsSub: "Reweight the factors — ranks update live.",
      reset: "Reset",
      whyTitle: "Why this rank",
      evidence: "Evidence",
      quotes: "What citizens said",
      hotspotsTitle: "Demand hotspots",
      hotspotsSub: "Where need concentrates across the constituency.",
      themesTitle: "Recurring needs",
      compare: "Compare",
      comparing: "Head-to-head",
      compareHint: "Select two works to compare them on evidence.",
      clear: "Clear",
      citizens: "citizens",
      high: "High",
      medium: "Medium",
      low: "Low",
      factors: { D: "Demand", G: "Service gap", P: "Population", E: "Equity", C: "Corroboration", F: "Feasibility" },
      factorsShort: { D: "Demand", G: "Gap", P: "Pop.", E: "Equity", C: "Corrob.", F: "Feasib." },
      office: "MP office",
    },
    lang: "Language",
  },
  hi: {
    nav: { home: "होम", how: "यह कैसे काम करता है", impact: "आपके सांसद के लिए", submit: "अपनी आवाज़ उठाएँ", signIn: "साइन इन", profile: "प्रोफ़ाइल", myComplaints: "मेरी शिकायतें", guide: "गाइड", about: "हमारे बारे में" },
    hero: {
      badge: "नागरिकों की आवाज़, मापी और मानचित्रित",
      titleA: "आपकी गली जानती है",
      titleB: "उसे क्या चाहिए।",
      titleC: "अब आपके सांसद भी जानेंगे।",
      sub: "बोलकर, लिखकर या फ़ोटो खींचकर बताइए कि आपके इलाक़े को क्या चाहिए। जनवाणी हज़ारों आवाज़ों को — आपकी भाषा में — एक क्रमबद्ध, प्रमाण-आधारित योजना में बदल देती है।",
      ctaPrimary: "अपनी आवाज़ उठाएँ",
      ctaSecondary: "यह कैसे काम करता है",
      trust: "पढ़ना-लिखना ज़रूरी नहीं · आवाज़ से चलता है · मुफ़्त और गुमनाम विकल्प",
    },
    stats: { voices: "सुनी गई आवाज़ें", themes: "पहचानी गई ज़रूरतें", areas: "मानचित्रित क्षेत्र", langs: "भाषाएँ" },
    how: {
      eyebrow: "यह कैसे काम करता है",
      title: "एक बोले शब्द से एक पूरे काम तक।",
      s1t: "आप बोलिए",
      s1d: "5 भाषाओं में से किसी में भी आवाज़ रिकॉर्ड कीजिए, लिखिए या फ़ोटो डालिए। टूटी सड़क, दूर का स्कूल, सूखा बोरवेल — जो भी चाहिए।",
      s2t: "एआई सुनता और जोड़ता है",
      s2d: "आपकी बात लिखी जाती है, समझी जाती है और उसी ज़रूरत की बाक़ी आवाज़ों से जोड़ी जाती है — ताकि 400 बार बताई गई एक सड़क 400 आवाज़ें गिनी जाए, 400 समस्याएँ नहीं।",
      s3t: "माँग मिलती है आँकड़ों से",
      s3d: "ज़रूरतें असली आँकड़ों पर तौली जाती हैं — जनसंख्या, स्कूल नामांकन, दूरी, मौजूदा कमी — न कि इस पर कि किसने सबसे ज़ोर से आवाज़ उठाई।",
      s4t: "आपके सांसद कार्रवाई करते हैं",
      s4d: "आपके प्रतिनिधि को प्राथमिकता वाले कामों की एक क्रमबद्ध, मानचित्रित सूची दिखती है — और वे विकास निधि वहाँ लगा सकते हैं जहाँ सच में माँग है।",
    },
    forMp: {
      eyebrow: "आपके प्रतिनिधि के लिए",
      title: "चिट्ठियों का ढेर नहीं, एक वस्तुनिष्ठ प्राथमिकता सूची।",
      body: "सांसदों को बैठकों, चिट्ठियों, सोशल मीडिया और पोर्टलों से अनुरोध मिलते हैं — और विकास योजनाओं में दर्जनों प्रतिस्पर्धी परियोजनाएँ होती हैं। जनवाणी हर माध्यम को जोड़ती है, बार-बार आने वाली ज़रूरतें पहचानती है, और सार्वजनिक आँकड़ों पर कामों को क्रमबद्ध करती है।",
      b1: "हर माध्यम एक ही जगह",
      b2: "बार-बार आने वाली ज़रूरतें अपने आप सामने",
      b3: "माँग के केंद्र एक जीवंत नक़्शे पर",
      b4: "प्रतिस्पर्धी प्रस्ताव प्रमाण पर तुलना",
      cta: "सांसद / कार्यालय साइन-इन",
    },
    submit: {
      eyebrow: "अपनी आवाज़ उठाएँ",
      title: "बताइए आपके इलाक़े को क्या चाहिए।",
      sub: "बस एक मिनट। अपनी भाषा में बोलिए — लिखने की ज़रूरत नहीं।",
      voiceTab: "बोलें",
      textTab: "लिखें",
      photoTab: "फ़ोटो",
      voiceHint: "माइक दबाइए और अपने शब्दों में समस्या बताइए।",
      recordStart: "रिकॉर्ड करने के लिए दबाएँ",
      recordStop: "रोकने के लिए दबाएँ",
      recording: "सुन रहे हैं…",
      recorded: "रिकॉर्ड हो गया — सुनने के लिए चलाएँ",
      textLabel: "ज़रूरत बताइए",
      textPlaceholder: "जैसे: सरकारी स्कूल की सड़क हर बरसात में डूब जाती है और बच्चे नहीं पहुँच पाते…",
      photoLabel: "फ़ोटो जोड़ें (वैकल्पिक)",
      photoHint: "समस्या की तस्वीर आपके सांसद को समझने में मदद करती है।",
      categoryLabel: "यह किस बारे में है?",
      categories: ["सड़क व परिवहन", "पानी व स्वच्छता", "शिक्षा", "स्वास्थ्य", "बिजली", "आजीविका", "अन्य"],
      locationLabel: "कौन-सा क्षेत्र?",
      locationPlaceholder: "गाँव / वार्ड / पहचान-स्थल",
      useLocation: "मेरा स्थान उपयोग करें",
      anonToggle: "गुमनाम रूप से भेजें",
      submitBtn: "मेरे सांसद को भेजें",
      privacy: "आपका संपर्क कभी सार्वजनिक नहीं दिखाया जाता। गुमनाम सुझाव भी गिने जाते हैं।",
      identity: {
        heading: "आप कैसे भेजना चाहते हैं?",
        anon: "गुमनाम रूप से भेजें",
        anonDesc: "आपका नाम कभी नहीं जोड़ा जाता — फिर भी आपकी आवाज़ गिनी जाती है।",
        verified: "आधार से सत्यापित करें",
        verifiedDesc: "आपकी आवाज़ को महत्व देता है और सांसद को संपर्क करने देता है।",
        aadhaarLabel: "आधार नंबर",
        aadhaarPlaceholder: "1234 5678 9012",
        verify: "सत्यापित करें",
        verifying: "सत्यापित हो रहा है…",
        verifiedBadge: "सत्यापित",
        verifiedAs: "सत्यापित:",
        popupTitle: "पहचान सत्यापित",
        popupNote: "केवल डेमो — ये विवरण उदाहरण के लिए हैं। आधार API एकीकरण बाद में होगा।",
        popupContinue: "ठीक है, आगे बढ़ें",
        change: "बदलें",
        invalid: "मान्य 12 अंकों का आधार नंबर डालें।",
      },
    },
    auth: {
      eyebrow: "साइन इन",
      citizenTitle: "स्वागत है। आपकी आवाज़ मायने रखती है।",
      citizenSub: "अपने फ़ोन नंबर से साइन इन करें — कोई पासवर्ड याद रखने की ज़रूरत नहीं।",
      phoneLabel: "मोबाइल नंबर",
      sendOtp: "OTP भेजें",
      otpLabel: "6 अंकों का कोड डालें",
      verify: "सत्यापित करें और आगे बढ़ें",
      or: "या",
      google: "Google से जारी रखें",
      mpTitle: "प्रतिनिधि व कार्यालय",
      mpSub: "अपना क्षेत्र डैशबोर्ड खोलें।",
      mpSignIn: "Google से साइन इन",
      mpEmailLabel: "आधिकारिक ईमेल",
      mpPasswordLabel: "पासवर्ड",
      mpSignInEmail: "साइन इन करें",
      switchToMp: "मैं सांसद या कर्मचारी हूँ",
      switchToCitizen: "मैं एक नागरिक हूँ",
      terms: "जारी रखकर आप जनवाणी का सम्मानपूर्वक और सच्चाई से उपयोग करने के लिए सहमत होते हैं।",
    },
    footer: {
      tagline: "नागरिकों की आवाज़, मापी और मानचित्रित।",
      built: "प्रमाण-आधारित विकास के लिए एक सिविक-टेक मंच।",
      rights: "जनता के लिए, जनता के साथ बनाया गया।",
    },
    onboarding: {
      eyebrow: "एक-बार की जानकारी",
      title: "अपने बारे में थोड़ा बताइए।",
      sub: "यह हम एक बार पूछते हैं ताकि आपकी आवाज़ सही प्रतिनिधि तक पहुँचे। आप इसे कभी भी प्रोफ़ाइल में बदल सकते हैं।",
      firstName: "पहला नाम",
      lastName: "उपनाम",
      address: "वर्तमान पता",
      addressPlaceholder: "मकान नं. / गली / क्षेत्र",
      constituency: "निर्वाचन क्षेत्र",
      constituencyPlaceholder: "आपका विधानसभा या लोकसभा क्षेत्र",
      pincode: "पिन कोड",
      pincodePlaceholder: "6 अंकों का पिन",
      state: "राज्य / केंद्र शासित",
      statePlaceholder: "अपना राज्य चुनें",
      aadhaar: "आधार नंबर",
      aadhaarTag: "वैकल्पिक",
      aadhaarHint: "आधार जोड़ने से आप बाद में सत्यापित सुझाव भेज सकते हैं। केवल अंतिम 4 अंक ही सहेजे जाते हैं।",
      save: "सहेजें और आगे बढ़ें",
      skip: "अभी छोड़ें",
      required: "आगे बढ़ने के लिए कृपया अपना नाम और राज्य भरें।",
    },
    profile: {
      eyebrow: "आपकी प्रोफ़ाइल",
      title: "आपकी जानकारी",
      sub: "इसी आधार पर आपकी आवाज़ जोड़ी जाती है। कभी भी बदलें।",
      welcome: "प्रोफ़ाइल सहेजी गई — जनवाणी में आपका स्वागत है!",
      edit: "संपादित करें",
      save: "बदलाव सहेजें",
      cancel: "रद्द करें",
      signOut: "साइन आउट",
      raiseVoice: "अपनी आवाज़ उठाएँ",
      contactHeading: "साइन-इन संपर्क",
      name: "नाम",
      phone: "मोबाइल",
      email: "ईमेल",
      notSet: "निर्धारित नहीं",
    },
    dash: {
      badge: "क्षेत्र डैशबोर्ड",
      kpiVoices: "सुनी गई आवाज़ें",
      kpiThemes: "पहचानी ज़रूरतें",
      kpiAreas: "मानचित्रित क्षेत्र",
      kpiVerified: "आधार-सत्यापित",
      rankedTitle: "प्राथमिकता वाले काम, क्रमबद्ध",
      rankedSub: "प्रमाणित माँग — नागरिक आवाज़ सार्वजनिक आँकड़ों पर तौली गई, न कि किसने सबसे ज़ोर से कहा।",
      score: "प्राथमिकता अंक",
      confidence: "विश्वास",
      sourceCitizen: "नागरिकों से",
      sourcePlan: "विकास योजना से",
      weightsTitle: "प्राथमिकताएँ समायोजित करें",
      weightsSub: "कारकों का भार बदलें — क्रम तुरंत बदलता है।",
      reset: "रीसेट",
      whyTitle: "यह क्रम क्यों",
      evidence: "प्रमाण",
      quotes: "नागरिकों ने क्या कहा",
      hotspotsTitle: "माँग के केंद्र",
      hotspotsSub: "क्षेत्र में ज़रूरत कहाँ केंद्रित है।",
      themesTitle: "बार-बार आने वाली ज़रूरतें",
      compare: "तुलना",
      comparing: "आमने-सामने",
      compareHint: "प्रमाण पर तुलना के लिए दो काम चुनें।",
      clear: "साफ़ करें",
      citizens: "नागरिक",
      high: "उच्च",
      medium: "मध्यम",
      low: "निम्न",
      factors: { D: "माँग", G: "सेवा कमी", P: "जनसंख्या", E: "समता", C: "पुष्टि", F: "व्यवहार्यता" },
      factorsShort: { D: "माँग", G: "कमी", P: "जन.", E: "समता", C: "पुष्टि", F: "व्यवहार्य" },
      office: "सांसद कार्यालय",
    },
    lang: "भाषा",
  },
} satisfies Record<string, unknown>;

// Fallback locales that don't yet have a full dictionary reuse English.
function dictFor(locale: Locale): Dict {
  return (dictionaries as Record<string, Dict>)[locale] ?? dictionaries.en;
}

type I18nValue = { locale: Locale; setLocale: (l: Locale) => void; t: Dict };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("janvaani.locale") as Locale | null;
    if (saved) setLocaleState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("janvaani.locale", l);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: dictFor(locale) }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

/* ------------------------------------------------------------------
   Page-scoped copy. New pages keep their strings in a local
   `strings.ts` ({ en: {...}, hi: {...} }) instead of growing the shared
   dictionaries above — this hook picks the right one for the current
   locale. `hi` may be partial: missing sections fall back to English
   per top-level key (same graceful-fallback stance as dictFor above).
   Locales without a translation (ta/mr/bn) read English.
   ------------------------------------------------------------------ */
export function useLocalStrings<T extends Record<string, unknown>>(strings: {
  en: T;
  hi?: Partial<T>;
}): T {
  const { locale } = useI18n();
  if (locale !== "hi" || !strings.hi) return strings.en;
  return { ...strings.en, ...strings.hi };
}
