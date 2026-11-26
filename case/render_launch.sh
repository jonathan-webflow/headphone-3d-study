#!/bin/bash
# filmes de lançamento: o resto do m01 (o 270–480 já saiu com os ajustes finais) e o r01 nos dois formatos
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
run() { $B -b headphone_v019_film.blend -P tools/film_render.py -- "$@" 2>&1 | grep "\[film\] [a-z0-9]* [0-9]*/" | tail -1; }
run m01 1 269
run r01 1 420
run r01f 1 420
echo DONE
