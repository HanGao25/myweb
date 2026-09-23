import copy
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('updater', ROOT / 'scripts/update_airport_status.py')
u = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u)
NOW = datetime(2026, 9, 22, 21, 0, tzinfo=timezone.utc)
CONFIG = json.loads((ROOT / 'data/airport-status-config.json').read_text())

def event(**overrides):
    data = {'startTime': '2026-09-22T20:00:00Z', 'endTime': '2026-09-22T23:00:00Z', 'impactingCondition': 'Weather', 'avgDelay': 0}
    data.update(overrides)
    return data

class AirportStatusTests(unittest.TestCase):
    def build(self, airports, enroute=None):
        return u.build_snapshot(airports, enroute or [], CONFIG, NOW)

    def test_major_airports_and_simultaneous_programs(self):
        result = self.build([{'airportId': 'KBOS', 'groundStop': event(), 'groundDelay': event()}, {'airportId': 'ALO', 'groundStop': event()}])
        self.assertEqual([a['code'] for a in result['airports']], ['BOS'])
        self.assertEqual(len(result['airports'][0]['events']), 2)
        self.assertEqual(result['airports'][0]['events'][0]['averageDelayMinutes'], 0)

    def test_exact_ga_notice_and_normal_delays_excluded(self):
        for reason in ['AD AP CLSD TO NON SKED TRANSIENT GA ACFT EXC PPR', 'Closed TO NON SKED TRANSIENT GA ACFT', 'CLOSED TO GENERAL AVIATION']:
            result = self.build([{'airportId': 'LAX', 'airportClosure': event(simpleText=reason), 'freeForm': event(), 'departureDelay': event()}])
            self.assertEqual(result['airports'], [])

    def test_full_closure_included(self):
        result = self.build([{'airportId': 'LAX', 'airportClosure': event(simpleText='AD AP CLSD EXC EMERG')}])
        self.assertEqual(result['airports'][0]['events'][0]['type'], 'Airport closure')

    def test_only_current_programs(self):
        for changes in [{'startTime': '2026-09-22T22:00:00Z'}, {'endTime': '2026-09-22T21:00:00Z'}, {'cancelled': True}, {'status': 'CANCELED'}, {'endTime': None}]:
            self.assertEqual(self.build([{'airportId': 'BOS', 'groundStop': event(**changes)}])['airports'], [])

    def test_airport_afp_vs_unmapped_region(self):
        result = self.build([], [{'airspaceFlowProgram': event(), 'fcaAirport': {'fcaAirportName': 'JFK'}}, {'airspaceFlowProgram': event(), 'polygon': {}}])
        self.assertEqual(result['airports'][0]['code'], 'JFK')
        self.assertEqual(result['unmappedAirspacePrograms'], 1)

    def test_invalid_response_is_not_empty_success(self):
        for invalid in [{}, None, 'unavailable']:
            with self.assertRaises(ValueError): self.build(invalid)
        with self.assertRaises(ValueError): self.build([{'airportId': 'BOS', 'groundDelay': event(startTime='bad')}])

    def test_atomic_snapshot_and_failed_fetch_preserves_file(self):
        import unittest.mock as mock
        with tempfile.TemporaryDirectory() as temp:
            dest = Path(temp) / 'status.json'
            u.publish(self.build([]), dest)
            original = dest.read_bytes()
            with mock.patch('sys.argv', ['updater', '--output', str(dest)]), mock.patch.object(u, 'fetch', side_effect=OSError('network down')):
                self.assertEqual(u.main(), 1)
            self.assertEqual(dest.read_bytes(), original)
            self.assertEqual(len(list(Path(temp).iterdir())), 1)

if __name__ == '__main__': unittest.main()
