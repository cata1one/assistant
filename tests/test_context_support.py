from tutor_assistant.library import LIBRARY

ADVANCED = [unit for unit in LIBRARY if unit["id"] in {
    "lib-en-b1-decisions", "lib-en-b1-stories", "lib-en-b1-advice",
    "lib-en-b2-media", "lib-en-b2-negotiation", "lib-en-b2-environment",
    "lib-en-c1-hedging", "lib-en-c1-argument", "lib-en-c1-register",
}]
from tutor_assistant.units import grade, student_view, validate_blocks


def test_context_and_instruction_survive_copy_and_student_view():
    blocks = validate_blocks([{"type": "choice", "title": "Train plans",
                               "context": "Maya booked a train for Friday at six.",
                               "instruction": "Use the information above.",
                               "questions": [{"q": "When?", "options": ["Friday", "Monday"], "answer": 0}]}])
    copy = validate_blocks(blocks)
    view = student_view({"id": "context-test", "title": "Test", "blocks": copy})
    assert view["blocks"][0]["context"] == blocks[0]["context"]
    assert view["blocks"][0]["instruction"] == blocks[0]["instruction"]
    assert "answer" not in view["blocks"][0]["questions"][0]


def test_advanced_lessons_supply_context_and_constraints():
    for lesson in ADVANCED:
        for block in lesson["blocks"]:
            if block["type"] in ("gap", "choice", "write"):
                assert len(block["context"]) > 100
                assert block["instruction"]
            if block["type"] == "listening":
                assert "short recording" in block["instruction"]
        assert len(validate_blocks(lesson["blocks"])) == len(lesson["blocks"])


def test_natural_advice_alternatives_are_accepted():
    lesson = next(u for u in ADVANCED if u["id"] == "lib-en-b1-advice")
    index = next(i for i, b in enumerate(lesson["blocks"]) if b["type"] == "gap")
    result = grade(lesson, {str(index): ["could", "don't have to", "can", "routine"]})
    assert all(result["blocks"][str(index)]["gaps"])


def test_advanced_concession_vocabulary_is_taught_before_testing():
    lesson = next(u for u in ADVANCED if u["id"] == "lib-en-c1-hedging")
    words = [w["word"] for b in lesson["blocks"] if b["type"] == "words" for w in b["items"]]
    assert "albeit" in words
    lesson = next(u for u in ADVANCED if u["id"] == "lib-en-c1-argument")
    words = [w["word"] for b in lesson["blocks"] if b["type"] == "words" for w in b["items"]]
    assert "admittedly" in words
