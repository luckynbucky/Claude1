# Coursera ML Specialization downloader

Downloads lecture videos (MP4), supplementary PDFs, and Jupyter notebook labs
from Andrew Ng's Machine Learning Specialization (2022) on Coursera, using
your logged-in browser session.

## Setup

```bash
cd scripts
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Getting your CAUTH cookie

1. Log into `https://www.coursera.org` in Chrome.
2. Open DevTools -> **Application** -> **Cookies** -> `https://www.coursera.org`.
3. Copy the value of the `CAUTH` cookie (a long opaque string).

Provide it to the script via any of:

- `--cauth "<value>"`
- `export COURSERA_CAUTH="<value>"`
- Write it to `./.coursera-cauth` (already gitignored — do **not** commit).

## Run

Download everything for all three specialization courses:

```bash
python coursera_download.py --out ./coursera-ml
```

Only one course:

```bash
python coursera_download.py --out ./coursera-ml --course machine-learning
```

Skip a content type (repeatable):

```bash
python coursera_download.py --out ./coursera-ml --skip video
```

## Output layout

```
coursera-ml/
  machine-learning/
    01 - Introduction to Machine Learning/
      01 - Welcome to machine learning.mp4
      01 - Welcome to machine learning.en.vtt
      02 - Applications of machine learning.mp4
      ...
    notebooks-manual.txt   # any labs the script couldn't fetch directly
  advanced-learning-algorithms/
    ...
  unsupervised-learning-recommenders-reinforcement-learning/
    ...
```

## Caveats

- **Notebook labs**: many labs in this specialization run in a Coursera-hosted
  Jupyter workspace. The script tries the public asset endpoints first; when a
  lab is only reachable through the workspace, its classroom URL is appended to
  `notebooks-manual.txt` so you can open it in the browser and use
  *File -> Download as -> Notebook (.ipynb)*.
- **You must be enrolled** (audit or paid) in each course, otherwise items come
  back as locked and get skipped.
- **Personal use only.** Don't redistribute the downloaded material.
- Coursera's private APIs change without notice; if something breaks, the
  places most likely to need adjusting are `MATERIALS_FIELDS` and the
  `download_lecture` / `download_supplement` / `download_notebook` functions.
