# Analytics

The site counts views and a few clicks with no analytics service, no cookie and no third-party
origin. The store is Firebase Hosting's own request log.

## What is sent

`src/scripts/beacon.ts` sends one `GET /e?c=<event>` per event. `/e` is an empty file in `public/`,
served `no-store` (`firebase.json`) so every request reaches the host and is logged.

| Event                    | When                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `view`                   | The page loaded and its script ran. `&r=<host>` if referred.      |
| `flip.<card>`            | A card was turned to its back.                                    |
| `out.<card\|bar>.<host>` | A link that leaves the site was pressed (`.mail` for an address). |
| `tear`, `copy`           | The ticket stub was torn off; the address was copied.             |

Each event is sent once per page load. Nothing is sent when the browser sends Global Privacy
Control or Do Not Track. Nothing is stored in the browser, so there is no consent banner to show.
A referrer is cut down to its host.

The log line itself carries what any web server sees: time, IP address, user agent, country and
city. Cloud Logging keeps it 30 days by default.

## Turning it on (once)

Linked on 2026-11-25. If it ever has to be done again: Firebase console → Project settings →
Integrations → **Cloud Logging** → Link, and tick the `portfolio-rick-groot` site. It needs no paid
plan. While it is not linked the beacons are requested and recorded nowhere.

A request usually shows up in the log within 30 minutes, not at once, and only requests made after
linking are there. An empty result straight after a visit means wait, not broken.

## Reading it

Logs Explorer, with this query:

```
resource.type="firebase_domain" AND httpRequest.requestUrl:"/e?c="
```

Or as totals in the terminal (needs the `gcloud` CLI, signed in):

```bash
gcloud logging read 'resource.type="firebase_domain" AND httpRequest.requestUrl:"/e?c="' \
  --project portfolio-rick-groot --freshness 30d --limit 100000 --format json | pnpm -s stats
```

`scripts/stats.mjs` prints views and visitors per day, where views came from, and a count per
event. A visitor is an IP address and user agent on one day, hashed in memory and never printed.
Bots that announce themselves are left out; `view` is only sent by a browser that ran the script,
which already drops most crawlers.

## Limits

- Anyone can request `/e` with any query. The script counts only well-formed events, but the
  numbers are an indication, not an audit.
- 30 days of history, unless a log sink to BigQuery is added.
- No sessions, no funnels, no unique visitors across days. That is on purpose.

## Adding an event

Call `mark('name')` from `beacon.ts` where the thing happens, add a row above and a case in
`tests/e2e/beacon.spec.ts`. Names are lower-case words joined by dots. Never put text a visitor
typed, or anything that identifies one, in an event name.
