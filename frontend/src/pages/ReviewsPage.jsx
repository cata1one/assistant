import Reviews from "../components/Reviews.jsx";
import { PageHead } from "../components/ui.jsx";

export default function ReviewsPage() {
  return (
    <>
      <PageHead eyebrow="Отзывы" title={<>Что говорят <span className="text-aurora italic">о школе</span></>}
        text="Ученики, родители и преподаватели. Публикуем только настоящие отзывы — после проверки администратором." />
      <Reviews />
      <div className="card mt-12 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl">Занимаетесь или преподаёте у нас?</h3>
          <p className="mt-1">Оставьте отзыв в личном кабинете — это займёт минуту.</p>
        </div>
        <a href="#/cabinet?tab=review" className="btn-primary">Оставить отзыв</a>
      </div>
    </>
  );
}
