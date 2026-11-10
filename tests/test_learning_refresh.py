from datetime import datetime, timezone

import pytest

from tutor_assistant.accounts import Accounts
from tutor_assistant.billing import plan_state, require_active
from tutor_assistant.config import Settings
from tutor_assistant.library import BOOKS, LIBRARY
from tutor_assistant.library_advanced import ADVANCED
from tutor_assistant.portal import Portal, PortalError, Viewer
from tutor_assistant.provision_access import provision
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage
from tutor_assistant.units import gap_speech, grade, student_view, validate_blocks


def test_gap_audio_is_sentence_scoped_and_keeps_gap_order():
    script = "Listen carefully. She [works] here and [lives] nearby.\nThey [travel|go] by train."
    assert gap_speech(script) == [
        "She works here and lives nearby.", "She works here and lives nearby.", "They travel by train."
    ]
    unit = {"id": "x", "title": "x", "blocks": validate_blocks([
        {"type": "listening", "script": script, "lang": "en-GB"}
    ])}
    view = student_view(unit)["blocks"][0]
    assert view["gap_speech"] == gap_speech(script)
    assert "[" not in view["speak"]
    assert "gap_answers" not in view


def test_audio_boundaries_survive_student_view_and_copy():
    blocks = validate_blocks([{"type": "listening", "audio": "/site/v1/files/" + "a" * 24,
                              "audio_start": 12.5, "audio_end": 18,
                              "questions": [{"q": "Where?", "options": ["Here", "There"], "answer": 0}]}])
    view = student_view({"id": "x", "title": "x", "blocks": blocks})["blocks"][0]
    assert view["audio_start"] == 12.5 and view["audio_end"] == 18
    assert "answer" not in view["questions"][0]
    assert validate_blocks(blocks)[0]["audio_end"] == 18


@pytest.mark.parametrize("start,end", [(-1, 4), (4, 4), (5, 3), (float("nan"), 10), (0, float("inf")), ("bad", 2)])
def test_invalid_audio_boundaries_rejected(start, end):
    with pytest.raises(PortalError):
        validate_blocks([{"type": "listening", "script": "A [word].", "audio_start": start, "audio_end": end}])


def test_new_courses_validate_and_accept_all_correct_answers():
    assert len(ADVANCED) == 9
    assert {u["level"] for u in ADVANCED} == {"B1", "B2", "C1"}
    ids = [u["id"] for u in LIBRARY]
    assert len(ids) == len(set(ids))
    for book in BOOKS:
        assert all(uid in ids for uid in book["units"])
    for unit in ADVANCED:
        assert len(validate_blocks(unit["blocks"])) == len(unit["blocks"])
        answers = {}
        for i, block in enumerate(unit["blocks"]):
            if block["type"] == "gap":
                from tutor_assistant.units import _gap_answers
                answers[str(i)] = [a[0] for a in _gap_answers(block["text"])]
            elif block["type"] == "choice":
                answers[str(i)] = [q["answer"] for q in block["questions"]]
            elif block["type"] == "listening":
                from tutor_assistant.units import _gap_answers
                answers[str(i)] = {"gaps": [a[0] for a in _gap_answers(block["script"])],
                                   "questions": [q["answer"] for q in block["questions"]]}
        result = grade(unit, answers)
        assert result["score"] == result["total"] and result["total"] >= 10


def test_lifetime_grants_are_explicit_and_school_teachers_inherit_them():
    storage = Storage(":memory:")
    try:
        storage.add_account(id="a_owner", email="school@example.test", password_hash="x", name="School",
                            role="school", org_id="o_test")
        storage.add_org("o_test", "School", "a_owner")
        storage.add_account(id="a_teacher", email="teacher@example.test", password_hash="x", name="Teacher",
                            role="tutor", org_id="o_test")
        teacher = storage.get_account("a_teacher")
        assert plan_state(storage, teacher)["state"] == "expired"
        storage.update_account("a_owner", lifetime_access="1")
        future = datetime(2099, 1, 1, tzinfo=timezone.utc)
        assert plan_state(storage, teacher, future)["lifetime"] is True
        assert plan_state(storage, teacher)["by_school"] is True
        require_active(storage, "a_teacher")
        storage.update_account("a_owner", lifetime_access=None)
        with pytest.raises(PortalError):
            require_active(storage, "a_teacher")
    finally:
        storage.close()


def test_provisioning_creates_private_password_links_and_four_student_invites(tmp_path):
    settings = Settings(db_path=str(tmp_path / "accounts.sqlite3"), llm_mode="off", stt_mode="off",
                        site_url="https://school.example.test")
    output = provision(settings, "teacher@example.test", "school@example.test", "Test school", 4)
    assert output["teacher"]["set_password"].startswith(settings.site_url + "/#/reset?code=")
    assert len(output["students"]) == 4
    assert len({i["code"] for i in output["students"]}) == 4
    storage = Storage(settings.db_path)
    try:
        accounts = Accounts(Portal(TutorAssistant(settings, storage)))
        for invite in output["students"]:
            assert accounts.invite_info(invite["code"])["role"] == "student"
        code = output["teacher"]["set_password"].split("code=")[1]
        result = accounts.reset_password({"code": code, "password": "choose-a-private-password"}, "local")
        assert result["account"]["billing"]["lifetime"]
        # Public signup/profile fields cannot self-grant the entitlement.
        account = accounts.register({"role": "tutor", "email": "normal@example.test", "name": "Normal",
                                     "password": "test-password", "consent": True, "lifetime_access": "1"}, "normal")
        viewer = Viewer(account["account"]["id"], False)
        accounts.update_profile(viewer, {"lifetime_access": "1"})
        assert not accounts.public(viewer.user_id)["billing"].get("lifetime")
    finally:
        storage.close()
    again = provision(settings, "teacher@example.test", "school@example.test", "Test school")
    assert not again["teacher"]["created"] and "set_password" not in again["teacher"]


def test_role_conflict_does_not_grant_other_owner_access(tmp_path):
    settings = Settings(db_path=str(tmp_path / "roles.sqlite3"), llm_mode="off", stt_mode="off")
    storage = Storage(settings.db_path)
    storage.add_account(id="a_student", email="school@example.test", password_hash="x", name="Student", role="student")
    storage.close()
    with pytest.raises(ValueError):
        provision(settings, "teacher@example.test", "school@example.test", "Test")
    storage = Storage(settings.db_path)
    try:
        assert storage.account_by_email("teacher@example.test") is None
    finally:
        storage.close()
