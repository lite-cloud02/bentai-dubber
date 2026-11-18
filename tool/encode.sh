#!/usr/bin/env bash
# Video ko 720p + AES-128 encrypted HLS mein badalta hai aur Backblaze par upload karta hai.
set -euo pipefail
INPUT="${1:?input video file do}"; EP="${2:?episode id do (admin panel se)}"
: "${KEY_SECRET:?KEY_SECRET set karo}" "${SITE_URL:?SITE_URL set karo}"
SITE_URL="${SITE_URL%/}"
command -v ffmpeg >/dev/null || { echo "ffmpeg install karo"; exit 1; }

WORK="$(mktemp -d)"; OUT="${OUT_DIR:-./hls_out/$EP}"; mkdir -p "$OUT"
trap 'rm -rf "$WORK"' EXIT

# Key = HMAC-SHA256(KEY_SECRET, EP) ke pehle 16 bytes (server ke api/_lib.js jaisa hi)
printf '%s' "$EP" | openssl dgst -sha256 -hmac "$KEY_SECRET" -binary > "$WORK/full.bin"
head -c 16 "$WORK/full.bin" > "$WORK/enc.key"
printf '%s\n%s\n' "$SITE_URL/api/key?e=$EP" "$WORK/enc.key" > "$WORK/keyinfo"

ffmpeg -y -i "$INPUT" -map 0:v:0 -map 0:a:0? \
  -vf "scale=-2:720" -c:v libx264 -profile:v high -preset "${PRESET:-slow}" -crf 24 -pix_fmt yuv420p \
  -c:a aac -b:a 96k -ac 2 \
  -hls_time 6 -hls_playlist_type vod -hls_key_info_file "$WORK/keyinfo" \
  -hls_segment_filename "$OUT/seg_%04d.ts" "$OUT/index.m3u8"

echo "HLS ready: $OUT"
if [ -n "${S3_BUCKET:-}" ] && [ -n "${S3_ENDPOINT:-}" ]; then
  AWS_DEFAULT_REGION="${S3_REGION:-us-east-005}" aws s3 sync "$OUT" "s3://$S3_BUCKET/episodes/$EP" --endpoint-url "https://${S3_ENDPOINT#https://}" --delete
  echo "Upload ho gaya: episodes/$EP"
else
  echo "S3_BUCKET / S3_ENDPOINT set nahi hain, upload nahi hua."
  # GitHub Actions mein fail karo, taaki source file bina upload ke delete na ho
  if [ -n "${CI:-}" ]; then echo "ERROR: upload skip hua, isliye run fail kar raha hoon." >&2; exit 1; fi
fi
