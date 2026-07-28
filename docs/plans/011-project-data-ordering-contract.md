# Project data ordering contract

Updated: 2026-07-28

## Canonical order

For current-schema projects, order is explicit:

1. volume order is the array order of `WritingProject.volumes`;
2. chapter order is the array order of each `VolumeDescriptor.chapters`;
3. chapter files remain at their existing project-relative paths;
4. filesystem enumeration and filename sorting are never authoritative.

The canonical manifest is `.writing-buddy/project.json`.

## Compatibility exception

The early-project reader discovers folders and Markdown files only to expose a
legacy project in read-only mode. Its sorted filesystem order is a migration
input, not an editable ordering contract. A future explicit migration must
materialize that order into the current manifest before structural editing.

## Creation

Y2 project creation writes current-schema projects directly. Template choice
affects initial structure but never changes the ordering mechanism. If a first
chapter is selected, a first volume is required and the manifest stores both
in their intended array order.

## Future movement

Y3 movement must:

- load the current manifest and project revision;
- validate a typed `MoveCommand`;
- update only the relevant arrays;
- preserve IDs and chapter filenames;
- commit through a verified atomic write;
- reject stale revisions;
- return an inverse command for session undo.

Renaming manuscript files to simulate order is prohibited.

## Scene and Story Kernel order

Scene and Story Kernel ordering are separate domain concerns. Y3 must first
map the existing scene/resource models and may introduce a versioned ordering
manifest only if those models cannot represent the required order. It must not
reuse directory enumeration as persisted state.

## Restart guarantee

After a successful creation or future move, reopening the project must produce
the same manifest array order. The undo stack itself may remain session-only.

