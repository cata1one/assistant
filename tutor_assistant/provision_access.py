"""Server operator tool. Run over authenticated SSH; never publish its output.

Creates permanent tutor/school access and optional one-use student invitations.
Existing passwords are preserved. New owners choose passwords through expiring reset links.
No HTTP route exposes this operation.
"""

from __future__ import annotations

import argparse
import json
import secrets

from .accounts import EMAIL_RE, Accounts, hash_password
from .config import Settings
from .portal import Portal, Viewer
from .service import TutorAssistant
from .storage import Storage


def provision(settings: Settings, teacher_email: str, school_email: str, school_name: str,
              students: int = 0) -> dict:
    teacher_email, school_email = teacher_email.strip().lower(), school_email.strip().lower()
    if not EMAIL_RE.match(teacher_email) or not EMAIL_RE.match(school_email) or teacher_email == school_email:
        raise ValueError("Supply two different valid owner emails.")
    if not 0 <= students <= 50 or not school_name.strip():
        raise ValueError("Supply a school name and 0–50 student invitations.")
    storage = Storage(settings.db_path)
    try:
        # Preflight both roles before changing either owner.
        for email, role in ((teacher_email, "tutor"), (school_email, "school")):
            existing = storage.account_by_email(email)
            if existing and existing["role"] != role:
                raise ValueError(f"{email}: existing account has a different role; no changes made.")
        accounts = Accounts(Portal(TutorAssistant(settings, storage)))
        output = {}
        for key, email, role in (("teacher", teacher_email, "tutor"), ("school", school_email, "school")):
            row = storage.account_by_email(email)
            created = row is None
            if created:
                account_id = "a_" + secrets.token_hex(8)
                org_id = "o_" + secrets.token_hex(6) if role == "school" else None
                if org_id:
                    storage.add_org(org_id, school_name.strip(), account_id)
                row = storage.add_account(id=account_id, email=email, role=role, org_id=org_id,
                                          name="Преподаватель" if role == "tutor" else school_name.strip(),
                                          password_hash=hash_password(secrets.token_urlsafe(32)))
            storage.update_account(row["id"], lifetime_access="1")
            owner = {"email": email, "lifetime": True, "created": created,
                     "login": f"{settings.site_url.rstrip('/')}/#/login"}
            if created:
                code = secrets.token_urlsafe(24)
                storage.add_invite(code, "reset", row["id"], row["id"])
                owner["set_password"] = f"{settings.site_url.rstrip('/')}/#/reset?code={code}"
                owner["expires_hours"] = accounts.RESET_HOURS
            output[key] = owner
        teacher = storage.account_by_email(teacher_email)
        output["students"] = [
            accounts.add_student(Viewer(teacher["id"], False), {"name": f"Student{n + 1}", "language": "en"})["invite"]
            for n in range(students)
        ]
        return output
    finally:
        storage.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--teacher-email", required=True)
    parser.add_argument("--school-email", required=True)
    parser.add_argument("--school-name", required=True)
    parser.add_argument("--students", type=int, default=0, help="Create this many NEW student invitations.")
    args = parser.parse_args()
    result = provision(Settings.from_env(), args.teacher_email, args.school_email, args.school_name, args.students)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
