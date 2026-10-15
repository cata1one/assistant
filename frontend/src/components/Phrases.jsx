/** Бегущая строка фраз на английском и китайском — визуальный «голос» языковой школы. */
const PHRASES = [
  ["Nice to meet you", "Приятно познакомиться"], ["你好", "nǐ hǎo · привет"], ["Practice makes perfect", "Повторение — мать учения"],
  ["加油!", "jiā yóu · вперёд!"], ["Break a leg", "Ни пуха ни пера"], ["我爱学习", "wǒ ài xuéxí · я люблю учиться"],
  ["Piece of cake", "Проще простого"], ["谢谢", "xièxie · спасибо"], ["Keep it up!", "Так держать!"],
  ["慢慢来", "màn man lái · не торопись"],
];

export default function Phrases() {
  const row = [...PHRASES, ...PHRASES];
  return (
    <div aria-hidden="true" className="relative my-10 overflow-hidden border-y border-white/10 py-5 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
      <div className="marquee flex w-max gap-10">
        {row.map(([p, t], i) => (
          <span key={i} className="flex items-baseline gap-3 whitespace-nowrap">
            <span className="font-display text-2xl text-white md:text-3xl">{p}</span>
            <span className="text-sm text-zinc-500">{t}</span>
            <span className="ml-7 text-violet-soft">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
