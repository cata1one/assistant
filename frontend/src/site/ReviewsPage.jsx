import Reviews from "./Reviews.jsx";
import { Section } from "./parts.jsx";

export default function ReviewsPage() {
  return (
    <div className="pt-20">
      <Section eyebrow="Отзывы" title="Что говорят о Bright" text="Преподаватели, ученики и родители. Только настоящие отзывы после проверки.">
        <Reviews />
        <div className="card mt-10 flex flex-wrap items-center justify-between gap-4">
          <div><h3 className="text-xl">Пользуетесь Bright?</h3><p className="text-sm text-ink-mute">Оставьте отзыв в кабинете – это минута.</p></div>
          <a href="#/app/review" className="btn-brand">Оставить отзыв</a>
        </div>
      </Section>
    </div>
  );
}
