import argparse
import json
import csv
from statistics import median
from math import floor
from PIL import Image

def is_nonwhite_pixel(px, alpha_thresh=10, white_thresh=240):
    r,g,b,a = px
    if a is None:
        a = 255
    if a < alpha_thresh:
        return False
    return not (r > white_thresh and g > white_thresh and b > white_thresh)

# --- NEW: single-row glyph detection (split by vertical whitespace) ---
def detect_glyphs_from_single_row(img, white_thresh=240, alpha_thresh=10, gap_tolerance=1, min_glyph_width=2):
    """
    Detect glyph bounding columns in a single-row sprite by scanning vertical whitespace.
    Returns list of glyph dicts: { sx, w, sy, h } (sy set to 0, h = image height to avoid per-glyph y-offset)
    """
    w, h = img.size
    rgba = img.convert('RGBA')
    px = rgba.load()

    # column non-white counts
    col_nonwhite = [0] * w
    for x in range(w):
        cnt = 0
        for y in range(h):
            r,g,b,a = px[x,y]
            a = 255 if a is None else a
            if a >= alpha_thresh and not (r > white_thresh and g > white_thresh and b > white_thresh):
                cnt += 1
        col_nonwhite[x] = cnt

    # find contiguous non-empty column blocks
    blocks = []
    in_block = False
    start = 0
    for x, val in enumerate(col_nonwhite):
        empty = (val == 0)
        if not empty and not in_block:
            in_block = True
            start = x
        if (empty or x == w-1) and in_block:
            end = x-1 if empty else x
            blocks.append({'start': start, 'end': end})
            in_block = False

    # merge small gaps: if gap between blocks <= gap_tolerance, merge them
    if gap_tolerance > 0 and len(blocks) > 1:
        merged = []
        cur = blocks[0]
        for b in blocks[1:]:
            gap = b['start'] - cur['end'] - 1
            if gap <= gap_tolerance:
                cur['end'] = b['end']
            else:
                merged.append(cur)
                cur = b
        merged.append(cur)
        blocks = merged

    # filter narrow noise blocks -- set sy=0 and use full image height to avoid per-glyph y offsets
    glyphs = []
    for b in blocks:
        width = b['end'] - b['start'] + 1
        if width < min_glyph_width:
            continue
        # do NOT compute top/bottom; use sy = 0 and full image height
        glyphs.append({'sx': b['start'], 'w': width, 'sy': 0, 'h': h})

    return glyphs

def map_order_to_coords_single_row(order, glyphs):
    coords = []
    for i, ch in enumerate(order):
        if i >= len(glyphs):
            break
        g = glyphs[i]
        coords.append({
            'char': ch,
            'index': i,
            'sx': g['sx'],
            'sy': g['sy'],
            'w': g['w'],
            'h': g['h']
        })
    return coords
# --- END NEW ---

def detect_blocks(arr):
    blocks = []
    in_block = False
    start = 0
    for i, v in enumerate(arr):
        empty = (v == 0)
        if not empty and not in_block:
            in_block = True
            start = i
        if (empty or i == len(arr)-1) and in_block:
            end = (i-1) if empty else i
            blocks.append({'start': start, 'end': end, 'size': end-start+1})
            in_block = False
    return blocks

def detect_sprite_grid(img, auto_cell=True):
    # improved detection: find column/row centers (peaks) and infer cell size from median spacing
    w, h = img.size
    rgba = img.convert('RGBA')
    px = rgba.load()

    def is_nonwhite_at(x, y, alpha_thresh=10, white_thresh=240):
        r, g, b, a = px[x, y]
        if a is None:
            a = 255
        if a < alpha_thresh:
            return False
        return not (r > white_thresh and g > white_thresh and b > white_thresh)

    colSum = [0] * w
    rowSum = [0] * h
    for y in range(h):
        for x in range(w):
            if is_nonwhite_at(x, y):
                colSum[x] += 1
                rowSum[y] += 1

    # fallback old block detect
    def detect_blocks(arr):
        blocks = []
        in_block = False
        start = 0
        for i, v in enumerate(arr):
            empty = (v == 0)
            if not empty and not in_block:
                in_block = True
                start = i
            if (empty or i == len(arr) - 1) and in_block:
                end = (i - 1) if empty else i
                blocks.append({'start': start, 'end': end, 'size': end - start + 1})
                in_block = False
        return blocks

    # find local peak centers (simple)
    def find_centers(arr, min_prom=1):
        centers = []
        L = len(arr)
        for i in range(1, L - 1):
            if arr[i] > 0 and arr[i] >= arr[i - 1] and arr[i] >= arr[i + 1] and arr[i] >= min_prom:
                centers.append(i)
        # include edges if appropriate
        if not centers:
            # fallback: treat any non-zero column as center candidates
            for i, v in enumerate(arr):
                if v > 0:
                    centers.append(i)
        return centers

    maxCol = max(colSum) if colSum else 0
    maxRow = max(rowSum) if rowSum else 0
    colCenters = find_centers(colSum, max(1, int(maxCol * 0.15)))
    rowCenters = find_centers(rowSum, max(1, int(maxRow * 0.15)))

    # compute median spacing between centers
    def median_spacing(centers):
        if len(centers) < 2:
            return None
        d = [centers[i+1] - centers[i] for i in range(len(centers)-1) if centers[i+1] - centers[i] > 0]
        if not d:
            return None
        d.sort()
        mid = len(d)//2
        return d[mid] if len(d)%2==1 else round((d[mid-1]+d[mid])/2)

    cellW = median_spacing(colCenters) if auto_cell else None
    cellH = median_spacing(rowCenters) if auto_cell else None

    # fallback to block-median method if spacing detection failed
    if not cellW or cellW <= 0:
        col_blocks = detect_blocks(colSum)
        col_sizes = [b['size'] for b in col_blocks] if col_blocks else []
        cellW = int(median(col_sizes)) if col_sizes else max(1, round(w / max(1, len(colSum) or 1)))
    if not cellH or cellH <= 0:
        row_blocks = detect_blocks(rowSum)
        row_sizes = [b['size'] for b in row_blocks] if row_blocks else []
        cellH = int(median(row_sizes)) if row_sizes else max(1, round(h / max(1, len(rowSum) or 1)))

    # determine row blocks and left offsets using rowSum blocks
    row_blocks = detect_blocks(rowSum)
    rowLefts = []
    for rb in row_blocks:
        left = w
        for x in range(w):
            found = False
            for y in range(rb['start'], rb['end'] + 1):
                if is_nonwhite_at(x, y):
                    left = x
                    found = True
                    break
            if found:
                break
        if left == w:
            left = 0
        rowLefts.append({'x': left, 'y': rb['start'], 'h': rb['size']})

    return {
        'imageWidth': w,
        'imageHeight': h,
        'cellW': int(cellW),
        'cellH': int(cellH),
        'colsGuessCount': max(1, w // max(1, int(cellW))),
        'rows': row_blocks,
        'rowLefts': rowLefts,
        'rawColSums': colSum,
        'rawRowSums': rowSum
    }

def map_order_to_coords(order, grid):
    w = grid['imageWidth']
    cellW = grid['cellW']
    cellH = grid['cellH']
    rowLefts = grid['rowLefts']
    coords = []
    idx = 0
    for r, row in enumerate(rowLefts):
        if idx >= len(order):
            break
        start_x = row['x']
        cols_in_row = max(0, (w - start_x) // cellW)
        for c in range(cols_in_row):
            if idx >= len(order):
                break
            sx = start_x + c * cellW
            # do NOT use row['y']; force sy = 0 to avoid per-row vertical offsets
            coords.append({
                'char': order[idx],
                'index': idx,
                'sx': sx, 'sy': 0, 'w': cellW, 'h': cellH
            })
            idx += 1
    return coords

def save_json(coords, meta, outpath):
    payload = {'meta': meta, 'coords': coords}
    with open(outpath, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

def save_csv(coords, outpath):
    with open(outpath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['index','char','sx','sy','w','h'])
        writer.writeheader()
        for c in coords:
            writer.writerow({k: c.get(k,'') for k in writer.fieldnames})

def make_alternating_order():
    U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    s = ''
    for ch in U:
        s += ch + ch.lower()
    return s

def main():
    p = argparse.ArgumentParser(description='Generate glyph coords from sprite sheet.')
    p.add_argument('--image', '-i', required=True, help='sprite image path')
    p.add_argument('--cellW', type=int, help='cell width in px (optional)')
    p.add_argument('--cellH', type=int, help='cell height in px (optional)')
    p.add_argument('--order', help='char order string (default AaBbCc...Zz)')
    p.add_argument('--out', '-o', default='coords.json', help='output json path')
    p.add_argument('--csv', help='also write CSV to this path')
    p.add_argument('--singleRow', action='store_true', help='detect glyphs by splitting on vertical whitespace (single row sprite)')
    p.add_argument('--gap', type=int, default=1, help='max gap (px) to merge across when detecting glyphs')
    p.add_argument('--minGlyphW', type=int, default=2, help='minimum glyph width (px) to keep')
    args = p.parse_args()

    img = Image.open(args.image)
    if args.order:
        order = ''.join(args.order.split())
    else:
        order = make_alternating_order()

    print(f"Using order (len={len(order)}): {order[:60]}{'...' if len(order)>60 else ''}")

    if args.singleRow:
        glyphs = detect_glyphs_from_single_row(img, gap_tolerance=args.gap, min_glyph_width=args.minGlyphW)
        print(f"Detected {len(glyphs)} glyph blocks (single-row mode).")
        coords = map_order_to_coords_single_row(order, glyphs)
        print(f"Mapped {len(coords)} chars from order to detected glyphs.")
        meta = {
            'image': args.image,
            'imageWidth': img.size[0],
            'imageHeight': img.size[1],
            'mode': 'singleRow',
            'detected_glyphs': len(glyphs),
            'order': order
        }
        save_json(coords, meta, args.out)
        if args.csv:
            save_csv(coords, args.csv)
        print(f"Saved {len(coords)} coords to {args.out}")
        if args.csv:
            print(f"CSV saved to {args.csv}")
        return

    # fallback: existing grid detection path (unchanged)
    grid = detect_sprite_grid(img, auto_cell=(not (args.cellW and args.cellH)))
    if args.cellW and args.cellH:
        grid['cellW'] = args.cellW
        grid['cellH'] = args.cellH
        grid['colsGuessCount'] = max(1, grid['imageWidth'] // grid['cellW'])
    coords = map_order_to_coords(order, grid)
    meta = {
        'image': args.image,
        'imageWidth': grid['imageWidth'],
        'imageHeight': grid['imageHeight'],
        'cellW': grid['cellW'],
        'cellH': grid['cellH'],
        'order': order
    }
    save_json(coords, meta, args.out)
    if args.csv:
        save_csv(coords, args.csv)
    print(f"Saved {len(coords)} coords to {args.out}")
    if args.csv:
        print(f"CSV saved to {args.csv}")

if __name__ == '__main__':
    main()