"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLocalStrings } from "@/lib/i18n";

const STRINGS = {
  en: {
    eyebrow: "About JanVaani",
    title: "Numbers you can check by hand.",
    intro:
      "JanVaani turns thousands of citizen voices into an evidence-backed development plan an MP can defend in public. That only works if every number is trustworthy — so we hold one rule above everything else.",
    ruleTitle: "The core rule",
    rule:
      "The AI never invents a score, a priority, or a decision. Every number is computed by fixed, readable rules — the AI's only job is to transcribe, describe, and explain in plain language what those rules already decided.",
    howTitle: "How the Evidence score is actually computed",
    howIntro:
      "This is the real rulebook, not a simplification. Anyone can recompute any score from it:",
    rules: [
      { k: "Corroborating reports", v: "Complaints in the same category near the same location add up to +30 (3 points each). One road reported 40 times counts as 40 voices, not 40 problems." },
      { k: "Attached evidence", v: "A photo or voice note adds a fixed bonus — real media beats bare text." },
      { k: "Government-data corroboration", v: "When uploaded government records (enrolment, schemes, population) match a complaint category in the same district, a fixed +15 applies. Data alone never creates a score — citizens must have raised it first." },
      { k: "Recency", v: "A spike in the last 30 days versus the previous 30 counts — need that's growing outranks need that's stable." },
      { k: "The cap and the labels", v: "Scores cap at 100. Strong ≥ 70, Moderate ≥ 40, everything else Weak. The exact reasons behind every score are stored with it and shown to both citizen and MP." },
    ],
    civicTitle: "Civic points, the same way",
    civic:
      "Your civic standing follows fixed thresholds too: 10 points per complaint, 25 more when one is resolved. Voice at 10 points, Advocate at 100, Champion at 300, Guardian at 750. No algorithm decides who matters.",
    privacyTitle: "Privacy, briefly",
    privacy:
      "Anonymous complaints never expose the filer. Complaint media is private by default and served only through short-lived signed links. Nearby-issue maps show category and location only — never who reported.",
    cta: "Read the user guide",
    cta2: "Raise your voice",
  },
  hi: {
    eyebrow: "JanVaani के बारे में",
    title: "ऐसे आँकड़े जिन्हें आप खुद जाँच सकते हैं।",
    intro:
      "JanVaani हज़ारों नागरिकों की आवाज़ को प्रमाण-आधारित विकास योजना में बदलता है, जिसे सांसद सार्वजनिक रूप से सही ठहरा सके। यह तभी संभव है जब हर आँकड़ा भरोसेमंद हो — इसलिए हमारा एक नियम सबसे ऊपर है।",
    ruleTitle: "मूल नियम",
    rule:
      "AI कभी कोई स्कोर, प्राथमिकता या निर्णय नहीं गढ़ता। हर संख्या तय, पढ़े जा सकने वाले नियमों से बनती है — AI का काम सिर्फ़ ट्रांसक्राइब करना, वर्णन करना और सरल भाषा में समझाना है।",
    howTitle: "प्रमाण स्कोर असल में कैसे बनता है",
    howIntro: "यह असली नियम-पुस्तिका है, कोई सरलीकरण नहीं। कोई भी इससे कोई भी स्कोर दोबारा निकाल सकता है:",
    rules: [
      { k: "पुष्टि करने वाली रिपोर्टें", v: "एक ही श्रेणी की, पास की शिकायतें +30 तक जोड़ती हैं (हर एक पर 3 अंक)। 40 बार रिपोर्ट हुई एक सड़क 40 आवाज़ें गिनी जाती है।" },
      { k: "जुड़ा प्रमाण", v: "फोटो या वॉइस नोट तय बोनस जोड़ता है — असली मीडिया खाली टेक्स्ट से आगे है।" },
      { k: "सरकारी डेटा की पुष्टि", v: "जब अपलोड किया सरकारी डेटा उसी ज़िले की शिकायत श्रेणी से मेल खाता है, तय +15 लगता है। अकेला डेटा कभी स्कोर नहीं बनाता।" },
      { k: "ताज़गी", v: "पिछले 30 दिनों में बढ़ोतरी मायने रखती है — बढ़ती ज़रूरत स्थिर ज़रूरत से ऊपर आती है।" },
      { k: "सीमा और लेबल", v: "स्कोर 100 पर रुकता है। मज़बूत ≥ 70, मध्यम ≥ 40, बाकी कमज़ोर। हर स्कोर के कारण उसके साथ सहेजे और दिखाए जाते हैं।" },
    ],
    civicTitle: "नागरिक अंक भी उसी तरह",
    civic:
      "आपकी नागरिक पहचान भी तय सीमाओं से बनती है: हर शिकायत पर 10 अंक, हल होने पर 25 और। Voice 10 पर, Advocate 100 पर, Champion 300 पर, Guardian 750 पर।",
    privacyTitle: "निजता, संक्षेप में",
    privacy:
      "गुमनाम शिकायतें कभी पहचान उजागर नहीं करतीं। शिकायत की मीडिया निजी रहती है और सिर्फ़ अल्पकालिक हस्ताक्षरित लिंक से दिखती है। आस-पास के नक्शे सिर्फ़ श्रेणी और जगह दिखाते हैं — रिपोर्ट करने वाला कभी नहीं।",
    cta: "उपयोग गाइड पढ़ें",
    cta2: "अपनी आवाज़ उठाएँ",
  },
};

export default function AboutPage() {
  const s = useLocalStrings(STRINGS);
  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-3xl px-5 py-12">
        <p className="eyebrow text-[var(--color-marigold-deep)]">{s.eyebrow}</p>
        <h1 className="display-lg mt-2 text-[var(--color-ink)]">{s.title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--color-ink-soft)]">{s.intro}</p>

        <section className="card rise mt-10 border-l-4 border-l-[var(--color-marigold-deep)] p-6">
          <p className="eyebrow text-[var(--color-marigold-deep)]">{s.ruleTitle}</p>
          <p className="mt-2 font-display text-xl leading-snug text-[var(--color-ink)]">{s.rule}</p>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">{s.howTitle}</h2>
          <p className="mt-2 text-[var(--color-ink-soft)]">{s.howIntro}</p>
          <dl className="mt-6 space-y-4">
            {s.rules.map((r) => (
              <div key={r.k} className="card p-5">
                <dt className="font-bold text-[var(--color-ink)]">{r.k}</dt>
                <dd className="mt-1 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">{r.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14 grid gap-6 sm:grid-cols-2">
          <div className="card p-6">
            <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">{s.civicTitle}</h2>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">{s.civic}</p>
          </div>
          <div className="card p-6">
            <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">{s.privacyTitle}</h2>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">{s.privacy}</p>
          </div>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/guide" className="btn btn-primary">
            {s.cta}
          </Link>
          <Link href="/submit" className="btn btn-marigold">
            {s.cta2}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
