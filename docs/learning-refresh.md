# Learning refresh: deployment and account setup

The application branch is `claude/busy-ramanujan-h8c5ma`. This update includes prebuilt assets in `tutor_assistant/web/`, so the production server does not need Node.js to serve it.

## Changes

- Book-and-sun logo, SVG/ICO browser icons, touch and installation icons.
- Simpler homepage typography and explicit preparation/lesson/practice sequence.
- Wide lesson previews and practice rendered at document root, including under animated containers.
- Sentence-scoped browser speech for gap exercises; stop/replay controls and cleanup on navigation/check.
- Optional start/end seconds for uploaded recording blocks. Set these in the lesson editor; timing cannot be inferred reliably from an arbitrary uploaded file.
- Nine original English practice lessons: three B1, three B2 and three C1. The new C1 book appears in the Bright library.
- Explicit lifetime entitlement for selected teacher/school owners, inherited by school teachers. Public signup/profile cannot grant it.

## Deployment

Use an authenticated server session. Inspect the running service, checkout branch, current code changes and database path before updating. Back up the production database and uploads. Do not overwrite a modified checkout blindly.

The existing `deploy/update.sh` expects a root session, an installation at `/opt/better-study`, and a `better-study` service. It fetches and resets the checkout to the application branch, installs Python requirements and restarts the service. It does not build the frontend; this update commits the generated frontend.

After deployment, check `/health`, the home and browser icons, account login, material preview, practice on desktop/mobile, a lesson report, and playback controls. Verify that ordinary paid users still have their normal billing state.

## Permanent access and private invitations

Only a trusted server operator should run this command, from the configured application directory and with its virtual environment:

```bash
.venv/bin/python -m tutor_assistant.provision_access \
  --teacher-email OWNER_EMAIL \
  --school-email SCHOOL_OWNER_EMAIL \
  --school-name 'Your school name' \
  --students 4
```

It reads the application's `.env` database/site settings and grants permanent access only to those owners. Existing passwords remain unchanged. Newly created owners receive expiring, one-use password-setup links in the command's output. Students receive one-use registration invitations and are linked to the teacher; student accounts are free already.

Keep output private: it contains account access links. Never post output to GitHub, CI logs, issues, or public documentation. Share only the appropriate invitation with each recipient. Each invocation with `--students 4` creates four NEW invitations; omit `--students` when only reapplying owner entitlements.

No live accounts are created by a repository commit or CI run.

## Validation

The verification run passed 396 Python tests (2 skipped), playback helper tests, the production frontend build, and Chromium checks at desktop and 320/390/768-pixel widths. Browser checks cover preview width, practice outside the popup, sentence-scoped speech, stopping on checking/exit, and recording start/end/replay.

Run: https://github.com/cata1one/assistant/actions/runs/42907551921

The workflow saves generated frontend assets only after successful checks. It targets the feature branch; it does not deploy to production.
