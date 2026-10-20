#!/usr/bin/env bash
set -euo pipefail

npm ci --prefix app
uv sync
