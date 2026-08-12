# lonradio

Live scanner and air traffic control audio for London, Ontario. Static site that embeds public streams from LiveATC, Broadcastify, and Canada.ca — no API keys, no auth, no proxying.

## Channels

| Channel | Source | Frequency / System |
|---|---|---|
| CYXU Tower | LiveATC | 119.4 MHz |
| CYXU Ground | LiveATC | 121.9 MHz |
| London Fire + Public Works | Broadcastify | P25 OneVoice |
| OPP + MTO | Broadcastify | VHF/UHF |
| Weatheradio London | Canada.ca / SDR | 162 MHz VHF |
| LPS Police | — | P25 PSRN, **encrypted** |
| EMS Dispatch | — | P25 PSRN, **encrypted** |

Police and EMS dispatch in London are AES-encrypted on the Ontario Public Safety Radio Network. They cannot be legally received or streamed. The site shows those channels in the sidebar so people understand the gap.

## Stack

- Vanilla HTML / CSS / JS — no build step
- One `Audio` element, Web Audio API for the live spectrum visualizer
- Light/dark theme via CSS custom properties + a toggle
- No backend, no analytics, no cookies beyond a localStorage theme pref

## Run locally

```bash
# Any static server works. Python:
python3 -m http.server 8000

# or Node:
npx serve .
```

Then open <http://localhost:8000>.

## Deploy

Drop on Vercel / Netlify / Cloudflare Pages — it's pure static. No env vars.

## Why embed, not proxy

LiveATC and Broadcastify stream their own bytes and run their own volunteers + infrastructure. Proxying them would burn their bandwidth, break their TOS, and add nothing. The site opens a direct connection from the browser to the source.

## Sources

- LiveATC CYXU: <https://www.liveatc.net/hlisten.php?mount=cyxu1_twr>
- Broadcastify London Fire: <https://www.broadcastify.com/listen/feed/34296>
- Broadcastify OPP: <https://www.broadcastify.com/listen/feed/31107>
- Weatheradio Ontario: <https://www.canada.ca/en/environment-climate-change/services/weatheradio/find-your-network/ontario.html>
- RadioReference (Middlesex): <https://www.radioreference.com/db/browse/ctid/4306>

## License

MIT.