"""Build a demonstration fixture from the actual current curriculum, without user data."""
import json
from pathlib import Path

from tutor_assistant.library import BOOKS, library_unit
from tutor_assistant.units import student_view

path = Path("frontend/qa/demo-data.json")
path.write_text(json.dumps({"unit": student_view(library_unit("lib-en-b1-decisions")), "books": BOOKS},
                           ensure_ascii=False), encoding="utf-8")
