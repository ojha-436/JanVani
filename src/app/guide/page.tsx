"use client";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AccordionItem } from "@/components/ui/Accordion";
import { Tabs } from "@/components/ui/Tabs";
import { useLocalStrings } from "@/lib/i18n";

const STRINGS = {
  en: {
    eyebrow: "User guide",
    title: "How to use JanVaani",
    sub: "A step-by-step guide for citizens raising their voice, and for MP offices acting on it.",
    citizenTab: "For citizens",
    mpTab: "For MP offices",
    faqTitle: "Frequently asked questions",
    citizenSteps: [
      { t: "Sign in & complete your profile", d: "Sign in with Google and fill your constituency, state and pincode once. Your constituency is how your complaint reaches the right MP's ledger — it is snapshotted with every complaint you file." },
      { t: "Raise your voice — speak, type, or snap", d: "On 'Raise your voice', record a voice note in your language, type the problem, or upload a photo. While typing you'll see suggested categories — tap one to accept, or pick your own; the suggestion is a fixed keyword rule, never an AI guess." },
      { t: "Check nearby issues first", d: "Once you add a location, a mini-map shows issues already reported near you. If your road is already reported, filing yours still counts — repeated reports strengthen the evidence, so one pothole complained about 40 times counts as 40 voices." },
      { t: "Your draft is auto-saved", d: "Half-typed complaint? It's saved on your device automatically. Come back any time and continue where you left off." },
      { t: "Track everything in 'My complaints'", d: "Each complaint shows a live timeline (Submitted → In progress → Resolved), which department it's assigned to, and its Evidence strength with the exact reasons — computed by fixed rules, listed in plain words." },
      { t: "Get notified on progress", d: "When the MP's office updates your complaint's status, a notification appears on your profile. Anonymous complaints stay anonymous — the MP never sees who filed them." },
      { t: "Earn your civic standing", d: "Every complaint earns 10 points; every resolved one 25 more. Badges — Voice, Advocate, Champion, Guardian — mark how much of your area's story you've helped record. Fixed thresholds, no algorithms." },
    ],
    mpSteps: [
      { t: "Sign in with an allowlisted account", d: "MP dashboard access is allowlisted by the admin CLI. Your account is scoped to exactly one constituency — you can never see another constituency's complaints." },
      { t: "Read the overview", d: "KPIs, complaint categories, ranked issues and consensus clusters. Every score traces to real complaint counts and uploaded government data — the 'why' is always one click away." },
      { t: "Work the complaint list", d: "Filter by category/status, listen to voice notes, view photos, and move complaints through New → In progress → Resolved with one click. Assign a department tag so progress is trackable by office." },
      { t: "Watch the hotspot map", d: "Complaint density by location. Use the compare toggle to see this period against the last one — same fixed counting, two windows." },
      { t: "Mind the bell", d: "The notification bell polls for new high-confidence complaints (evidence score ≥ 70) so strong signals don't wait for your next login." },
      { t: "Upload government data", d: "CSV/API imports of schemes, enrolment, population. Where citizen complaints corroborate a dataset category, evidence scores get a fixed +15 bonus — data alone never moves a score." },
      { t: "Print the field report", d: "The Print report button produces a clean, ink-friendly summary of the dashboard for review meetings — straight from your browser." },
    ],
    faqs: [
      { q: "Is my identity shared with the MP?", a: "Only if you choose. Toggle 'Anonymous' before submitting and your name is never attached to the complaint anywhere in the MP's view." },
      { q: "Who decides the Evidence strength score?", a: "Nobody — and no AI. It's a fixed, published rule: points for corroborating complaints nearby, attached photo/voice evidence, and government-data corroboration. The exact reasons are listed under every score." },
      { q: "What does AI actually do here?", a: "It transcribes voice notes, describes photos, and explains — in plain language — numbers that the fixed rules already computed. It is never allowed to invent a score, a priority, or a decision." },
      { q: "My complaint shows 'Weak' evidence. Is it ignored?", a: "No. Weak only means few corroborating signals so far. More reports from your area, or a photo, strengthen it. The MP sees every complaint regardless of score." },
      { q: "Which languages can I use?", a: "The interface supports English and Hindi fully, with Tamil, Marathi and Bengali falling back to English. Voice notes can be spoken in your own language — they're transcribed automatically." },
      { q: "Is JanVaani free?", a: "Yes, completely free for citizens." },
    ],
  },
  hi: {
    eyebrow: "उपयोग गाइड",
    title: "JanVaani कैसे इस्तेमाल करें",
    sub: "नागरिकों के लिए आवाज़ उठाने की, और सांसद कार्यालय के लिए उस पर काम करने की सिलसिलेवार गाइड।",
    citizenTab: "नागरिकों के लिए",
    mpTab: "सांसद कार्यालय के लिए",
    faqTitle: "अक्सर पूछे जाने वाले सवाल",
    citizenSteps: [
      { t: "साइन इन करें और प्रोफ़ाइल पूरी करें", d: "Google से साइन इन करें और अपना निर्वाचन क्षेत्र, राज्य और पिनकोड एक बार भरें। आपका निर्वाचन क्षेत्र ही तय करता है कि शिकायत किस सांसद के बहीखाते में पहुँचेगी।" },
      { t: "आवाज़ उठाएँ — बोलें, लिखें या फोटो लें", d: "'अपनी आवाज़ उठाएँ' पर अपनी भाषा में वॉइस नोट रिकॉर्ड करें, समस्या लिखें, या फोटो अपलोड करें। लिखते समय श्रेणी के सुझाव दिखेंगे — यह तय कीवर्ड नियम से आते हैं, AI के अंदाज़े से नहीं।" },
      { t: "पहले आस-पास की समस्याएँ देखें", d: "लोकेशन डालते ही मिनी-नक्शा दिखाता है कि आपके पास कौन सी समस्याएँ पहले से दर्ज हैं। पहले से दर्ज समस्या पर भी अपनी शिकायत ज़रूर करें — बार-बार की रिपोर्टें प्रमाण मज़बूत करती हैं।" },
      { t: "ड्राफ्ट अपने आप सेव होता है", d: "आधी लिखी शिकायत आपके डिवाइस पर अपने आप सेव हो जाती है। कभी भी लौटें और वहीं से जारी रखें।" },
      { t: "'मेरी शिकायतें' में सब कुछ ट्रैक करें", d: "हर शिकायत की लाइव टाइमलाइन (दर्ज → प्रगति में → हल), कौन सा विभाग देख रहा है, और प्रमाण की मजबूती — सटीक कारणों के साथ, सीधी भाषा में।" },
      { t: "प्रगति पर सूचना पाएँ", d: "सांसद कार्यालय जब स्थिति बदलता है, आपकी प्रोफ़ाइल पर सूचना आती है। गुमनाम शिकायतें गुमनाम ही रहती हैं।" },
      { t: "अपनी नागरिक पहचान बनाएँ", d: "हर शिकायत पर 10 अंक; हल होने पर 25 और। बैज — Voice, Advocate, Champion, Guardian — तय सीमाओं से मिलते हैं, किसी एल्गोरिथ्म से नहीं।" },
    ],
    mpSteps: [
      { t: "अनुमोदित खाते से साइन इन करें", d: "डैशबोर्ड की पहुँच admin द्वारा अनुमोदित खातों तक सीमित है। हर खाता ठीक एक निर्वाचन क्षेत्र से बँधा है।" },
      { t: "ओवरव्यू पढ़ें", d: "KPI, श्रेणियाँ, रैंक की गई समस्याएँ और सहमति समूह। हर स्कोर असली शिकायत संख्या और सरकारी डेटा तक वापस जाता है।" },
      { t: "शिकायत सूची पर काम करें", d: "श्रेणी/स्थिति से फ़िल्टर करें, वॉइस नोट सुनें, फोटो देखें, और एक क्लिक में नई → प्रगति में → हल करें। विभाग टैग लगाएँ।" },
      { t: "हॉटस्पॉट नक्शा देखें", d: "लोकेशन के हिसाब से शिकायत घनत्व। तुलना टॉगल से यह अवधि बनाम पिछली अवधि देखें।" },
      { t: "घंटी पर नज़र रखें", d: "नोटिफिकेशन बेल नई उच्च-विश्वास शिकायतों (स्कोर ≥ 70) की सूचना देती है।" },
      { t: "सरकारी डेटा अपलोड करें", d: "योजनाओं, नामांकन, जनसंख्या का CSV/API आयात। जहाँ नागरिक शिकायतें डेटा की पुष्टि करती हैं, वहीं तय +15 बोनस लगता है — अकेला डेटा कभी स्कोर नहीं बदलता।" },
      { t: "फील्ड रिपोर्ट प्रिंट करें", d: "Print report बटन समीक्षा बैठकों के लिए साफ, प्रिंट-योग्य सार तैयार करता है — सीधे ब्राउज़र से।" },
    ],
    faqs: [
      { q: "क्या मेरी पहचान सांसद को दिखती है?", a: "सिर्फ़ आपकी मर्ज़ी से। सबमिट से पहले 'गुमनाम' चुनें तो आपका नाम कहीं नहीं जुड़ता।" },
      { q: "प्रमाण की मजबूती का स्कोर कौन तय करता है?", a: "कोई नहीं — और कोई AI नहीं। यह तय, सार्वजनिक नियम है: आस-पास की पुष्टि करने वाली शिकायतें, जुड़ी फोटो/आवाज़, और सरकारी डेटा की पुष्टि। हर स्कोर के नीचे सटीक कारण लिखे होते हैं।" },
      { q: "AI यहाँ असल में क्या करता है?", a: "वॉइस नोट का ट्रांसक्रिप्शन, फोटो का विवरण, और पहले से गणना किए नंबरों की सरल व्याख्या। उसे कभी स्कोर, प्राथमिकता या निर्णय गढ़ने की अनुमति नहीं है।" },
      { q: "मेरी शिकायत 'कमज़ोर' प्रमाण दिखाती है। क्या वह अनदेखी होगी?", a: "नहीं। कमज़ोर का मतलब सिर्फ़ अभी कम पुष्टि है। आपके इलाके से और रिपोर्टें या फोटो उसे मज़बूत करती हैं। सांसद हर शिकायत देखता है।" },
      { q: "कौन सी भाषाएँ चलेंगी?", a: "इंटरफ़ेस अंग्रेज़ी और हिन्दी में पूरा है; तमिल, मराठी, बांग्ला अभी अंग्रेज़ी पर आधारित हैं। वॉइस नोट अपनी भाषा में बोलें — अपने आप ट्रांसक्राइब होगा।" },
      { q: "क्या JanVaani मुफ़्त है?", a: "हाँ, नागरिकों के लिए पूरी तरह मुफ़्त।" },
    ],
  },
};

function Steps({ steps }: { steps: { t: string; d: string }[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, i) => (
        <li key={step.t} className="card rise flex gap-4 p-5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] font-display text-sm font-bold text-[var(--color-marigold)]"
          >
            {i + 1}
          </span>
          <div>
            <h3 className="font-bold text-[var(--color-ink)]">{step.t}</h3>
            <p className="mt-1 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">{step.d}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function GuidePage() {
  const s = useLocalStrings(STRINGS);
  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-3xl px-5 py-12">
        <p className="eyebrow text-[var(--color-marigold-deep)]">{s.eyebrow}</p>
        <h1 className="display-lg mt-2 text-[var(--color-ink)]">{s.title}</h1>
        <p className="mt-3 max-w-xl text-[var(--color-ink-soft)]">{s.sub}</p>

        <Tabs
          className="mt-10"
          tabs={[
            { label: s.citizenTab, content: <Steps steps={s.citizenSteps} /> },
            { label: s.mpTab, content: <Steps steps={s.mpSteps} /> },
          ]}
        />

        <section id="faq" className="mt-16">
          <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">{s.faqTitle}</h2>
          <div className="mt-6 space-y-3">
            {s.faqs.map((f) => (
              <AccordionItem key={f.q} question={f.q}>
                {f.a}
              </AccordionItem>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
