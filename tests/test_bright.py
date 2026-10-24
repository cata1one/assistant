"""Bright: цены 290/490, оплата тарифа через ЮKassa, оплата занятий, помощь, настроение, фото, проверка конспекта."""

import pytest

from tutor_assistant import billing
from tutor_assistant.accounts import Accounts
from tutor_assistant.classroom import Classroom
from tutor_assistant.community import Community
from tutor_assistant.config import Settings
from tutor_assistant.learning import Learning
from tutor_assistant.lesson_pay import LessonPay
from tutor_assistant.portal import Portal, PortalError
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage
from tutor_assistant.units import Units
from tutor_assistant.yookassa import PlanPayments, YooKassa

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100


class H(dict):
    def get(self, k, d=None):
        return super().get(k, d)


@pytest.fixture
def env(tmp_path):
    settings = Settings(llm_mode="off", stt_mode="off", db_path=":memory:", site_url="https://bright.example",
                        smtp_host="smtp.example", smtp_user="bot@bright.example")
    a = TutorAssistant(settings, Storage(":memory:"))
    portal = Portal(a)
    tg: list[tuple[str, str]] = []
    portal.telegram_send = lambda chat, text: tg.append((chat, text))
    portal.mailer._deliver = lambda msg: None  # письма не уходят, но записываются в portal.mailer.sent
    learning = Learning(portal, tmp_path)
    room = Classroom(portal)
    return {"a": a, "portal": portal, "acc": Accounts(portal), "c": Community(portal), "l": learning, "room": room,
            "units": Units(learning), "tg": tg, "mail": portal.mailer, "pay": LessonPay(portal)}


def reg(env, role, email, name="Анна", **kw):
    res = env["acc"].register({"role": role, "name": name, "email": email, "password": "secret123", "consent": True, **kw}, "1.1.1.1")
    return env["portal"].viewer(res["token"]), res


def pair(env):
    tutor, _ = reg(env, "tutor", "tutor@mail.ru", "Анна")
    added = env["acc"].add_student(tutor, {"name": "Миша"})
    student, _ = reg(env, "student", "misha@mail.ru", "Миша", invite=added["invite"]["code"])
    return tutor, student, added


# -- цены -------------------------------------------------------------------------------------
def test_prices_and_first_month_discount(env):
    assert billing.PLANS["teacher"]["periods"] == {1: 290, 3: 783, 12: 2784}
    assert billing.PLANS["school"]["periods"] == {1: 490, 3: 1323, 12: 4704}
    tutor, _ = reg(env, "tutor", "t@mail.ru")
    acc = env["a"].storage.get_account(tutor.user_id)
    q = billing.quote(acc, 1, env["a"].storage)
    assert (q["total"], q["percent"], q["reason"]) == (232, 20, "first")  # первый месяц на 20% дешевле
    assert billing.quote(acc, 12, env["a"].storage)["total"] == 2784  # скидки не суммируются с годовой
    school, _ = reg(env, "school", "s@mail.ru", school_name="Лингва")
    sq = billing.quote(env["a"].storage.get_account(school.user_id), 1, env["a"].storage, teachers=3)
    assert sq["total"] == 1470 and sq["reason"] is None  # школе скидка на первый месяц не положена


# -- ЮKassa -------------------------------------------------------------------------------------
class FakeYK:
    def __init__(self):
        self.calls, self.status, self.amount = [], "pending", None

    def __call__(self, method, url, payload, headers):
        self.calls.append((method, url, payload))
        if method == "POST":
            self.amount = payload["amount"]["value"]
            self.meta = payload["metadata"]
            return {"id": "yk-1", "status": "pending", "confirmation": {"confirmation_url": "https://yoomoney.ru/pay/1"}}
        return {"id": "yk-1", "status": self.status, "paid": self.status == "succeeded",
                "amount": {"value": self.amount, "currency": "RUB"}, "metadata": self.meta}


def test_yookassa_payment_extends_once(env):
    tutor, _ = reg(env, "tutor", "t@mail.ru")
    http = FakeYK()
    pp = PlanPayments(env["portal"], YooKassa("shop", "key", http=http))
    opt = pp.options(tutor)
    assert opt["online"] and [q["total"] for q in opt["quotes"]] == [232, 783, 2784]
    res = pp.pay(tutor, {"months": 1, "method": "sbp"})
    assert res["url"].startswith("https://yoomoney.ru") and res["amount"] == 232
    sent = http.calls[0][2]
    assert sent["amount"]["value"] == "232.00" and sent["payment_method_data"] == {"type": "sbp"}
    assert sent["confirmation"]["return_url"].startswith("https://bright.example/#/app/plan")
    assert pp.check(tutor, {"id": res["id"]})["status"] == "pending"
    http.status = "succeeded"
    assert pp.check(tutor, {"id": res["id"]})["status"] == "succeeded"
    until = env["a"].storage.get_account(tutor.user_id)["paid_until"]
    pp.webhook({"event": "payment.succeeded", "object": {"id": "yk-1"}})  # повторное уведомление
    pp.check(tutor, {"id": res["id"]})
    assert env["a"].storage.get_account(tutor.user_id)["paid_until"] == until
    assert billing.plan_state(env["a"].storage, env["a"].storage.get_account(tutor.user_id))["state"] == "active"
    assert any("оплата получена" in m["subject"] for m in env["mail"].sent)
    # второй платёж уже без скидки на первый месяц
    assert billing.quote(env["a"].storage.get_account(tutor.user_id), 1, env["a"].storage)["total"] == 290


def test_yookassa_rejects_wrong_amount_and_foreign_payment(env):
    tutor, _ = reg(env, "tutor", "t@mail.ru")
    other, _ = reg(env, "tutor", "o@mail.ru")
    http = FakeYK()
    pp = PlanPayments(env["portal"], YooKassa("shop", "key", http=http))
    res = pp.pay(tutor, {"months": 3})
    http.status, http.amount = "succeeded", "1.00"
    with pytest.raises(PortalError) as e:
        pp.check(tutor, {"id": res["id"]})
    assert e.value.status == 409 and env["a"].storage.get_account(tutor.user_id)["paid_until"] is None
    with pytest.raises(PortalError) as e:
        pp.check(other, {"id": res["id"]})  # чужой платёж
    assert e.value.status == 404
    with pytest.raises(PortalError):
        pp.pay(tutor, {"months": 5})


def test_payments_disabled_without_keys_and_school_tutor_cannot_pay(env):
    tutor, _ = reg(env, "tutor", "t@mail.ru")
    pp = PlanPayments(env["portal"])
    assert pp.options(tutor)["online"] is False
    with pytest.raises(PortalError) as e:
        pp.pay(tutor, {"months": 1})
    assert e.value.status == 503
    school, _ = reg(env, "school", "s@mail.ru", school_name="Лингва")
    code = env["acc"].school_invite(school)["code"] if hasattr(env["acc"], "school_invite") else None
    if code:
        member, _ = reg(env, "tutor", "m@mail.ru", invite=code)
        with pytest.raises(PortalError) as e:
            PlanPayments(env["portal"], YooKassa("s", "k", http=FakeYK())).pay(member, {"months": 1})
        assert e.value.status == 403


# -- оплата занятий -----------------------------------------------------------------------------------
def test_lesson_payment_flow(env):
    tutor, student, added = pair(env)
    pay = env["pay"]
    with pytest.raises(PortalError):
        pay.save_config(tutor, {"enabled": True, "price": 1500})  # без реквизитов нельзя
    pay.save_config(tutor, {"enabled": True, "price": 1500, "packs": [1, 4], "remind": "after", "require_prepay": True,
                            "requisites": "СБП +7 900 000-00-00, Анна П."})
    view = pay.overview(student)["items"][0]
    assert view["price"] == 1500 and view["packs"] == [1, 4] and view["balance"] == 0 and "СБП" in view["requisites"]
    with pytest.raises(PortalError):
        pay.declare(student, {"pair_id": view["pair_id"], "count": 3})  # такого пакета нет
    res = pay.declare(student, {"pair_id": view["pair_id"], "count": 4})
    assert res["amount"] == 6000
    assert any(m["to"] == "tutor@mail.ru" and "оплатил" in m["subject"] for m in env["mail"].sent)  # письмо преподавателю
    assert pay.overview(tutor)["pending_total"] == 1
    with pytest.raises(PortalError):
        pay.decide(student, {"id": res["id"], "action": "confirm"})  # подтверждает только преподаватель
    pid = res["id"]
    assert pay.decide(tutor, {"id": pid, "action": "confirm"})["balance"] == 4
    assert any(m["to"] == "misha@mail.ru" and "подтверждена" in m["subject"] for m in env["mail"].sent)
    with pytest.raises(PortalError) as e:
        pay.decide(tutor, {"id": pid, "action": "confirm"})
    assert e.value.status == 409  # повторно баланс не растёт
    assert pay.adjust(tutor, {"pair_id": view["pair_id"], "delta": -1})["balance"] == 3


def test_prepay_gate_blocks_student_and_reminders(env):
    tutor, student, _ = pair(env)
    pay = env["pay"]
    pay.save_config(tutor, {"enabled": True, "price": 1000, "packs": [1], "remind": "before", "require_prepay": True,
                            "requisites": "карта 2200 0000 0000 0000"})
    chat = env["portal"].accesses(tutor)[0].chat_id
    lid = env["room"].start(tutor, chat, "Тема")["lesson_id"]
    assert any(m["to"] == "misha@mail.ru" and "Напоминание" in m["subject"] for m in env["mail"].sent)
    with pytest.raises(PortalError) as e:
        env["room"].state(student, lid)
    assert e.value.status == 402 and "оплатите" in e.value.message.lower()
    pair_id = pay.overview(student)["items"][0]["pair_id"]
    pay.adjust(tutor, {"pair_id": pair_id, "delta": 1})
    assert env["room"].state(student, lid)["role"] == "student"
    # короткий урок занятие не списывает
    env["room"].finish(tutor, lid)
    assert env["a"].storage.pair_balance(pair_id) == 1


def test_lesson_payment_off_by_default(env):
    tutor, student, _ = pair(env)
    assert env["pay"].overview(student)["items"] == []
    chat = env["portal"].accesses(tutor)[0].chat_id
    lid = env["room"].start(tutor, chat, "Тема")["lesson_id"]
    assert env["room"].state(student, lid)["role"] == "student"  # без настройки вход свободен


# -- помощь -----------------------------------------------------------------------------------------------
def test_support_anonymous_and_logged_in(env):
    c = env["c"]
    with pytest.raises(PortalError):
        c.support({"text": "не могу войти"}, None, "5.5.5.5")  # без контакта ответить некуда
    out = c.support({"text": "Не приходит письмо при регистрации", "contact": "ivan@mail.ru", "page": "#/register"}, None, "5.5.5.5")
    assert out["email"] == "monework@mail.ru"
    assert any(m["to"] == "monework@mail.ru" and "Не приходит" in m["text"] for m in env["mail"].sent)
    assert any(m["to"] == "ivan@mail.ru" and "получили" in m["subject"] for m in env["mail"].sent)
    tutor, _ = reg(env, "tutor", "t@mail.ru")
    c.support({"text": "Вопрос про оплату", "kind": "payment"}, tutor, "6.6.6.6")  # почта берётся из аккаунта
    assert env["a"].storage.feedback_list()[0]["contact"] == "t@mail.ru"
    assert c.support({"text": "spam spam", "website": "x"}, None, "7.7.7.7")["id"] is None
    for _ in range(8):
        c.support({"text": "ещё вопрос", "contact": "a@b.ru"}, None, "8.8.8.8")
    with pytest.raises(PortalError) as e:
        c.support({"text": "ещё вопрос", "contact": "a@b.ru"}, None, "8.8.8.8")
    assert e.value.status == 429


# -- настроение, фото -----------------------------------------------------------------------------------------
def test_mood_is_optional_and_private_on_request(env):
    tutor, student, _ = pair(env)
    assert env["acc"].students(tutor)["students"][0]["mood"] is None  # не отметил, значит нигде не видно
    env["acc"].set_mood(student, {"level": 2})
    assert env["acc"].students(tutor)["students"][0]["mood"]["level"] == 2
    assert env["acc"].public(student.user_id)["mood"]["today"] == 2
    env["acc"].update_prefs(student, {"mood_private": True})
    assert env["acc"].students(tutor)["students"][0]["mood"] is None
    env["acc"].update_prefs(student, {"mood_private": False})
    env["acc"].set_mood(student, {"level": None})
    assert env["acc"].students(tutor)["students"][0]["mood"] is None
    with pytest.raises(PortalError):
        env["acc"].set_mood(student, {"level": 9})
    with pytest.raises(PortalError):
        env["acc"].set_mood(tutor, {"level": 3})  # только ученики


def test_profile_photo_upload(env):
    tutor, student, _ = pair(env)
    out = env["l"].upload_photo(student, PNG, H({"Content-Type": "image/png"}))
    assert out["url"].startswith("/site/v1/files/")
    data, mime, _ = env["l"].file(out["photo"])
    assert mime == "image/png" and data == PNG
    assert env["acc"].students(tutor)["students"][0]["photo"] == out["url"]  # преподаватель видит картинку ученика
    second = env["l"].upload_photo(student, PNG + b"1", H({"Content-Type": "image/png"}))
    with pytest.raises(PortalError):
        env["l"].file(out["photo"])  # старая заменена
    assert second["photo"] != out["photo"]
    with pytest.raises(PortalError) as e:
        env["l"].upload_photo(student, b"not an image", H({"Content-Type": "image/png"}))
    assert e.value.status == 415
    # фото не попадают в материалы преподавателя
    env["l"].upload_photo(tutor, PNG, H({"Content-Type": "image/png"}))
    assert env["l"].materials(tutor)["materials"] == []
    # сохранение оформления не стирает картинку
    env["acc"].update_prefs(student, {"theme": "newyear"})
    assert env["acc"].public(student.user_id)["prefs"]["photo"] == second["photo"]
    assert env["acc"].public(student.user_id)["prefs"]["theme"] == "newyear"


# -- проверка конспекта перед отправкой ------------------------------------------------------------------------
def test_review_before_send_hides_report_until_publish(env):
    tutor, student, _ = pair(env)
    env["acc"].update_prefs(tutor, {"review_reports": True})
    chat = env["portal"].accesses(tutor)[0].chat_id
    lid = env["room"].start(tutor, chat, "Кухня")["lesson_id"]
    st = env["a"].storage
    for role, uid, text in [("tutor", tutor.user_id, "Today we learn kitchen. New words: kitchen - кухня, table - стол."),
                            ("student", student.user_id, "I like my kitchen.")]:
        st.add_message(lid, uid, "x", __import__("tutor_assistant.models", fromlist=["Role"]).Role.parse(role), text)
    out = env["room"].finish(tutor, lid)
    from tutor_assistant.models import VocabItem

    words = [VocabItem(word="kitchen", translation="кухня")]  # слова урока, как после расшифровки
    report = st.get_report(lid)
    report.vocabulary = words
    st.save_report(lid, report)
    st.add_words(env["a"].owner_for(st.get_lesson(lid)), lid, words)
    assert out["on_review"] and out["delivered"] is None
    assert env["l"].portal.lesson(tutor, lid)["published"] is False
    sv = env["portal"].lesson(student, lid)
    assert sv["report"] is None and sv["on_review"]
    assert [x for x in env["portal"].me(student)["lessons"] if x["id"] == lid][0]["has_report"] is False
    assert not any(w["word"] == "kitchen" for w in env["portal"].words(student)["words"])  # слова пока не в карточках
    with pytest.raises(PortalError):
        env["room"].publish(student, lid)
    res = env["room"].publish(tutor, lid)
    assert res["published"] and res["delivered"]["student"] == 1
    assert env["portal"].lesson(student, lid)["report"] is not None
    assert any(m["to"] == "misha@mail.ru" and "конспект" in m["subject"].lower() for m in env["mail"].sent)
    assert any(w["word"].lower() == "kitchen" for w in env["portal"].words(student)["words"])


def test_exercises_from_lesson(env):
    tutor, student, _ = pair(env)
    chat = env["portal"].accesses(tutor)[0].chat_id
    lid = env["room"].start(tutor, chat, "Кухня")["lesson_id"]
    env["room"].finish(tutor, lid)
    report = env["a"].storage.get_report(lid)
    from tutor_assistant.models import VocabItem

    report.vocabulary = [VocabItem(word=w, translation=t) for w, t in
                         [("kitchen", "кухня"), ("table", "стол"), ("chair", "стул"), ("window", "окно")]]
    report.topic = "Кухня"
    env["a"].storage.save_report(lid, report)
    out = env["units"].from_lesson(tutor, lid, {"assign": True})
    assert out["assigned"] and out["generated_by"] == "offline"
    unit = env["a"].storage.get_unit(out["unit_id"])
    kinds = {b["type"] for b in unit["blocks"]}
    assert {"words", "match", "choice"} <= kinds
    hw = env["l"].homework(student)["homework"][0]
    assert hw["unit"]["title"].startswith("Закрепление")
    with pytest.raises(PortalError):
        env["units"].from_lesson(student, lid, {})


# -- восстановление пароля --------------------------------------------------------------------------------
def test_password_reset_by_email(env):
    tutor, res = reg(env, "tutor", "t@mail.ru")
    acc = env["acc"]
    assert acc.forgot_password({"email": "nobody@mail.ru"}, "1.1.1.1")["ok"]  # ответ тот же, письма нет
    assert not [m for m in env["mail"].sent if m["to"] == "nobody@mail.ru"]
    acc.forgot_password({"email": "T@mail.ru"}, "1.1.1.1")
    mail = [m for m in env["mail"].sent if m["to"] == "t@mail.ru" and "пароль" in m["subject"]][0]
    code = mail["text"].split("code=")[1].split()[0]
    with pytest.raises(PortalError):
        acc.reset_password({"code": code, "password": "short"}, "1.1.1.1")
    out = acc.reset_password({"code": code, "password": "brand-new-pass"}, "1.1.1.1")
    assert out["account"]["email"] == "t@mail.ru"
    assert acc.login({"email": "t@mail.ru", "password": "brand-new-pass"}, "2.2.2.2")["token"]
    with pytest.raises(PortalError) as e:
        acc.reset_password({"code": code, "password": "another-pass1"}, "1.1.1.1")  # ссылка одноразовая
    assert e.value.status == 410
    with pytest.raises(PortalError):
        env["portal"].viewer(res["token"])  # старый вход закрыт
