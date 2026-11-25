#!/bin/sh
set -eu
attempt=1
until mvn -B -U -s /build/maven-settings.xml "$@"; do
    if [ "$attempt" -ge 3 ]; then
        echo 'Maven failed after 3 attempts.' >&2
        exit 1
    fi
    echo "Maven attempt $attempt failed; retrying after a short delay." >&2
    sleep "$((attempt * 15))"
    attempt=$((attempt + 1))
done
