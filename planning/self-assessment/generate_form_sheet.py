#!/usr/bin/env python3
"""
Regenerates the MS-Forms build sheet from self-assessment-form-spec.json.
Usage: python3 generate_form_sheet.py
Edit the JSON, rerun this, get a fresh build sheet — no re-typing.
"""
import json
from pathlib import Path

SPEC_PATH = Path(__file__).parent / "self-assessment-form-spec.json"
OUT_PATH = Path(__file__).parent / "self-assessment-form-BUILD-SHEET.md"

def render_scale(scale):
    lines = []
    for k in ["1", "2", "3", "4", "5"]:
        lines.append(f"  {k} — {scale[k]}")
    return "\n".join(lines)

def render_field(f, scale):
    lines = [f"### {f['order']}. {f['label']}"]
    lines.append(f"- **Field id:** `{f['id']}`")
    lines.append(f"- **Type:** {f['type']}")
    lines.append(f"- **Required:** {'Yes' if f['required'] else 'No'}")

    if f['type'] == 'single-select':
        lines.append(f"- **Options:** {f.get('optionsSource', '')}")
    if f['type'] == 'multi-select':
        opts = "\n".join(f"  - {o}" for o in f.get('options', []))
        lines.append(f"- **Options (tick all that apply):**\n{opts}")
    if f['type'] == 'scale-1to5':
        lines.append(f"- **Scale:**\n{render_scale(scale)}")
    if f.get('note'):
        lines.append(f"- **Note:** {f['note']}")

    return "\n".join(lines)

def main():
    spec = json.loads(SPEC_PATH.read_text())
    fields = sorted(spec['fields'], key=lambda f: f['order'])
    scale = spec['confidenceScale']

    out = []
    out.append(f"# Self-Assessment Form — Build Sheet")
    out.append(f"**Cycle:** {spec['cycleId']}  ")
    out.append(f"**Focus:** {', '.join(spec['focus'])}  ")
    out.append(f"**Send date:** {spec['sendDate']}  ")
    out.append(f"**Reminder:** {spec['reminderWindow']}\n")
    out.append("Build these questions into Microsoft Forms in this exact order. "
                "Field ids are for the Hub importer later — they don't appear in the Form itself, "
                "just keep this sheet as the reference.\n")
    out.append("---\n")

    for f in fields:
        out.append(render_field(f, scale))
        out.append("")

    out.append("---\n")
    out.append("_Regenerated from `self-assessment-form-spec.json` — edit the JSON, not this file._")

    OUT_PATH.write_text("\n".join(out))
    print(f"Written: {OUT_PATH}")

if __name__ == "__main__":
    main()
