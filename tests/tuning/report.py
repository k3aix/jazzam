#!/usr/bin/env python3
"""
Generate a self-contained HTML report from an OAT sweep results JSON.

Usage:
  python3 report.py results/sweep-TIMESTAMP.json [output.html]
  python3 report.py results/sweep-*.json          (picks latest)
"""

import json
import sys
import glob
import os
from html import escape

# ── Load data ─────────────────────────────────────────────────────────────────

pattern_or_file = sys.argv[1] if len(sys.argv) > 1 else 'results/sweep-*.json'
matches = sorted(glob.glob(pattern_or_file))
if not matches:
    print(f"No file found: {pattern_or_file}"); sys.exit(1)
src = matches[-1]
print(f"Reading: {src}")

with open(src) as f:
    data = json.load(f)

out_file = sys.argv[2] if len(sys.argv) > 2 else src.replace('.json', '.html')

# Filter out crashed variants (0 found in <100ms — service didn't start)
valid = [v for v in data if not (v['foundCount'] == 0 and v['durationMs'] < 500)]
crashed = [v for v in data if v['foundCount'] == 0 and v['durationMs'] < 500]

baseline = next(v for v in valid if v['variant']['name'] == 'baseline')
total = baseline['totalCases']
base_t1 = baseline['top1Count']
base_found = baseline['foundCount']

# Case titles (from baseline results)
case_titles = [r['testCase']['title'] for r in baseline['results']]

# Sort variants: baseline first, then by top1 desc, then found desc
sorted_variants = sorted(
    valid,
    key=lambda v: (-v['top1Count'], -v['foundCount'], v['variant']['name'])
)

# ── Per-case matrix ───────────────────────────────────────────────────────────

def rank_badge(result, base_result):
    """Return (html, css_class) for a case result cell."""
    if not result['found']:
        return '✗', 'miss'
    r = result['rank']
    conf = result['confidence']
    base_r = base_result['rank'] if base_result['found'] else None

    if r == 1:
        cls = 'top1-better' if (base_r is None or base_r > 1) else 'top1'
        return f'#1', cls
    improvement = base_r is not None and r < base_r
    cls = 'found-better' if improvement else 'found'
    return f'#{r}', cls

# Build lookup: variant_name → {case_title: result}
variant_case = {}
for v in valid:
    variant_case[v['variant']['name']] = {
        r['testCase']['title']: r for r in v['results']
    }

# ── Chart data ────────────────────────────────────────────────────────────────

chart_labels = json.dumps([v['variant']['name'] for v in sorted_variants])
chart_t1     = json.dumps([v['top1Count'] for v in sorted_variants])
chart_found  = json.dumps([v['foundCount'] for v in sorted_variants])
chart_colors = json.dumps([
    '#f59e0b' if v['variant']['name'] == 'baseline'
    else '#22c55e' if v['top1Count'] > base_t1
    else '#ef4444' if v['top1Count'] < base_t1
    else '#64748b'
    for v in sorted_variants
])

# ── HTML ──────────────────────────────────────────────────────────────────────

def variant_row(v):
    name = v['variant']['name']
    desc = v['variant'].get('description', '')
    t1 = v['top1Count']
    found = v['foundCount']
    dur = v['durationMs'] // 1000

    t1_delta = t1 - base_t1
    found_delta = found - base_found

    if name == 'baseline':
        row_cls = 'row-baseline'
    elif t1 > base_t1:
        row_cls = 'row-better'
    elif t1 < base_t1:
        row_cls = 'row-worse'
    else:
        row_cls = 'row-same'

    delta_t1_html = (
        '' if t1_delta == 0
        else f'<span class="delta pos">+{t1_delta}</span>' if t1_delta > 0
        else f'<span class="delta neg">{t1_delta}</span>'
    )
    delta_found_html = (
        '' if found_delta == 0
        else f'<span class="delta pos">+{found_delta}</span>' if found_delta > 0
        else f'<span class="delta neg">{found_delta}</span>'
    )

    case_cells = ''
    base_map = variant_case['baseline']
    v_map = variant_case[name]
    for title in case_titles:
        r = v_map.get(title)
        br = base_map.get(title)
        if r is None:
            case_cells += '<td class="miss">?</td>'
            continue
        badge, cls = rank_badge(r, br)
        conf_str = f'{r["confidence"]:.2f}' if r['confidence'] is not None else ''
        case_cells += f'<td class="{cls}" title="{escape(title)}: {conf_str}">{badge}</td>'

    return f'''
    <tr class="{row_cls}">
      <td class="name" title="{escape(desc)}">{escape(name)}</td>
      <td class="num">{t1}/{total} {delta_t1_html}</td>
      <td class="num">{found}/{total} {delta_found_html}</td>
      <td class="dur">{dur}s</td>
      {case_cells}
    </tr>'''

case_headers = ''.join(
    f'<th class="case-th" title="{escape(t)}">{escape(t[:12])}</th>'
    for t in case_titles
)

crashed_note = ''
if crashed:
    names = ', '.join(v['variant']['name'] for v in crashed)
    crashed_note = f'<p class="crashed-note">⚠ Crashed / skipped (service did not start): {escape(names)}</p>'

rows_html = '\n'.join(variant_row(v) for v in sorted_variants)

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OAT Sweep — {os.path.basename(src)}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; font-size: 13px; }}
  h1 {{ font-size: 1.2rem; font-weight: 700; color: #f8fafc; }}
  h2 {{ font-size: 0.85rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }}
  .header {{ padding: 20px 24px 12px; border-bottom: 1px solid #1e293b; display:flex; gap:24px; align-items:baseline; }}
  .meta {{ color: #64748b; font-size: 0.78rem; }}
  .stat {{ background:#1e293b; border-radius:8px; padding:10px 16px; }}
  .stat-val {{ font-size:1.6rem; font-weight:700; color:#f59e0b; }}
  .stat-lbl {{ font-size:0.72rem; color:#64748b; }}
  .stats {{ display:flex; gap:12px; padding:16px 24px; }}
  .chart-wrap {{ padding: 0 24px 24px; max-width: 1200px; }}
  canvas {{ background:#1e293b; border-radius:8px; padding:12px; }}
  .table-wrap {{ padding: 0 24px 40px; overflow-x: auto; }}
  table {{ border-collapse: collapse; white-space: nowrap; }}
  th {{ background:#1e293b; color:#94a3b8; font-size:0.72rem; font-weight:600;
        text-transform:uppercase; letter-spacing:.04em; padding:6px 10px;
        position:sticky; top:0; z-index:2; border-bottom:1px solid #334155; }}
  th.case-th {{ writing-mode: vertical-rl; text-orientation: mixed;
                transform: rotate(180deg); height: 90px; padding: 4px 6px;
                font-size:0.65rem; font-weight:400; color:#64748b; }}
  td {{ padding: 5px 10px; border-bottom: 1px solid #1e293b; vertical-align:middle; }}
  td.name {{ font-weight: 500; color: #cbd5e1; min-width: 200px; }}
  td.num {{ text-align: center; font-variant-numeric: tabular-nums; }}
  td.dur {{ text-align: right; color: #475569; font-size: 0.72rem; }}
  .delta {{ font-size:0.72rem; margin-left:4px; font-weight:600; }}
  .delta.pos {{ color: #22c55e; }}
  .delta.neg {{ color: #ef4444; }}

  /* Per-case cells */
  td.top1       {{ text-align:center; background:#166534; color:#86efac; font-weight:700; font-size:0.72rem; }}
  td.top1-better{{ text-align:center; background:#14532d; color:#4ade80; font-weight:700; font-size:0.72rem; border:1px solid #22c55e; }}
  td.found      {{ text-align:center; background:#1e3a5f; color:#93c5fd; font-size:0.72rem; }}
  td.found-better{{text-align:center; background:#1e3a5f; color:#60a5fa; font-size:0.72rem; border:1px solid #3b82f6; }}
  td.miss       {{ text-align:center; color:#475569; font-size:0.72rem; }}

  /* Row highlights */
  tr.row-baseline {{ background: #1c1f2e; }}
  tr.row-better   {{ background: #0f2d1a; }}
  tr.row-worse    {{ background: #2d0f0f; }}
  tr.row-same     {{ background: #0f172a; }}
  tr:hover td     {{ filter: brightness(1.15); }}

  .crashed-note {{ color:#f59e0b; font-size:0.78rem; padding: 0 24px 12px; }}
  .legend {{ display:flex; gap:16px; padding: 8px 24px 16px; font-size:0.75rem; color:#64748b; }}
  .legend span {{ display:inline-flex; align-items:center; gap:6px; }}
  .dot {{ width:10px; height:10px; border-radius:50%; display:inline-block; }}
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>OAT Parameter Sweep</h1>
    <div class="meta">{escape(os.path.basename(src))} &nbsp;·&nbsp; {len(valid)} variants &nbsp;·&nbsp; {total} test cases</div>
  </div>
</div>

<div class="stats">
  <div class="stat"><div class="stat-val">{base_t1}/{total}</div><div class="stat-lbl">Baseline #1</div></div>
  <div class="stat"><div class="stat-val">{base_found}/{total}</div><div class="stat-lbl">Baseline found</div></div>
  <div class="stat"><div class="stat-val">{max(v['top1Count'] for v in valid)}/{total}</div><div class="stat-lbl">Best #1 (any variant)</div></div>
  <div class="stat"><div class="stat-val">{sum(1 for v in valid if v['top1Count'] > base_t1)}</div><div class="stat-lbl">Variants beating baseline</div></div>
</div>

{crashed_note}

<div class="chart-wrap">
  <h2 style="margin-bottom:10px">Top-1 score by variant</h2>
  <canvas id="chart" height="80"></canvas>
</div>

<div class="legend">
  <span><span class="dot" style="background:#f59e0b"></span> Baseline</span>
  <span><span class="dot" style="background:#22c55e"></span> Better than baseline</span>
  <span><span class="dot" style="background:#64748b"></span> Same as baseline</span>
  <span><span class="dot" style="background:#ef4444"></span> Worse than baseline</span>
</div>

<div class="table-wrap">
  <h2 style="margin-bottom:10px">Per-variant / per-case breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Variant</th>
        <th>#1</th>
        <th>Found</th>
        <th>Time</th>
        {case_headers}
      </tr>
    </thead>
    <tbody>
      {rows_html}
    </tbody>
  </table>
</div>

<script>
new Chart(document.getElementById('chart'), {{
  type: 'bar',
  data: {{
    labels: {chart_labels},
    datasets: [
      {{
        label: '#1 (top-1)',
        data: {chart_t1},
        backgroundColor: {chart_colors},
        borderRadius: 3,
      }},
      {{
        label: 'Found (any rank)',
        data: {chart_found},
        backgroundColor: 'rgba(148,163,184,0.15)',
        borderRadius: 3,
      }}
    ]
  }},
  options: {{
    responsive: true,
    plugins: {{
      legend: {{ labels: {{ color: '#94a3b8', font: {{ size: 11 }} }} }},
      tooltip: {{
        callbacks: {{
          label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y + '/{total}'
        }}
      }}
    }},
    scales: {{
      x: {{ ticks: {{ color: '#64748b', font: {{ size: 10 }}, maxRotation: 45 }}, grid: {{ color: '#1e293b' }} }},
      y: {{ min: 0, max: {total}, ticks: {{ color: '#94a3b8', stepSize: 5 }}, grid: {{ color: '#1e293b' }} }}
    }}
  }}
}});
</script>
</body>
</html>
"""

with open(out_file, 'w') as f:
    f.write(html)

print(f"Report saved: {out_file}")
