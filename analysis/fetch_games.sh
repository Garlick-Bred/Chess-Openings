#!/usr/bin/env bash
# Download every monthly archive for a chess.com user (public API, no key).
#   analysis/fetch_games.sh <username> <out_dir>
set -euo pipefail
USER_NAME="${1:?username}"
OUT="${2:?out dir}"
mkdir -p "$OUT/archives"
curl -sS -A "endgame-trainer-analysis/0.1" "https://api.chess.com/pub/player/$USER_NAME/games/archives" -o "$OUT/archives.json"
python3 -c "import json,sys;[print(u) for u in json.load(open(sys.argv[1]))['archives']]" "$OUT/archives.json" | while read -r url; do
  f="$OUT/archives/$(echo "$url" | awk -F/ '{print $(NF-1)"-"$NF}').json"
  curl -sS --retry 3 -A "endgame-trainer-analysis/0.1" "$url" -o "$f"
  sleep 0.3
done
echo "Downloaded $(ls "$OUT/archives" | wc -l) monthly archives to $OUT/archives"
