"""Import an approved organization unit without creating demo accounts or events."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
from postgres_client import command_prefix

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--docker', action='store_true')
    parser.add_argument('--project')
    parser.add_argument('--compose-file', default='compose.yaml')
    parser.add_argument('--unit-name', required=True)
    args = parser.parse_args()
    name = args.unit_name.strip()
    if not 1 <= len(name) <= 150 or '\x00' in name:
        parser.error('Unit name must contain 1..150 characters.')
    try:
        prefix = command_prefix(args.docker, args.project, args.compose_file)
    except ValueError as error:
        parser.error(str(error))
    # ASCII hex avoids Windows psql argv code-page conversion. No user text is interpolated into SQL.
    initialize = f"SELECT convert_from(decode('{name.encode('utf-8').hex()}','hex'),'UTF8') AS unit_name\n\\gset\n"
    sql = initialize + (ROOT / 'database/seeds/production_catalog.sql').read_text(encoding='utf-8')
    environment = {**os.environ, 'PGCLIENTENCODING': 'UTF8'}
    subprocess.run(prefix + ['psql', '-X', '-v', 'ON_ERROR_STOP=1'], input=sql.encode('utf-8'),
                   cwd=ROOT, env=environment, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    print('Organization unit imported. Existing accounts and events were preserved.')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError:
        sys.exit('Catalog import failed. Check PostgreSQL access and permissions; credentials were not printed.')
