#!/usr/bin/env python3
"""
Download videos, supplementary PDFs, and Jupyter notebook labs for the
Coursera Machine Learning Specialization (Andrew Ng, 2022).

Auth: paste the CAUTH cookie value from a logged-in browser session.
    Chrome DevTools -> Application -> Cookies -> www.coursera.org -> CAUTH
Pass it via --cauth, the COURSERA_CAUTH env var, or a .coursera-cauth file.

Usage:
    python coursera_download.py --out ./coursera-ml
    python coursera_download.py --out ./coursera-ml --course machine-learning
    python coursera_download.py --out ./coursera-ml --skip videos

Notes:
- Coursera's private APIs change without notice. If a request 401s, refresh
  your CAUTH cookie. If the JSON shape changes, the item-type dispatch in
  download_item() is the place to adjust.
- Notebook downloads use the openCourseAssets endpoint. Some labs live in a
  Jupyter workspace and can't be pulled that way; those get logged to
  notebooks-manual.txt so you can grab them from the browser.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

import requests
from tqdm import tqdm

SPECIALIZATION_SLUGS = [
    "machine-learning",
    "advanced-learning-algorithms",
    "unsupervised-learning-recommenders-reinforcement-learning",
]

BASE = "https://www.coursera.org"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

MATERIALS_FIELDS = (
    "moduleIds,"
    "onDemandCourseMaterialModules.v1(name,slug,lessonIds),"
    "onDemandCourseMaterialLessons.v1(name,slug,elementIds),"
    "onDemandCourseMaterialItems.v2(name,slug,contentSummary,isLocked)"
)


@dataclass
class Item:
    id: str
    name: str
    type: str
    module: str
    lesson: str
    module_idx: int
    lesson_idx: int
    item_idx: int


def load_cauth(cli_value: str | None) -> str:
    if cli_value:
        return cli_value.strip()
    env = os.environ.get("COURSERA_CAUTH")
    if env:
        return env.strip()
    for path in (Path(".coursera-cauth"), Path.home() / ".coursera-cauth"):
        if path.is_file():
            return path.read_text().strip()
    sys.exit(
        "No CAUTH cookie found. Pass --cauth, set COURSERA_CAUTH, or write it "
        "to .coursera-cauth. Get it from Chrome DevTools -> Application -> "
        "Cookies -> www.coursera.org -> CAUTH."
    )


def make_session(cauth: str) -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
    s.cookies.set("CAUTH", cauth, domain=".coursera.org")
    # CSRF3 token: Coursera checks that the cookie value matches the header.
    csrf = f"cli-{int(time.time())}"
    s.cookies.set("CSRF3-Token", csrf, domain=".coursera.org")
    s.headers["X-CSRF3-Token"] = csrf
    return s


def get_json(session: requests.Session, url: str) -> dict:
    r = session.get(url, timeout=30)
    if r.status_code == 401:
        sys.exit("401 Unauthorized. Your CAUTH cookie is likely expired.")
    r.raise_for_status()
    return r.json()


def fetch_course_materials(
    session: requests.Session, slug: str, debug_dir: Path | None = None
) -> tuple[str, list[Item]]:
    url = (
        f"{BASE}/api/onDemandCourseMaterials.v2/"
        f"?q=slug&slug={slug}"
        f"&includes=modules,lessons,items"
        f"&fields={MATERIALS_FIELDS}"
    )
    data = get_json(session, url)
    if debug_dir is not None:
        debug_dir.mkdir(parents=True, exist_ok=True)
        (debug_dir / f"{slug}-materials.json").write_text(json.dumps(data, indent=2))
        print(f"  [debug] wrote {debug_dir / f'{slug}-materials.json'}")

    element = data["elements"][0]
    course_id = element["id"]
    linked = data.get("linked") or {}

    modules_list = linked.get("onDemandCourseMaterialModules.v1") or []
    lessons_list = linked.get("onDemandCourseMaterialLessons.v1") or []
    items_list = linked.get("onDemandCourseMaterialItems.v2") or []
    print(
        f"  [linked] modules={len(modules_list)} "
        f"lessons={len(lessons_list)} items={len(items_list)} "
        f"element.moduleIds={len(element.get('moduleIds') or [])}"
    )
    if not items_list:
        print("  [hint] no items in response. Check the JSON dumped with --debug — "
              "usually means the session cookie can't see this course's content.")

    modules = {m["id"]: m for m in modules_list}
    lessons = {l["id"]: l for l in lessons_list}
    items = {i["id"]: i for i in items_list}

    ordered: list[Item] = []
    for m_idx, module_id in enumerate(element["moduleIds"], start=1):
        module = modules[module_id]
        for l_idx, lesson_id in enumerate(module["lessonIds"], start=1):
            lesson = lessons[lesson_id]
            for i_idx, item_id in enumerate(lesson["elementIds"], start=1):
                item = items.get(item_id)
                if item is None:
                    continue
                type_name = (item.get("contentSummary") or {}).get("typeName") or "unknown"
                ordered.append(
                    Item(
                        id=item_id,
                        name=item["name"],
                        type=type_name,
                        module=module["name"],
                        lesson=lesson["name"],
                        module_idx=m_idx,
                        lesson_idx=l_idx,
                        item_idx=i_idx,
                    )
                )
    return course_id, ordered


def safe_name(s: str, max_len: int = 80) -> str:
    s = re.sub(r"[<>:\"/\\|?*\x00-\x1f]", "", s).strip().rstrip(".")
    return (s[:max_len] or "untitled").rstrip()


def download_file(session: requests.Session, url: str, dest: Path, desc: str) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    with session.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        total = int(r.headers.get("Content-Length") or 0)
        with open(tmp, "wb") as f, tqdm(
            total=total, unit="B", unit_scale=True, desc=desc, leave=False
        ) as bar:
            for chunk in r.iter_content(chunk_size=1 << 15):
                if chunk:
                    f.write(chunk)
                    bar.update(len(chunk))
    tmp.rename(dest)


def download_lecture(
    session: requests.Session, course_id: str, item: Item, out_dir: Path
) -> None:
    url = (
        f"{BASE}/api/onDemandLectureVideos.v1/{course_id}~{item.id}"
        "?includes=video"
        "&fields=onDemandVideos.v1(sources,subtitles)"
    )
    data = get_json(session, url)
    videos = data.get("linked", {}).get("onDemandVideos.v1", [])
    if not videos:
        return
    video = videos[0]
    sources = video.get("sources", {}) or {}
    byres = sources.get("byResolution", {}) or {}
    if not byres:
        return
    # Pick highest resolution offered.
    best = max(byres.keys(), key=lambda k: int(re.sub(r"\D", "", k) or 0))
    mp4_url = byres[best].get("mp4VideoUrl")
    if not mp4_url:
        return

    stem = f"{item.item_idx:02d} - {safe_name(item.name)}"
    video_dest = out_dir / f"{stem}.mp4"
    download_file(session, mp4_url, video_dest, f"video {stem[:30]}")

    for lang, sub_url in (video.get("subtitles") or {}).items():
        full = sub_url if sub_url.startswith("http") else BASE + sub_url
        sub_dest = out_dir / f"{stem}.{lang}.vtt"
        try:
            download_file(session, full, sub_dest, f"sub {lang}")
        except requests.HTTPError:
            pass


def download_supplement(
    session: requests.Session, course_id: str, item: Item, out_dir: Path
) -> None:
    url = (
        f"{BASE}/api/onDemandSupplements.v1/{course_id}~{item.id}"
        "?includes=asset"
        "&fields=openCourseAssets.v1(typeName),openCourseAssets.v1(definition)"
    )
    data = get_json(session, url)
    assets = data.get("linked", {}).get("openCourseAssets.v1", [])
    stem = f"{item.item_idx:02d} - {safe_name(item.name)}"

    for asset in assets:
        definition = asset.get("definition") or {}
        value = definition.get("value") or ""
        # Extract any <a href="..."> or asset URLs from the HTML blob.
        urls = re.findall(r'href="(https?://[^"]+)"', value)
        urls += re.findall(r'src="(https?://[^"]+\.(?:pdf|zip|ipynb))"', value)
        # Also inline asset IDs.
        for match in re.finditer(r'data-asset-id="([^"]+)"', value):
            urls.append(_resolve_asset(session, match.group(1)))

        for u in filter(None, urls):
            if any(part in u for part in ("cloudfront", "coursera-instructor", ".pdf", ".ipynb", ".zip")):
                path = urlparse(u).path
                ext = os.path.splitext(path)[1] or ".pdf"
                dest = out_dir / f"{stem}{ext}"
                try:
                    download_file(session, u, dest, f"supp {stem[:30]}")
                except requests.HTTPError:
                    continue
                break


def _resolve_asset(session: requests.Session, asset_id: str) -> str | None:
    url = f"{BASE}/api/assets.v1/{asset_id}"
    try:
        data = get_json(session, url)
        return (data.get("elements", [{}])[0].get("url") or {}).get("url")
    except Exception:
        return None


def download_notebook(
    session: requests.Session,
    course_id: str,
    item: Item,
    out_dir: Path,
    manual_log: Path,
) -> None:
    """Attempt to grab an ipynb. Many labs live in a Jupyter workspace and can
    only be exported from the browser; those get logged for you to fetch."""
    stem = f"{item.item_idx:02d} - {safe_name(item.name)}"
    # Try the notebook item endpoint (only exists for some notebook types).
    endpoints = [
        f"{BASE}/api/onDemandLabItems.v1/{course_id}~{item.id}",
        f"{BASE}/api/openCourseAssets.v1/{item.id}",
    ]
    for url in endpoints:
        try:
            data = get_json(session, url)
        except requests.HTTPError:
            continue
        blob = json.dumps(data)
        m = re.search(r'https?://[^"]+\.ipynb', blob)
        if m:
            try:
                dest = out_dir / f"{stem}.ipynb"
                download_file(session, m.group(0), dest, f"nb {stem[:30]}")
                return
            except requests.HTTPError:
                continue

    # Fallback: log the classroom URL so you can open it manually.
    lab_url = f"{BASE}/learn/{item.module.lower()}/ungradedLab/{item.id}"
    with manual_log.open("a") as f:
        f.write(f"{item.module} > {item.lesson} > {item.name}\n  {lab_url}\n\n")


ITEM_DISPATCH = {
    "lecture": "video",
    "lectureVideo": "video",
    "supplement": "supp",
    "notebook": "notebook",
    "ungradedLab": "notebook",
    "programming": "notebook",
    "programmingAssignment": "notebook",
    "ungradedProgramming": "notebook",
    "ungradedLabProject": "notebook",
    "lab": "notebook",
    "gradedLti": "notebook",
    "ungradedLti": "notebook",
}


def download_course(
    session: requests.Session,
    slug: str,
    out_root: Path,
    skip: set[str],
    debug_dir: Path | None = None,
) -> None:
    print(f"\n=== {slug} ===")
    course_id, items = fetch_course_materials(session, slug, debug_dir=debug_dir)
    print(f"  courseId={course_id}  items={len(items)}")

    type_counts: dict[str, int] = {}
    for it in items:
        type_counts[it.type] = type_counts.get(it.type, 0) + 1
    print("  item types:", ", ".join(f"{t}={n}" for t, n in sorted(type_counts.items())))

    unknown = {t for t in type_counts if t not in ITEM_DISPATCH}
    if unknown:
        print(f"  skipping unrecognized types: {sorted(unknown)}")

    course_dir = out_root / safe_name(slug)
    manual_log = course_dir / "notebooks-manual.txt"

    handled = 0
    for item in items:
        kind = ITEM_DISPATCH.get(item.type)
        if kind is None or kind in skip:
            continue
        if item.type != "lecture" and getattr(item, "type", None):
            pass  # placeholder; per-item logging below

        module_dir = course_dir / f"{item.module_idx:02d} - {safe_name(item.module)}"
        print(f"  [{item.type}] {item.module_idx:02d}.{item.lesson_idx:02d}.{item.item_idx:02d} {item.name[:60]}")
        try:
            if kind == "video":
                download_lecture(session, course_id, item, module_dir)
            elif kind == "supp":
                download_supplement(session, course_id, item, module_dir)
            elif kind == "notebook":
                module_dir.mkdir(parents=True, exist_ok=True)
                download_notebook(session, course_id, item, module_dir, manual_log)
            handled += 1
        except requests.HTTPError as e:
            print(f"    ! {item.type} '{item.name}': HTTP {e.response.status_code if e.response else '?'} {e}", file=sys.stderr)
        except Exception as e:
            print(f"    ! {item.type} '{item.name}': {e!r}", file=sys.stderr)

    print(f"  processed {handled} items")


def main(argv: Iterable[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, default=Path("./coursera-ml"))
    p.add_argument("--cauth", help="CAUTH cookie (else COURSERA_CAUTH or .coursera-cauth)")
    p.add_argument(
        "--course",
        action="append",
        help="Course slug (repeatable). Default: all three ML Specialization courses.",
    )
    p.add_argument(
        "--skip",
        action="append",
        choices=["video", "supp", "notebook"],
        default=[],
        help="Content types to skip (repeatable).",
    )
    p.add_argument(
        "--debug",
        action="store_true",
        help="Dump the raw materials API response for each course to ./debug/.",
    )
    args = p.parse_args(list(argv) if argv is not None else None)

    cauth = load_cauth(args.cauth)
    session = make_session(cauth)
    courses = args.course or SPECIALIZATION_SLUGS
    args.out.mkdir(parents=True, exist_ok=True)
    debug_dir = Path("./debug") if args.debug else None

    for slug in courses:
        try:
            download_course(session, slug, args.out, set(args.skip), debug_dir=debug_dir)
        except requests.HTTPError as e:
            print(f"skipping {slug}: {e}", file=sys.stderr)

    print(f"\nDone. Output: {args.out.resolve()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
