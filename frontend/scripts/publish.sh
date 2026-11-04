#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
from pathlib import Path
import shutil, os
source, target = Path('build-staged'), Path('build')
if not (source/'index.html').is_file(): raise SystemExit('Run npm run build first.')
target.mkdir(exist_ok=True)
# Publish content before the entry point. Keep old hashed assets for open tabs.
for path in source.iterdir():
    if path.name == 'index.html': continue
    destination=target/path.name
    if path.is_dir(): shutil.copytree(path,destination,dirs_exist_ok=True)
    else: shutil.copy2(path,destination)
shutil.copy2(source/'index.html', target/'.index.html.next')
os.replace(target/'.index.html.next',target/'index.html')
print('Published staged frontend; existing hashed assets retained.')
PY
