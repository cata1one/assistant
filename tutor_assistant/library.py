"""Готовые занятия платформы: подготовка к IELTS и HSK, общий английский.

Все тексты написаны для платформы. Преподаватель копирует занятие к себе и меняет как хочет.
"""

from __future__ import annotations

from typing import Any

LIBRARY: list[dict[str, Any]] = [
    {
        "id": "lib-ielts-speaking-hometown", "title": "IELTS Speaking Part 1: Hometown", "language": "en", "level": "B1–B2",
        "tags": ["IELTS", "Speaking"],
        "blocks": [
            {"type": "text", "title": "Как отвечать в Part 1",
             "body": "В первой части экзаменатор задаёт короткие вопросы о вас. Хороший ответ – 2–3 предложения: "
                     "прямой ответ, причина или пример, немного деталей.\n\nDo you like your hometown? → "
                     "Yes, I do. It's a bustling city with lots of things to do, but the parks make it feel calm."},
            {"type": "words", "title": "Новые слова", "items": [
                {"word": "bustling", "translation": "оживлённый, шумный"},
                {"word": "suburb", "translation": "пригород"},
                {"word": "landmark", "translation": "достопримечательность, ориентир"},
                {"word": "commute", "translation": "дорога на работу или учёбу"},
                {"word": "vibrant", "translation": "яркий, полный жизни"},
                {"word": "picturesque", "translation": "живописный"},
            ]},
            {"type": "match", "title": "Соедините слово и значение", "pairs": [
                ["bustling", "full of people and activity"],
                ["suburb", "an area on the edge of a city where people live"],
                ["landmark", "a famous building or place that is easy to recognise"],
                ["commute", "the journey to work or school every day"],
                ["picturesque", "pretty, especially in an old-fashioned way"],
            ]},
            {"type": "gap", "title": "Вставьте слова", "bank": True, "text":
                "I grew up in a quiet [suburb] about twenty minutes from the centre. My daily [commute] was short, "
                "which I loved. The most famous [landmark] is the old bridge over the river. On weekends the market "
                "square is really [bustling], and the old town is very [picturesque]."},
            {"type": "choice", "title": "Выберите лучший ответ экзаменатору", "questions": [
                {"q": "Is your hometown a good place for young people?",
                 "options": ["Yes.", "Yes, definitely. There are lots of cafés and sports clubs, so there's always something to do.",
                             "My hometown is a town."], "answer": 1},
                {"q": "What do you like most about your hometown?",
                 "options": ["Probably the river. It's picturesque, and I often walk there after work.",
                             "I like.", "It is nothing."], "answer": 0},
            ]},
            {"type": "write", "title": "Ваш ответ",
             "prompt": "Ответьте на вопросы письменно или запишите голосом, по 2–3 предложения:\n"
                       "1. Where is your hometown?\n2. What do you like about it?\n3. Has it changed much since you were a child?"},
        ],
    },
    {
        "id": "lib-ielts-writing-trends", "title": "IELTS Writing Task 1: тренды на графиках", "language": "en",
        "level": "B2", "tags": ["IELTS", "Writing"],
        "blocks": [
            {"type": "text", "title": "Как описывать изменения",
             "body": "Глагол + наречие: rose sharply, fell slightly, increased steadily.\n"
                     "Прилагательное + существительное: a sharp rise, a slight fall, a steady increase.\n"
                     "Пик и стабильность: peaked at, remained stable at, fluctuated between."},
            {"type": "words", "title": "Новые слова", "items": [
                {"word": "rise sharply", "translation": "резко вырасти"},
                {"word": "decline gradually", "translation": "постепенно снижаться"},
                {"word": "fluctuate", "translation": "колебаться"},
                {"word": "peak", "translation": "достичь пика"},
                {"word": "remain stable", "translation": "оставаться стабильным"},
                {"word": "plummet", "translation": "резко упасть"},
            ]},
            {"type": "gap", "title": "Опишите график: вставьте слова", "bank": True, "text":
                "Between 2010 and 2015, the number of visitors [rose] sharply from 20,000 to 50,000. It [peaked] at "
                "60,000 in 2016 and then [remained] stable for two years. After 2018, the figure [fluctuated] between "
                "40,000 and 45,000, before it [plummeted] to just 10,000 in 2020."},
            {"type": "choice", "title": "Глагол или существительное?", "questions": [
                {"q": "There was a sharp ___ in prices.", "options": ["rise", "rose", "risen"], "answer": 0},
                {"q": "Prices ___ dramatically in 2019.", "options": ["increase", "increased", "an increase"], "answer": 1},
                {"q": "The figure ___ at 80% in May.", "options": ["peaked", "peak", "peaking"], "answer": 0},
            ]},
            {"type": "write", "title": "Мини-описание",
             "prompt": "Опишите в 3–4 предложениях: продажи кофе в кафе росли с января по март, в апреле достигли пика "
                       "(500 чашек в день), а затем постепенно снижались до июня."},
        ],
    },
    {
        "id": "lib-ielts-listening-booking", "title": "IELTS Listening Section 1: запись в спортклуб", "language": "en",
        "level": "B1–B2", "tags": ["IELTS", "Listening"],
        "blocks": [
            {"type": "text", "title": "Как это устроено",
             "body": "В первой части – разговор двух людей о бытовой ситуации. Нужно дописать форму: имя, дату, время, "
                     "цену. Перед прослушиванием прочитайте пропуски и подумайте, какое слово подходит. Можно "
                     "слушать два раза."},
            {"type": "listening", "title": "Послушайте и заполните форму", "lang": "en-GB", "script":
                "Good morning, Riverside Sports Centre. – Hi, I'd like to join the swimming club. – Of course. Can I "
                "have your surname? – It's [Fletcher], F-L-E-T-C-H-E-R. – Thank you. Which membership would you like, "
                "monthly or yearly? – [Monthly], please. – The beginners' group meets on [Tuesday] evenings at "
                "[seven|7] o'clock. – Great. How much is it? – It's [thirty|30] pounds a month, and you'll need to "
                "bring your own [towel].",
             "questions": [
                 {"q": "Why is the woman calling?", "options": ["To book a tennis court", "To join the swimming club",
                                                               "To complain about a class"], "answer": 1},
                 {"q": "What does she need to bring?", "options": ["A towel", "A photo", "Her passport"], "answer": 0},
             ]},
            {"type": "write", "title": "Проверьте себя",
             "prompt": "Какие слова вы не расслышали с первого раза? Выпишите их и послушайте запись ещё раз."},
        ],
    },
    {
        "id": "lib-hsk1-greetings", "title": "HSK 1: приветствия и вежливые фразы", "language": "zh", "level": "HSK 1",
        "tags": ["HSK", "HSK 1"],
        "blocks": [
            {"type": "words", "title": "Новые слова", "items": [
                {"word": "你好 (nǐ hǎo)", "translation": "здравствуйте, привет"},
                {"word": "谢谢 (xièxie)", "translation": "спасибо"},
                {"word": "不客气 (bú kèqi)", "translation": "пожалуйста (в ответ на «спасибо»)"},
                {"word": "对不起 (duìbuqǐ)", "translation": "извините"},
                {"word": "没关系 (méi guānxi)", "translation": "ничего страшного"},
                {"word": "再见 (zàijiàn)", "translation": "до свидания"},
                {"word": "老师 (lǎoshī)", "translation": "учитель"},
                {"word": "学生 (xuésheng)", "translation": "ученик, студент"},
            ]},
            {"type": "match", "title": "Фраза и ответ на неё", "pairs": [
                ["谢谢", "不客气"], ["对不起", "没关系"], ["你好", "你好"], ["再见", "再见"],
            ]},
            {"type": "gap", "title": "Вставьте слово в диалог", "bank": True, "text":
                "A: 老师，[你好]！\nB: 你好！\nA: [谢谢] 老师！\nB: [不客气]。\nA: [对不起]！\nB: [没关系]。\nA: 老师 [再见]！"},
            {"type": "choice", "title": "Тест", "questions": [
                {"q": "Что ответить на 谢谢?", "options": ["没关系", "不客气", "你好"], "answer": 1},
                {"q": "Как сказать «учитель»?", "options": ["学生", "老师", "再见"], "answer": 1},
                {"q": "Какой тон у слога hǎo в 你好?", "options": ["первый", "второй", "третий", "четвёртый"], "answer": 2},
            ]},
            {"type": "listening", "title": "Послушайте и выберите", "lang": "zh-CN", "script": "对不起。没关系。",
             "questions": [{"q": "Что вы услышали?", "options": ["Спасибо – пожалуйста", "Извините – ничего страшного",
                                                                 "Здравствуйте – до свидания"], "answer": 1}]},
        ],
    },
    {
        "id": "lib-hsk2-shopping", "title": "HSK 2: в магазине", "language": "zh", "level": "HSK 2",
        "tags": ["HSK", "HSK 2"],
        "blocks": [
            {"type": "words", "title": "Новые слова", "items": [
                {"word": "多少钱 (duōshao qián)", "translation": "сколько стоит"},
                {"word": "便宜 (piányi)", "translation": "дешёвый"},
                {"word": "贵 (guì)", "translation": "дорогой"},
                {"word": "块 (kuài)", "translation": "юань (в разговоре)"},
                {"word": "买 (mǎi)", "translation": "покупать"},
                {"word": "卖 (mài)", "translation": "продавать"},
                {"word": "衣服 (yīfu)", "translation": "одежда"},
                {"word": "颜色 (yánsè)", "translation": "цвет"},
            ]},
            {"type": "match", "title": "Соедините иероглифы и перевод", "pairs": [
                ["便宜", "дешёвый"], ["贵", "дорогой"], ["买", "покупать"], ["卖", "продавать"], ["颜色", "цвет"],
            ]},
            {"type": "gap", "title": "Диалог в магазине", "bank": True, "text":
                "A: 这件衣服 [多少钱]？\nB: 二百 [块]。\nA: 太 [贵] 了！有没有 [便宜] 一点儿的？\nB: 有，这件一百块，你喜欢这个 [颜色] 吗？\nA: 喜欢，我 [买] 这件。"},
            {"type": "listening", "title": "Аудирование", "lang": "zh-CN", "script": "这件衣服多少钱？一百五十块。太贵了！",
             "questions": [
                 {"q": "Сколько стоит одежда?", "options": ["15 юаней", "150 юаней", "500 юаней"], "answer": 1},
                 {"q": "Что думает покупатель о цене?", "options": ["Дёшево", "Слишком дорого", "Нормально"], "answer": 1},
             ]},
            {"type": "write", "title": "Составьте диалог",
             "prompt": "Напишите свой диалог из 4–6 реплик: вы покупаете одежду и торгуетесь. Используйте 多少钱, 贵, 便宜."},
        ],
    },
    {
        "id": "lib-en-present-perfect", "title": "Present Perfect или Past Simple", "language": "en", "level": "A2–B1",
        "tags": ["Грамматика"],
        "blocks": [
            {"type": "text", "title": "Правило",
             "body": "Present Perfect (have/has + V3) – опыт и результат к настоящему моменту, время не важно или не "
                     "закончилось: I have been to London. She has lost her keys.\n"
                     "Past Simple (V2) – законченное действие в прошлом с указанием времени: I went to London last year.\n"
                     "Маркеры Present Perfect: ever, never, already, yet, just, since, for. Маркеры Past Simple: yesterday, "
                     "ago, last week, in 2019."},
            {"type": "gap", "title": "Поставьте глагол в нужную форму", "text":
                "1. I [have never been|'ve never been] to Japan. (never / be)\n2. We [visited] Paris two years ago. (visit)\n"
                "3. She [has just finished|'s just finished] her homework. (just / finish)\n4. They [moved] to Moscow in 2020. (move)\n"
                "5. [Have] you ever [tried] sushi? (try)"},
            {"type": "choice", "title": "Выберите правильный вариант", "questions": [
                {"q": "I ___ him yesterday.", "options": ["have seen", "saw", "see"], "answer": 1},
                {"q": "She ___ here since 2018.", "options": ["has worked", "worked", "works"], "answer": 0},
                {"q": "___ you finished yet?", "options": ["Did", "Have", "Are"], "answer": 1},
                {"q": "We ___ to the cinema last night.", "options": ["have gone", "went", "go"], "answer": 1},
            ]},
            {"type": "write", "title": "Расскажите о себе",
             "prompt": "Напишите 3 предложения о том, что вы уже делали в жизни (Present Perfect), и 3 – о том, когда "
                       "именно это было (Past Simple)."},
        ],
    },
]


def library_unit(unit_id: str) -> dict[str, Any] | None:
    return next((u for u in LIBRARY if u["id"] == unit_id), None)
