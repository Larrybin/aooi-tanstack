# Decision Log

|   # | Decision              | Final choice                                                     |
| --: | --------------------- | ---------------------------------------------------------------- |
|   1 | Primary user strategy | SEO-first, secondary students/reading efficiency                 |
|   2 | TTS technology        | Cloudflare Workers AI TTS first                                  |
|   3 | Free strategy         | Guest preview only; MP3 download requires login                  |
|   4 | v1 input              | Plain text only; no PDF/DOCX/web URL                             |
|   5 | SEO page scale        | 10 high-evidence pages + trust/legal                             |
|   6 | Commercial model      | Lifetime plans + Extra Credits                                   |
|   7 | Lifetime meaning      | Monthly quota + extra credits; not unlimited                     |
|   8 | Plan structure        | Free + Lifetime Basic + Lifetime Pro + Extra Credits             |
|   9 | Pricing               | Free 10k/mo, Basic $29/100k/mo, Pro $79/500k/mo, Credits $9/250k |
|  10 | Generator             | Modified standard generator                                      |
|  11 | Languages             | English/Spanish official; FR/DE/JA/PT Beta                       |
|  12 | Payment               | Creem                                                            |
|  13 | Extra Credits expiry  | 12 months                                                        |
|  14 | History retention     | Free 3/3d, Basic 20/30d, Pro 50/90d                              |
|  15 | Charging              | Generate charges; replay/download free                           |
|  16 | Consumption order     | Monthly quota first, Extra Credits second                        |
|  17 | Single request limits | Guest 1500, Free 3500, Basic/Pro 15000                           |
|  18 | Voice tiers           | One standard pool in v1; reserve model_tier                      |
|  19 | Text privacy          | Save first 100 chars only, not full text                         |
|  20 | Guest limit           | 5 previews/IP/day + Turnstile                                    |
|  21 | Homepage              | `/` is main tool page                                            |
|  22 | Language pages        | Do not create language pages; use language selector              |
|  23 | SEO page list         | High-evidence stable set                                         |
|  24 | Brand                 | Text to Speech Generator                                         |
|  25 | Domain strategy       | Precise keyword domain                                           |
|  26 | Domain in SPEC        | Placeholder; production domain TBD                               |
|  27 | Model routing         | EN Aura-2, ES Aura-2, Beta via MeloTTS, config-driven            |
|  28 | Auth                  | Use existing aooi Auth                                           |
|  29 | Safety                | Rule blocking + Terms                                            |
|  30 | Success criteria      | Tool + SEO + payment loop all working                            |
