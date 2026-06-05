# Risk Register

| Risk                                         | Severity | Mitigation                                                                                     |
| -------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| TTS cost exceeds revenue                     | High     | quota limits, guest rate limit, Turnstile, Extra Credits, config-driven model routing          |
| Lifetime Pro heavy users become unprofitable | High     | monitor usage, avoid unlimited claims, reserve model_tier and credit multiplier support for v2 |
| Cloudflare model quality varies by language  | Medium   | English/Spanish official only; other languages Beta                                            |
| Guest preview abuse                          | High     | 5/IP/day, Turnstile, abuse logging                                                             |
| Thin SEO pages                               | Medium   | only 10 high-evidence pages; unique intent and FAQ per page                                    |
| Saving sensitive user text                   | High     | save only first 100 chars, not full original text                                              |
| Creem webhook duplicate grants               | High     | idempotency and event persistence                                                              |
| Refunds after credit use                     | Medium   | ledger adjustment policy                                                                       |
| User confusion about playback speed          | Medium   | describe speed as player playback speed only                                                   |
| v1 scope creep                               | High     | strict Non-goals list                                                                          |
