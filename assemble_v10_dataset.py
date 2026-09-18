import os
import random
import shutil
from pathlib import Path

random.seed(42)

RAW_DIR = Path("dataset_v9_raw")
SAMPLES_DIR = RAW_DIR / "samples"
RVF10K_ROOT = Path(r"C:\Users\ashis\Downloads\RVF10K\Real vs Fake Faces\7030")
CELEBDF_SAMPLES = Path(r"dataset_v10_raw\celebdf_samples")

DEST_DIR = Path("dataset_v10")
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
    print("ASSEMBLING BALANCED DATASET V10 (OMNISHIELD)", flush=True)
    print("=" * 60, flush=True)

    # 1. Insight Face Swap (High priority: 4,000 train / 1,000 valid)
    insight_files = list((SAMPLES_DIR / "fake_insight").glob("*.*"))
    print(f"Found {len(insight_files)} insight face-swap images", flush=True)
    copy_split(insight_files, 4000, 1000, TRAIN_FAKE, VALID_FAKE, "insight")

    # 2. Inpainting (High priority: 3,500 train / 1,000 valid)
    inpaint_files = list((SAMPLES_DIR / "fake_inpainting").glob("*.*"))
    print(f"Found {len(inpaint_files)} inpainting images", flush=True)
    copy_split(inpaint_files, 3500, 1000, TRAIN_FAKE, VALID_FAKE, "inpaint")

    # 3. Text2Img Diffusion (3,000 train / 750 valid)
    text2img_files = list((SAMPLES_DIR / "fake_text2img").glob("*.*"))
    print(f"Found {len(text2img_files)} text2img images", flush=True)
    copy_split(text2img_files, 3000, 750, TRAIN_FAKE, VALID_FAKE, "text2img")

    # 4. StyleGAN from RVF10K (3,500 train / 750 valid)
    if RVF10K_ROOT.exists():
        rvf_fake = list((RVF10K_ROOT / "train" / "fake").glob("*.*")) + list((RVF10K_ROOT / "valid" / "fake").glob("*.*"))
        print(f"Found {len(rvf_fake)} RVF10K fake images", flush=True)
        copy_split(rvf_fake, 3500, 750, TRAIN_FAKE, VALID_FAKE, "stylegan")
        
        rvf_real = list((RVF10K_ROOT / "train" / "real").glob("*.*")) + list((RVF10K_ROOT / "valid" / "real").glob("*.*"))
        print(f"Found {len(rvf_real)} RVF10K real images", flush=True)
        copy_split(rvf_real, 3500, 750, TRAIN_REAL, VALID_REAL, "rvf10k")
    else:
        print("[WARNING] RVF10K not found!", flush=True)

    # 5. Celeb-DF Face Crops (Video face-swaps: 3,500 train / 750 valid)
    if (CELEBDF_SAMPLES / "fake").exists():
        celeb_fake = list((CELEBDF_SAMPLES / "fake").glob("*.jpg"))
        print(f"Found {len(celeb_fake)} Celeb-DF fake face crops", flush=True)
        if len(celeb_fake) > 0:
            tr_c = min(3500, int(len(celeb_fake) * 0.82))
            va_c = min(750, len(celeb_fake) - tr_c)
            copy_split(celeb_fake, tr_c, va_c, TRAIN_FAKE, VALID_FAKE, "celebdf_fake")
            
    if (CELEBDF_SAMPLES / "real").exists():
        celeb_real = list((CELEBDF_SAMPLES / "real").glob("*.jpg"))
        print(f"Found {len(celeb_real)} Celeb-DF real face crops", flush=True)
        if len(celeb_real) > 0:
            tr_c = min(3500, int(len(celeb_real) * 0.82))
            va_c = min(750, len(celeb_real) - tr_c)
            copy_split(celeb_real, tr_c, va_c, TRAIN_REAL, VALID_REAL, "celebdf_real")

    # 6. Authentic Real from Wiki (Target balance)
    train_fake_so_far = len(list(TRAIN_FAKE.glob("*.*")))
    train_real_so_far = len(list(TRAIN_REAL.glob("*.*")))
    valid_fake_so_far = len(list(VALID_FAKE.glob("*.*")))
    valid_real_so_far = len(list(VALID_REAL.glob("*.*")))
    
    needed_train_real = max(0, train_fake_so_far - train_real_so_far)
    needed_valid_real = max(0, valid_fake_so_far - valid_real_so_far)
    
    wiki_files = list((SAMPLES_DIR / "real_wiki").glob("*.*"))
    print(f"Found {len(wiki_files)} wiki real images. Need {needed_train_real} train / {needed_valid_real} valid for perfect 50/50 balance.", flush=True)
    copy_split(wiki_files, needed_train_real, needed_valid_real, TRAIN_REAL, VALID_REAL, "wiki")

    train_fake_count = len(list(TRAIN_FAKE.glob("*.*")))
    train_real_count = len(list(TRAIN_REAL.glob("*.*")))
    valid_fake_count = len(list(VALID_FAKE.glob("*.*")))
    valid_real_count = len(list(VALID_REAL.glob("*.*")))

    print("\n" + "=" * 60, flush=True)
    print("BALANCED DATASET V10 (OMNISHIELD) SUMMARY:", flush=True)
    print(f"  Training Fake:   {train_fake_count:,}", flush=True)
    print(f"  Training Real:   {train_real_count:,} (Balance: {train_fake_count/(train_fake_count+train_real_count)*100:.1f}% Fake / {train_real_count/(train_fake_count+train_real_count)*100:.1f}% Real)", flush=True)
    print(f"  Validation Fake: {valid_fake_count:,}", flush=True)
    print(f"  Validation Real: {valid_real_count:,} (Balance: {valid_fake_count/(valid_fake_count+valid_real_count)*100:.1f}% Fake / {valid_real_count/(valid_fake_count+valid_real_count)*100:.1f}% Real)", flush=True)
    print(f"  TOTAL IMAGES:    {train_fake_count + train_real_count + valid_fake_count + valid_real_count:,}", flush=True)
    print("=" * 60, flush=True)

if __name__ == "__main__":
    assemble()
