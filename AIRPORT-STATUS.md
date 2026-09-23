# FAA airport status

The homepage's FAA ATCSCC button opens `airport-status.html`. The page loads
`data/airport-status.json`; GitHub Actions can refresh that saved snapshot on a
schedule. The full FAA page is linked from the dashboard.

## Scheduled GitHub refresh

`.github/workflows/refresh-airport-status.yml` runs the existing updater every 30
minutes, then commits a changed `data/airport-status.json` to the repository's
default branch. It can also be started manually from the repository's **Actions**
tab. No server-side code is needed on the university host.

To activate it:

1. Put this website project in a GitHub repository, including the hidden
   `.github/workflows/refresh-airport-status.yml` file.
2. Make sure the workflow is on the repository's default branch and GitHub
   Actions are enabled.
3. In **Settings → Actions → General**, allow workflows to write repository
   contents if the setting is available.
4. Open **Actions → Refresh FAA airport status → Run workflow** to try one run.

The workflow only needs GitHub's built-in token; no upload password or FAA key
is required. A 30-minute schedule is a compromise between freshness and runner
use. Scheduled runs can be delayed by GitHub and run from the default branch only.

**The GitHub commit does not by itself update a separately hosted university
website.** The university site must either automatically publish from this
repository or have an approved deployment step that uploads the changed JSON.
Ask the university web administrator whether this site deploys from GitHub or
supports an approved automated file upload. Until that connection exists, the
snapshot updates in GitHub but the university-hosted copy remains unchanged.

For GitHub-hosted runners, standard runners are free for public repositories.
Private repositories use the account's included minutes; a 30-minute schedule
is about 1,440 short runs per 30-day month, with billing rounded up per run and
other workflows sharing the same allowance. Check your account's current usage
before increasing the frequency.

## Updater details

Requires Python 3.9+ with only its standard library:

```sh
python3 scripts/update_airport_status.py
```

Optional `--config PATH` and `--output PATH` arguments are supported. Paths default
to this project, independent of the current working directory. Network timeouts,
malformed responses, or parse errors exit nonzero and leave the last good JSON
untouched. Publication on the updater machine uses atomic replacement.

The page's **Reload saved status** button re-downloads the published JSON; it
does not contact ATCSCC. New visitors automatically receive the latest version
that has actually been published to the university site.

Event start and end times are displayed in the affected airport's local time
zone. IANA time-zone IDs are maintained in `airport_time_zones` in
`data/airport-status-config.json`; the browser applies daylight-saving changes.
The snapshot retrieval time remains labeled UTC.

## Filtering and limitations

`data/airport-status-config.json` contains the displayed airport list, airport
time zones, and the updater's airport filter and closure exclusion patterns.
This is a selected list, not an official FAA size classification. The page
includes only airports with qualifying events:

- Active ground stops and ground delay programs.
- Active airport closures, except closures limited to GA/transient GA.
- Active airspace flow programs explicitly associated with a monitored airport.

Routine arrival/departure delay reports, free-form notices, deicing, runway
configurations, unmonitored airports, future programs, and expired programs are
excluded. The FAA currently classifies the LAX/SAN `CLSD TO NON SKED TRANSIENT GA
ACFT` notices as `freeForm`; these are excluded automatically, and closure regexes
also cover that text if it arrives in `airportClosure`.

The feeds used by the public FAA website are:

- https://nasstatus.faa.gov/api/airport-events
- https://nasstatus.faa.gov/api/enroute-events

Their JSON provides full UTC dates, which are more suitable for active-time checks
than the legacy XML's abbreviated closure dates. These public website endpoints
can change; this implementation does not assume a documented stability guarantee.

Regional AFPs are not assigned to airports by guessing geographic impact. CTOPs,
reroutes, and other CDM advisories are **not comprehensively covered**. They require
additional verified feeds and explicit airport-impact rules before inclusion.
Missing start/end times are excluded rather than called active. The page labels
snapshots older than 45 minutes as possibly out of date. Snapshot age measures
retrieval, not the age of each FAA advisory. Empty results mean no matching event
reported, not normal operations.

## Verification

```sh
python3 -m unittest discover -s tests -p 'test_airport_status.py'
```
