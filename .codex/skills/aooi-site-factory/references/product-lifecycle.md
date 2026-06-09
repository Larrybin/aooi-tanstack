# Product Lifecycle Reference

Use this reference before building upload, conversion, compression, generation,
preview, or media-processing tools.

## Async Lifecycle Invariants

For upload, convert, compress, generate, and preview tools:

- All file entry points must call one `chooseFile`-style entry or equivalent centralized selection path.
- Each selection must have a `selectionId` or equivalent token.
- Each processing run must have an `operationId` or equivalent token.
- Async continuations must not update state unless their token is still current.
- Cancel must cover loading and processing phases.
- Failed replacement must clear stale file/result state or prevent processing.
- Object URLs must have explicit ownership and only be revoked on replace, remove, or unmount.
- Browse, drop, paste, sample, and retry entry points must share the same busy/disabled constraints.
- Settings that affect an in-flight operation must be frozen or guarded while the operation is active.
- Successful results must be cleared when settings change before a new run.

These are invariants, not a mandate to use one specific reducer shape. Use a
reducer/state machine when it simplifies the final code, but a direct
`selectionId`/`operationId` pattern is acceptable for small tools.

## Media Encoding Semantics

UI wording must match generated command arguments. Add parameter-level tests for
encoding decisions instead of relying on manual browser checks.

Examples:

- A resolution option must never upscale smaller videos.
- `Audio Keep` must copy/map original audio streams, or the UI must not say "Keep".
- `Audio Remove` must remove audio.
- Target-size controls must affect the generated bitrate arguments.
- Local-only processing must not call remote APIs for the primary file.

Prefer tests such as:

```text
720p input + 1080p option => no scale
4k input + 1080p option => scale down
audio=keep => -map 0:a? + -c:a copy
audio=reduce => AAC with reduced bitrate
audio=remove => -an
```
