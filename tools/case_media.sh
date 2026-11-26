#!/bin/bash
# Gera as versões leves da página /case a partir de case/out e previews/.
# Pode rodar de novo a qualquer momento: refaz só o que mudou.
set -e
cd "$(dirname "$0")/.."
OUT=web/case/media; mkdir -p $OUT/films $OUT/posts $OUT/process
newer() { [ ! -f "$2" ] || [ "$1" -nt "$2" ]; }

# processo: só renders e prints nossos (refs/ com fotos oficiais fica de fora)
for f in 01_blockout.png 02_concha.png 03_janela.png 05a_conjunto.png 06_render_v1.png 06_render_v3.png 07_explodida.png 07b_sequencia.png; do
  dst=$OUT/process/${f%.*}.jpg
  newer previews/$f $dst && ffmpeg -v error -y -i previews/$f -vf "scale='min(1600,iw)':-2" -q:v 4 $dst
done

# comerciais: 9:16 em 540×960, mudos, com início rápido; pôster no meio do clipe
for v in case/out/commercials/*_9x16.mp4; do
  n=$(basename $v _9x16.mp4); dst=$OUT/films/$n.mp4
  [ "$n" = s01_site ] && continue   # o site em uso saiu do /case (lá entram prints nítidos e o link para o site)
  if newer $v $dst; then
    ffmpeg -v error -y -i $v -an -vf scale=540:960 -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -movflags +faststart $dst
    case $n in l01_reveal) ss=14.5;; l02_macro) ss=7.5;; *) ss=2.6;; esac   # o reveal começa no escuro: pôster com o fone já aceso
    ffmpeg -v error -y -ss $ss -i $v -frames:v 1 -vf scale=540:960 -q:v 4 $OUT/films/$n.jpg
  fi
done
# abertura: o teardown em 4:5
v=case/out/commercials/c08_teardown_4x5.mp4; dst=$OUT/films/hero_4x5.mp4
if newer $v $dst; then
  ffmpeg -v error -y -i $v -an -vf scale=864:1080 -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart $dst
  ffmpeg -v error -y -ss 8 -i $v -frames:v 1 -vf scale=864:1080 -q:v 3 $OUT/films/hero_4x5.jpg
fi

# posts: 4:5 em 864×1080
for p in case/out/posts/*.jpg; do
  dst=$OUT/posts/$(basename $p | tr 'A-Z' 'a-z')
  newer $p $dst && ffmpeg -v error -y -i $p -vf scale=864:1080 -q:v 3 $dst
done

# 3D breakdown: renders com fundo transparente compostos sobre o preto da página (#0b0b0b), recortados no produto
B=case/renders/breakdown; D=$OUT/breakdown; mkdir -p $D
comp() {   # comp <png> <saída.jpg> <cor de fundo> <recorte w:h:x:y> <escala w:h>
  newer $1 $2 && ffmpeg -v error -y -f lavfi -i "color=c=$3:s=1080x1350" -i $1 \
    -filter_complex "[0][1]overlay=shortest=1,crop=$4,scale=$5:flags=lanczos" -frames:v 1 -q:v 3 $2
  return 0
}
comp $B/wire_hero.png $D/wire_hero.jpg 0x0b0b0b 1080:1350:0:0 864:1080
comp $B/wire_bezel.png $D/wire_bezel.jpg 0x0b0b0b 1080:1350:0:0 864:1080
for l in hdri studio strips all; do comp $B/light_$l.png $D/light_$l.jpg 0x0b0b0b 1000:1000:40:234 720:720; done
comp $B/stage_1_clay.png $D/stage_1_clay.jpg 0x2b2b2b 560:700:255:264 640:800
for s in 2_color 3_light 4_final; do comp $B/stage_$s.png $D/stage_$s.jpg 0x0b0b0b 560:700:255:264 640:800; done
for m in alu_graphite_satin titanium_dark leather_pu_black foam_gray fabric_black plastic_softtouch_dark; do
  newer $B/mat_$m.png $D/mat_$m.jpg && ffmpeg -v error -y -f lavfi -i "color=c=0x0b0b0b:s=1000x1000" -i $B/mat_$m.png \
    -filter_complex "[0][1]overlay=shortest=1,crop=760:760:120:120,scale=520:520:flags=lanczos" -frames:v 1 -q:v 3 $D/mat_$m.jpg
done
for t in alu_blast_n leather_n foam_n fabric_n; do
  newer web/tex/$t.webp $D/tex_$t.jpg && ffmpeg -v error -y -i web/tex/$t.webp -vf "scale=360:360:force_original_aspect_ratio=increase,crop=360:360" -q:v 3 $D/tex_$t.jpg
done
du -sh $OUT/* | cat
