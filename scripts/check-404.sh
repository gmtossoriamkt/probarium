#!/bin/bash
# Проверка: несуществующие адреса боевого сайта должны отдавать HTTP 404, существующие — 200.
# Использование: bash scripts/check-404.sh [https://probarium.ru]
BASE="${1:-https://probarium.ru}"
fail=0
check() {
  local path="$1" want="$2"
  local got
  got=$(curl -s -o /dev/null -m 20 -w "%{http_code}" "$BASE/$path")
  if [ "$got" = "$want" ]; then echo "OK   $got  /$path"; else echo "FAIL $got (ожидалось $want)  /$path"; fail=1; fi
}
check "" 200
check "blog/" 200
check "kontakty/" 200
check "net-takoj-stranicy-12345" 404
check "blog/net-takoj-stati-777" 404
check "uslugi/zzz.html" 404
exit $fail
