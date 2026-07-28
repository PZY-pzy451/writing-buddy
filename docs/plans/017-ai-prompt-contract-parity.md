# AI prompt contract parity repair

Date: 2026-07-28
Status: Accepted

## Observed failure

The user confirmed that DeepSeek connection and model discovery work, but
Story Kernel generation stops locally with **AI 配置不完整。** before producing
any candidate.

## Root cause

`AiGenerateRequest::validate` intentionally requires the TypeScript and Rust
system prompts to match byte-for-byte before a paid request can leave the
application. Commit `830deedd` strengthened the TypeScript Story Kernel prompt
for plot threads, foreshadowing, and information resources, but the duplicated
Rust constant retained the earlier text. Connection testing does not exercise
this generation contract, so settings can be healthy while every Story Kernel
request is rejected locally as `invalid_configuration`.

## Outcome

1. Make the Rust Story Kernel prompt identical to the TypeScript source.
2. Add a repository-level parity test for every duplicated TypeScript/Rust
   system prompt, not only the currently failing prompt.
3. Keep strict local request validation and the no-network-on-contract-failure
   safety boundary.
4. Verify the exact Story Kernel request accepted by the TypeScript builder
   also passes the Rust validator.
5. Run TypeScript compilation before focused and complete tests.
6. Build a fresh Windows portable executable and installer from the accepted
   commit, then perform isolated native launch/close smoke.

## UX contract

- A working model and credential must never be mislabeled as incomplete due to
  an internal prompt-version mismatch.
- Generation keeps a visible loading state and only exposes candidates after
  the authoritative schema passes.
- No automatic retry or paid request is added.
- Existing error cards retain text, icon, diagnostic detail, 44px controls,
  keyboard focus, and Paper/Midnight support.

## Stop line

- Do not read, reveal, or replace the user's API key.
- Do not send a real paid request during automated validation.
- Do not weaken the Rust prompt/input contract to make the request pass.
- Do not claim provider output quality is verified without a user-authorized
  real request.
