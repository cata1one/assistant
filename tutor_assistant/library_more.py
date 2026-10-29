"""Курсы Bright, вторая часть: уроки, которые дополняют учебники до полного курса.

Все объяснения, тексты и задания написаны для платформы.
"""

from .library import WR, C, G, L, M, T, W, unit

GENERAL = "Грамматика"
TALK = "Разговорная речь"
FIRST = "Первые слова"

MORE = [
    # == English A1 ====================================================================================
    unit(
        "lib-en-a1-numbers-time", "Числа, время и даты", "en", "A1", [GENERAL, "Начинающим"],
        "Считаем до ста, называем время и дату, спрашиваем «который час?».",
        T("Правило", """
Числа 13–19 оканчиваются на -teen (thirteen, fifteen), десятки – на -ty (twenty, fifty).
Ударение помогает различить: fifTEEN (15) и FIFty (50).

Время: It's seven o'clock (7:00). It's half past seven (7:30). It's quarter past seven (7:15).
It's quarter to eight (7:45). Можно проще: It's seven fifteen, seven forty-five.
What time is it? – Который час?   at 5 o'clock – в 5 часов.

Дата: on Monday, on the 5th of May; in May, in 2025; at night, at the weekend.
Порядковые: first (1st), second (2nd), third (3rd), fourth (4th), twenty-first (21st).
"""),
        W("""
thirteen – тринадцать
thirty – тридцать
fifteen – пятнадцать
fifty – пятьдесят
a hundred – сто
o'clock – ровно (о времени)
half past – половина (после часа)
quarter to – без четверти
birthday – день рождения
the weekend – выходные
"""),
        M("Время и запись", """
It's half past three. = 3:30
It's quarter to six. = 5:45
It's quarter past nine. = 9:15
It's ten o'clock. = 10:00
It's twenty to eleven. = 10:40
"""),
        G("Вставьте in, on или at", """
My birthday is [in] June. The lesson starts [at] 6 o'clock.
We play football [on] Saturday. I sleep [at] night.
She was born [in] 2012. The party is [on] the 3rd of May.
"""),
        C("Выберите правильный вариант", """
15 – это… | fifty | *fifteen | five
50 – это… | fifteen | *fifty | fifty-five
Как сказать 7:30? | half to seven | *half past seven | seven half
Какой порядковый для 3? | threeth | *third | thirdth
I get up ___ 7 o'clock. | in | on | *at
We have English ___ Monday. | in | *on | at
"""),
        L("Послушайте и впишите", "en-GB", """
My name is Kate. My birthday is on the [twelfth|12th] of March. I get up at half past [seven|7].
School starts at [eight|8] o'clock and finishes at quarter to [three|3].
""", """
When does school finish? | At 3:15 | *At 2:45 | At 3:45
When is Kate's birthday? | 20 March | *12 March | 12 May
"""),
        WR("Мой день", "Напишите, во сколько вы встаёте, начинаете учиться или работать, обедаете и ложитесь спать. Используйте at и время."),
    ),
    unit(
        "lib-en-a1-can", "Can и can't: что я умею", "en", "A1", [GENERAL, TALK],
        "Говорим об умениях и просим разрешения: can, can't, can you…?",
        T("Правило", """
Can – «могу, умею». После can глагол без to и без -s: She can swim. (не cans, не can to swim)
Отрицание: can't (cannot): I can't drive.
Вопрос: Can you play the guitar? – Yes, I can. / No, I can't.

Can для просьбы и разрешения: Can I open the window? Can you help me, please?
"""),
        W("""
swim – плавать
ride a bike – кататься на велосипеде
drive – водить машину
cook – готовить
sing – петь
dance – танцевать
draw – рисовать
speak – говорить (на языке)
play the piano – играть на пианино
help – помогать
"""),
        C("Выберите правильный вариант", """
My brother ___ swim very well. | cans | *can | can to
I ___ drive. I'm only 12. | *can't | can | don't can
___ you speak French? | Do | *Can | Are
She can ___ the guitar. | plays | *play | to play
Can I ___ the window? | opening | to open | *open
"""),
        M("Вопрос и ответ", """
Can you cook? = Yes, I can. I make great pancakes.
Can your sister ride a bike? = No, she can't. She's three.
Can I use your phone? = Sure, here you are.
Can you help me? = Of course! What's the problem?
"""),
        G("Дополните рассказ", """
I [can] speak English and a little Spanish. I can't [sing], but I can [dance]!
My dad can [drive] a car and a bus. My little brother [can't|cannot] swim yet.
"""),
        L("Послушайте и ответьте", "en-GB", """
Hi, I'm Mia. I can draw and I can play the piano. I can't swim, but I want to learn this summer.
My friend Leo can ride a bike and he can cook pizza!
""", """
What can't Mia do? | Draw | *Swim | Play the piano
What can Leo cook? | Pasta | *Pizza | Pancakes
"""),
        WR("Мои умения", "Напишите 3 вещи, которые вы умеете делать, и 3 вещи, которые пока не умеете, но хотите научиться."),
    ),
    unit(
        "lib-en-a1-family", "Семья: my, his, her и 's", "en", "A1", [GENERAL],
        "Рассказываем о семье. Притяжательные местоимения и окончание 's.",
        T("Правило", """
Чей? my (мой), your (твой, ваш), his (его), her (её), its (его/её о предмете), our (наш), their (их).
This is my mum. Her name is Olga. That's my dad. His name is Ivan.

's показывает принадлежность: Anna's bag – сумка Анны, my brother's room – комната брата.
Если слово во множественном числе на -s, ставим только апостроф: my parents' car.
Не путайте: it's = it is, its = его (о предмете).
"""),
        W("""
mother (mum) – мама
father (dad) – папа
parents – родители
brother – брат
sister – сестра
grandmother – бабушка
grandfather – дедушка
aunt – тётя
uncle – дядя
cousin – двоюродный брат, сестра
"""),
        G("Вставьте my, his, her, our или their", """
This is my sister. [Her] name is Masha. This is my uncle. [His] name is Pavel.
We live in a big house. [Our] house is near the river. My grandparents have a dog. [Their] dog is very old.
"""),
        C("Выберите правильный вариант", """
Это сумка Кати. | Katya bag | *Katya's bag | Katyas bag
Машина моих родителей. | my parent's car | *my parents' car | my parents car
___ name is Tom. He's my cousin. | Her | *His | Its
The cat is hungry. ___ bowl is empty. | It's | *Its | His
"""),
        M("Кто это?", """
mother's sister = aunt
father's brother = uncle
mother's mother = grandmother
uncle's son = cousin
"""),
        L("Послушайте и впишите", "en-GB", """
This is a photo of my family. This is my [father|dad], his name is Alex. My [mother|mum] is a doctor.
I have one [sister] and two [cousins]. Our [grandmother] lives with us.
"""),
        WR("Моя семья", "Расскажите о трёх членах семьи: как их зовут, сколько им лет, чем они занимаются. Используйте his, her и 's."),
    ),
    unit(
        "lib-en-a1-place", "Где это? in, on, under, next to", "en", "A1", [GENERAL],
        "Предлоги места: описываем комнату и говорим, где лежат вещи.",
        T("Правило", """
in – в (in the box, in the kitchen)
on – на (on the table, on the wall)
under – под (under the bed)
next to – рядом с (next to the window)
between – между (between the sofa and the lamp)
behind – за, позади (behind the door)
in front of – перед (in front of the TV)

Вопрос: Where is my phone? – It's on the sofa. Where are my keys? – They're in your bag.
"""),
        W("""
sofa – диван
shelf – полка
wardrobe – шкаф для одежды
window – окно
wall – стена
floor – пол
lamp – лампа
carpet – ковёр
desk – письменный стол
mirror – зеркало
"""),
        G("Вставьте предлог", """
The cat is [under] the bed. The picture is [on] the wall.
My books are [in] the bag. The lamp is [next to] the sofa.
The ball is [between] the chair and the desk. The bike is [behind] the door.
"""),
        C("Где это?", """
Ключи внутри сумки. | on the bag | *in the bag | under the bag
Ковёр под столом. | *under the table | on the table | in the table
Лампа рядом с окном. | in front of the window | *next to the window | behind the window
Where ___ my glasses? | is | *are | am
"""),
        M("Вопрос и ответ", """
Where is the remote? = It's on the sofa.
Where are my shoes? = They're under the bed.
Where is the cat? = It's behind the curtain.
Where is your school? = It's next to the park.
"""),
        L("Послушайте и ответьте", "en-GB", """
In my room there is a bed, a desk and a big wardrobe. My desk is next to the window.
My guitar is behind the door and my cat usually sleeps under the bed.
""", """
Where is the desk? | Behind the door | *Next to the window | Under the bed
Where does the cat sleep? | On the desk | In the wardrobe | *Under the bed
"""),
        WR("Моя комната", "Опишите свою комнату в 5–6 предложениях: что где стоит. Используйте предлоги места."),
    ),
    # == English A2 ====================================================================================
    unit(
        "lib-en-a2-past-continuous", "Past Continuous: что вы делали, когда…", "en", "A2", [GENERAL],
        "Действие в процессе в прошлом и прерванное действие: was doing, when, while.",
        T("Правило", """
Past Continuous: was / were + глагол с -ing. Действие шло в определённый момент в прошлом.
At 8 o'clock yesterday I was having dinner. They were watching TV.

Длинное действие прервано коротким: Past Continuous + Past Simple.
I was walking home when it started to rain. (шёл → начался дождь)
While she was cooking, the phone rang.

Вопрос: Were you sleeping? What was he doing? Отрицание: I wasn't listening.
"""),
        W("""
suddenly – вдруг
while – пока, в то время как
ring (rang) – звонить
fall (fell) – падать
break (broke) – ломать
notice – замечать
lose (lost) – терять
happen – случаться
"""),
        G("Поставьте глагол в Past Continuous", """
At 9 pm yesterday I [was reading] a book. My parents [were watching] a film.
What [were you doing] at midnight? We [weren't|were not] sleeping, we [were playing] chess.
"""),
        C("Выберите правильный вариант", """
I ___ a shower when you called. | had | *was having | were having
While we ___, it started to snow. | *were walking | walked | was walking
She ___ her leg when she was skiing. | was breaking | *broke | breaks
What ___ at 7 pm? | did you do | *were you doing | was you doing
"""),
        M("Начало и конец фразы", """
I was cooking dinner = when the lights went out.
While they were swimming = a big wave came.
He was driving to work = when he saw an accident.
We were having a picnic = when it started to rain.
"""),
        L("Послушайте и ответьте", "en-GB", """
Last Sunday I was walking in the park with my dog. The sun was shining and children were playing.
Suddenly my dog saw a cat and ran away! I was looking for him for an hour. Finally I found him under a bench.
""", """
What were the children doing? | Running | *Playing | Swimming
How long was she looking for the dog? | Ten minutes | *An hour | All day
"""),
        WR("История", "Расскажите, что вы делали вчера в 8 утра, в 3 часа дня и в 9 вечера. Добавьте один случай: «I was … when …»."),
    ),
    unit(
        "lib-en-a2-experience", "Present Perfect: опыт, ever и never", "en", "A2", [GENERAL, TALK],
        "Рассказываем, что делали в жизни и чего ещё никогда не пробовали.",
        T("Правило", """
Present Perfect – опыт в жизни без точного времени: have / has + 3-я форма глагола.
I have been to Paris. She has never tried sushi. Have you ever seen a whale?

ever – «когда-нибудь» (в вопросах), never – «никогда».
Если называем время, нужен Past Simple: I went to Paris in 2019. (не have been … in 2019)

been и gone: He has been to Spain (был и вернулся). He has gone to Spain (уехал и сейчас там).
"""),
        W("""
been – был, побывал
seen – видел
tried – пробовал
eaten – ел
met – встречал
flown – летал
won – выигрывал
climbed – взбирался
"""),
        G("Вставьте have или has и глагол", """
I [have been] to Kazan twice. My sister [has never tried] Indian food.
[Have] you ever [met] a famous person? We [haven't|have not] seen this film yet.
"""),
        C("Выберите правильный вариант", """
Have you ever ___ a horse? | ride | rode | *ridden
She ___ to London three times. | *has been | have been | was
I ___ Rome last year. | have visited | *visited | have visit
He ___ a marathon. | *has never run | never has run | has never ran
"""),
        M("Вопрос и ответ", """
Have you ever been to China? = No, never. But I want to go.
Has she ever won a prize? = Yes, she has. She won a cup last year.
Have they ever tried surfing? = Yes, they tried it in Bali.
Have you seen my keys? = Yes, they're on the shelf.
"""),
        L("Послушайте и ответьте", "en-GB", """
I love travelling. I've been to twelve countries! I've climbed a volcano in Italy and I've swum with dolphins.
But I've never flown in a helicopter. Maybe next year!
""", """
How many countries has he been to? | Two | *Twelve | Twenty
What has he never done? | Climbed a volcano | Swum with dolphins | *Flown in a helicopter
"""),
        WR("Я никогда не…", "Напишите 3 вещи, которые вы делали в жизни, и 3 вещи, которые никогда не делали. Используйте Present Perfect."),
    ),
    unit(
        "lib-en-a2-travel", "В аэропорту и в отеле", "en", "A2", [TALK, "Путешествия"],
        "Фразы для поездки: регистрация, паспортный контроль, заселение и просьбы.",
        T("Полезные фразы", """
В аэропорту:
Can I see your passport and boarding pass, please?
Window or aisle seat? – A window seat, please.
Is this bag carry-on? How many bags are you checking in?

В отеле:
I have a reservation under the name Ivanova.
What time is check-out? Is breakfast included?
Could I have another towel, please? The air conditioning isn't working.

Could I…? / Could you…? – вежливее, чем Can.
"""),
        W("""
boarding pass – посадочный талон
gate – выход на посадку
delay – задержка
luggage – багаж
carry-on bag – ручная кладь
reservation – бронь
check in – регистрироваться, заселяться
check out – выезжать из отеля
towel – полотенце
receipt – чек
"""),
        M("Вопрос и ответ", """
Window or aisle seat? = Window, please.
How many bags are you checking in? = Just one.
What time is check-out? = At 12 noon.
Is breakfast included? = Yes, from 7 to 10.
"""),
        G("Дополните диалог в отеле", """
Guest: Hello, I have a [reservation] for two nights.
Receptionist: What's your name, please?
Guest: Petrov. And what time is [check-out|checkout]?
Receptionist: At eleven. Here is your key.
Guest: [Could] I have an extra [towel], please?
"""),
        C("Что сказать?", """
Вы хотите место у окна. | An aisle seat, please. | *A window seat, please. | A gate, please.
Рейс задерживается. | The flight is boarding. | *The flight is delayed. | The flight is cancelled.
Вежливая просьба | Give me a towel. | *Could I have a towel, please? | Towel!
"""),
        L("Объявление в аэропорту", "en-GB", """
Attention, please. Flight SU 2140 to Rome is delayed by forty minutes. Passengers, please go to gate [twelve|12].
Boarding will start at [ten|10] fifteen.
""", """
Where is the flight going? | Paris | *Rome | Riga
How long is the delay? | Fourteen minutes | *Forty minutes | Four hours
"""),
        WR("Письмо в отель", "Напишите короткое письмо в отель: вы приедете поздно вечером, попросите тихий номер и спросите про завтрак."),
    ),
    # == English B2 ====================================================================================
    unit(
        "lib-en-b2-deduction", "Предположения о прошлом: must have, might have, can't have", "en", "B2", [GENERAL],
        "Как сказать «наверное, он забыл» и «не может быть, чтобы она не знала».",
        T("Правило", """
Модальный глагол + have + 3-я форма – предположение о прошлом:

must have done – наверняка сделал (уверены на 90%): The streets are wet. It must have rained.
might / may / could have done – возможно, сделал: She might have missed the bus.
can't / couldn't have done – не может быть, чтобы сделал: He can't have seen me – I was hiding.

Не путайте с should have done – «следовало сделать» (сожаление): You should have told me!
"""),
        W("""
probably – вероятно
evidence – доказательство
assume – предполагать
obviously – очевидно
apparently – по-видимому
regret – сожалеть
"""),
        C("Выберите лучший вариант", """
The lights are off. They ___ gone to bed. | can't have | *must have | should have
She didn't answer. She ___ been asleep. | *might have | must | can't have
He ___ stolen the money – he was with me all day. | must have | *can't have | might have
I failed the test. I ___ studied more. | must have | *should have | can't have
"""),
        G("Дополните предположения", """
Anna isn't here yet. She [might have] missed her train.
The window is broken and there's a ball on the floor. Someone [must have] kicked it.
Tom [can't have] written this – he doesn't speak German.
"""),
        M("Ситуация и вывод", """
The grass is wet. = It must have rained.
He looks very tired. = He might have worked all night.
She knows the answer. = She can't have forgotten it.
I was late again. = I should have left earlier.
"""),
        L("Послушайте и ответьте", "en-GB", """
When I came home, the door was open and there was mud on the carpet. My brother's boots were by the door,
so he must have come back early. But he can't have done the washing up – the sink is full of plates!
""", """
Who came back early? | Her father | *Her brother | Her neighbour
What can't he have done? | *The washing up | The shopping | His homework
"""),
        WR("Детектив", "Опишите загадочную ситуацию (например, на столе пустая коробка из-под торта) и сделайте 4 предположения с must have, might have и can't have."),
    ),
    unit(
        "lib-en-b2-gerund", "Gerund или infinitive: enjoy doing, decide to do", "en", "B2", [GENERAL],
        "После каких глаголов -ing, после каких to, и где меняется смысл.",
        T("Правило", """
После enjoy, avoid, mind, finish, suggest, keep, can't stand – глагол с -ing:
I enjoy reading. Would you mind closing the door?

После want, decide, hope, plan, promise, refuse, manage, agree – to + глагол:
She decided to stay. We managed to finish on time.

Меняется смысл:
stop doing – перестать делать; stop to do – остановиться, чтобы сделать.
remember doing – помнить, что сделал; remember to do – не забыть сделать.
try doing – попробовать (как способ); try to do – стараться, пытаться.
"""),
        W("""
avoid – избегать
mind – возражать
suggest – предлагать
refuse – отказываться
manage – суметь
can't stand – терпеть не могу
"""),
        C("Выберите правильный вариант", """
I enjoy ___ in the rain. | to walk | *walking | walk
We decided ___ a taxi. | taking | *to take | take
Would you mind ___ the window? | to open | *opening | open
He promised ___ late again. | *not to be | not being | to not being
"""),
        G("Глагол в правильной форме", """
I stopped [smoking] five years ago. Please remember [to lock] the door when you leave.
She refused [to answer] the question. They suggested [going] to the cinema.
"""),
        M("Фраза и смысл", """
I stopped to buy coffee. = Я остановился, чтобы купить кофе.
I stopped buying coffee. = Я перестал покупать кофе.
I remember meeting her. = Я помню, как встретил её.
Remember to call her. = Не забудь позвонить ей.
"""),
        L("Послушайте и ответьте", "en-GB", """
I can't stand waiting in queues, so I avoid going to the supermarket on Saturdays.
Last week I tried ordering food online. I managed to get everything in twenty minutes!
""", """
What does the speaker avoid? | Ordering online | *Going to the supermarket on Saturdays | Cooking
How long did it take? | Two minutes | *Twenty minutes | Two hours
"""),
        WR("Привычки", "Напишите о том, что вам нравится и что вы терпеть не можете, что вы решили изменить в этом году и что пообещали себе. Используйте глаголы из урока."),
    ),
    # == Китайский ======================================================================================
    unit(
        "lib-hsk1-time", "HSK 1: время и дни недели", "zh", "HSK 1", ["HSK"],
        "Который час, какой сегодня день, порядок слов со временем.",
        T("Правило", """
Время ставится перед глаголом: 我八点上课。 Wǒ bā diǎn shàngkè. – Я в 8 часов иду на занятия.
现在几点？ Xiànzài jǐ diǎn? – Который сейчас час?
八点半 bā diǎn bàn – половина девятого. 八点十分 – 8:10.

Дни недели: 星期 xīngqī + число: 星期一 – понедельник … 星期六 – суббота, 星期天 – воскресенье.
今天星期几？ Jīntiān xīngqī jǐ? – Какой сегодня день недели?
"""),
        W("""
现在 (xiànzài) – сейчас
点 (diǎn) – час (при счёте времени)
半 (bàn) – половина
今天 (jīntiān) – сегодня
明天 (míngtiān) – завтра
昨天 (zuótiān) – вчера
星期 (xīngqī) – неделя
几 (jǐ) – сколько (до 10)
"""),
        M("Иероглифы и перевод", """
星期一 = понедельник
星期三 = среда
星期天 = воскресенье
八点半 = 8:30
明天 = завтра
"""),
        C("Выберите правильный вариант", """
Как спросить «Который час?» | 你几岁？ | *现在几点？ | 今天星期几？
«Я в 7 часов завтракаю» | 我吃早饭七点。 | *我七点吃早饭。 | 七点吃早饭我。
星期五 – это… | вторник | *пятница | воскресенье
半 значит… | четверть | *половина | минута
"""),
        G("Дополните диалог", """
A: 现在[几]点？
B: 现在三[点]半。
A: 今天[星期]几？
B: 今天星期二。
"""),
        L("Послушайте и ответьте", "zh-CN", """
今天星期六。我九点起床，十点去公园。
""", """
Какой сегодня день? | Пятница | *Суббота | Воскресенье
Во сколько он идёт в парк? | В 9 | *В 10 | В 12
"""),
        WR("Мой день по-китайски", "Напишите иероглифами или пиньинем 3 предложения: во сколько вы встаёте, обедаете и ложитесь спать."),
    ),
    unit(
        "lib-hsk1-shopping", "HSK 1: покупки и еда", "zh", "HSK 1", ["HSK", TALK],
        "Сколько стоит, хочу и не хочу, заказываем в кафе.",
        T("Правило", """
多少钱？ Duōshao qián? – Сколько стоит?
Деньги: 块 kuài (разговорное «юань»), 毛 máo – десятая часть.  这个十五块。 – Это стоит 15 юаней.

我想要… Wǒ xiǎng yào… – Я хотел бы… (вежливо)   我要… – Мне… (дайте)
不要 bú yào – не надо.   还要别的吗？ – Ещё что-нибудь?

这个 zhège – этот, 那个 nàge – тот.  Вопрос с 吗 ma: 你喝茶吗？ – Ты пьёшь чай?
"""),
        W("""
多少钱 (duōshao qián) – сколько стоит
块 (kuài) – юань (разг.)
买 (mǎi) – покупать
想 (xiǎng) – хотеть, думать
茶 (chá) – чай
米饭 (mǐfàn) – рис
苹果 (píngguǒ) – яблоко
水 (shuǐ) – вода
"""),
        M("Фраза и перевод", """
多少钱？ = Сколько стоит?
我想买苹果。 = Я хочу купить яблоки.
这个很好。 = Этот хороший.
不要，谢谢。 = Не надо, спасибо.
"""),
        G("Дополните диалог в кафе", """
A: 你想喝什么？
B: 我想喝[茶]。
A: 还要别的吗？
B: 我[要]一碗米饭。[多少钱]？
A: 二十[块]。
"""),
        C("Выберите правильный вариант", """
Как спросить цену? | 你好吗？ | *多少钱？ | 几点？
«Я не хочу» | *我不要 | 我要不 | 不我要
买 значит… | продавать | *покупать | есть
水 – это… | чай | рис | *вода
"""),
        L("Послушайте и ответьте", "zh-CN", """
我想买三个苹果。一共十二块。
""", """
Сколько яблок он покупает? | Два | *Три | Десять
Сколько он платит? | 10 юаней | *12 юаней | 20 юаней
"""),
        WR("Список покупок", "Напишите по-китайски, что вы хотите купить (3–4 продукта), и спросите цену."),
    ),
    unit(
        "lib-hsk2-bi", "HSK 2: сравнение с 比", "zh", "HSK 2", ["HSK"],
        "Сравниваем: выше, дешевле, больше. Конструкции A 比 B и 没有.",
        T("Правило", """
A 比 B + прилагательное: 我比他高。 Wǒ bǐ tā gāo. – Я выше него.
Насколько: 我比他高一点儿。 – чуть выше. 我比他大三岁。 – старше на три года.
Внимание: с 比 не используем 很: 他比我很高 – ошибка.

Отрицание: A 没有 B + прил.: 今天没有昨天冷。 – Сегодня не так холодно, как вчера.
"""),
        W("""
比 (bǐ) – чем (при сравнении)
高 (gāo) – высокий
贵 (guì) – дорогой
便宜 (piányi) – дешёвый
大 (dà) – большой, старший
冷 (lěng) – холодный
一点儿 (yìdiǎnr) – немного
没有 (méiyǒu) – не так… как
"""),
        C("Выберите правильный вариант", """
«Брат выше меня» | 我比哥哥高。 | *哥哥比我高。 | 哥哥高比我。
«Этот дешевле того» | *这个比那个便宜。 | 这个比那个很便宜。 | 那个比这个便宜。
«Сегодня не так жарко, как вчера» | 今天比昨天热。 | *今天没有昨天热。 | 今天不比昨天。
"""),
        G("Дополните", """
苹果[比]香蕉贵。
我比妹妹大两[岁]。
北京[没有]哈尔滨冷。
"""),
        M("Фраза и перевод", """
他比我高。 = Он выше меня.
这个比那个贵。 = Этот дороже того.
我比你大一点儿。 = Я немного старше тебя.
今天没有昨天冷。 = Сегодня не так холодно, как вчера.
"""),
        L("Послушайте и ответьте", "zh-CN", """
我哥哥比我大五岁。他比我高，可是我比他快。
""", """
На сколько брат старше? | На 2 года | *На 5 лет | На 10 лет
Кто быстрее? | Брат | *Говорящий | Одинаково
"""),
        WR("Сравните", "Напишите 4 предложения с 比 и 没有: сравните членов семьи, города или продукты."),
    ),
    # == Испанский ======================================================================================
    unit(
        "lib-es-a1-gustar", "Испанский A1: me gusta", "es", "A1", [GENERAL, TALK],
        "Говорим, что нравится и что нет. Me gusta / me gustan, a mí también.",
        T("Правило", """
Gustar устроен «наоборот»: me gusta el café – мне нравится кофе (буквально «кофе нравится мне»).
Единственное число или глагол: me gusta el chocolate, me gusta bailar.
Множественное число: me gustan los gatos.

me – мне, te – тебе, le – ему/ей/Вам, nos – нам, os – вам, les – им.
¿Te gusta el fútbol? – Sí, me gusta mucho. / No, no me gusta nada.
Согласие: A mí también (мне тоже). A mí tampoco (мне тоже нет).
"""),
        W("""
me gusta – мне нравится
me encanta – обожаю
la música – музыка
el cine – кино
leer – читать
bailar – танцевать
los perros – собаки
la comida – еда
mucho – очень, много
nada – совсем (в отрицании)
"""),
        C("Выберите правильный вариант", """
Мне нравятся собаки. | Me gusta los perros. | *Me gustan los perros. | Yo gusto los perros.
Тебе нравится читать? | *¿Te gusta leer? | ¿Te gustan leer? | ¿Tú gustas leer?
Ему нравится кино. | *Le gusta el cine. | Les gusta el cine. | Me gusta el cine.
Мне тоже нет. | A mí también. | *A mí tampoco. | Yo no.
"""),
        G("Gusta или gustan?", """
Me [gusta] la pizza. Nos [gustan] los libros de aventuras.
¿Te [gusta] bailar? A mi hermana le [gustan] los gatos.
"""),
        M("Фраза и перевод", """
Me encanta la música. = Я обожаю музыку.
No me gusta nada. = Мне совсем не нравится.
¿Qué te gusta hacer? = Что ты любишь делать?
A mí también. = Мне тоже.
"""),
        L("Escucha y responde", "es-ES", """
Hola, soy Lucía. Me encanta el cine y me gusta mucho leer. No me gustan los deportes, pero me gusta bailar.
""", """
¿Qué no le gusta a Lucía? | El cine | *Los deportes | Bailar
Что Лючия обожает? | Читать | *Кино | Танцевать
"""),
        WR("Что мне нравится", "Напишите по-испански 5 предложений: что вам нравится, что обожаете и что не нравится."),
    ),
    unit(
        "lib-es-a1-ir-a", "Испанский A1: планы с ir a", "es", "A1", [GENERAL],
        "Говорим о планах: voy a estudiar, vamos a viajar. Глагол ir.",
        T("Правило", """
Глагол ir – идти, ехать:
yo voy, tú vas, él/ella va, nosotros vamos, vosotros vais, ellos van.

Планы: ir + a + инфинитив.
Voy a estudiar. – Я собираюсь заниматься.  ¿Qué vas a hacer mañana? – Что ты будешь делать завтра?
Vamos a + инфинитив также значит «давай(те)»: ¡Vamos a bailar!

Куда: Voy al cine (a + el = al), voy a la playa.
"""),
        W("""
mañana – завтра
el fin de semana – выходные
viajar – путешествовать
estudiar – учиться
la playa – пляж
el cine – кино
visitar – навещать
descansar – отдыхать
"""),
        G("Вставьте форму ir", """
Mañana yo [voy] a estudiar. ¿Tú [vas] a la fiesta?
Mis padres [van] a viajar a Málaga. Nosotros [vamos] al cine el sábado.
"""),
        C("Выберите правильный вариант", """
Мы собираемся отдыхать. | *Vamos a descansar. | Vamos descansar. | Vamos a descansamos.
Я иду в кино. | Voy a el cine. | *Voy al cine. | Voy cine.
¿Qué ___ a hacer tú? | va | *vas | voy
"""),
        M("Вопрос и ответ", """
¿Qué vas a hacer mañana? = Voy a visitar a mi abuela.
¿Adónde vais en verano? = Vamos a la playa.
¿Vas a estudiar hoy? = Sí, voy a estudiar dos horas.
"""),
        L("Escucha y responde", "es-ES", """
Este fin de semana voy a visitar a mis amigos en Valencia. El sábado vamos a ir a la playa y el domingo vamos a descansar.
""", """
¿Adónde va? | A Madrid | *A Valencia | A Sevilla
¿Qué van a hacer el sábado? | Descansar | *Ir a la playa | Estudiar
"""),
        WR("Мои планы", "Напишите по-испански о планах на выходные: 4–5 предложений с ir a."),
    ),
    unit(
        "lib-es-a1-numbers", "Испанский A1: числа и время", "es", "A1", [GENERAL],
        "Числа до 100, ¿qué hora es?, дни недели.",
        T("Правило", """
1 uno, 2 dos, 3 tres, 4 cuatro, 5 cinco, 6 seis, 7 siete, 8 ocho, 9 nueve, 10 diez,
11 once, 12 doce, 15 quince, 16 dieciséis, 20 veinte, 21 veintiuno, 30 treinta, 31 treinta y uno, 50 cincuenta, 100 cien.

¿Qué hora es? – Es la una (1:00). Son las dos (2:00). Son las tres y media (3:30).
Son las cuatro y cuarto (4:15). Son las cinco menos cuarto (4:45).
A las ocho – в восемь.

Дни: lunes, martes, miércoles, jueves, viernes, sábado, domingo (пишутся с маленькой буквы).
"""),
        W("""
quince – пятнадцать
veinte – двадцать
cincuenta – пятьдесят
cien – сто
y media – половина (после часа)
menos cuarto – без четверти
lunes – понедельник
domingo – воскресенье
"""),
        M("Время и запись", """
Son las tres y media. = 3:30
Es la una. = 1:00
Son las cinco menos cuarto. = 4:45
Son las diez y cuarto. = 10:15
"""),
        C("Выберите правильный вариант", """
15 – это… | cincuenta | *quince | cinco
Который час? | ¿Cuántos años tienes? | *¿Qué hora es? | ¿Qué día es?
2:00 | Es la dos. | *Son las dos. | Son dos.
Пятница | *viernes | jueves | martes
"""),
        G("Дополните", """
Es [la] una. Son [las] ocho y [media].
La clase es [a] las nueve.
"""),
        L("Escucha y responde", "es-ES", """
El lunes tengo clase de español a las siete y media. El viernes juego al tenis a las cinco.
""", """
¿Cuándo es la clase de español? | El viernes | *El lunes | El domingo
¿A qué hora juega al tenis? | A las siete | *A las cinco | A las seis
"""),
        WR("Расписание", "Напишите по-испански своё расписание на неделю: в какой день и во сколько у вас занятия или спорт."),
    ),
    # == Французский ===================================================================================
    unit(
        "lib-fr-a1-er", "Французский A1: глаголы на -er", "fr", "A1", [GENERAL],
        "Настоящее время правильных глаголов: parler, aimer, habiter. Отрицание ne… pas.",
        T("Правило", """
Большинство глаголов на -er спрягаются одинаково. parler – говорить:
je parle, tu parles, il/elle parle, nous parlons, vous parlez, ils/elles parlent.
Окончания -e, -es, -e, -ent не читаются: parle, parles, parlent звучат одинаково.

Перед гласной je → j': j'aime, j'habite.
Отрицание: ne + глагол + pas: Je ne parle pas italien. Перед гласной n': Je n'aime pas le café.
"""),
        W("""
parler – говорить
aimer – любить, нравиться
habiter – жить
travailler – работать
écouter – слушать
regarder – смотреть
manger – есть
chanter – петь
"""),
        G("Поставьте глагол в нужную форму", """
Je [parle] français. Tu [habites] à Paris?
Nous [aimons] la musique. Vous [regardez] la télé. Ils [travaillent] beaucoup.
"""),
        C("Выберите правильный вариант", """
Я люблю шоколад. | *J'aime le chocolat. | Je aime le chocolat. | J'aimes le chocolat.
Мы живём в Москве. | Nous habite à Moscou. | *Nous habitons à Moscou. | Nous habitez à Moscou.
Я не говорю по-английски. | Je parle pas anglais. | *Je ne parle pas anglais. | Je ne pas parle anglais.
Они поют. | *Ils chantent. | Ils chantons. | Ils chante.
"""),
        M("Фраза и перевод", """
Tu parles anglais ? = Ты говоришь по-английски?
J'habite à Kazan. = Я живу в Казани.
Elle n'aime pas le sport. = Она не любит спорт.
Nous écoutons la radio. = Мы слушаем радио.
"""),
        L("Écoutez et répondez", "fr-FR", """
Bonjour ! Je m'appelle Julie. J'habite à Lyon et je travaille dans une école. J'aime chanter, mais je n'aime pas le sport.
""", """
Où habite Julie ? | À Paris | *À Lyon | À Nice
Qu'est-ce qu'elle n'aime pas ? | Chanter | *Le sport | L'école
"""),
        WR("О себе по-французски", "Напишите 5 предложений: где вы живёте, на каких языках говорите, что любите и что не любите."),
    ),
    unit(
        "lib-fr-a2-futur-proche", "Французский A2: aller и ближайшее будущее", "fr", "A2", [GENERAL],
        "Глагол aller и планы: je vais partir, on va manger.",
        T("Правило", """
aller – идти, ехать: je vais, tu vas, il/elle/on va, nous allons, vous allez, ils/elles vont.

Ближайшее будущее (futur proche): aller + инфинитив.
Je vais visiter Paris. – Я собираюсь посетить Париж. Ils vont partir demain.
Отрицание обнимает aller: Je ne vais pas sortir ce soir.

Куда: à + le = au (au cinéma), à + la (à la plage), à + les = aux (aux États-Unis).
"""),
        W("""
demain – завтра
ce soir – сегодня вечером
partir – уезжать
sortir – выходить, гулять
la plage – пляж
le cinéma – кино
les vacances – каникулы, отпуск
bientôt – скоро
"""),
        G("Вставьте форму aller", """
Demain je [vais] à la plage. Tu [vas] au cinéma ce soir ?
Nous [allons] partir en vacances. Mes amis [vont] manger au restaurant.
"""),
        C("Выберите правильный вариант", """
Мы собираемся уезжать. | *Nous allons partir. | Nous allons partons. | Nous va partir.
Я иду в кино. | Je vais à le cinéma. | *Je vais au cinéma. | Je vais cinéma.
Я не буду выходить. | Je vais ne pas sortir. | *Je ne vais pas sortir. | Je ne vais sortir pas.
"""),
        M("Вопрос и ответ", """
Qu'est-ce que tu vas faire demain ? = Je vais visiter mes grands-parents.
Où allez-vous en été ? = Nous allons à la mer.
Tu vas sortir ce soir ? = Non, je vais rester à la maison.
"""),
        L("Écoutez et répondez", "fr-FR", """
Cet été, nous allons partir en Bretagne. Mon frère va faire du surf et moi, je vais lire sur la plage.
""", """
Où vont-ils partir ? | En Provence | *En Bretagne | À Paris
Que va faire le frère ? | Lire | *Faire du surf | Nager
"""),
        WR("Планы на лето", "Напишите по-французски 4–5 предложений о планах на лето с aller + инфинитив."),
    ),
    # == Итальянский и португальский ====================================================================
    unit(
        "lib-it-a1-presente", "Итальянский A1: настоящее время и вопросы", "it", "A1", [GENERAL, TALK],
        "Глаголы на -are, -ere, -ire и вопросы dove, quando, che cosa.",
        T("Правило", """
parlare – говорить: io parlo, tu parli, lui/lei parla, noi parliamo, voi parlate, loro parlano.
prendere – брать: prendo, prendi, prende, prendiamo, prendete, prendono.
dormire – спать: dormo, dormi, dorme, dormiamo, dormite, dormono.

Местоимение часто опускают: Parlo italiano. – Я говорю по-итальянски.
Вопросы: Dove abiti? – Где ты живёшь? Che cosa mangi? – Что ты ешь? Quando parti? – Когда уезжаешь?
"""),
        W("""
parlare – говорить
abitare – жить
mangiare – есть
prendere – брать
leggere – читать
dormire – спать
dove – где
quando – когда
"""),
        C("Выберите правильный вариант", """
Я говорю по-итальянски. | *Parlo italiano. | Parla italiano. | Parli italiano.
Где ты живёшь? | Dove abita? | *Dove abiti? | Dove abito?
Мы берём кофе. | Prendono un caffè. | *Prendiamo un caffè. | Prendete un caffè.
"""),
        G("Поставьте глагол", """
Io [abito] a Roma. Tu [leggi] molto?
Marco [dorme] fino alle nove. Noi [mangiamo] la pizza.
"""),
        M("Вопрос и ответ", """
Dove abiti? = Abito a Milano.
Che cosa prendi? = Un cappuccino, grazie.
Quando parti? = Parto domani.
"""),
        L("Ascolta e rispondi", "it-IT", """
Ciao, sono Giulia. Abito a Firenze e studio arte. La mattina prendo un cappuccino e leggo il giornale.
""", """
Dove abita Giulia? | A Roma | *A Firenze | A Napoli
Cosa prende la mattina? | Un tè | *Un cappuccino | Un succo
"""),
        WR("Il mio giorno", "Напишите по-итальянски 4–5 предложений о своём обычном дне."),
    ),
    unit(
        "lib-pt-a1-presente", "Португальский A1: настоящее время", "pt", "A1", [GENERAL],
        "Глаголы на -ar, -er, -ir: falar, comer, partir. Что ты делаешь?",
        T("Правило", """
falar – говорить: eu falo, você/ele/ela fala, nós falamos, vocês/eles falam.
comer – есть: eu como, ele come, nós comemos, eles comem.
partir – уезжать: eu parto, ele parte, nós partimos, eles partem.

В Бразилии вместо tu обычно говорят você (форма как у ele).
Вопрос: O que você faz? – Что ты делаешь (чем занимаешься)? Onde você mora? – Где ты живёшь?
"""),
        W("""
falar – говорить
morar – жить
trabalhar – работать
comer – есть
beber – пить
abrir – открывать
hoje – сегодня
sempre – всегда
"""),
        C("Выберите правильный вариант", """
Я говорю по-португальски. | *Eu falo português. | Eu fala português. | Eu falamos português.
Мы едим рыбу. | Nós come peixe. | *Nós comemos peixe. | Nós comem peixe.
Где ты живёшь? | *Onde você mora? | Onde você moro? | Onde mora eu?
"""),
        G("Поставьте глагол", """
Eu [moro] em Lisboa. Ela [trabalha] num banco.
Nós [bebemos] café todos os dias. Eles [abrem] a loja às nove.
"""),
        M("Фраза и перевод", """
O que você faz? = Чем ты занимаешься?
Eu trabalho num hotel. = Я работаю в отеле.
Nós sempre comemos juntos. = Мы всегда едим вместе.
"""),
        L("Ouça e responda", "pt-BR", """
Oi, eu sou o Pedro. Moro no Rio de Janeiro e trabalho num restaurante. Hoje eu como em casa.
""", """
Onde Pedro mora? | Em São Paulo | *No Rio de Janeiro | Em Lisboa
Onde ele trabalha? | Num banco | *Num restaurante | Num hotel
"""),
        WR("Sobre mim", "Напишите по-португальски 4–5 предложений о себе: где живёте, где работаете или учитесь, что едите на завтрак."),
    ),
]
