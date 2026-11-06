#!/usr/bin/env bash
# Peragaan REST API untuk presentasi. Jalankan setelah `php artisan serve` (port 8000).
# Pemakaian: EMAIL=admin@demo.test PASSWORD='...' bash docs/demo-rest.sh
set -u
BASE=${BASE:-http://localhost:8000}
ORIGIN=${ORIGIN:-http://localhost:5173}   # harus termasuk SANCTUM_STATEFUL_DOMAINS
JAR=$(mktemp)
H=(-H "Accept: application/json" -H "Origin: $ORIGIN" -H "Referer: $ORIGIN/" -b "$JAR" -c "$JAR")
xsrf() { grep XSRF-TOKEN "$JAR" | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))'; }
call() { # call METODE PATH [JSON]
  local m=$1 p=$2 d=${3:-}
  echo; echo "### $m $p ${d:+  body: $d}"
  if [ -n "$d" ]; then
    curl -s -o /tmp/body -w "HTTP %{http_code}  (Content-Type: %{content_type})\n" -X "$m" "$BASE$p" "${H[@]}" -H "X-XSRF-TOKEN: $(xsrf)" -H "Content-Type: application/json" -d "$d"
  else
    curl -s -o /tmp/body -w "HTTP %{http_code}  (Content-Type: %{content_type})\n" -X "$m" "$BASE$p" "${H[@]}" -H "X-XSRF-TOKEN: $(xsrf)"
  fi
  python3 -m json.tool /tmp/body 2>/dev/null | head -${LINES_MAX:-14}
}

echo "== 1. Tanpa login: harus 401 =="; call GET /api/v1/courses
curl -s -o /dev/null "$BASE/sanctum/csrf-cookie" "${H[@]}"
echo; echo "== 2. Login =="; call POST /api/v1/auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
echo; echo "== 3. CREATE -> 201 =="; call POST /api/v1/courses '{"type":"academic","title":"Kursus Peragaan REST","description":"Dibuat oleh skrip demo"}'
ID=$(python3 -c 'import json;print(json.load(open("/tmp/body"))["data"]["id"])')
echo; echo "== 4. READ (daftar + summary) -> 200 =="; LINES_MAX=30 call GET "/api/v1/courses?q=Peragaan"
echo; echo "== 5. READ satu resource -> 200 =="; call GET "/api/v1/courses/$ID"
echo; echo "== 6. UPDATE sebagian (PATCH) -> 200 =="; call PATCH "/api/v1/courses/$ID" '{"title":"Kursus Peragaan (diubah)"}'
echo; echo "== 7. Validasi gagal -> 422 =="; call POST /api/v1/courses '{"type":"bukan-jenis","title":""}'
echo; echo "== 8. DELETE -> 200 =="; call DELETE "/api/v1/courses/$ID"
echo; echo "== 9. Resource sudah hilang -> 404 =="; call GET "/api/v1/courses/$ID"
echo; echo "== 10. Metode tidak didukung -> 405 (lihat header Allow) =="; call PUT /api/v1/courses
