#!/usr/bin/env python3
"""Convert a CSV file to JSON, handling malformed quoting that trips up papaparse."""
import csv, json, sys

with open(sys.argv[1], encoding='utf-8') as f:
    reader = csv.DictReader(f)
    print(json.dumps(list(reader)))
