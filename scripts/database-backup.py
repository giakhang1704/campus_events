"""Binary-safe PostgreSQL backup and restore rehearsal; never overwrites an existing database.

Local Docker: python scripts/database-backup.py --docker backup
Native/cloud: use PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, PGSSLMODE (no secret URL argument).
"""
import argparse
import hashlib
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone
from postgres_client import command_prefix

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--docker', action='store_true')
    parser.add_argument('--project', help='Isolated Compose project, if different from the default')
    parser.add_argument('--compose-file', default='compose.yaml')
    actions = parser.add_subparsers(dest='action', required=True)
    backup = actions.add_parser('backup')
    backup.add_argument('--output', type=Path)
    restore = actions.add_parser('restore')
    restore.add_argument('--input', type=Path, required=True)
    restore.add_argument('--target-db', required=True, help='NEW database named bkevent_restore_<suffix>')
    args = parser.parse_args()

    try:
        prefix = command_prefix(args.docker, args.project, args.compose_file)
    except ValueError as error:
        parser.error(str(error))

    def run(command, **kwargs):
        return subprocess.run(prefix + command, cwd=ROOT, check=True, **kwargs)

    def query(sql, database=None):
        cmd = ['psql', '-X', '-tA', '-v', 'ON_ERROR_STOP=1']
        if database:
            cmd += ['--dbname', database]
        # Do not print raw server error messages: they may include connection details.
        return run(cmd + ['-c', sql], capture_output=True).stdout.decode().strip()

    if args.action == 'backup':
        target = args.output or ROOT / '.backups' / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.dump')
        target = target.resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() or target.with_suffix(target.suffix + '.sha256').exists():
            parser.error('Output already exists. Choose a new filename.')
        # Exclusive open and direct bytes avoid PowerShell text redirection corrupting custom archives.
        created = False
        try:
            with target.open('xb') as stream:
                created = True
                run(['pg_dump', '--format=custom', '--no-owner', '--no-acl', '--schema=campus'], stdout=stream, stderr=subprocess.PIPE)
        except Exception:
            if created:
                target.unlink(missing_ok=True)  # only the file this invocation created
            raise
        with target.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        with target.with_suffix(target.suffix + '.sha256').open('x', encoding='ascii') as stream:
            stream.write(digest + '\n')
        print(f'Backup created: {target}\nSHA-256: {digest}')
        return

    source = args.input.resolve(strict=True)
    checksum = source.with_suffix(source.suffix + '.sha256').read_text(encoding='ascii').strip()
    with source.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != checksum:
            parser.error('Checksum mismatch; no database was created.')
    target = args.target_db
    if not re.fullmatch(r'bkevent_restore_[a-z0-9_]{1,40}', target):
        parser.error('Target must be a NEW database named bkevent_restore_<lowercase suffix>.')
    source_database = query('SELECT current_database()')
    if target == source_database:
        parser.error('Cannot restore over the source database.')
    # createdb fails if the target already exists. No DROP DATABASE, --clean or overwrite path.
    run(['createdb', '--maintenance-db', source_database, target], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        with source.open('rb') as stream:
            run(['pg_restore', '--dbname', target, '--single-transaction', '--exit-on-error', '--no-owner', '--no-acl'], stdin=stream, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        tables = query("SELECT count(*) FROM information_schema.tables WHERE table_schema='campus' AND table_type='BASE TABLE' AND table_name <> 'flyway_schema_history'", target)
        if tables != '15':
            raise RuntimeError('Restored schema does not contain the expected 15 business tables.')
        counts = query("SELECT json_build_object('users',(SELECT count(*) FROM campus.users),'events',(SELECT count(*) FROM campus.events),'registrations',(SELECT count(*) FROM campus.registrations),'attendance',(SELECT count(*) FROM campus.attendance))", target)
        print(f'Restored into NEW database: {target}\n15 business tables; row counts: {counts}')
        print('Run the app against this isolated database and verify login, QR, reports/CSV before accepting the backup.')
    except Exception:
        print(f'Restore failed. Target {target} is retained for inspection; source was not changed.', file=sys.stderr)
        raise


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError:
        sys.exit('PostgreSQL command failed. Check client tools, server access and permissions; credentials were not printed.')
