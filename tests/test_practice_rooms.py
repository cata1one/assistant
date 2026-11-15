import pytest

from tutor_assistant.classroom import Classroom
from tutor_assistant.config import Settings
from tutor_assistant.portal import Portal, PortalError, Viewer
from tutor_assistant.practice_rooms import PracticeRooms
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage


def test_practice_room_discovery_capacity_and_signal_access():
    db = Storage(":memory:")
    for index in range(6):
        db.add_account(id=f"a{index}", email=f"a{index}@example.test", role="student",
                       name=f"Learner {index}", password_hash="x")
    portal = Portal(TutorAssistant(Settings(llm_mode="off", stt_mode="off"), db))
    rooms = PracticeRooms(portal, Classroom(portal))
    viewers = [Viewer(f"a{index}", False) for index in range(6)]
    room_id = rooms.create(viewers[0], {
        "title": "Travel", "topic": "weekend", "language": "en", "level": "B1"
    })["id"]
    assert rooms.list(viewers[1], {"language": "en", "q": "travel"})["rooms"][0]["id"] == room_id
    assert rooms.list(viewers[1], {"language": "es"})["rooms"] == []
    for viewer in viewers[1:4]:
        rooms.join(viewer, room_id)
    with pytest.raises(PortalError):
        rooms.join(viewers[4], room_id)
    rooms.signal(viewers[0], room_id, {"to": viewers[1].user_id, "kind": "offer", "data": {}})
    assert len(rooms.state(viewers[1], room_id)["signals"]) == 1
    assert rooms.state(viewers[2], room_id)["signals"] == []
    with pytest.raises(PortalError):
        rooms.signal(viewers[5], room_id, {"to": viewers[1].user_id, "kind": "offer", "data": {}})
    rooms.next_prompt(viewers[1], room_id)
    assert rooms.state(viewers[2], room_id)["prompt"] == 1
    with pytest.raises(PortalError):
        rooms.next_prompt(viewers[5], room_id)
    for viewer in viewers[:4]:
        rooms.leave(viewer, room_id)
    assert rooms.list(viewers[4], {})["rooms"] == []
    db.close()
