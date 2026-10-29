"""Курсы Bright: общий английский, уровни A1–B2."""

from .library import WR, C, G, L, M, T, W, unit

GENERAL = "Грамматика"
TALK = "Разговорная речь"

ENGLISH = [
    # == A1 ===========================================================================================
    unit(
        "lib-en-a1-to-be", "To be: знакомимся и рассказываем о себе", "en", "A1", [GENERAL, "Начинающим"],
        "Формы am, is, are в утверждениях, вопросах и отрицаниях. Первый разговор о себе.",
        T("Правило", """
Глагол to be – «быть, являться». В русском его часто пропускают («Я учитель»), в английском – никогда.

I am (I'm) a teacher.
He / She / It is (he's, she's, it's) from Moscow.
We / You / They are (we're, you're, they're) friends.

Вопрос: глагол ставим в начало – Are you a student? Is she at home?
Отрицание: добавляем not – I'm not tired. He isn't (is not) late. They aren't (are not) here.
"""),
        W("""
name – имя
surname – фамилия
age – возраст
job – работа, профессия
from – из (откуда)
married – женат, замужем
single – не женат, не замужем
tired – уставший
hungry – голодный
busy – занятой
"""),
        G("Вставьте am, is или are", """
Hi! My name [is] Lena. I [am|'m] twelve years old. My parents [are] doctors. My brother Max [is] nine.
We [are|'re] from Kazan. My best friend [is] Sasha. She [is|'s] very funny. [Are] you from Kazan too?
"""),
        C("Выберите правильный вариант", """
___ you hungry? | Is | *Are | Am
My sister ___ a student. | are | am | *is
I ___ not busy today. | is | *am | are
They ___ from Spain. | *are | is | am
___ he your teacher? | *Is | Are | Am
We ___ late! Let's go. | is | *are | am
"""),
        M("Вопрос и подходящий ответ", """
What's your name? = My name is Anna.
How old are you? = I'm fifteen.
Where are you from? = I'm from Samara.
Are you a student? = Yes, I am.
Is your brother busy? = No, he isn't.
"""),
        L("Послушайте и впишите пропущенные слова", "en-GB", """
Hello! My [name] is Tom. I'm [eleven|11] years old and I'm from [London]. My mum is a [teacher] and my dad is a driver.
I'm not [tired] today, I'm happy!
""", """
Who is Tom's mum? | A driver | *A teacher | A doctor
How does Tom feel today? | Tired | *Happy | Hungry
"""),
        WR("О себе", "Напишите 5–6 предложений о себе: имя, возраст, откуда вы, кто по профессии ваши родители, какой у вас характер."),
    ),
    unit(
        "lib-en-a1-present-simple", "Present Simple: мой обычный день", "en", "A1", [GENERAL],
        "Как рассказать о привычках и распорядке дня. Окончание -s у he, she, it. Слова частоты.",
        T("Правило", """
Present Simple – то, что происходит регулярно: привычки, расписание, факты.

I / You / We / They work.   He / She / It works (+ s).
После -s, -sh, -ch, -x, -o добавляем -es: watches, goes, does. Согласная + y → -ies: study → studies.

Вопрос: Do you work? Does she work? (после does глагол без -s!)
Отрицание: I don't (do not) work. He doesn't (does not) work.

Слова частоты стоят перед глаголом: I always get up at 7. She never drinks coffee.
always – всегда, usually – обычно, often – часто, sometimes – иногда, never – никогда.
"""),
        W("""
get up – вставать
have breakfast – завтракать
go to school – ходить в школу
start – начинаться
finish – заканчиваться
do homework – делать домашку
watch TV – смотреть телевизор
go to bed – ложиться спать
usually – обычно
never – никогда
"""),
        G("Поставьте глагол в нужную форму", """
My dad [gets] up at six o'clock. He [has] breakfast and [goes] to work by bus. I [get] up at seven.
School [starts] at half past eight. My sister [studies] at university. She [doesn't] like mornings!
[Does] your brother play football? – Yes, he [does].
"""),
        C("Тест", """
She ___ TV every evening. | watch | *watches | watchs
___ you like pizza? | Does | *Do | Is
He ___ eat meat. | don't | *doesn't | isn't
My friends ___ to the park on Sundays. | goes | *go | going
Where ___ your mum work? | do | *does | is
I ___ late for school. | never am | *am never | never
"""),
        M("Глагол и его форма с he / she / it", """
go = goes
watch = watches
study = studies
have = has
do = does
play = plays
"""),
        L("Аудирование: день Эммы", "en-US", """
Emma [gets] up at seven o'clock. She usually [has] porridge for breakfast. She [goes] to school by bike.
After school she [plays] tennis. She never [watches] TV in the evening, she reads books.
""", """
How does Emma go to school? | By bus | *By bike | On foot
What does Emma do in the evening? | Watches TV | *Reads books | Plays tennis
"""),
        WR("Мой день", "Опишите свой обычный будний день в 6–8 предложениях. Используйте always, usually, sometimes, never."),
    ),
    unit(
        "lib-en-a1-there-is", "There is / there are: мой дом", "en", "A1", [GENERAL, "Лексика"],
        "Как описать комнату и квартиру: there is, there are, some, any и предлоги места.",
        T("Правило", """
There is + один предмет: There is a sofa in the living room.
There are + много предметов: There are two windows in my bedroom.
Вопрос: Is there a TV? Are there any chairs?
Отрицание: There isn't a garden. There aren't any shops.

some – в утверждениях (There are some books), any – в вопросах и отрицаниях (Are there any books? There aren't any books).

Предлоги места: in – в, on – на, under – под, next to – рядом с, between – между, in front of – перед, behind – за.
"""),
        W("""
living room – гостиная
kitchen – кухня
bedroom – спальня
bathroom – ванная
wardrobe – шкаф для одежды
shelf – полка
fridge – холодильник
armchair – кресло
carpet – ковёр
mirror – зеркало
"""),
        G("Вставьте is или are, some или any", """
In my room there [is] a big bed and there [are] two shelves. There [are] [some] books on the shelves.
There [isn't|is not] a TV in my room. [Are] there [any] plants in your room? – No, there [aren't|are not].
"""),
        M("Предлог и его значение", """
under = под
next to = рядом с
between = между
behind = за, позади
in front of = перед
"""),
        C("Тест", """
There ___ a mirror in the bathroom. | are | *is | am
There ___ three chairs in the kitchen. | *are | is | be
Are there ___ apples in the fridge? | some | *any | a
The cat is ___ the bed. It's sleeping there. | *under | between | from
There aren't ___ shops in my street. | some | *any | a
"""),
        L("Послушайте описание кухни", "en-GB", """
This is our kitchen. There is a big [fridge] next to the window. There are [four|4] chairs and a table.
There is a [clock] on the wall. There aren't any [plants], my mum doesn't like them.
""", """
How many chairs are there? | Three | *Four | Five
Where is the fridge? | *Next to the window | Under the table | Behind the door
"""),
        WR("Моя комната", "Опишите свою комнату в 6 предложениях: что там есть и где это стоит."),
    ),
    unit(
        "lib-en-a1-food", "Еда: some, any, much, many", "en", "A1–A2", [GENERAL, "Лексика"],
        "Исчисляемые и неисчисляемые существительные, how much / how many, разговор в кафе.",
        T("Правило", """
Исчисляемые можно посчитать: an apple – two apples, an egg – six eggs.
Неисчисляемые посчитать нельзя: water, milk, bread, cheese, rice, money. У них нет множественного числа и артикля a.

How many apples? – много штук. How much milk? – сколько вещества.
many – с исчисляемыми (many eggs), much – с неисчисляемыми (much sugar), a lot of – с любыми.
Неисчисляемое можно посчитать упаковкой: a bottle of water, a piece of cake, a cup of tea, a loaf of bread.
"""),
        W("""
bread – хлеб
cheese – сыр
butter – сливочное масло
juice – сок
rice – рис
a bottle of – бутылка (чего-то)
a piece of – кусок
a cup of – чашка
menu – меню
bill – счёт в кафе
"""),
        G("Вставьте much или many", """
How [much] water do you drink every day? How [many] apples are there in the bag?
I don't eat [much] bread. There aren't [many] eggs in the fridge. How [much] money do you need?
"""),
        C("Тест", """
Can I have ___ cup of tea, please? | an | *a | some
There isn't ___ milk left. | many | *much | a
How ___ eggs do we need for the cake? | much | *many | a lot
I'd like a ___ of cake. | bottle | *piece | loaf
We need ___ cheese for the pizza. | a | an | *some
"""),
        M("Упаковка и продукт", """
a bottle of = water
a loaf of = bread
a cup of = coffee
a bar of = chocolate
a bowl of = soup
"""),
        L("В кафе", "en-GB", """
– Good afternoon. Are you ready to order?
– Yes, can I have a [cheese] sandwich and a [bowl] of tomato soup, please?
– Anything to drink?
– A [cup] of tea with [milk], please. No sugar.
– That's [seven|7] pounds fifty.
""", """
What does the customer drink? | Coffee | *Tea | Juice
Does the customer want sugar? | Yes | *No | Two spoons
"""),
        WR("Мой обед", "Напишите, что вы обычно едите на обед и чего никогда не едите. Используйте some, any, much, many, a lot of."),
    ),
    # == A2 ===========================================================================================
    unit(
        "lib-en-a2-past-simple", "Past Simple: как прошли выходные", "en", "A2", [GENERAL],
        "Правильные и неправильные глаголы в прошедшем времени, вопросы с did, рассказ о прошлом.",
        T("Правило", """
Past Simple – закончившееся действие в прошлом: yesterday, last week, two days ago, in 2020.

Правильные глаголы: + ed. play → played, watch → watched, stop → stopped, study → studied.
Неправильные нужно запомнить: go → went, see → saw, have → had, buy → bought, eat → ate, take → took.

Вопрос и отрицание – через did, глагол возвращается в начальную форму:
Did you go out? – Yes, I did. / No, I didn't.
I didn't see him. (НЕ didn't saw)
to be: I was / we were; I wasn't at home. Were you tired?
"""),
        W("""
went – пошёл (go)
saw – увидел (see)
bought – купил (buy)
ate – ел (eat)
took – взял (take)
met – встретил (meet)
came – пришёл (come)
made – сделал (make)
last weekend – в прошлые выходные
ago – назад
"""),
        M("Глагол и вторая форма", """
go = went
see = saw
buy = bought
eat = ate
take = took
come = came
"""),
        G("Поставьте глаголы в Past Simple", """
Last Saturday I [went] to the cinema with my friends. We [saw] a funny comedy. After the film we [ate] pizza
and I [bought] a new T-shirt. On Sunday I [stayed] at home and [watched] TV. I [didn't] do my homework!
[Did] you have a good weekend?
"""),
        C("Тест", """
We ___ to the beach yesterday. | go | *went | goed
Did you ___ the new film? | saw | *see | seen
She ___ at school on Monday. She was ill. | *wasn't | didn't | weren't
I ___ him two days ago. | meet | *met | meeted
What ___ you do last night? | do | was | *did
They ___ very tired after the trip. | was | *were | did
"""),
        L("Рассказ Джейка", "en-US", """
Last weekend was great. On Saturday I [met] my cousin and we [went] to the zoo. We [saw] a baby elephant!
In the evening we [made] pancakes. On Sunday it [rained], so I [stayed] at home.
""", """
Where did Jake go on Saturday? | To the cinema | *To the zoo | To the beach
Why did he stay at home on Sunday? | He was ill | *It rained | He was tired
"""),
        WR("Мои выходные", "Расскажите о своих прошлых выходных в 6–8 предложениях. Используйте минимум 5 неправильных глаголов."),
    ),
    unit(
        "lib-en-a2-comparatives", "Сравнения: bigger, more interesting, the best", "en", "A2", [GENERAL],
        "Сравнительная и превосходная степень прилагательных. Сравниваем города, людей, вещи.",
        T("Правило", """
Короткие прилагательные: + er / the + est.
cheap → cheaper → the cheapest; big → bigger → the biggest; easy → easier → the easiest.
Длинные: more / the most + прилагательное.
interesting → more interesting → the most interesting.
Исключения: good → better → the best; bad → worse → the worst; far → further → the furthest.

Сравнение: Moscow is bigger than Kazan. Равенство: My bag is as heavy as yours. Not as ... as – «не такой ... как».
"""),
        W("""
crowded – многолюдный
quiet – тихий
expensive – дорогой
cheap – дешёвый
dangerous – опасный
safe – безопасный
modern – современный
ancient – древний
polluted – загрязнённый
than – чем
"""),
        G("Вставьте нужную форму", """
Saint Petersburg is [colder] (cold) than Sochi, but it is [more beautiful] (beautiful) in summer.
Moscow is [the biggest] (big) city in Russia. The metro is [faster] (fast) than the bus.
This is [the best] (good) pizza in town! Today the weather is [worse] (bad) than yesterday.
"""),
        C("Тест", """
A car is ___ than a bike. | fast | *faster | fastest
This is ___ book I've ever read. | the more interesting | *the most interesting | most interesting
My English is ___ than last year. | gooder | *better | best
Kazan is ___ crowded than Moscow. | most | *less | the less
Everest is ___ mountain in the world. | higher | *the highest | the most high
"""),
        M("Прилагательное и сравнительная степень", """
good = better
bad = worse
happy = happier
hot = hotter
expensive = more expensive
"""),
        L("Два города", "en-GB", """
I live in a small town, but I study in a big city. The city is [noisier] and more [expensive], but it's more [interesting].
My town is [quieter] and safer. The best thing about my town is the [river].
""", """
Which place is more interesting for the speaker? | The town | *The city | Both
What is the best thing about the town? | The park | *The river | The shops
"""),
        WR("Сравните", "Сравните свой город с другим, где вы были. 6 предложений: что больше, дороже, интереснее, где лучше жить."),
    ),
    unit(
        "lib-en-a2-future", "Планы: going to и will", "en", "A2", [GENERAL],
        "Как говорить о планах, решениях и прогнозах. Разница между going to и will.",
        T("Правило", """
going to – план, уже решили заранее: I'm going to visit my grandma next weekend.
Также going to – прогноз по признакам: Look at the clouds! It's going to rain.

will – решение прямо сейчас, обещание, предположение: I'm cold. – I'll close the window. I'll help you. I think she will win.

Present Continuous для договорённостей: I'm meeting Ann at 5 (уже договорились).
"""),
        W("""
plan – план, планировать
promise – обещать
decide – решать
probably – вероятно
next summer – следующим летом
tomorrow – завтра
holiday – отпуск, каникулы
book a ticket – забронировать билет
travel – путешествовать
weather forecast – прогноз погоды
"""),
        G("going to или will?", """
– What are your plans for the summer? – I'm [going to] visit my cousins in Sochi. We've already bought tickets.
– This bag is heavy! – Don't worry, I ['ll|will] carry it.
– Look at those black clouds. It's [going to] rain.
– I think people [will] live on Mars one day.
"""),
        C("Тест", """
The phone is ringing. – I ___ answer it. | am going to | *'ll | answer
We ___ fly to Turkey in July. We booked the hotel yesterday. | *are going to | will | going
I promise I ___ tell anyone. | am not going | *won't | don't
Be careful! You ___ fall! | will | *are going to | fall
I think it ___ be sunny tomorrow. | is going | *will | is
"""),
        L("Планы на лето", "en-US", """
This summer I'm [going] to learn to swim. My parents are going to [rent] a house by the sea.
I think it [will] be hot. Maybe I'll [visit] my friend in Minsk too.
""", """
What is the speaker going to learn? | To dance | *To swim | To drive
Where are they going to stay? | In a hotel | *In a house by the sea | With friends
"""),
        WR("Мои планы", "Напишите о своих планах на следующие каникулы или отпуск (going to) и о трёх предсказаниях о будущем (will)."),
    ),
    unit(
        "lib-en-a2-continuous", "Present Continuous или Present Simple", "en", "A2", [GENERAL],
        "Что происходит сейчас и что происходит обычно. Глаголы, которые не бывают в Continuous.",
        T("Правило", """
Present Continuous (am/is/are + -ing) – прямо сейчас или в этот период: Look! She's dancing. I'm reading a great book this month.
Present Simple – обычно, регулярно, всегда: She dances every Friday.

Маркеры Continuous: now, at the moment, Look!, Listen!, this week.
Маркеры Simple: every day, usually, often, on Mondays.

Глаголы состояния обычно не ставят в Continuous: like, love, know, want, need, understand, believe.
I want a coffee (НЕ I'm wanting).
"""),
        W("""
at the moment – в данный момент
right now – прямо сейчас
look for – искать
wait for – ждать
understand – понимать
believe – верить
cook – готовить
wear – носить (одежду)
rain – идти (о дожде)
sit – сидеть
"""),
        G("Выберите время", """
Shh! The baby [is sleeping] (sleep). My mum usually [cooks] (cook) dinner, but today my dad [is cooking] (cook).
I [don't understand] (not understand) this word. Look! It [is snowing] (snow)! We [go] (go) to the gym every Tuesday.
"""),
        C("Тест", """
I ___ for my keys. Have you seen them? | look | *am looking | looks
She ___ jeans every day. | is wearing | *wears | wear
They ___ TV at the moment. | watch | *are watching | watches
I ___ what you mean. | am understanding | *understand | understands
Listen! Someone ___ the piano. | plays | *is playing | play
"""),
        L("Телефонный звонок", "en-GB", """
– Hi, Kate! What are you [doing]?
– I'm [waiting] for the bus. It's late again! What about you?
– I'm at home. I'm [cooking] dinner. I usually [cook] on Fridays.
""", """
Where is Kate? | At home | *At the bus stop | In a cafe
What does the other person usually do on Fridays? | Watches TV | *Cooks | Goes out
"""),
        WR("Прямо сейчас", "Опишите, что происходит вокруг вас прямо сейчас (5 предложений), и что обычно происходит в это время дня (3 предложения)."),
    ),
    # == B1 ===========================================================================================
    unit(
        "lib-en-b1-present-perfect", "Present Perfect или Past Simple", "en", "B1", [GENERAL],
        "Опыт и результат против законченного прошлого. ever, never, already, yet, just, for, since.",
        T("Правило", """
Present Perfect (have/has + V3) – прошлое, связанное с настоящим: опыт, результат, незаконченный период.
I've been to London. (когда – не важно, важен опыт)
She's lost her keys. (результат: ключей нет сейчас)
I've lived here for five years / since 2020. (и живу до сих пор)

Past Simple – законченный момент в прошлом, когда указано время: I went to London in 2019.

Слова Present Perfect: ever, never, already, yet, just, so far, for, since.
for – отрезок (for two weeks), since – начальная точка (since Monday).
"""),
        W("""
ever – когда-либо
never – никогда
already – уже
yet – ещё (в вопросах и отрицаниях), уже (в вопросах)
just – только что
since – с (какого-то момента)
for – в течение
been – побывал (be)
lost – потерял (lose)
achieve – достичь
"""),
        G("Present Perfect или Past Simple?", """
I [have never been|'ve never been] to Japan, but I [went] to China last year.
[Have] you ever [eaten] sushi? – Yes, I [ate] it yesterday!
She [has lived|'s lived] in Moscow since 2018. He [has just finished|'s just finished] his homework.
We [haven't seen] the new film yet.
"""),
        C("Тест", """
I ___ this film three times. | saw | *have seen | see
When ___ you ___ to Paris? | have / been | *did / go | do / go
She has worked here ___ 2015. | for | *since | from
Have you finished ___? | already | *yet | just
I ___ my phone yesterday. | have lost | *lost | lose
They have been married ___ ten years. | since | *for | during
"""),
        M("Начало предложения и его конец", """
I've known her = since we were children.
Have you ever = tried skydiving?
He moved to Kazan = two years ago.
We haven't decided = yet.
She's just = left the office.
"""),
        L("Интервью", "en-US", """
– Have you ever [worked] abroad?
– Yes, I [have]. I worked in Dubai for two years. I [moved] back to Russia in 2021.
– And how long have you been a teacher?
– I've been a teacher [since] 2015, so for about ten years now.
""", """
Where did the speaker work abroad? | London | *Dubai | Paris
When did the speaker come back to Russia? | 2015 | *2021 | 2019
"""),
        WR("Мой опыт", "Напишите 6 предложений о вашем опыте: что вы уже делали, чего никогда не делали, что сделали недавно (Present Perfect) и когда это было (Past Simple)."),
    ),
    unit(
        "lib-en-b1-conditionals", "Условные предложения: 0, 1 и 2 тип", "en", "B1", [GENERAL],
        "Если..., то...: реальные и воображаемые ситуации. Unless, if I were you.",
        T("Правило", """
Zero: факт, всегда так. If + Present, Present. If you heat ice, it melts.
First: реальное будущее. If + Present, will + глагол. If it rains, we'll stay at home.
Second: воображаемое, маловероятное сейчас. If + Past, would + глагол. If I had a million, I would travel.

После if в первом типе НЕ ставим will: If it rains (НЕ will rain).
If I were you, I would... – совет «на твоём месте я бы...».
unless = if not: You'll miss the bus unless you hurry.
"""),
        W("""
unless – если не
otherwise – иначе
in case – на случай если
win the lottery – выиграть в лотерею
afford – позволить себе (по деньгам)
invite – приглашать
miss – опоздать на, пропустить
advice – совет
fail an exam – провалить экзамен
pass an exam – сдать экзамен
"""),
        G("Поставьте глаголы в нужную форму", """
If you [heat] water to 100 degrees, it boils. If it [rains] tomorrow, we [will|'ll] stay at home.
If I [had] more free time, I [would|'d] learn Chinese. If I [were] you, I [would|'d] call her.
You won't pass the exam [unless] you study.
"""),
        C("Тест", """
If you ___ me, I'll help you. | will call | *call | called
If I ___ rich, I would buy a house by the sea. | am | *were | will be
She would be happier if she ___ a dog. | has | *had | will have
If you mix red and white, you ___ pink. | would get | *get | got
We'll be late ___ we leave now. | if | *unless | when
"""),
        M("Начало и конец", """
If I won the lottery, = I would travel around the world.
If you study hard, = you'll pass the exam.
If you freeze water, = it turns into ice.
If I were you, = I'd talk to the teacher.
"""),
        L("Совет другу", "en-GB", """
– I failed my driving test again. What should I do?
– If I [were] you, I would take more [lessons]. If you practise every day, you'll [pass] next time.
– But lessons are expensive. If I had more [money], I'd take ten lessons!
""", """
What test did the person fail? | An English test | *A driving test | A maths test
What is the problem with lessons? | They are boring | *They are expensive | They are far away
"""),
        WR("Что бы вы сделали?", "Ответьте на три вопроса полными предложениями: What would you do if you could fly? What will you do if it snows tomorrow? What would you change if you were the head of your school or company?"),
    ),
    unit(
        "lib-en-b1-modals", "Обязанности и советы: must, have to, should", "en", "B1", [GENERAL],
        "Модальные глаголы: правила, необходимость, советы, запреты и разрешения.",
        T("Правило", """
must – сильная обязанность или внутреннее решение говорящего: I must call my mum.
have to – обязанность из-за правил или обстоятельств: I have to wear a uniform at school.
don't have to – нет необходимости: You don't have to come (можно не приходить).
mustn't – запрет: You mustn't smoke here. (Не путайте с don't have to!)
should – совет: You should see a doctor. shouldn't – не стоит.
can / can't – можно / нельзя (разрешение): Can I go out?
В прошедшем времени: had to (I had to work late).
"""),
        W("""
rule – правило
allowed – разрешено
forbidden – запрещено
uniform – форма (одежда)
wear a seatbelt – пристегнуться
on time – вовремя
helmet – шлем
see a doctor – сходить к врачу
fine – штраф
obligatory – обязательный
"""),
        G("Вставьте must, mustn't, have to, don't have to или should", """
At our school we [have to] wear a uniform. You [mustn't] use phones during the exam – it's forbidden.
Tomorrow is Sunday, so I [don't have to] get up early. You look tired. You [should] go to bed earlier.
I [must] remember to buy a present for Mum!
"""),
        C("Тест", """
You ___ drive fast near schools. It's dangerous and illegal. | don't have to | *mustn't | should
It's a free museum. You ___ pay. | mustn't | *don't have to | should
Yesterday I ___ stay at work until 9 pm. | must | *had to | should
You have a cold. You ___ drink hot tea. | mustn't | *should | have
In Britain, cars ___ drive on the left. | should | *have to | can
"""),
        M("Ситуация и подходящая фраза", """
It's a rule. = You have to do it.
It's prohibited. = You mustn't do it.
It's not necessary. = You don't have to do it.
It's a good idea. = You should do it.
"""),
        L("Правила лагеря", "en-US", """
Welcome to the summer camp! A few [rules]: you have to be in your room by [ten|10] pm.
You mustn't [swim] without an instructor. You don't have to [wear] a uniform, but you should bring a [hat].
""", """
When do campers have to be in their rooms? | 9 pm | *10 pm | 11 pm
What should campers bring? | A uniform | *A hat | A phone
"""),
        WR("Правила и советы", "Напишите 3 правила вашей школы или работы (have to / mustn't) и 3 совета новичку (should)."),
    ),
    unit(
        "lib-en-b1-phrasal", "Фразовые глаголы на каждый день", "en", "B1", ["Лексика", TALK],
        "15 самых нужных фразовых глаголов: значение, примеры и тренировка в контексте.",
        T("Что важно знать", """
Фразовый глагол = глагол + частица (up, off, out...). Значение часто не складывается из частей:
give up – бросить (привычку), а не «дать вверх».

Многие фразовые глаголы можно разделить объектом: turn the TV off = turn off the TV.
Если объект – местоимение, оно стоит в середине: turn it off (НЕ turn off it).
"""),
        W("""
get up – вставать
give up – бросать, сдаваться
look after – заботиться, присматривать
look forward to – ждать с нетерпением
find out – узнать, выяснить
turn on / turn off – включить / выключить
put on – надеть
take off – снять (одежду); взлететь
run out of – закончиться (о запасах)
come back – вернуться
set up – основать, настроить
get on with – ладить с
"""),
        M("Фразовый глагол и синоним", """
give up = stop doing something
find out = discover information
look after = take care of
come back = return
run out of = have no more of something
"""),
        G("Вставьте частицу", """
I'm looking forward [to] the holidays! Can you look [after] my cat while I'm away?
My dad gave [up] smoking last year. We've run [out] of milk, can you buy some?
Please turn [off] the light when you leave. I get [on] with my classmates very well.
"""),
        C("Тест", """
It's cold. ___ your jacket. | Put off | *Put on | Take on
The plane took ___ at 6 am. | on | *off | up
I need to find ___ when the train leaves. | up | *out | on
Don't give ___! You can do it. | out | *up | off
Turn the music down – no, turn it ___ completely. | *off | out | down
"""),
        L("Короткие диалоги", "en-GB", """
– When will you come [back] from your trip? – On Monday.
– Can you turn the TV [off]? I'm trying to sleep.
– I've just found [out] that our teacher is leaving!
– I'm really looking forward [to] the concert.
""", """
What does the second person want to do? | Watch TV | *Sleep | Leave
What did the third person find out? | A concert date | *The teacher is leaving | A new trip
"""),
        WR("Ваша история", "Напишите короткую историю (6–8 предложений), используя минимум 6 фразовых глаголов из урока."),
    ),
    unit(
        "lib-en-b1-passive", "Страдательный залог: is made, was built", "en", "B1", [GENERAL],
        "Когда важен предмет, а не тот, кто действует. Passive в настоящем и прошедшем времени.",
        T("Правило", """
Passive = be + V3. Используем, когда неважно или неизвестно, кто делает действие, или важнее сам предмет.

Present Simple: Cars are made in this factory. English is spoken all over the world.
Past Simple: The bridge was built in 1903. These photos were taken in Rome.
Кто сделал – через by: The book was written by Tolstoy.

Сравните: Someone stole my bike (актив). → My bike was stolen (пассив).
"""),
        W("""
build – строить (built)
invent – изобретать
discover – открыть, обнаружить
produce – производить
steal – украсть (stole, stolen)
grow – выращивать (grew, grown)
translate – переводить
destroy – разрушать
deliver – доставлять
found – основать
"""),
        G("Поставьте глагол в Passive", """
The Eiffel Tower [was built] (build) in 1889. Tea [is grown] (grow) in India and China.
The telephone [was invented] (invent) by Alexander Bell. Millions of smartphones [are produced] (produce) every year.
My wallet [was stolen] (steal) on the bus yesterday!
"""),
        C("Тест", """
Coffee ___ in Brazil. | grows | *is grown | was grow
"War and Peace" ___ by Tolstoy. | wrote | *was written | is writing
The windows ___ every week. | clean | *are cleaned | is cleaned
These houses ___ in the 19th century. | *were built | built | are built
English ___ in many countries. | speaks | *is spoken | is speaking
"""),
        M("Изобретение и год", """
The telephone was invented = in 1876.
The first car was produced = in 1886.
The first website was created = in 1991.
"""),
        L("Экскурсия", "en-US", """
This castle was [built] in the 14th century. It was [destroyed] during a war and [rebuilt] in 1820.
Today it is [visited] by thousands of tourists every year. The paintings in this hall were [painted] by local artists.
""", """
When was the castle rebuilt? | In the 14th century | *In 1820 | Last year
Who painted the paintings? | Famous Italians | *Local artists | Unknown people
"""),
        WR("Мой город", "Напишите 5 предложений в Passive о вашем городе или стране: что там производят, что и когда было построено."),
    ),
    # == B2 ===========================================================================================
    unit(
        "lib-en-b2-third-conditional", "Третий тип условных и I wish", "en", "B2", [GENERAL],
        "Сожаления о прошлом и воображаемое прошлое: if I had known, I wish I had, смешанные условные.",
        T("Правило", """
Third conditional – воображаемое прошлое, которое уже не изменить:
If + had + V3, would have + V3. If I had studied, I would have passed the exam.

I wish / If only:
о настоящем – Past Simple: I wish I lived by the sea (но не живу).
о прошлом – Past Perfect: I wish I hadn't said that (но сказал).
о раздражающем поведении – would: I wish you would stop talking.

Смешанный тип: прошлое → настоящее. If I had taken that job, I would be rich now.
"""),
        W("""
regret – сожалеть
apologise – извиняться
opportunity – возможность
consequence – последствие
miss a chance – упустить шанс
on time – вовремя
otherwise – иначе
hindsight – взгляд в прошлое, «задним умом»
make a mistake – ошибиться
turn out – оказаться
"""),
        G("Поставьте глаголы в нужную форму", """
If I [had known] about the party, I [would have come]. I wish I [hadn't eaten] so much cake yesterday!
If we [had left] earlier, we wouldn't have missed the train. I wish I [had] a bigger flat (now).
If she had taken the job in London, she [would be] rich now.
"""),
        C("Тест", """
If you ___ me, I would have helped you. | asked | *had asked | would ask
I wish I ___ more time now. | have | *had | had had
If they had played better, they ___ the match. | would win | *would have won | will win
I wish I ___ to the doctor earlier last month. | went | *had gone | would go
If I had saved money, I ___ a car now. | *would have | would have had | had
"""),
        L("Сожаление", "en-GB", """
I wish I had [listened] to my teacher. If I had [practised] more, I would have [passed] my speaking exam.
Now I have to wait until [June|July] to take it again. If only I [hadn't] been so lazy!
""", """
What exam did the speaker fail? | Writing | *Speaking | Grammar
What is the speaker's attitude? | Proud | *Regretful | Angry
"""),
        WR("Сожаления", "Напишите о трёх событиях в вашей жизни, которые могли бы пойти иначе. Используйте third conditional и I wish."),
    ),
    unit(
        "lib-en-b2-reported", "Косвенная речь: he said that...", "en", "B2", [GENERAL],
        "Как пересказать чужие слова: сдвиг времён, вопросы и просьбы в косвенной речи.",
        T("Правило", """
Если вводный глагол в прошедшем (said, told), время сдвигается на шаг назад:
"I am tired" → She said (that) she was tired.
"I have finished" → He said he had finished.
"I will call" → She said she would call.
"I can swim" → He said he could swim.

Меняются слова времени и места: today → that day, tomorrow → the next day, here → there.
Вопросы – прямой порядок слов: "Where do you live?" → She asked where I lived.
Да/нет вопросы – через if: "Are you OK?" → He asked if I was OK.
Просьбы – to + глагол: "Please wait" → She asked me to wait.
say something, tell somebody something: He told me (that)...
"""),
        W("""
admit – признать
deny – отрицать
explain – объяснять
complain – жаловаться
suggest – предлагать
promise – обещать
warn – предупреждать
whether – ли (= if)
the following day – на следующий день
announce – объявить
"""),
        G("Перескажите", """
"I'm busy." → She said that she [was] busy.
"We will win." → They said they [would] win.
"I've lost my keys." → He told me he [had lost] his keys.
"Do you like jazz?" → She asked me [if|whether] I liked jazz.
"Please close the door." → He asked me [to close] the door.
"""),
        C("Тест", """
She said she ___ come to the party. | will | *would | can
He asked me where I ___. | do live | *lived | did live
"I can't swim," she said. → She said she ___ swim. | can't | *couldn't | didn't
He ___ me that he was leaving. | said | *told | asked
"Don't touch it!" → She told me ___ it. | don't touch | *not to touch | not touch
"""),
        L("Новости в школе", "en-US", """
Yesterday our headteacher [announced] that the school would [close] for repairs. She said that the work [would] take two weeks.
Some parents [complained] that they had nowhere to leave their children. She promised that she [would] find a solution.
""", """
Why will the school close? | Holidays | *Repairs | A strike
How long will the work take? | One week | *Two weeks | A month
"""),
        WR("Перескажите разговор", "Вспомните недавний разговор с другом и перескажите его в косвенной речи (6 предложений): что он сказал, о чём спросил, что попросил."),
    ),
    unit(
        "lib-en-b2-linkers", "Связки для эссе и устной речи", "en", "B2", ["Письмо", TALK],
        "Слова-связки: добавление, контраст, причина, результат, пример. Без них текст звучит по-детски.",
        T("Как пользоваться", """
Добавить: moreover, furthermore, in addition, besides.
Противопоставить: however, although, even though, whereas, on the other hand, nevertheless.
Причина: because of, due to, since, as.
Результат: therefore, as a result, consequently, so.
Пример: for example, for instance, such as.
Вывод: to sum up, in conclusion, overall.

Обратите внимание на пунктуацию: However, ... (с запятой в начале предложения).
although + предложение, despite / in spite of + существительное или -ing.
"""),
        W("""
however – однако
although – хотя
whereas – тогда как
moreover – более того
therefore – поэтому
despite – несмотря на
due to – из-за
consequently – следовательно
for instance – например
to sum up – подводя итог
"""),
        G("Вставьте связку", """
Online learning is convenient. [However], it requires a lot of self-discipline. [Although] the course was expensive, it was worth it.
Many people work from home [due to] the high cost of transport. [Moreover], it saves time.
The train was cancelled. [Therefore], we took a taxi. [Despite] the rain, the concert went ahead.
"""),
        C("Тест", """
___ he was tired, he finished the report. | Despite | *Although | However
She loves cats, ___ her brother prefers dogs. | therefore | *whereas | moreover
The flight was delayed ___ fog. | although | *due to | despite
Prices went up. ___, people bought less. | However | *As a result | Although
___ being ill, she went to work. | Although | *Despite | Even though
"""),
        M("Связка и её функция", """
however = контраст
therefore = результат
moreover = добавление
for instance = пример
to sum up = вывод
"""),
        L("Мнение о работе из дома", "en-GB", """
Working from home has many [advantages]. For [instance], you don't waste time on transport. [Moreover], you can plan your day.
[However], some people feel lonely. [Therefore], many companies now offer a mix of office and home work.
""", """
What is one disadvantage of working from home? | Transport costs | *Loneliness | Less free time
What do many companies now offer? | Only office work | *A mix of office and home | Higher salaries
"""),
        WR("Абзац эссе", "Напишите абзац (80–100 слов) на тему «Should school uniforms be compulsory?». Используйте минимум 5 связок."),
    ),
    unit(
        "lib-en-b2-make-do", "Коллокации: make или do", "en", "B2", ["Лексика"],
        "Самые частые устойчивые сочетания с make и do, в которых ошибаются даже продвинутые ученики.",
        T("Правило-подсказка", """
do – работа, обязанности, деятельность «вообще»: do homework, do the dishes, do business, do your best, do sport.
make – создаём, производим что-то новое: make a cake, make a decision, make a mistake, make money, make friends, make noise.

Это подсказка, а не закон: многие сочетания просто нужно запомнить.
"""),
        W("""
make a decision – принять решение
make a mistake – ошибиться
make progress – делать успехи
make an effort – приложить усилие
make a complaint – пожаловаться
do your best – сделать всё возможное
do research – проводить исследование
do the shopping – делать покупки
do someone a favour – сделать одолжение
do damage – нанести ущерб
"""),
        G("make или do?", """
I need to [make] a decision about my future. Could you [do] me a favour? Don't worry, everyone [makes] mistakes.
She [does] the shopping on Saturdays. You've [made] great progress this year! The storm [did] a lot of damage.
"""),
        C("Тест", """
We need to ___ research before we start. | make | *do | have
He ___ a lot of noise at night. | does | *makes | has
I always ___ my best in exams. | make | *do | give
She ___ friends easily. | does | *makes | gets
Who ___ this cake? It's delicious! | did | *made | cooked
"""),
        M("Сочетание и глагол к нему", """
an appointment = make
the washing up = do
a phone call = make
an exercise = do
an excuse = make
"""),
        L("Разговор с наставником", "en-US", """
– I think you've [made] real progress this term. Have you [done] the extra exercises?
– Yes, I've [done] all of them. But I still [make] mistakes with tenses.
– That's normal. Just keep [making] an effort.
""", """
What does the student still find difficult? | Vocabulary | *Tenses | Pronunciation
Has the student done the extra exercises? | No | *Yes, all of them | Some of them
"""),
        WR("Ваши примеры", "Составьте 8 предложений о себе с разными сочетаниями make и do из урока."),
    ),
    unit(
        "lib-en-b1-small-talk", "Small talk: поддержать разговор", "en", "B1", [TALK],
        "Как начать разговор, задать встречный вопрос, проявить интерес и вежливо закончить беседу.",
        T("Как это работает", """
Small talk – лёгкий разговор о погоде, выходных, работе. Главное правило: отвечайте развёрнуто и задавайте встречный вопрос.

Начать: How's it going? / How was your weekend? / Busy day?
Проявить интерес: Really? / That sounds great! / No way! / How come?
Вернуть вопрос: What about you? / And you? / How about your weekend?
Закончить: Anyway, I'd better go. / It was nice talking to you. / See you around!
"""),
        W("""
How's it going? – Как дела?
How come? – Как так? Почему?
That sounds great – Звучит здорово
No way! – Да ладно!
I'd better go – Мне пора
catch up – поболтать, наверстать новости
by the way – кстати
pretty good – довольно хорошо
not bad at all – совсем неплохо
see you around – ещё увидимся
"""),
        M("Фраза и уместный ответ", """
How was your weekend? = Pretty good, thanks. I went hiking. And yours?
I got a new job! = No way! Congratulations!
It's freezing today, isn't it? = I know! I can't wait for spring.
Anyway, I'd better go. = Sure, see you around!
"""),
        G("Дополните диалог", """
A: Hi, Tom! How's it [going]?
B: Pretty [good], thanks. What [about] you?
A: Not bad at [all]. How was your weekend?
B: Great! I went to a concert. By the [way], have you heard the new album?
A: Not yet. Anyway, I'd [better] go. See you [around]!
"""),
        C("Какой ответ лучше поддержит разговор?", """
How was your holiday? | Good. | *Amazing! We went to Altai. Have you ever been there? | Yes.
I'm moving to Canada next month. | OK. | *Really? That's exciting! What made you decide? | Canada is big.
Nice weather today! | Yes. | *Isn't it? Perfect for a walk. | Weather.
"""),
        L("В лифте", "en-GB", """
– Morning! Busy day ahead?
– Oh, you know, the usual. Lots of [meetings]. What about you?
– I'm leaving early today, it's my daughter's [birthday].
– That sounds [lovely]! Have a great evening.
""", """
Why is the second person leaving early? | A meeting | *A birthday | A doctor's appointment
"""),
        WR("Ваш диалог", "Напишите небольшой диалог (8–10 реплик) двух коллег в понедельник утром. Используйте фразы из урока."),
    ),
]
