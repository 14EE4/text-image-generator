import argparse
import json
import csv
from statistics import median
from PIL import Image

def is_nonwhite_pixel(px, alpha_thresh=10, white_thresh=240):
    r, g, b, a = px
    if a is None:
        a = 255
    if a < alpha_thresh:
        return False
    return not (r > white_thresh and g > white_thresh and b > white_thresh)

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
    w, h = img.size
    rgba = img.convert('RGBA')
    px = rgba.load()

    col_sum = [0]*w
    row_sum = [0]*h
    for y in range(h):
        for x in range(w):
            if is_nonwhite_pixel(px[x,y]):
                col_sum[x] += 1
                row_sum[y] += 1

    col_blocks = detect_blocks(col_sum)
    row_blocks = detect_blocks(row_sum)

    col_sizes = [b['size'] for b in col_blocks] if col_blocks else []
    row_sizes = [b['size'] for b in row_blocks] if row_blocks else []

    cellW = int(median(col_sizes)) if (auto_cell and col_sizes) else None
    cellH = int(median(row_sizes)) if (auto_cell and row_sizes) else None

    if not cellW or cellW <= 0:
        cellW = max(1, round(w / max(1, len(col_blocks) or 1)))
    if not cellH or cellH <= 0:
        cellH = max(1, round(h / max(1, len(row_blocks) or 1)))

    # find left offset for each detected row-block
    rowLefts = []
    for rb in row_blocks:
        left = w
        for x in range(w):
            found = False
            for y in range(rb['start'], rb['end']+1):
                if is_nonwhite_pixel(px[x,y]):
                    left = x
                    found = True
                    break
            if found:
                break
        if left == w:
            left = 0
        rowLefts.append({'x': left, 'y': rb['start'], 'h': rb['size']})

    return {
        'imageWidth': w, 'imageHeight': h,
        'cellW': cellW, 'cellH': cellH,
        'colsGuessCount': max(1, w // cellW),
        'rows': row_blocks, 'rowLefts': rowLefts,
        'rawColBlocks': col_blocks, 'rawRowBlocks': row_blocks
    }

def map_order_to_coords(order, grid):
    """
    Map characters in `order` to coordinates.
    Prefer per-block widths from grid['rawColBlocks'] and assign blocks per row using rowLefts.
    Fallback to fixed cellW when block info insufficient.
    """
    w = grid['imageWidth']
    cellW = grid['cellW']
    cellH = grid['cellH']
    rowLefts = grid['rowLefts']
    rawColBlocks = grid.get('rawColBlocks') or []
    coords = []
    idx = 0

    # prepare blocks partitioned by row (if rawColBlocks available)
    blocks_by_row = []
    if rawColBlocks and rowLefts:
        # sort blocks just in case
        blocks = sorted(rawColBlocks, key=lambda b: b['start'])
        for ri, row in enumerate(rowLefts):
            start_x = row['x']
            # determine row end (next row's x or image width)
            if ri + 1 < len(rowLefts):
                row_end_bound = rowLefts[ri + 1]['x']
            else:
                row_end_bound = w
            # collect blocks whose start lies within this row horizontal span
            row_blocks = [b for b in blocks if b['start'] >= start_x and b['start'] < row_end_bound]
            blocks_by_row.append({'row': row, 'blocks': row_blocks})

    # If we have blocks_by_row, use them to map glyphs (variable widths)
    if blocks_by_row:
        for rb in blocks_by_row:
            row = rb['row']
            for b in rb['blocks']:
                if idx >= len(order):
                    break
                sx = b['start']
                bw = b.get('size', b.get('end', b.get('width', 0)) - b.get('start', sx) + 1)
                sy = row.get('y', 0)
                coords.append({
                    'char': order[idx],
                    'index': idx,
                    'sx': sx,
                    'sy': sy,
                    'w': bw,
                    'h': cellH
                })
                idx += 1
            if idx >= len(order):
                break

    # If still characters remain, fall back to grid cell mapping (left→right rows)
    if idx < len(order):
        for r, row in enumerate(rowLefts):
            if idx >= len(order):
                break
            start_x = row['x']
            cols_in_row = max(0, (w - start_x) // cellW)
            for c in range(cols_in_row):
                if idx >= len(order):
                    break
                sx = start_x + c * cellW
                sy = row.get('y', 0)
                coords.append({
                    'char': order[idx],
                    'index': idx,
                    'sx': sx, 'sy': sy, 'w': cellW, 'h': cellH
                })
                idx += 1
            if idx >= len(order):
                break

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
    args = p.parse_args()

    img = Image.open(args.image)
    if args.order:
        order = ''.join(args.order.split())
    else:
        order = make_alternating_order()

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