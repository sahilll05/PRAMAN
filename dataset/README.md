# Dataset Directory (PRAMAN)

This directory is gitignored (`.gitignore`) and houses all locally downloaded data subsets, sampled parquet shards, precomputed embedding memmap arrays, and split manifests.

## Structure
- `dataset/cf_small/`: Shards and local cache for OwensLab/CommunityForensics-Small.
- `dataset/openfake/`: Shards and local cache for ComplexDataLab/OpenFake (core & reddit).
- `dataset/embeddings/`: Cached float16 NumPy memory-mapped CLIP embeddings (`.npy` / `.dat`).
- `dataset/splits/`: JSON manifests for train, cal, test-in-domain, and generator-disjoint splits.
- `dataset/local/`: Locally generated fresh images for canary/degradation evaluations.

All packages for processing datasets and models are managed inside the project virtual environment `ml/.venv`.
