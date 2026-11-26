#!/bin/bash
# monta os 20 filmes e os 10 posts a partir dos quadros em case/renders
cd "$(dirname "$0")/remotion"
B=../out/bundle
rm -rf $B && npx remotion bundle --out-dir $B >/dev/null 2>&1 || { echo "bundle falhou"; exit 1; }
for id in C01-Hero C02-Controls C03-Glass C04-Bezel C05-Plate C06-Driver C07-Battery C08-Teardown C09-Comfort C10-Rebuild; do
  n=$(echo $id | tr 'A-Z' 'a-z' | sed 's/-/_/')
  for f in 9x16 4x5; do
    npx remotion render $B $id-$f ../out/commercials/${n}_$f.mp4 --muted --log=error && echo "[ok] ${n}_$f"
  done
done
for p in P01-Hero P02-Exploded P03-Driver P04-Controls P05-Glass P06-Bezel P07-Plate P08-Battery P09-Comfort P10-Specs; do
  npx remotion still $B $p ../out/posts/$p.jpg --log=error && echo "[ok] $p"
done
echo DONE
