"""Teacher timetable: ownership, conflicts, time zones and persistence."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest

from tutor_assistant.accounts import Accounts
from tutor_assistant.config import Settings
from tutor_assistant.portal import Portal, PortalError, Viewer
from tutor_assistant.schedule import Schedule
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage


@pytest.fixture
def schedule_env(tmp_path):
    settings = Settings(llm_mode="off", stt_mode="off", db_path=str(tmp_path / "schedule.sqlite3"))
    storage = Storage(settings.db_path)
    portal = Portal(TutorAssistant(settings, storage))
    accounts = Accounts(portal)

    def register(role, email):
        result = accounts.register({"name": "Anna", "role": role, "email": email,
                                    "password": "secret123", "consent": True}, email)
        return portal.viewer(result["token"])

    teacher = register("tutor", "teacher@example.test")
    other = register("tutor", "other@example.test")
    student = register("student", "student@example.test")
    first = accounts.add_student(teacher, {"name": "Misha"})["pair_id"]
    second = accounts.add_student(other, {"name": "Lena"})["pair_id"]
    group = accounts.save_group(teacher, {"title": "Group A", "members": [first]})["id"]
    env = {"storage": storage, "settings": settings, "portal": portal, "service": Schedule(portal),
           "teacher": teacher, "other": other, "student": student, "first": first, "second": second, "group": group}
    yield env
    env["storage"].close()


def entry(pair_id, start="2028-02-01T10:00:00+03:00", end="2028-02-01T11:00:00+03:00"):
    return {"title": "English", "pair_id": pair_id, "starts_at": start, "ends_at": end, "note": "B1"}


RANGE = {"from": "2028-02-01T00:00:00Z", "to": "2028-02-02T00:00:00Z"}


def test_schedule_timezones_ownership_and_edit(schedule_env):
    e = schedule_env
    service, teacher = e["service"], e["teacher"]
    event_id = service.save(teacher, entry(e["first"]))["id"]
    item = service.list(teacher, RANGE)["items"][0]
    assert item["starts_at"] == "2028-02-01T07:00:00+00:00"
    assert item["ends_at"] == "2028-02-01T08:00:00+00:00"
    assert item["name"] == "Misha" and item["chat_id"] is None
    assert service.list(e["other"], RANGE)["items"] == []
    with pytest.raises(PortalError) as denied:
        service.list(e["student"], RANGE)
    assert denied.value.status == 403
    with pytest.raises(PortalError):
        service.save(e["other"], entry(e["first"]))
    with pytest.raises(PortalError):
        service.save(e["other"], entry(e["second"]), event_id)
    changed = entry(e["first"], "2028-02-01T12:00:00+03:00", "2028-02-01T13:00:00+03:00")
    changed["title"] = "Speaking"
    service.save(teacher, changed, event_id)
    assert service.list(teacher, RANGE)["items"][0]["title"] == "Speaking"
    with pytest.raises(PortalError):
        service.delete(e["other"], event_id)
    assert service.delete(teacher, event_id) == {"ok": True}
    assert service.list(teacher, RANGE)["items"] == []


def test_schedule_group_conflicts_and_validation(schedule_env):
    e = schedule_env
    service, teacher = e["service"], e["teacher"]
    service.save(teacher, entry(e["first"]))
    group = {**entry(e["first"]), "pair_id": None, "group_id": e["group"]}
    with pytest.raises(PortalError) as conflict:
        service.save(teacher, group)
    assert conflict.value.status == 409
    group.update(starts_at="2028-02-01T08:00:00Z", ends_at="2028-02-01T09:00:00Z")
    service.save(teacher, group)  # consecutive appointments are allowed
    assert [item["name"] for item in service.list(teacher, RANGE)["items"]] == ["Misha", "Group A"]
    with pytest.raises(PortalError):
        service.save(teacher, entry(e["first"], "2028-02-01T10:00", "2028-02-01T11:00"))
    with pytest.raises(PortalError):
        service.save(teacher, entry(e["first"], "2028-02-01T10:00:00Z", "2028-02-01T10:01:00Z"))
    with pytest.raises(PortalError):
        service.save(teacher, entry(e["first"]), "0" * 24)
    with pytest.raises(PortalError):
        service.list(teacher, {"from": "2028-01-01T00:00:00Z", "to": "2029-01-01T00:00:00Z"})


def test_schedule_concurrent_booking_is_atomic(schedule_env):
    e = schedule_env
    barrier = Barrier(2)
    def create():
        barrier.wait()
        try:
            e["service"].save(e["teacher"], entry(e["first"]))
            return "saved"
        except PortalError as exc:
            return exc.status
    with ThreadPoolExecutor(max_workers=2) as pool:
        result = list(pool.map(lambda _: create(), range(2)))
    assert result.count("saved") == 1 and result.count(409) == 1


def test_schedule_persists_after_restart(schedule_env):
    e = schedule_env
    e["service"].save(e["teacher"], entry(e["first"]))
    e["storage"].close()
    storage = Storage(e["settings"].db_path)
    e["storage"] = storage
    portal = Portal(TutorAssistant(e["settings"], storage))
    assert Schedule(portal).list(Viewer(e["teacher"].user_id, False), RANGE)["items"][0]["name"] == "Misha"
