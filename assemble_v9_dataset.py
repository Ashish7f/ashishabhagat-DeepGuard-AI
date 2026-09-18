import os
import random
import shutil
from pathlib import Path

random.seed(42)

RAW_DIR = Path("dataset_v9_raw")
SAMPLES_DIR = RAW_DIR / "samples"
RVF10K_ROOT = Path(r"C:\Users\ashis\Downloads\RVF10K\Real vs Fake Faces\7030")

DEST_DIR = Path("dataset_v9")
TRAIN_FAKE = DEST_DIR / "train" / "fake"
TRAIN_REAL = DEST_DIR / "train" / "real"
VALID_FAKE = DEST_DIR / "valid" / "fake"
VALID_REAL = DEST_DIR / "valid" / "real"

for d in [TRAIN_FAKE, TRAIN_REAL, VALID_FAKE, VALID_REAL]:
    d.mkdir(parents=True, exist_ok=True)

def copy_split(file_list, train_count, valid_count, dest_train, dest_valid, prefix):
    random.shuffle(file_list)
    train_slice = file_list[:train_count]
    valid_slice = file_list[train_count:train_count + valid_count]
    for idx, src in enumerate(train_slice):
        dst = dest_train / f"{prefix}_train_{idx:05d}{src.suffix.lower()}"
        if not dst.exists():
            shutil.copy2(src, dst)
    for idx, src in enumerate(valid_slice):
        dst = dest_valid / f"{prefix}_valid_{idx:05d}{src.suffix.lower()}"
        if not dst.exists():
            shutil.copy2(src, dst)
    print(f"  [{prefix}] Copied {len(train_slice)} to train, {len(valid_slice)} to valid.", flush=True)

def assemble():
    print("=" * 60, flush=True)
    print("ASSEMBLING BALANCED DATASET V9", flush=True)
    print("=" * 60, flush=True)

    # 1. Inpainting
    inpaint_files = list((SAMPLES_DIR / "fake_inpainting").glob("*.*"))
    print(f"Found {len(inpaint_files)} inpainting images", flush=True)
    copy_split(inpaint_files, 2000, 500, TRAIN_FAKE, VALID_FAKE, "inpaint")

    # 2. Insight Face Swap
    insight_files = list((SAMPLES_DIR / "fake_insight").glob("*.*"))
    print(f"Found {len(insight_files)} insight images", flush=True)
    copy_split(insight_files, 2000, 500, TRAIN_FAKE, VALID_FAKE, "insight")

    # 3. Text2Img Diffusion
    text2img_files = list((SAMPLES_DIR / "fake_text2img").glob("*.*"))
    print(f"Found {len(text2img_files)} text2img images", flush=True)
    copy_split(text2img_files, 2000, 500, TRAIN_FAKE, VALID_FAKE, "text2img")

    # 4. StyleGAN from RVF10K
    if RVF10K_ROOT.exists():
        rvf_fake = list((RVF10K_ROOT / "train" / "fake").glob("*.*"))
        print(f"Found {len(rvf_fake)} RVF10K fake images", flush=True)
        copy_split(rvf_fake, 2000, 500, TRAIN_FAKE, VALID_FAKE, "stylegan")
        
        rvf_real = list((RVF10K_ROOT / "train" / "real").glob("*.*"))
        print(f"Found {len(rvf_real)} RVF10K real images", flush=True)
        copy_split(rvf_real, 2000, 500, TRAIN_REAL, VALID_REAL, "rvf10k")
    else:
        print("[WARNING] RVF10K not found!", flush=True)

    # 5. Authentic Real from Wiki
    wiki_files = list((SAMPLES_DIR / "real_wiki").glob("*.*"))
    print(f"Found {len(wiki_files)} wiki real images", flush=True)
    copy_split(wiki_files, 6000, 1500, TRAIN_REAL, VALID_REAL, "wiki")

    train_fake_count = len(list(TRAIN_FAKE.glob("*.*")))
    train_real_count = len(list(TRAIN_REAL.glob("*.*")))
    valid_fake_count = len(list(VALID_FAKE.glob("*.*")))
    valid_real_count = len(list(VALID_REAL.glob("*.*")))

    print("\n" + "=" * 60, flush=True)
    print("BALANCED DATASET V9 SUMMARY:", flush=True)
    print(f"  Training Fake:   {train_fake_count:,}", flush=True)
    print(f"  Training Real:   {train_real_count:,}", flush=True)
    print(f"  Validation Fake: {valid_fake_count:,}", flush=True)
    print(f"  Validation Real: {valid_real_count:,}", flush=True)
    print(f"  TOTAL IMAGES:    {train_fake_count + train_real_count + valid_fake_count + valid_real_count:,}", flush=True)
    print("=" * 60, flush=True)

if __name__ == "__main__":
    assemble()
