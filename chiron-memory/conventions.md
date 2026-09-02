# convention

A rule the codebase follows — naming, patterns, and where things live.

## The desktop/device gate blocks phones (coarse pointer + no hover, or a phone user-agent)…

What: The desktop/device gate blocks phones (coarse pointer + no hover, or a phone user-agent) and any viewport below 800×600 CSS px, with 800×600 itself treated as the minimum supported (renders), and 799×600 blocking · Why: — · Where: src/deviceGate.ts <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-3 -->

## This project's Chiron workflow commits work-order changes to `master` and moves the corre…

What: This project's Chiron workflow commits work-order changes to `master` and moves the corresponding board card to Done via the `/chiron-push` command · Why: — · Where: Chiron board / `.chiron/project.json` <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-5 -->

## The desktop/device gate re-evaluates on every window resize (not just once on load), so s…

What: The desktop/device gate re-evaluates on every window resize (not just once on load), so shrinking the window below threshold blocks the game live and enlarging it restores the game without a page reload · Why: — · Where: src/deviceGate.ts, src/main.ts <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-7 -->

## models.User.PasswordHash is tagged json:"-" so it can never leak into API responses or lo…

What: models.User.PasswordHash is tagged json:"-" so it can never leak into API responses or logs, and login failures return a generic 401 without indicating whether the email or the password was wrong · Why: prevents plaintext exposure and account enumeration · Where: light-backend/internal/models/user.go, light-backend/internal/handlers/handlers.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-4 -->

## Password strength rule is minimum 8 characters with at least one letter and one digit; em…

What: Password strength rule is minimum 8 characters with at least one letter and one digit; email is validated with net/mail and normalized to lowercase before the uniqueness check and storage · Why: — · Where: light-backend/internal/validate/validate.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-5 -->
