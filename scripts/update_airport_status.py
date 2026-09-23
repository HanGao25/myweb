#!/usr/bin/env python3
"""Fetch FAA active-event feeds and atomically publish a filtered static JSON file."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'airports': 'https://nasstatus.faa.gov/api/airport-events',
    'enroute': 'https://nasstatus.faa.gov/api/enroute-events',
}


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError('Missing or invalid FAA event timestamp')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('FAA timestamp has no timezone')
    return result


def active(event, now):
    # Missing times fail closed: do not claim a program is currently enforced.
    if not event.get('startTime') or not event.get('endTime'):
        return False
    if event.get('cancelled') or event.get('canceled'):
        return False
    if str(event.get('status', '')).upper() in {'CANCELLED', 'CANCELED', 'EXPIRED'}:
        return False
    return timestamp(event['startTime']) <= now < timestamp(event['endTime'])


def airport_code(value):
    code = str(value or '').upper().strip()
    return code[1:] if len(code) == 4 and code.startswith('K') else code


def normalize(event, kind):
    return {
        'type': kind,
        'reason': event.get('impactingCondition') or event.get('simpleText') or event.get('text') or 'Reason not provided',
        'start': event['startTime'], 'end': event['endTime'],
        'averageDelayMinutes': event.get('avgDelay'),
        'maximumDelayMinutes': event.get('maxDelay'),
        'updatedAt': event.get('sourceTimeStamp') or event.get('updatedAt'),
        'advisoryUrl': event.get('advisoryUrl'),
    }


def build_snapshot(airports, enroute, config, now):
    if not isinstance(airports, list) or not isinstance(enroute, list):
        raise ValueError('FAA feeds must be arrays; previous JSON retained')
    allowed = set(config['airports'])
    patterns = [re.compile(p, re.I) for p in config['excluded_closure_patterns']]
    results = {}
    names = {}
    for row in airports:
        if not isinstance(row, dict) or not row.get('airportId'):
            raise ValueError('Unexpected airport feed record')
        code = airport_code(row['airportId'])
        names[str(row.get('airportLongName', '')).upper()] = code
        if code not in allowed:
            continue
        events = []
        for field, label in [('groundStop', 'Ground stop'), ('groundDelay', 'Ground delay program'), ('airportClosure', 'Airport closure')]:
            event = row.get(field)
            if not event or not active(event, now):
                continue
            reason = ' '.join(str(event.get(k) or '') for k in ('simpleText', 'text', 'impactingCondition'))
            if field == 'airportClosure' and any(p.search(reason) for p in patterns):
                continue
            events.append(normalize(event, label))
        # freeForm, routine delays, configurations, and deicing are intentionally excluded.
        if events:
            results[code] = {'code': code, 'name': row.get('airportLongName') or code, 'events': events}
    unmapped = 0
    for row in enroute:
        if not isinstance(row, dict):
            raise ValueError('Unexpected en-route feed record')
        event = row.get('airspaceFlowProgram')
        if not event or not active(event, now):
            continue
        fca = row.get('fcaAirport') or {}
        target = fca.get('fcaAirportName', '')
        code = names.get(str(target).upper()) or airport_code(target)
        # A geographic FCA does not prove that every nearby airport is affected.
        if code not in allowed:
            unmapped += 1
            continue
        result = results.setdefault(code, {'code': code, 'name': target or code, 'events': []})
        item = normalize(event, 'Airspace flow program')
        item['advisoryUrl'] = row.get('advisoryUrl') or item['advisoryUrl']
        result['events'].append(item)
    return {
        'schemaVersion': 1, 'fetchedAt': now.isoformat(),
        'source': 'https://nasstatus.faa.gov', 'sources': SOURCES,
        'monitoredAirports': sorted(allowed),
        'coverage': 'Active ground stops, ground delay programs, airport-wide closures, and airport-linked airspace flow programs. Excludes routine delays and GA-only notices. Regional AFPs, CTOPs, reroutes, and other advisories are not comprehensively covered.',
        'unmappedAirspacePrograms': unmapped,
        'airports': [results[code] for code in sorted(results)],
    }


def fetch(url):
    request = Request(url, headers={'User-Agent': 'AirportStatusDashboard/1.0', 'Accept': 'application/json'})
    with urlopen(request, timeout=30) as response:
        data = response.read(5_000_001)
    if len(data) > 5_000_000:
        raise ValueError('FAA response exceeds size limit')
    return json.loads(data)


def publish(snapshot, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=destination.parent, delete=False) as out:
            temporary = out.name
            json.dump(snapshot, out, ensure_ascii=False, indent=2)
            out.write('\n')
        os.chmod(temporary, 0o644)
        os.replace(temporary, destination)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=ROOT / 'data/airport-status-config.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'data/airport-status.json')
    args = parser.parse_args()
    try:
        config = json.loads(args.config.read_text())
        airports = fetch(SOURCES['airports'])
        enroute = fetch(SOURCES['enroute'])
        snapshot = build_snapshot(airports, enroute, config, datetime.now(timezone.utc))
        publish(snapshot, args.output)
    except Exception as error:
        print(f'Update failed; previous JSON retained: {error}', file=sys.stderr)
        return 1
    print(f'Updated {args.output}: {len(snapshot["airports"])} airports with active events')
    return 0


if __name__ == '__main__':
    sys.exit(main())
