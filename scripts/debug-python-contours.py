import json
import sys
from pathlib import Path

import cv2

if len(sys.argv) != 2:
    raise SystemExit('usage: python scripts/debug-python-contours.py <image-path>')

image_path = Path(sys.argv[1])
img = cv2.imread(str(image_path))
if img is None:
    raise SystemExit(f'cannot read {image_path}')

gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
blur = cv2.GaussianBlur(gray, (5, 5), 0)
edges = cv2.Canny(blur, 30, 100)
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
items = []
for index, contour in enumerate(contours):
    x, y, w, h = cv2.boundingRect(contour)
    items.append({
        'index': index,
        'points': int(len(contour)),
        'area': float(cv2.contourArea(contour)),
        'bounds': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
        'firstPoints': [{'x': int(pt[0][0]), 'y': int(pt[0][1])} for pt in contour[:8]],
    })
print(json.dumps({
    'input': str(image_path),
    'image': {'width': int(img.shape[1]), 'height': int(img.shape[0])},
    'rawContourCount': len(contours),
    'contours': items,
}, ensure_ascii=False, indent=2))
