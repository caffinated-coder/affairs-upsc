import type { TopicId } from "@/lib/pib/topics";

const TONE: Record<Exclude<TopicId, "all">, { bg: string; a: string; b: string }> = {
  economy: { bg: "#E7F6EF", a: "#3D9B80", b: "#A8D9C6" },
  foreign: { bg: "#EEE9FF", a: "#6D5AE6", b: "#C9C0F5" },
  infra: { bg: "#E4F4F8", a: "#3A8EA8", b: "#B7D9E4" },
  health: { bg: "#FDEEE8", a: "#E07A5F", b: "#F3C4B5" },
  environment: { bg: "#EAF6E4", a: "#5A9A4A", b: "#C3E0B8" },
  governance: { bg: "#EEF1F6", a: "#5B6478", b: "#C5CAD6" },
};

export function StoryArt({ topic, className }: { topic: Exclude<TopicId, "all">; className?: string }) {
  const t = TONE[topic];
  return (
    <svg viewBox="0 0 280 160" className={className} aria-hidden>
      <rect width="280" height="160" rx="20" fill={t.bg} />
      {topic === "economy" && (<><path d="M24 128 L70 96 L110 108 L168 64 L220 80 L256 48" fill="none" stroke={t.b} strokeWidth="8" strokeLinecap="round" /><path d="M24 128 L70 96 L110 108 L168 64 L220 80 L256 48" fill="none" stroke={t.a} strokeWidth="3.5" strokeLinecap="round" /><circle cx="168" cy="64" r="7" fill={t.a} /><rect x="36" y="118" width="10" height="22" rx="2" fill={t.b} /><rect x="52" y="104" width="10" height="36" rx="2" fill={t.a} /><rect x="68" y="110" width="10" height="30" rx="2" fill={t.b} /><circle cx="228" cy="44" r="18" fill={t.a} opacity="0.2" /></>)}
      {topic === "foreign" && (<><circle cx="150" cy="82" r="46" fill="white" opacity="0.55" /><circle cx="150" cy="82" r="46" fill="none" stroke={t.b} strokeWidth="3" /><ellipse cx="150" cy="82" rx="18" ry="46" fill="none" stroke={t.a} strokeWidth="2" /><path d="M104 82h92M150 36v92" stroke={t.b} strokeWidth="2" /><path d="M70 108 C110 70, 160 70, 220 50" fill="none" stroke={t.a} strokeWidth="3" strokeLinecap="round" /><circle cx="220" cy="50" r="5" fill={t.a} /></>)}
      {topic === "infra" && (<><path d="M20 118 C80 40, 200 40, 260 118" fill="none" stroke={t.b} strokeWidth="10" /><path d="M20 118 C80 40, 200 40, 260 118" fill="none" stroke={t.a} strokeWidth="3.5" /><rect x="132" y="70" width="16" height="58" rx="3" fill={t.a} /><path d="M20 128h240" stroke={t.b} strokeWidth="6" /></>)}
      {topic === "health" && (<><rect x="118" y="40" width="44" height="88" rx="10" fill={t.b} /><rect x="96" y="62" width="88" height="44" rx="10" fill={t.a} /><circle cx="58" cy="54" r="22" fill="white" opacity="0.7" /></>)}
      {topic === "environment" && (<><circle cx="86" cy="96" r="36" fill={t.a} opacity="0.25" /><circle cx="128" cy="88" r="44" fill={t.a} opacity="0.35" /><circle cx="168" cy="100" r="32" fill={t.b} /><rect x="124" y="112" width="12" height="28" rx="3" fill={t.a} /></>)}
      {topic === "governance" && (<><rect x="70" y="48" width="140" height="84" rx="8" fill="white" opacity="0.7" /><rect x="70" y="48" width="140" height="22" rx="8" fill={t.a} /><rect x="86" y="84" width="108" height="8" rx="4" fill={t.b} /><rect x="86" y="100" width="72" height="8" rx="4" fill={t.b} /></>)}
    </svg>
  );
}
