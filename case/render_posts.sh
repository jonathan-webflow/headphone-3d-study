#!/bin/bash
# Posts em Cycles (GPU), com o look do site. Rodar depois dos filmes, para não disputar a GPU.
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b headphone_v019_film.blend -P tools/film_render.py -- posts 2>&1 | grep -E "\[film\]|Error|Traceback"
for p in "c02f 240 p04" "c03f 240 p05" "c04f 200 p06" "c05f 240 p07" "c07f 240 p08 - - 0" "c09f 240 p09" "c10f 300 p10 1.35 -0.3 -"; do
  set -- $p
  $B -b headphone_v019_film.blend -P tools/film_render.py -- still "$@" 2>&1 | grep -E "\[film\]|Error|Traceback" | tail -2
done
echo DONE
