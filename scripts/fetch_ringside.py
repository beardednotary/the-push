"""Download the Ringside Wrestling Archive (Kaggle, CC0) into data/raw/ringside.

    pip install kagglehub
    python scripts/fetch_ringside.py

Public datasets download without a Kaggle account.
"""
import pathlib

import kagglehub

DEST = pathlib.Path(__file__).resolve().parent.parent / "data/raw/ringside"
DEST.mkdir(parents=True, exist_ok=True)
print(kagglehub.dataset_download("theodorerubin/ringside-wrestling-archive", output_dir=str(DEST)))
