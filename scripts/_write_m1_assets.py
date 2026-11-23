# -*- coding: utf-8 -*-
"""One-shot helper to materialize M1 snapshot JSON + remaining source files."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
SNAP = DATA / "snapshots"
SNAP.mkdir(parents=True, exist_ok=True)

CANVAS = {
    "id": "canvas",
    "label": "图一抄录（第三方画布）",
    "storyTime": "2025-03-15T10:12:00+08:00",
    "source": "research-figure-1-ocr",
    "notSameMomentAs": "runtime",
    "notes": [
        "浅灰底、蓝色虚线管；入口压力单位为 kPa。",
        "与 runtime 产线照片非同一采样时刻，禁止拼成同一数据集。",
        "坏点：valve.8=无数据→NODATA；valve.7=-0.75→BAD；不得驱动开度动画。",
    ],
    "presentation": {"pipeColor": "blue-dashed", "background": "light-gray"},
    "values": [
        {"id": "HG-UF-101.pressure", "value": 4676.98, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "HG-UF-101.temperature", "value": 39.55, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "HG-UF-101.cumStd", "value": 31378607, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "HG-UF-101.cumWork", "value": 645092, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "HG-UF-101.flowWork", "value": 0, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "HG-UF-101.dp2", "value": 0, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "HG-UF-102.pressure", "value": 4676.52, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "HG-UF-102.temperature", "value": 38.62, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "HG-UF-102.velocity", "value": 0, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "HG-UF-102.flowWork", "value": 0, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "HG-UF-102.flowStd", "value": 0, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "HG-UF-102.dp1", "value": -0.06, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "elster.afterReg.temperature", "value": 38.77, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "elster.afterReg.pressure", "value": 1.06, "quality": "UNCERTAIN", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "weisi.afterReg.temperature", "value": 38.76, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "weisi.afterReg.pressure", "value": 0.86, "quality": "UNCERTAIN", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "outlet.temperature", "value": 38, "quality": "GOOD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "outlet.pressure", "value": 1.06, "quality": "UNCERTAIN", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "valve.7.opening", "value": -0.75, "quality": "BAD", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "valve.8.opening", "value": None, "quality": "NODATA", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "HG-PCV10213.valveColor", "value": None, "quality": "NODATA", "ts": "2025-03-15T10:12:00+08:00"},
        {"id": "HG-PCV10223.valveColor", "value": None, "quality": "NODATA", "ts": "2025-03-15T10:12:00+08:00"},
    ],
}

RUNTIME = {
    "id": "runtime",
    "label": "产线色态关系（MCGS/照片）",
    "storyTime": "2025-04-08T14:20:40+08:00",
    "source": "plant-screen-photo-color-relation",
    "notSameMomentAs": "canvas",
    "notes": [
        "黄管、红/绿阀色；左上约 29°C，与图一 ~38°C 非同时刻。",
        "storyTime 对齐 MCGS 特写可读时钟；数值为运行态示意，非已核对生产监视。",
        "禁止与 canvas 快照按同一 ts 合并。",
    ],
    "presentation": {
        "pipeColor": "yellow",
        "background": "process-dark",
        "valveColors": {"open": "green", "closed": "red", "bad": "gray"},
    },
    "values": [
        {"id": "HG-UF-101.pressure", "value": 4.62, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "HG-UF-101.temperature", "value": 29.0, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "HG-UF-101.cumStd", "value": 31410200, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "HG-UF-101.cumWork", "value": 646100, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "HG-UF-101.flowWork", "value": 12.4, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "HG-UF-101.dp2", "value": 0.12, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "HG-UF-102.pressure", "value": 4.58, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "HG-UF-102.temperature", "value": 28.7, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "HG-UF-102.velocity", "value": 0.8, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "HG-UF-102.flowWork", "value": 11.9, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "HG-UF-102.flowStd", "value": 118.0, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "HG-UF-102.dp1", "value": 0.05, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "elster.afterReg.temperature", "value": 28.9, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "elster.afterReg.pressure", "value": 1.05, "quality": "UNCERTAIN", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "weisi.afterReg.temperature", "value": 28.8, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "weisi.afterReg.pressure", "value": 0.9, "quality": "UNCERTAIN", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "outlet.temperature", "value": 29.0, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "outlet.pressure", "value": 1.05, "quality": "UNCERTAIN", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "valve.7.opening", "value": 100, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "valve.8.opening", "value": 0, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "HG-PCV10213.valveColor", "value": 1, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
        {"id": "HG-PCV10223.valveColor", "value": 0, "quality": "GOOD", "ts": "2025-04-08T14:20:40+08:00"},
    ],
}


def dump(path: Path, obj: object) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", path)


if __name__ == "__main__":
    dump(SNAP / "snapshot-canvas.json", CANVAS)
    dump(SNAP / "snapshot-runtime.json", RUNTIME)
