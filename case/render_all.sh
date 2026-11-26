#!/bin/bash
# Render completo dos comerciais (EEVEE). Retoma: clipes completos com a marca .new são pulados,
# e um clipe pela metade continua do primeiro quadro que falta.
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
CLIPS="${@:-c01 c02 c03 c04 c05 c06 c07 c08 c09 c10 c01f c02f c03f c04f c05f c06f c07f c08f c09f c10f}"
for c in $CLIPS; do
  d=case/renders/$c; mkdir -p $d
  case $c in c01*|c08*|c10*) n=300;; *) n=240;; esac
  [ -f $d/.new ] && [ $(ls $d/*.png 2>/dev/null | wc -l) -ge $n ] && { echo "[film] $c pronto"; continue; }
  if [ ! -f $d/.new ]; then rm -f $d/*.png; touch $d/.new; fi
  start=1; while [ -f $d/$(printf %04d $start).png ]; do start=$((start+1)); done
  $B -b headphone_v019_film.blend -P tools/film_render.py -- $c $start $n 2>&1 | grep "\[film\]" | tail -1
done
echo DONE
