"""A short, optional English screening, not a certified CEFR assessment."""
from .portal import PortalError
from .storage import utcnow

# Original questions, increasing in difficulty. Answers stay on the server.
QUESTIONS = [
    ("I ___ a student.", ["am", "is", "are"], 0),
    ("She ___ in London.", ["live", "lives", "living"], 1),
    ("Where ___ you from?", ["is", "am", "are"], 2),
    ("Yesterday we ___ to the cinema.", ["go", "went", "have gone"], 1),
    ("There isn't ___ milk left.", ["some", "many", "any"], 2),
    ("I usually walk, but today I ___ the bus.", ["take", "am taking", "took"], 1),
    ("If it rains, we ___ inside.", ["stay", "will stay", "would stay"], 1),
    ("I've lived here ___ 2020.", ["for", "since", "during"], 1),
    ("This book is ___ than the film.", ["more interesting", "most interesting", "interestinger"], 0),
    ("If I had more time, I ___ another language.", ["learn", "will learn", "would learn"], 2),
    ("The report ___ by Friday, so we can review it then.", ["will have been completed", "will completing", "has completing"], 0),
    ("She asked me where I ___ the previous day.", ["was", "had been", "have been"], 1),
    ("Hardly ___ home when the phone rang.", ["I had got", "had I got", "I got"], 1),
    ("His argument is plausible; ___, it lacks supporting evidence.", ["nevertheless", "therefore", "similarly"], 0),
    ("Had they known about the delay, they ___ earlier.", ["would leave", "would have left", "left"], 1),
]


def _student(accounts, viewer):
    account = accounts.account(viewer)
    if account["role"] != "student":
        raise PortalError(403, "тест доступен ученикам")
    return account


def get_test(accounts, viewer):
    account = _student(accounts, viewer)
    result = accounts.storage._one("SELECT level, score, completed_at FROM placement_results WHERE user_id=?", (account["id"],))
    return {"questions": [{"prompt": q, "options": opts} for q, opts, _ in QUESTIONS], "result": result}


def submit_test(accounts, viewer, body):
    account = _student(accounts, viewer)
    answers = body.get("answers") if isinstance(body, dict) else None
    if not isinstance(answers, list) or len(answers) != len(QUESTIONS) or any(
        type(a) is not int or not 0 <= a < len(QUESTIONS[i][1]) for i, a in enumerate(answers)
    ):
        raise PortalError(400, "ответьте на каждый вопрос")
    score = sum(a == QUESTIONS[i][2] for i, a in enumerate(answers))
    # A screening estimate only; do not claim it measures productive skills.
    level = "C1" if score >= 14 else "B2" if score >= 12 else "B1" if score >= 9 else "A2" if score >= 5 else "A1 или ниже"
    accounts.storage._exec("INSERT INTO placement_results(user_id, level, score, completed_at) VALUES(?,?,?,?) "
                           "ON CONFLICT(user_id) DO UPDATE SET level=excluded.level, score=excluded.score, completed_at=excluded.completed_at",
                           (account["id"], level, score, utcnow()))
    return {"level": level, "score": score, "total": len(QUESTIONS)}


def get_duolingo(accounts, viewer):
    account = _student(accounts, viewer)
    return {"result": accounts.storage._one("SELECT score_min, score_max, kind, completed_at FROM duolingo_results WHERE user_id=?", (account["id"],))}


def save_duolingo(accounts, viewer, body):
    account = _student(accounts, viewer)
    body = body if isinstance(body, dict) else {}
    low, high, kind = body.get("score_min"), body.get("score_max"), body.get("kind")
    if type(low) is not int or type(high) is not int or not 10 <= low <= high <= 160 or kind not in ("practice", "certified"):
        raise PortalError(400, "укажите результат Duolingo от 10 до 160 и тип теста")
    if kind == "certified" and low != high:
        raise PortalError(400, "у официального результата укажите одно число")
    accounts.storage._exec("INSERT INTO duolingo_results(user_id, score_min, score_max, kind, completed_at) VALUES(?,?,?,?,?) "
                           "ON CONFLICT(user_id) DO UPDATE SET score_min=excluded.score_min, score_max=excluded.score_max, kind=excluded.kind, completed_at=excluded.completed_at",
                           (account["id"], low, high, kind, utcnow()))
    return get_duolingo(accounts, viewer)
