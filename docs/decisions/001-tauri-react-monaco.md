# 001 — Tauri 2, React and Monaco

Status: accepted.

Tauri provides the Windows shell and trust boundary. React owns product
surfaces. Monaco remains the plain-text chapter editor so Markdown,
selection, undo, IME and diff behavior remain mature without carrying the
Code-OSS workbench.

The project pins exact npm and Cargo versions. There are no `latest` specifiers
in executable scripts or manifests.
