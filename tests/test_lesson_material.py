"""Слова, домашнее задание, тест, конспект, разбор расшифровки, текстовые утилиты."""

from tutor_assistant import textnorm
from tutor_assistant.homework import (
    HomeworkCollector,
    extract_from_message,
    generate_homework,
)
from tutor_assistant.models import Role, Rule, VocabItem, word_key
from tutor_assistant.quiz import generate_test
from tutor_assistant.summary import (
    detect_topic,
    extract_corrections,
    extract_rules,
    plural,
)
from tutor_assistant.transcript import parse_transcript
from tutor_assistant.vocabulary import (
    VocabularyCollector,
    auto_candidates,
    extract_announced,
    extract_pairs,
    parse_item,
)

# -- нормализация -------------------------------------------------------------


def test_words_to_digits():
    assert textnorm.words_to_digits("восемь девятьсот двадцать три сорок пять") == "8 923 45"
    assert textnorm.words_to_digits("плюс семь девятьсот") == "+7 900"
    assert textnorm.words_to_digits("пять яблок") == "5 яблок"
    assert textnorm.words_to_digits("nine hundred five") == "905"


def test_homoglyphs_and_spacing():
    assert textnorm.for_matching("Мой тeлeгрaм") == "мой телеграм"
    assert textnorm.for_matching("в а т с а п") == "ватсап"


def test_deobfuscate_email():
    assert textnorm.deobfuscate_email("ivan собака gmail точка com") == "ivan@gmail.com"
    assert textnorm.deobfuscate_email("look at google.com") == "look at google.com"


# -- слова ------------------------------------------------------------------------


def test_announced_list_inline():
    items, awaiting = extract_announced(
        "Новые слова сегодня: apple — яблоко, pear — груша, to run - бегать, бежать; brave (смелый)")
    assert not awaiting
    assert [(i.word, i.translation) for i in items] == [
        ("apple", "яблоко"), ("pear", "груша"), ("to run", "бегать, бежать"), ("brave", "смелый")]


def test_announced_list_multiline_with_transcription():
    items, _ = extract_announced("New words:\n1. kitchen [ˈkɪtʃɪn] — кухня\n2) fridge — холодильник\n- oven")
    assert [(i.word, i.translation, i.transcription) for i in items] == [
        ("kitchen", "кухня", "[ˈkɪtʃɪn]"), ("fridge", "холодильник", None), ("oven", None, None)]


def test_parse_item_swaps_sides():
    item = parse_item("яблоко — apple")
    assert item and item.word == "apple" and item.translation == "яблоко"
    assert parse_item("просто русский текст") is None


def test_list_announced_then_items_in_next_messages():
    vc = VocabularyCollector()
    assert vc.feed_tutor_message("Запишите новые слова.") == []
    assert [w.word for w in vc.feed_tutor_message("1. sofa — диван")] == ["sofa"]
    assert [w.word for w in vc.feed_tutor_message("2. armchair — кресло")] == ["armchair"]
    vc.feed_tutor_message("Отлично, а теперь читаем текст.")
    assert vc.feed_tutor_message("3. lamp - лампа") == []  # список закончился
    assert len(vc.words) == 2


def test_free_speech_pairs():
    pairs = extract_pairs("Смотри, brave переводится как смелый, а clever означает умный. Кухня по-английски kitchen.")
    assert {(p.word, p.translation) for p in pairs} == {("brave", "смелый"), ("clever", "умный"), ("kitchen", "кухня")}


def test_collector_deduplicates_and_merges():
    vc = VocabularyCollector()
    vc.feed_tutor_message("Новые слова: the apple")
    vc.feed_tutor_message("apple переводится как яблоко")
    assert len(vc.words) == 1 and vc.words[0].translation == "яблоко"


def test_word_key():
    assert word_key("To Run") == "run"
    assert word_key("the Apple.") == "apple"


def test_auto_candidates_skip_known_and_basic():
    utt = parse_transcript("Учитель: The landlord lives upstairs. The landlord is nice.\n"
                           "Учитель: Слово wardrobe — это шкаф. My wardrobe is big.\n"
                           "Ученик: Landlord?")
    words = [w.word for w in auto_candidates(utt, known=["wardrobe"])]
    assert "landlord" in words
    assert "wardrobe" not in words and "the" not in words and "nice" not in words


# -- домашнее задание --------------------------------------------------------------


def test_homework_with_colon_and_items():
    tasks, awaiting = extract_from_message("Домашнее задание: 1) упражнение 4 на с. 32; 2) выучить слова")
    assert not awaiting and tasks == ["Упражнение 4 на с. 32.", "Выучить слова."]


def test_homework_sentence_without_colon():
    tasks, _ = extract_from_message("Отлично поработали. К следующему уроку выучите слова и сделайте упражнение 5.")
    assert tasks == ["К следующему уроку выучите слова и сделайте упражнение 5."]


def test_homework_question_is_not_homework():
    assert extract_from_message("А какое дз?") == ([], False)


def test_homework_announced_then_items():
    hc = HomeworkCollector()
    hc.feed_tutor_message("Домашнее задание:")
    hc.feed_tutor_message("1. Прочитать текст на с. 20")
    hc.feed_tutor_message("2. Выучить слова")
    hc.feed_tutor_message("Всё, до встречи!")
    assert [t.text for t in hc.tasks] == ["Прочитать текст на с. 20.", "Выучить слова."]
    assert all(t.source == "teacher" for t in hc.tasks)


def test_generated_homework_uses_lesson_material():
    vocab = [VocabItem(word="cozy", translation="уютный"), VocabItem(word="kitchen", translation="кухня")]
    tasks = generate_homework(vocab, [Rule(title="Present Perfect", explanation="...")], "Дом")
    text = " ".join(t.text for t in tasks)
    assert "cozy" in text and "уютный" in text and "Present Perfect" in text and "«Дом»" in text
    assert all(t.source == "generated" for t in tasks)


# -- тест -----------------------------------------------------------------------


def test_generate_test_is_deterministic_and_correct():
    vocab = [VocabItem(word=w, translation=t, example=e) for w, t, e in [
        ("cozy", "уютный", "A cozy kitchen is nice."), ("landlord", "арендодатель", None),
        ("wardrobe", "шкаф", None), ("kitchen", "кухня", None)]]
    t1 = generate_test(vocab, seed="x")
    t2 = generate_test(vocab, seed="x")
    assert [q.model_dump() for q in t1] == [q.model_dump() for q in t2]
    for q in t1:
        if q.options:
            assert q.answer in q.options
            assert len(set(q.options)) == len(q.options)
    assert any(q.kind == "gap" and "_____" in q.question for q in t1)


def test_generate_test_without_translations():
    tests = generate_test([VocabItem(word="cozy")])
    assert tests and tests[0].kind == "open"


def test_generate_test_empty():
    assert generate_test([]) == []


# -- конспект ---------------------------------------------------------------------


def test_topic_rules_corrections():
    utt = parse_transcript(
        "Учитель: Тема урока: Present Perfect.\n"
        "Учитель: Запомни: Present Perfect образуется с помощью have/has и третьей формы глагола. I have done it.\n"
        "Ученик: I have went there.\n"
        "Учитель: Не \"I have went\", а \"I have gone\".")
    assert detect_topic(utt) == "Present Perfect"
    rules = extract_rules(utt)
    assert rules and "have/has" in rules[0].title and rules[0].examples == ["I have done it."]
    corr = extract_corrections(utt)
    assert corr and corr[0].wrong == "I have went" and corr[0].correct == "I have gone"


def test_plural():
    assert plural(1, "слово", "слова", "слов") == "1 слово"
    assert plural(3, "слово", "слова", "слов") == "3 слова"
    assert plural(11, "слово", "слова", "слов") == "11 слов"
    assert plural(22, "слово", "слова", "слов") == "22 слова"


# -- расшифровка --------------------------------------------------------------------


def test_parse_transcript_formats():
    utt = parse_transcript(
        "[10:00] Анна Петровна (преподаватель): Hello!\n"
        "продолжение реплики\n"
        "10:01 - Миша (ученик): Hi\n"
        "Teacher: Новые слова сегодня: apple — яблоко\n"
        "Student: OK\n")
    assert [(u.speaker, u.role) for u in utt] == [
        ("Анна Петровна", Role.TUTOR), ("Миша", Role.STUDENT), ("Teacher", Role.TUTOR), ("Student", Role.STUDENT)]
    assert utt[0].text == "Hello!\nпродолжение реплики"
    assert utt[0].timestamp == "10:00"
    assert "Новые слова сегодня: apple" in utt[2].text


def test_parse_transcript_keeps_labels_inside_text():
    utt = parse_transcript("Учитель: Сейчас продиктую.\nНовые слова сегодня: cat — кошка\nДомашнее задание: выучить")
    assert len(utt) == 1
    assert "Домашнее задание: выучить" in utt[0].text


def test_parse_transcript_infers_roles():
    utt = parse_transcript("Анна: Today we will learn a lot of new words and phrases about travelling.\nМиша: OK")
    assert utt[0].role == Role.TUTOR and utt[1].role == Role.STUDENT


def test_parse_transcript_with_names_mapping():
    utt = parse_transcript("Anna: Hi\nMike: Hello", tutor_names=["Anna"], student_names=["Mike"])
    assert [u.role for u in utt] == [Role.TUTOR, Role.STUDENT]
