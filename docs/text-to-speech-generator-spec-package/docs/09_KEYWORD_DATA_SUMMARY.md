# Keyword Data Summary

Source file: `inputs/KeywordStats_6_5_2026.csv`

The source CSV contains only three fields: `Keyword`, `Trends`, and `Impressions`. It supports demand sizing and page-priority decisions. It does **not** provide KD, CPC, paid competition, backlink difficulty, or SERP weakness.

## Top Keywords by Impressions

| Keyword                 | Impressions | Trends                                                                            |
| ----------------------- | ----------: | --------------------------------------------------------------------------------- |
| online text to speech   |     691,111 | `[10405,45489,31791,10408,46907,67399,68975,69744,67854,67184,41677,66355,96923]` |
| tts                     |     123,997 | `[10027,10010,9952,10147,8534,8204,9351,10590,10198,9165,10087,9996,7736]`        |
| voice                   |     114,321 | `[9327,9073,8953,8871,9125,8823,9065,8491,8416,8498,8771,8765,8143]`              |
| ttsmaker                |     110,812 | `[7156,8227,8629,8468,8251,8574,9466,9352,7545,7893,8745,9588,8918]`              |
| reader                  |      52,749 | `[4364,4824,4333,4272,3686,3974,4160,4172,3604,3687,4035,3869,3769]`              |
| speech                  |      51,048 | `[4138,4045,3892,3912,3538,3746,4118,4077,3652,4058,4096,4049,3727]`              |
| read aloud              |      39,743 | `[3100,3092,2887,2998,2665,2846,3179,3335,3488,3307,3115,3129,2602]`              |
| 文字转语音              |      36,751 | `[2520,2798,3171,2991,2714,2827,2987,3060,2461,2804,2703,2926,2789]`              |
| ai voice generator      |      33,580 | `[2616,2489,2465,2539,2630,2539,2587,2681,2739,2636,2531,2557,2571]`              |
| luvvoice                |      28,597 | `[1890,2226,2225,6592,1888,1873,1721,1705,1652,1728,1621,1765,1711]`              |
| text to speech free     |      28,391 | `[2394,2592,2342,2307,2042,2180,2120,2001,2113,2103,2181,2067,1949]`              |
| ai voice                |      19,790 | `[1612,1554,1551,1575,1516,1529,1473,1475,1459,1603,1493,1511,1439]`              |
| text to voice           |      15,312 | `[1234,1198,1086,1300,1264,1150,1126,1224,1225,1154,1131,1193,1027]`              |
| tts maker               |      13,378 | `[992,1039,847,912,919,910,1053,1140,1037,1212,1134,1131,1052]`                   |
| ttsreader               |      11,875 | `[933,949,939,1025,840,882,1004,1017,873,987,849,826,751]`                        |
| free text to speech     |      11,180 | `[950,871,809,793,740,744,693,883,858,1099,1009,913,818]`                         |
| texto a voz             |      10,567 | `[747,945,789,724,552,779,981,957,765,809,824,846,849]`                           |
| text to speech online   |      10,204 | `[480,512,431,397,358,361,376,366,2679,1780,954,795,715]`                         |
| text to speech ai       |       9,554 | `[828,784,777,880,762,740,688,702,658,721,739,677,598]`                           |
| text to audio           |       8,627 | `[782,686,620,638,592,651,651,648,668,692,714,684,601]`                           |
| text reader             |       7,416 | `[697,661,633,562,513,557,609,592,536,559,524,492,481]`                           |
| ai voice text to speech |       7,191 | `[544,561,577,589,567,542,565,568,579,540,505,506,548]`                           |
| tts online              |       6,758 | `[626,573,582,571,415,443,427,504,597,571,543,557,349]`                           |
| voice over              |       6,752 | `[521,534,511,452,457,497,533,531,521,556,586,582,471]`                           |
| voice generator         |       6,734 | `[512,501,526,543,549,500,451,537,510,543,508,510,544]`                           |
| ai text to speech       |       6,630 | `[509,583,531,514,480,552,585,516,499,501,448,502,410]`                           |
| google text to speech   |       6,413 | `[537,447,416,519,458,553,594,601,611,498,401,408,370]`                           |
| ai reader               |       6,259 | `[524,542,494,492,458,445,471,498,533,484,479,429,410]`                           |
| read out loud           |       6,063 | `[473,472,454,503,433,424,458,496,507,518,445,467,413]`                           |
| read aloud text         |       6,054 | `[528,512,475,412,382,430,468,504,513,533,432,451,414]`                           |

## Decision From This Data

The dataset strongly supports using the homepage `/` for **Online Text to Speech Generator**, not only the narrower phrase **Text to Speech Generator**.

Recommended v1 page matrix:

| URL                          | Primary intent                                             |
| ---------------------------- | ---------------------------------------------------------- |
| `/`                          | online text to speech / text to speech generator           |
| `/free-text-to-speech/`      | free text to speech / text to speech free                  |
| `/read-aloud/`               | read aloud / read text aloud / read out loud               |
| `/text-reader/`              | text reader / ai reader / online reader                    |
| `/ai-text-to-speech/`        | ai text to speech / text to speech ai / ai voice generator |
| `/tts-online/`               | tts online / free tts / tts tool                           |
| `/text-to-voice/`            | text to voice / voice generator / voice maker              |
| `/text-to-audio/`            | text to audio / text to speech download                    |
| `/text-to-speech-converter/` | text to speech converter / convert text to speech          |
| `/voice-generator/`          | voice generator / narrator voice / robot text to speech    |

## Pages Explicitly Deferred

The following page ideas are not recommended for v1 because the keyword evidence is weak in this file or the product capability is not implemented in v1:

- `/pdf-to-speech/`
- `/document-reader/`
- `/article-to-audio/`
- `/study-notes-to-speech/`
- `/proofreading-text-to-speech/`
- `/accessibility-text-to-speech/`
- `/dyslexia-text-reader/`
- language-specific pages such as `/spanish-text-to-speech/`

## Brand / Competitor Terms

The CSV contains high-impression competitor or brand terms such as `ttsmaker`, `luvvoice`, `google text to speech`, `natural reader text to speech`, and `elevenlabs text to speech`. These are deferred for v1 because they are navigation-heavy, may have trademark risk, and are not necessary for the initial product scope.
