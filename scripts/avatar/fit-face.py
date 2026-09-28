"""Optional one-time landmark fit. See docs/avatar/README.md for setup and sources."""
import hashlib
import json
import sys
from pathlib import Path

import mediapipe as mp
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
source = ROOT / 'public/raj-avatar.webp'
options = mp.tasks.vision.FaceLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=sys.argv[1], delegate=mp.tasks.BaseOptions.Delegate.CPU),
    num_faces=1,
)
with mp.tasks.vision.FaceLandmarker.create_from_options(options) as detector:
    result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.array(Image.open(source).convert('RGB'))))
if not result.face_landmarks:
    raise RuntimeError('No face found; do not replace the existing fit.')
fit = {
    'source': 'public/raj-avatar.webp',
    'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'method': 'MediaPipe FaceLandmarker float16/1, 468 face landmarks; inferred depth, not a scan',
    'landmarks': [[round(p.x, 7), round(p.y, 7), round(p.z, 7)] for p in result.face_landmarks[0][:468]],
}
(ROOT / 'scripts/avatar/face-fit.json').write_text(json.dumps(fit, separators=(',', ':')) + '\n')
print('Fitted', len(fit['landmarks']), 'landmarks')
for i in [1,10,152,234,454,33,263]: print(i,fit['landmarks'][i])
