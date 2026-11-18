#!/usr/bin/env bash
# Re-renders every sheet of the character from public/skin.png.
#
# Usage: scripts/render/render_all.sh [work_dir]
#
# One command because the skin is a script too (gen_skin.py): a change of
# colour or of haircut is that edit and this, about five minutes of GPU.
# Each sheet also gets its @half, which is the one most screens are served.
set -euo pipefail
cd "$(dirname "$0")/../.."
WORK="${1:-$(mktemp -d)}"
SKIN=public/skin.png
HERE=scripts/render
OUT=public/sprites
mkdir -p "$WORK"

render() { # name, poses.json, [foot_y]
  rm -rf "${WORK:?}/$1" && mkdir -p "$WORK/$1"
  if ! blender -b -P $HERE/rig.py -- $SKIN "$2" "$WORK/$1" ${3:-} > "$WORK/$1.log" 2>&1 \
      || ! grep -q RENDERED "$WORK/$1.log"; then
    tail -8 "$WORK/$1.log" >&2
    echo "render_all: $1 did not render" >&2
    exit 1
  fi
}

half() { magick "$OUT/$1.webp" -filter Lanczos -resize 50% -quality 90 -define webp:alpha-quality=95 "$OUT/$1@half.webp"; }

# The profile sheets: one row of 460x600 cells, feet on row 540.
strip() { # name, poses.json
  render "$1" "$2" 540
  magick "$WORK/$1"/f*.png +append -quality 90 "$OUT/$1.webp"
  half "$1"
  echo "$1: $(ls "$WORK/$1" | wc -l) frames"
}

# The traced sheets carry the zoom that matched the hand-made original. The
# site renders them all at 1.
for sheet in run walk idle; do
  python3 -c "import json,sys; d=json.load(open(sys.argv[1])); d.pop('zoom', None); json.dump(d, open(sys.argv[2], 'w'))" \
    $HERE/poses/$sheet.json "$WORK/$sheet.json"
  strip $sheet "$WORK/$sheet.json"
done
python3 -c "import json,sys; d=json.load(open(sys.argv[1])); d.pop('zoom', None); json.dump(d, open(sys.argv[2], 'w'))" \
  $HERE/poses/throw_v2.json "$WORK/throw.json"
strip throw "$WORK/throw.json"

python3 $HERE/gen_sit.py "$WORK/sit.json" && strip sit "$WORK/sit.json"
python3 $HERE/gen_podium.py climb "$WORK/climb.json" && strip climb "$WORK/climb.json"
python3 $HERE/gen_podium.py cheer "$WORK/cheer.json" && strip cheer "$WORK/cheer.json"
python3 $HERE/gen_type.py "$WORK/type.json" && strip type "$WORK/type.json"
# Typing a /tp where he cannot stand up to do it: seated on the cliff and on
# the podium.
python3 $HERE/gen_type.py "$WORK/type_sit.json" sit && strip type_sit "$WORK/type_sit.json"
python3 $HERE/gen_type.py "$WORK/type_podium.json" podium && strip type_podium "$WORK/type_podium.json"
# Taking off with the elytra and a rocket, when a sign leads out of the site.
python3 $HERE/gen_fly.py "$WORK/fly.json" && strip fly "$WORK/fly.json"

# The greeting: rendered 960x720 and cut to its bottom 570, which is the cell.
python3 $HERE/gen_peek.py "$WORK/peek_wave.json" 1.5
render peek_wave "$WORK/peek_wave.json"
magick mogrify -crop 960x570+0+150 +repage "$WORK/peek_wave"/f*.png
magick montage "$WORK/peek_wave"/f*.png -tile 8x4 -geometry 960x570+0+0 -background none "$WORK/peek_wave.png"
magick "$WORK/peek_wave.png" -quality 90 "$OUT/peek_wave.webp"
half peek_wave
echo "peek_wave: $(ls "$WORK/peek_wave" | wc -l) frames"

# The one who watches the picture in the viewer. No @half: phones never load it.
python3 $HERE/gen_watch.py "$WORK/peek_watch.json" 0.8
render peek_watch "$WORK/peek_watch.json"
magick montage "$WORK/peek_watch"/f*.png -tile 8x8 -geometry 512x384+0+0 -background none "$WORK/peek_watch.png"
magick "$WORK/peek_watch.png" -quality 90 "$OUT/peek_watch.webp"
echo "peek_watch: $(ls "$WORK/peek_watch" | wc -l) frames"

# The cover: arms crossed, seven poses in a row, cut to the box all of them
# share so that changing the gaze does not shift him.
python3 $HERE/gen_duo.py "$WORK/duo.json"
render duo "$WORK/duo.json"
BOX=$(magick "$WORK/duo"/f*.png -background none -layers flatten -format "%@" info:)
magick "$WORK/duo"/f*.png -crop "$BOX" +repage +append -quality 90 "$OUT/duo.webp"
half duo
echo "duo: $(ls "$WORK/duo" | wc -l) frames, cell $BOX"
