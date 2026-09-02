# convention

A rule the codebase follows — naming, patterns, and where things live.

## UI HTML (top/side/bottom bars) is placed around the canvas using a CSS grid with the canv…

What: UI HTML (top/side/bottom bars) is placed around the canvas using a CSS grid with the canvas confined to a center cell, instead of relying on z-index/absolute-positioning discipline to avoid overlap · Why: makes it structurally impossible for UI to cover the canvas, satisfying the 'UI never overlaps canvas' requirement by layout rather than convention · Where: index.html, src/style.css. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-2 -->

## Signup rejects a duplicate email with HTTP 409 Conflict (not a generic 400)

What: Signup rejects a duplicate email with HTTP 409 Conflict (not a generic 400) · Why: — · Where: light-backend/internal/handlers/handlers.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-10 -->

## Passwords must never be stored, logged, or returned in plaintext, including in dev/test;…

What: Passwords must never be stored, logged, or returned in plaintext, including in dev/test; `models.User.PasswordHash` is tagged `json:"-"` to prevent accidental exposure in responses · Why: Explicit requirement from the work order, applies even during testing · Where: light-backend/internal/models/user.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-4 -->

## Login failures return an opaque 401 regardless of whether the email exists or the passwor…

What: Login failures return an opaque 401 regardless of whether the email exists or the password is wrong · Why: Prevents account enumeration via differing error messages · Where: light-backend/internal/handlers/handlers.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-5 -->

## Password strength rule is minimum 8 characters with at least one letter and one digit; em…

What: Password strength rule is minimum 8 characters with at least one letter and one digit; email is validated via `net/mail` and stored lowercased with a unique MongoDB index enforcing no duplicates · Why: — · Where: light-backend/internal/validate/validate.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-6 -->
