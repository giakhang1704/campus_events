"""Shared PostgreSQL CLI setup; credentials stay in environment variables."""
import os


def command_prefix(docker, project=None, compose_file='compose.yaml'):
    if not docker:
        if not all(os.environ.get(name) for name in ('PGHOST', 'PGUSER', 'PGDATABASE')):
            raise ValueError('Set PGHOST, PGUSER and PGDATABASE; use PGPASSWORD/.pgpass for authentication.')
        return []
    prefix = ['docker', 'compose', '-f', compose_file]
    if project:
        prefix += ['-p', project]
    # Constant shell code, with arguments passed through "$@" rather than interpolation.
    return prefix + ['exec', '-T', 'db', 'sh', '-c',
                     'export PGHOST=127.0.0.1 PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD" PGDATABASE="$POSTGRES_DB" PGCLIENTENCODING=UTF8; exec "$@"', 'sh']
