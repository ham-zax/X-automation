#!/usr/bin/env python3
"""Bridge anonymous cookie bytes to a seekable Linux memfd, then exec Lightpanda.

No cookie bytes are written to disk or exposed in argv, env, logs, or temp files.
The browser receives a proc-fd path to a memory-backed, inherited descriptor.
"""
import os
import sys


def main():
    if len(sys.argv) != 2 or not sys.argv[1].startswith('/'):
        raise SystemExit('Expected an absolute Lightpanda executable path')
    parts = []
    size = 0
    while True:
        chunk = os.read(3, 65536)
        if not chunk:
            break
        size += len(chunk)
        if size > 2_000_000:
            raise SystemExit('Authentication snapshot exceeded secure handoff limit')
        parts.append(chunk)
    if not size:
        raise SystemExit('No authentication snapshot supplied')
    fd = os.memfd_create('xgrowth-lightpanda-cookie', flags=0)
    os.write(fd, b''.join(parts))
    os.lseek(fd, 0, os.SEEK_SET)
    os.set_inheritable(fd, True)
    exe = sys.argv[1]
    os.execve(exe, [exe, 'mcp', '--cookie', f'/proc/self/fd/{fd}'], os.environ)


if __name__ == '__main__':
    main()
