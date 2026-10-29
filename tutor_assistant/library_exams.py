"""Курсы Bright: подготовка к экзаменам – IELTS, ОГЭ и ЕГЭ по английскому.

Задания повторяют формат экзаменов, но все тексты написаны для платформы.
Официальные демоверсии ЕГЭ и ОГЭ есть на сайте ФИПИ (fipi.ru) – их стоит решать вместе с этими занятиями.
"""

from .library import WR, C, G, L, M, T, W, unit

EXAMS = [
    # == IELTS =========================================================================================
    unit(
        "lib-ielts-speaking-hometown", "IELTS Speaking Part 1: дом и родной город", "en", "B1–B2", ["IELTS", "Speaking"],
        "Как отвечать на короткие вопросы первой части: формула ответа, полезные фразы, типичные ошибки.",
        T("Формула ответа", """
В Part 1 экзаменатор задаёт 10–12 коротких вопросов о вас. Хороший ответ – 2–3 предложения:
1) прямой ответ, 2) причина или пример, 3) деталь.

Do you like your hometown?
→ Yes, I really do. It's a bustling city with plenty of things to do, but the parks along the river make it feel calm.

Ошибки, которые снижают балл: ответ одним словом («Yes»), заученные длинные монологи, повтор слов из вопроса без изменений.
Перефразируйте: like → enjoy, be fond of; big → large, sprawling.
"""),
        W("""
bustling – оживлённый
suburb – пригород
landmark – достопримечательность
commute – дорога на работу или учёбу
vibrant – яркий, полный жизни
picturesque – живописный
sprawling – раскинувшийся
amenities – удобства, инфраструктура
to be fond of – любить, быть привязанным
it's a stone's throw from – рукой подать до
"""),
        M("Слово и определение", """
bustling = full of people and activity
suburb = an area on the edge of a city where people live
landmark = a famous place that is easy to recognise
commute = the daily journey to work or school
amenities = useful services like shops, parks and gyms
"""),
        G("Дополните ответы кандидата", """
I grew up in a quiet [suburb] about twenty minutes from the centre. My daily [commute] was short, which I loved.
The most famous [landmark] is the old bridge over the river. On weekends the market square is really [bustling],
and the old town is very [picturesque]. My flat is a stone's [throw] from the metro.
"""),
        C("Какой ответ принесёт больше баллов?", """
Is your hometown a good place for young people? | Yes. | *Definitely. There are lots of cafés and sports clubs, so there's always something to do. | My hometown is a town.
What do you like most about where you live? | *Probably the river. It's picturesque, and I often walk there after work. | I like. | Everything is good.
Has your town changed much? | No. | Yes, it changed. | *Quite a lot. Several shopping centres have been built, so it's much livelier than ten years ago.
"""),
        L("Образец ответа", "en-GB", """
I live in Kazan, which is a [vibrant] city on the Volga. What I like most is the [mixture] of cultures, you can see a mosque
and a cathedral side by side. The only [downside] is the traffic, my [commute] takes almost an hour.
""", """
What does the speaker like most? | The food | *The mix of cultures | The weather
What is the downside? | Prices | *Traffic | Noise
"""),
        WR("Ваши ответы", "Ответьте на вопросы по формуле (2–3 предложения на каждый) и запишите голосовое преподавателю:\n1. Where is your hometown?\n2. What do you like about it?\n3. Would you like to live there in the future? Why?"),
    ),
    unit(
        "lib-ielts-speaking-part2", "IELTS Speaking Part 2: описать человека", "en", "B2", ["IELTS", "Speaking"],
        "Карточка-задание, план на минуту подготовки и как говорить две минуты без пауз.",
        T("Стратегия", """
Вам дают карточку с темой и 3–4 пунктами. Минута на подготовку, потом 1–2 минуты речи.

Как готовиться за минуту: запишите по 2–3 ключевых слова на каждый пункт, а не предложения.
Структура: вступление (кто это) → пункты карточки по порядку → чувства и вывод (why...).

Чтобы не замолчать:
Let me think... / What I mean is... / Another thing worth mentioning is... / Looking back, I think...
"""),
        T("Карточка", """
Describe a person who has influenced you.
You should say:
– who this person is
– how you know them
– what they did
and explain why this person influenced you.
"""),
        W("""
influence – влиять, влияние
role model – пример для подражания
determined – целеустремлённый
patient – терпеливый
encourage – поддерживать, вдохновлять
look up to – равняться на
generous – щедрый
inspire – вдохновлять
persuade – убеждать
in hindsight – оглядываясь назад
"""),
        G("Дополните образец ответа", """
I'd like to talk about my grandmother, who has been a real [role] model for me. I [look] up to her because she is incredibly
[determined]: she learned to drive at sixty! She always [encouraged] me to try new things. Looking [back], I think she
taught me that it's never too late to start.
"""),
        C("Что лучше сказать вместо паузы?", """
Вы забыли слово. | *What I mean is, she's very... she never gives up. | Ehm... ehm... | I don't know English.
Вы рассказали всё по пунктам, а время осталось. | *Another thing worth mentioning is how she treats strangers. | That's all. | Can I stop?
"""),
        M("Пункт карточки и полезная фраза", """
who this person is = I'd like to talk about...
how you know them = I first met her when...
what they did = What impressed me most was...
why they influenced you = Looking back, I think...
"""),
        L("Начало ответа", "en-GB", """
I'd like to talk about my first English [teacher], Mrs Ivanova. I met her when I was [ten|10]. She was very [patient] and she
never laughed at our mistakes. What [impressed] me most was that she spoke only English in class.
""", """
When did the speaker meet the teacher? | At six | *At ten | At university
What impressed the speaker most? | Her clothes | *She spoke only English | Her homework
"""),
        WR("Ваши две минуты", "Подготовьте план по карточке (ключевые слова) и запишите голосовое на 1,5–2 минуты. Преподаватель оценит по критериям IELTS."),
    ),
    unit(
        "lib-ielts-writing-trends", "IELTS Writing Task 1: тренды на графиках", "en", "B2", ["IELTS", "Writing"],
        "Язык описания изменений: глаголы, существительные, наречия. Структура отчёта по графику.",
        T("Структура и язык", """
Структура: введение (перефраз задания) → overview (2 главные тенденции, без цифр) → 2 абзаца деталей с цифрами.

Глагол + наречие: rose sharply, fell slightly, increased steadily, dropped dramatically.
Прилагательное + существительное: a sharp rise, a slight fall, a steady increase, a dramatic drop.
Пик и стабильность: peaked at, reached a high of, remained stable at, fluctuated between, levelled off.
Сравнение: twice as much as, three times higher than, the figure for X was considerably higher.
"""),
        W("""
rise sharply – резко вырасти
decline gradually – постепенно снижаться
fluctuate – колебаться
peak at – достичь пика
remain stable – оставаться стабильным
plummet – резко упасть
level off – выровняться
overall – в целом
respectively – соответственно
account for – составлять (долю)
"""),
        G("Опишите график", """
Between 2010 and 2015, the number of visitors [rose] sharply from 20,000 to 50,000. It [peaked] at 60,000 in 2016 and then
[remained] stable for two years. After 2018, the figure [fluctuated] between 40,000 and 45,000, before it [plummeted] to just
10,000 in 2020. [Overall], the museum became less popular over the period.
"""),
        C("Глагол или существительное?", """
There was a sharp ___ in prices. | *rise | rose | risen
Prices ___ dramatically in 2019. | increase | *increased | an increase
The figure ___ at 80% in May. | *peaked | peak | peaking
Sales levelled ___ in the summer. | up | *off | out
Cars and buses accounted for 40% and 25% ___. | overall | *respectively | totally
"""),
        M("Фраза и её смысл", """
plummeted = fell very quickly
levelled off = stopped changing
fluctuated = went up and down
peaked = reached the highest point
"""),
        WR("Мини-отчёт", "Опишите в 80–100 словах: продажи кофе в кафе росли с января по март, в апреле достигли пика (500 чашек в день), затем постепенно снижались до июня и выровнялись на уровне 300. Начните с overview."),
    ),
    unit(
        "lib-ielts-writing-task2", "IELTS Writing Task 2: эссе-мнение", "en", "B2", ["IELTS", "Writing"],
        "Четыре абзаца, тезис в введении, аргумент + пример + вывод. Фразы для каждой части.",
        T("План эссе", """
Задание: To what extent do you agree or disagree? (250+ слов, 40 минут)

1. Введение: перефраз темы + ваше мнение (тезис). In my view, ... / I strongly believe that ...
2. Тело 1: первая причина → объяснение → пример.
3. Тело 2: вторая причина (или контраргумент и опровержение).
4. Вывод: повтор мнения другими словами. In conclusion, ...

Каждый абзац тела начинается с ясного главного предложения: The main reason why ... is that ...
"""),
        T("Тема", "Some people think that children should start learning a foreign language at primary school. Others believe it is better to start at secondary school. Discuss both views and give your own opinion."),
        W("""
in my view – по моему мнению
it is often argued that – часто утверждают, что
a key advantage of – ключевое преимущество
for example – например
this means that – это значит, что
on the other hand – с другой стороны
admittedly – надо признать
outweigh – перевешивать
in conclusion – в заключение
acquire – усваивать, приобретать
"""),
        G("Соберите введение", """
It is often [argued] that children should start learning a foreign language as early as possible, while others [believe]
that secondary school is the right age. In my [view], an early start brings more [benefits] than drawbacks,
as young children [acquire] languages naturally.
"""),
        C("Что подходит в эссе IELTS?", """
Лучшее начало абзаца тела | I think I agree. | *The main reason why an early start is beneficial is that young children imitate sounds easily. | So, languages.
Уместная фраза для уступки | *Admittedly, primary school teachers may lack training. | But whatever. | Anyway, it's bad.
Лучший вывод | That's all I wanted to say. | *In conclusion, although there are some challenges, the advantages of an early start clearly outweigh them. | Bye.
"""),
        M("Часть эссе и фраза", """
введение = In my view, ...
аргумент = The main reason why ... is that ...
пример = For example, in Finland ...
уступка = Admittedly, ...
вывод = In conclusion, ...
"""),
        WR("Ваше эссе", "Напишите эссе на тему выше (250–280 слов) по плану из урока. Преподаватель проверит по четырём критериям IELTS: Task Response, Coherence, Lexical Resource, Grammar."),
    ),
    unit(
        "lib-ielts-listening-form", "IELTS Listening Section 1: заполнение формы", "en", "B1–B2", ["IELTS", "Listening"],
        "Имена по буквам, числа, даты и цены – где теряют баллы и как это тренировать.",
        T("Как не терять баллы", """
Section 1 – бытовой разговор: запись, бронирование, анкета. Почти все ответы – имена, числа, даты, адреса.
1) Перед прослушиванием прочитайте пропуски и угадайте тип ответа (число? имя? день недели?).
2) Следите за исправлениями: «It's Tuesday... oh no, sorry, Thursday» – верный ответ Thursday.
3) Имена диктуют по буквам: тренируйте английский алфавит, особенно A, E, I, G, J, R, Y.
4) Проверяйте лимит слов: NO MORE THAN TWO WORDS – третье слово = ошибка.
"""),
        L("Послушайте и заполните форму", "en-GB", """
Good morning, Riverside Sports Centre. – Hi, I'd like to join the swimming club. – Of course. Can I have your surname?
– It's [Fletcher], F-L-E-T-C-H-E-R. – Thank you. Which membership would you like, monthly or yearly?
– [Monthly], please. – The beginners' group meets on Tuesday... sorry, on [Thursday] evenings at [seven|7] o'clock.
– Great. How much is it? – It's [thirty|30] pounds a month, and you'll need to bring your own [towel].
""", """
Why is the woman calling? | To book a tennis court | *To join the swimming club | To complain about a class
When does the group meet? | Tuesday | *Thursday | Saturday
"""),
        L("Числа и даты", "en-US", """
The course starts on the [fifteenth|15th|15] of March. The room number is [two hundred and twelve|212].
Please call us on oh-seven-nine, [double five|55], three-one. The deposit is [forty-five|45] dollars.
""", """
When does the course start? | 5 March | *15 March | 50 March
"""),
        C("Ловушки", """
«It's on the 13th... sorry, the 30th.» Ответ: | 13th | *30th | 13th and 30th
«Double two» – это: | 2 | *22 | 2 2 2
NO MORE THAN TWO WORDS. Ответ «a large blue bag» – | правильно | *ошибка: слишком много слов | правильно, если без ошибок
"""),
        WR("Алфавит", "Продиктуйте голосом свою фамилию и e-mail по буквам по-английски и отправьте преподавателю."),
    ),
    unit(
        "lib-ielts-reading-tfng", "IELTS Reading: True / False / Not Given", "en", "B2", ["IELTS", "Reading"],
        "Самый коварный тип заданий: в чём разница между False и Not Given и как не путать.",
        T("Правило", """
True – текст говорит то же самое (другими словами).
False – текст говорит противоположное.
Not Given – в тексте этой информации нет, ни «да», ни «нет».

Главная ловушка: выбирать False, когда просто «не нашли». Если текст молчит – это Not Given.
Обращайте внимание на слова-ограничители: all, some, always, only, most – они меняют смысл.
"""),
        T("Текст", """
The city library was founded in 1902 by a local businessman. At first, it was open only three days a week and lent books
only to members. Today it opens every day except Monday. In 2018 a children's section was added on the second floor,
and the library now hosts free English clubs for teenagers. Most visitors come in the evening.
"""),
        C("True, False или Not Given?", """
The library was founded by a businessman. | *True | False | Not Given
At first, anyone could borrow books. | True | *False | Not Given
The library is open on Mondays. | True | *False | Not Given
The businessman was very rich. | True | False | *Not Given
The children's section is on the second floor. | *True | False | Not Given
The English clubs are popular with adults. | True | False | *Not Given
"""),
        W("""
found – основать
lend – давать взаймы
except – кроме
host – проводить (мероприятие)
paraphrase – перефразирование
contradict – противоречить
claim – утверждение
"""),
        M("Ответ и что он значит", """
True = текст говорит то же самое
False = текст говорит обратное
Not Given = в тексте об этом ничего нет
"""),
        WR("Свои утверждения", "Придумайте к тексту по одному утверждению True, False и Not Given и объясните, почему ответ именно такой."),
    ),
    # == ЕГЭ и ОГЭ =======================================================================================
    unit(
        "lib-ege-email", "ЕГЭ: электронное письмо (задание 37)", "en", "B1–B2", ["ЕГЭ", "Письмо"],
        "Формат письма другу по переписке: структура, обязательные элементы, фразы и типичные потери баллов.",
        T("Структура письма", """
Объём 100–140 слов. Неформальный стиль.

1. Обращение: Dear Tom, (на отдельной строке, с запятой)
2. Благодарность за письмо и ссылка на прошлые контакты: Thanks for your email. It was great to hear from you.
3. Ответы на ВСЕ вопросы друга – полными предложениями.
4. Три своих вопроса по теме, указанной в задании.
5. Завершающая фраза: Write back soon. / Hope to hear from you soon.
6. Подпись: Best wishes, (запятая) и имя на отдельной строке.

Потеря баллов: не на все вопросы ответили, меньше трёх своих вопросов, официальный стиль, нарушение объёма.
"""),
        W("""
Thanks for your email – Спасибо за письмо
It was great to hear from you – Рад был получить от тебя весточку
Sorry I haven't written for so long – Прости, что долго не писал
As for your question about... – Что касается твоего вопроса о...
By the way – Кстати
I'd better go now – Мне пора заканчивать
Write back soon – Пиши скорее
Best wishes – С наилучшими пожеланиями
Take care – Береги себя
Keep in touch – Будем на связи
"""),
        G("Соберите письмо", """
Dear Mike,
[Thanks] for your email. It was great to [hear] from you. As [for] your question about my weekend, I usually spend it with my family.
On Saturdays we go to the swimming pool, and on Sundays I meet my friends.
By the [way], I've heard you've joined a football team. When do you train? How often do you play matches? Who is your coach?
I'd [better] go now. Write [back] soon.
[Best] wishes,
Sasha
"""),
        C("Что правильно для ЕГЭ?", """
Как начать письмо? | Dear Sir, | *Dear Mike, | Hello Mike!!!
Сколько своих вопросов нужно задать? | Один | Два | *Три
Где ставится подпись? | *На отдельной строке после «Best wishes,» | В начале письма | Подпись не нужна
Какой стиль нужен? | Официальный | *Неофициальный (дружеский) | Любой
"""),
        M("Элемент письма и пример", """
обращение = Dear Kate,
благодарность = Thanks for your email.
переход к вопросам = By the way, I've heard that...
завершение = Write back soon.
прощание = Best wishes,
"""),
        WR("Ваше письмо", "Ответьте другу Бену (100–140 слов). Он пишет: «...What do you usually do in the summer holidays? Do you prefer to travel or stay at home? Why? ...By the way, my sister has just started learning Russian!» Ответьте на его вопросы и задайте 3 вопроса о его сестре."),
    ),
    unit(
        "lib-ege-essay", "ЕГЭ: высказывание с элементами рассуждения (задание 38)", "en", "B2", ["ЕГЭ", "Письмо"],
        "Проектная работа по таблице или диаграмме: структура из 5 абзацев и готовые фразы.",
        T("Структура", """
Объём 200–250 слов. Нейтральный стиль. 5 абзацев:

1. Вступление: тема проекта. I have been doing a project on... / The aim of my project is to find out...
2. Описание данных: 2–3 факта из таблицы с цифрами. According to the survey, ... / As we can see, ... while ...
3. Сравнение: 1–2 сравнения. ... is twice as popular as ... / ... is less popular than ...
4. Проблема и решение: One of the problems connected with ... is ... A possible solution would be to ...
5. Вывод с личным мнением: In conclusion, ... As for me, ...

Не пишите заголовок, не переписывайте всю таблицу, не используйте сокращения (don't, it's).
"""),
        W("""
survey – опрос
according to – согласно
the majority of – большинство
whereas – тогда как
compared to – по сравнению с
a significant number – значительное число
one of the problems connected with – одна из проблем, связанных с
a possible solution would be – возможным решением было бы
to sum up – подводя итог
as for me – что касается меня
"""),
        G("Дополните абзацы", """
I have been doing a [project] on how teenagers in Zetland spend their free time. I have found some interesting data in the
results of a [survey]. [According] to the survey, 46% of teenagers prefer computer games, [whereas] only 12% enjoy reading.
Computer games are almost four times [as] popular as reading. One of the [problems] connected with games is that teenagers
spend too much time sitting. A possible [solution] would be to join a sports club.
"""),
        C("Правильно для задания 38?", """
Можно ли использовать «don't» и «it's»? | Да | *Нет, нейтральный стиль: do not, it is | Только в выводе
Нужно ли переписывать все строки таблицы? | Да | *Нет, только 2–3 факта и сравнения | Только первую строку
Где вы высказываете своё мнение? | Во вступлении | *В заключении | Нигде
"""),
        M("Абзац и его фраза", """
вступление = The aim of my project is to find out...
данные = According to the survey, ...
сравнение = ... is twice as popular as ...
проблема = One of the problems connected with ... is ...
вывод = To sum up, ... As for me, ...
"""),
        WR("Ваше высказывание", "Тема проекта: «Любимые виды спорта подростков». Данные: футбол – 34%, плавание – 22%, баскетбол – 18%, теннис – 9%, шахматы – 6%. Напишите 200–250 слов по плану."),
    ),
    unit(
        "lib-oge-word-formation", "ОГЭ и ЕГЭ: словообразование", "en", "A2–B1", ["ОГЭ", "ЕГЭ", "Грамматика"],
        "Суффиксы и приставки, которые встречаются в заданиях на словообразование: -er, -tion, -ful, -less, un-, dis-.",
        T("Шпаргалка", """
Профессия / человек: -er, -or, -ist, -ian: teach → teacher, act → actor, science → scientist, music → musician.
Существительное: -tion, -ment, -ness, -ity, -ance: decide → decision, develop → development, kind → kindness, active → activity.
Прилагательное: -ful, -less, -ous, -al, -able, -ive: care → careful/careless, danger → dangerous, nature → natural, comfort → comfortable.
Наречие: прилагательное + -ly: quick → quickly, happy → happily.
Отрицание: un-, dis-, im-, in-, ir-: happy → unhappy, agree → disagree, possible → impossible, regular → irregular.

Алгоритм: 1) какая часть речи нужна по месту в предложении; 2) нужен ли отрицательный смысл; 3) множественное число?
"""),
        W("""
decision – решение (decide)
development – развитие (develop)
kindness – доброта (kind)
dangerous – опасный (danger)
careless – небрежный (care)
comfortable – удобный (comfort)
impossible – невозможный (possible)
disappear – исчезнуть (appear)
musician – музыкант (music)
scientist – учёный (science)
"""),
        G("Образуйте нужное слово от слова в скобках", """
My uncle is a famous [scientist] (SCIENCE). It was a difficult [decision] (DECIDE) for all of us.
Be [careful] (CARE), the road is icy! The new sofa is very [comfortable] (COMFORT).
It's [impossible] (POSSIBLE) to learn a language in a week. The magician made the coin [disappear] (APPEAR).
She smiled [happily] (HAPPY). Thank you for your [kindness] (KIND).
"""),
        C("Тест", """
The ___ of the city took 20 years. (DEVELOP) | developing | *development | developer
Driving fast is very ___. (DANGER) | dangerless | *dangerous | dangerful
My brother is a talented ___. (MUSIC) | musicer | *musician | musicist
I ___ with you completely. (AGREE) | unagree | *disagree | inagree
He answered the question ___. (CORRECT) | correct | *correctly | correction
"""),
        M("Суффикс и часть речи", """
-tion = существительное
-ful = прилагательное
-ly = наречие
-er = человек, профессия
un- = отрицание
"""),
        WR("Свой ряд слов", "Для слов help, use, create, nation образуйте как можно больше родственных слов и составьте с тремя из них предложения."),
    ),
    unit(
        "lib-oge-grammar-forms", "ОГЭ и ЕГЭ: грамматические формы", "en", "A2–B1", ["ОГЭ", "ЕГЭ", "Грамматика"],
        "Задания «поставьте слово в нужную форму»: времена, степени сравнения, множественное число, местоимения.",
        T("Что проверяют", """
1. Время глагола: смотрите на маркеры (yesterday, already, now, every day) и на другие глаголы в тексте.
2. Пассив: если подлежащее не выполняет действие – was built, is made.
3. Степени сравнения: than → сравнительная; the + ... in/of → превосходная.
4. Множественное число исключений: child → children, mouse → mice, tooth → teeth, woman → women.
5. Местоимения: I → me / my / mine / myself.
6. Числительные: ONE → first, TWO → second, THREE → third, FIVE → fifth.
"""),
        G("Поставьте слово в нужную форму", """
Last summer we [went] (GO) to the seaside. My little brother has two [teeth] (TOOTH) now.
It was the [hottest] (HOT) day of the year. The museum [was built] (BUILD) in 1850.
I hurt [myself] (I) when I was playing football. She is [taller] (TALL) than her mother.
Tomorrow is my sister's [eleventh] (ELEVEN) birthday. The [children] (CHILD) are playing in the garden.
"""),
        C("Тест", """
They ___ (NOT/SEE) the film yet. | didn't see | *haven't seen | don't see
This is the ___ (GOOD) day of my life! | better | *best | goodest
Look! It ___ (SNOW). | snows | *is snowing | snowed
Two ___ (MOUSE) ran across the kitchen. | mouses | *mice | mices
The letter ___ (SEND) yesterday. | sent | *was sent | has sent
"""),
        M("Слово и его форма", """
woman = women
foot = feet
NINE = ninth
TWELVE = twelfth
they = themselves
"""),
        WR("Свой текст", "Напишите 6 предложений о прошедшем лете так, чтобы в них были: неправильный глагол, пассив, превосходная степень, порядковое числительное и возвратное местоимение. Подчеркните эти формы."),
    ),
]
