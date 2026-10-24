from datetime import datetime

from tutor_assistant.models import Role
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage


def _live_lesson(assistant: TutorAssistant):
    lesson = assistant.start_lesson(chat_id="chat1", tutor_id="t1", tutor_name="Анна", title="Урок 1")
    lid = lesson["id"]
    say = lambda who, text, ref=None, ts=None: assistant.process_message(  # noqa: E731
        lid, who, {"t1": "Анна", "s1": "Миша"}[who], text, ref=ref, ts=ts)
    return lid, say


def test_live_lesson_full_flow(assistant: TutorAssistant):
    lid, say = _live_lesson(assistant)
    out = say("t1", "Тема урока: Еда. Новые слова сегодня: apple — яблоко, pear — груша")
    assert [w.word for w in out.new_words] == ["apple", "pear"]
    assert out.moderation.action == "allow"

    out = say("s1", "мой телеграм @misha_2010")
    assert out.moderation.blocked and out.incident_id
    assert "@misha_2010" not in out.stored_text
    assert assistant.storage.get_lesson(lid)["student_id"] == "s1"  # первый ученик запомнен

    out = say("t1", "ДЗ: выучить слова; упражнение 3")
    assert [h.text for h in out.new_homework] == ["Выучить слова.", "Упражнение 3."]

    # Во время урока запросы видят ещё не сохранённые слова и ДЗ
    assert "apple" in assistant.handle_text_query("новые слова сегодня", chat_id="chat1")
    assert "Упражнение 3" in assistant.handle_text_query("дз", chat_id="chat1")

    report = assistant.finish_lesson(lid)
    assert [v.word for v in report.vocabulary] == ["apple", "pear"]
    assert [h.text for h in report.homework_teacher] == ["Выучить слова.", "Упражнение 3."]
    assert report.stats.violations == 1
    assert report.topic == "Еда"
    assert assistant.storage.get_lesson(lid)["status"] == "finished"

    # Сохранённое в базе — без контактов
    texts = [u.text for u in assistant.storage.lesson_utterances(lid)]
    assert not any("misha_2010" in t for t in texts)
    # Исходный текст есть только в журнале нарушений
    incidents = assistant.storage.incidents(lesson_id=lid)
    assert incidents[0]["original_text"] == "мой телеграм @misha_2010" and incidents[0]["role"] == "student"

    # После урока: словарь ученика и запросы по ключевым словам
    today = assistant.handle_text_query("Новые слова сегодня?", chat_id="chat1")
    assert "apple – яблоко" in today and "pear – груша" in today
    assert "apple" in assistant.handle_text_query("новые слова", chat_id="chat1")
    assert "Ваш словарь" in assistant.handle_text_query("мой словарь", chat_id="chat1")
    assert "Тест" in assistant.handle_text_query("тест", chat_id="chat1")
    assert "Ответы" in assistant.handle_text_query("ответы", chat_id="chat1")
    assert "Конспект" in assistant.handle_text_query("конспект", chat_id="chat1")
    assert "Выучить слова" in assistant.handle_text_query("какое домашнее задание", chat_id="chat1")
    assert [w.word for w in assistant.words_today("student:s1")] == ["apple", "pear"]


def test_known_words_are_not_new_next_lesson(assistant: TutorAssistant):
    lid, say = _live_lesson(assistant)
    say("t1", "Новые слова: landlord — арендодатель")
    say("s1", "ok")
    assistant.finish_lesson(lid)

    lid2, say2 = _live_lesson(assistant)
    say2("s1", "hi")
    say2("t1", "The landlord is nice. The landlord lives here. Our neighbour is a landlord too. Neighbour, neighbour.")
    report = assistant.finish_lesson(lid2)
    extra = [w.word for w in report.extra_words]
    assert "neighbour" in extra and "landlord" not in extra


def test_split_phone_in_live_chat(assistant: TutorAssistant):
    lid, say = _live_lesson(assistant)
    say("s1", "8 916", ref=101, ts=0)
    say("s1", "555", ref=102, ts=2)
    out = say("s1", "12 34", ref=103, ts=4)
    assert out.moderation.blocked and out.moderation.related_refs == [101, 102]


def test_live_state_survives_restart(settings, tmp_path):
    db = tmp_path / "db.sqlite3"
    a1 = TutorAssistant(settings, Storage(db))
    lesson = a1.start_lesson(chat_id="c", tutor_id="t", tutor_name="T")
    a1.process_message(lesson["id"], "t", "T", "Новые слова: cat — кошка")
    a1.storage.close()

    a2 = TutorAssistant(settings, Storage(db))  # «перезапуск» бота
    assert a2.start_lesson(chat_id="c")["id"] == lesson["id"]  # активный урок продолжается
    out = a2.process_message(lesson["id"], "t", "T", "cat переводится как кошка")
    assert out.new_words == []  # без дублей
    report = a2.finish_lesson(lesson["id"])
    assert [v.word for v in report.vocabulary] == ["cat"]
    a2.storage.close()


def test_blocked_tutor_message_does_not_feed_vocabulary(assistant: TutorAssistant):
    lid, say = _live_lesson(assistant)
    out = say("t1", "Новые слова: apple — яблоко. Пиши мне в телеграм @anna_t")
    assert out.moderation.blocked and out.new_words == []


def test_analyze_transcript(assistant: TutorAssistant, sample_lesson: str):
    report, violations = assistant.analyze_transcript(sample_lesson, title="Урок 5")
    words = [v.word for v in report.vocabulary]
    assert words[:5] == ["kitchen", "wardrobe", "cozy", "to rent", "landlord"]
    assert "neighbour" in words
    assert len(report.homework_teacher) == 3
    assert report.test and report.homework_generated and report.rules and report.corrections
    assert report.topic and report.topic.startswith("Present Perfect")
    assert report.stats.duration_minutes == 26
    assert {v["speaker"] for v in violations} == {"Миша", "Анна Петровна"}
    assert len(violations) == 3
    dumped = report.model_dump_json()
    assert "anna_english_tutor" not in dumped and "555 12 34" not in dumped


def test_analyze_transcript_hides_split_phone_parts(assistant: TutorAssistant):
    report, violations = assistant.analyze_transcript("Учитель: Hello\nУченик: 8 916\nУченик: 555\nУченик: 12 34\n")
    assert len(violations) == 1 and violations[0]["related_indexes"] == [1, 2]


def test_analyze_transcript_persist(assistant: TutorAssistant, sample_lesson: str):
    report, _ = assistant.analyze_transcript(sample_lesson, student_id="42", persist=True)
    assert report.lesson_id
    assert assistant.storage.get_report(report.lesson_id) is not None
    assert len(assistant.storage.all_words("student:42")) == len(report.vocabulary)
    assert assistant.storage.incident_count(lesson_id=report.lesson_id) == 3


def test_moderation_outside_lesson(assistant: TutorAssistant):
    result, incident_id = assistant.moderate_chat_message("chatX", "u1", "Вася", "звони 89001234567")
    assert result.blocked and incident_id
    assert assistant.storage.incidents(chat_id="chatX")[0]["user_name"] == "Вася"


def test_roles_resolution(assistant: TutorAssistant):
    lesson = assistant.start_lesson(chat_id="c2", tutor_id="t")
    assert assistant.resolve_role(lesson, "t", None) == Role.TUTOR
    assert assistant.resolve_role(lesson, "x", None) == Role.STUDENT
    assert assistant.resolve_role(lesson, "x", "teacher") == Role.TUTOR


def test_queries_without_lessons(assistant: TutorAssistant):
    assert assistant.handle_text_query("новые слова сегодня", chat_id="nope") == "Пока нет ни одного урока."
    assert "не задано" in assistant.handle_text_query("дз", chat_id="nope")
    assert "после завершения" in assistant.handle_text_query("тест", chat_id="nope")
    assert assistant.handle_text_query("просто текст", chat_id="nope") is None


def test_words_on_day_uses_timezone(storage: Storage, settings):
    from tutor_assistant.models import VocabItem

    storage.add_words("o", None, [VocabItem(word="cat")])
    today = datetime.now(settings.tz).date()
    assert [w.word for w in storage.words_on_day("o", today, settings.tz)] == ["cat"]
    assert storage.add_words("o", None, [VocabItem(word="Cat", translation="кошка")]) == 0
    assert storage.all_words("o")[0].translation == "кошка"



def test_words_today_after_new_lesson_started(assistant: TutorAssistant):
    """Слова сегодняшнего урока видны и после того, как в чате начался следующий урок."""
    lid, say = _live_lesson(assistant)
    say("s1", "hi")
    say("t1", "Новые слова: rain — дождь")
    assistant.finish_lesson(lid)
    assistant.start_lesson(chat_id="chat1", tutor_id="t1")
    assert "rain – дождь" in assistant.handle_text_query("новые слова сегодня", chat_id="chat1")
    assert "rain" in assistant.handle_text_query("новые слова", chat_id="chat1")
    assert "rain" in assistant.handle_text_query("мой словарь", chat_id="chat1")


def test_private_queries_by_student(assistant: TutorAssistant):
    lid, say = _live_lesson(assistant)
    say("s1", "hi")
    say("t1", "Новые слова: rain — дождь")
    say("t1", "ДЗ: описать погоду")
    assistant.finish_lesson(lid)
    assert "Описать погоду" in assistant.answer_command("homework", owner="student:s1")
    assert "rain" in assistant.answer_command("words_today", owner="student:s1")
    assert "Тест" in assistant.answer_command("test", owner="student:s1")
