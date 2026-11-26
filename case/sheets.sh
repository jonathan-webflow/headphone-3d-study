#!/bin/bash
# folhas de conferência: 5 quadros por filme (0,5 s, 25 %, 50 %, 75 %, fim) e grade dos posts
cd "$(dirname "$0")/out"; mkdir -p check/sheets; T=$(mktemp -d)
for f in 9x16 4x5; do
  rows=""
  for v in commercials/*_$f.mp4; do
    n=$(basename $v .mp4); d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $v)
    i=0
    for t in 0.5 $(echo "$d*0.25" | bc -l) $(echo "$d*0.5" | bc -l) $(echo "$d*0.75" | bc -l) $(echo "$d-0.2" | bc -l); do
      ffmpeg -v error -y -ss $t -i $v -frames:v 1 -vf "scale=-2:480" $T/${n}_$i.png; i=$((i+1))
    done
    ffmpeg -v error -y -i $T/${n}_0.png -i $T/${n}_1.png -i $T/${n}_2.png -i $T/${n}_3.png -i $T/${n}_4.png -filter_complex hstack=5 $T/row_$n.png
    rows="$rows -i $T/row_$n.png"
  done
  ffmpeg -v error -y $rows -filter_complex "vstack=$(ls $T/row_*_$f.png | wc -l)" -q:v 3 check/sheets/films_$f.jpg
done
ffmpeg -v error -y $(for p in posts/*.jpg; do echo "-i $p"; done) -filter_complex "[0][1][2][3][4]hstack=5[a];[5][6][7][8][9]hstack=5[b];[a][b]vstack=2,scale=2700:-2" -q:v 3 check/sheets/posts.jpg
rm -rf $T; ls -la check/sheets
