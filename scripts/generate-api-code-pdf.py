"""Generate a PDF containing ALL API route.ts source code with syntax highlighting."""

import os, html as html_mod, re
from pathlib import Path

BASE = '/home/z/my-project/src/app/api'
OUTPUT_HTML = '/home/z/my-project/scripts/api-code.html'
OUTPUT_PDF = '/home/z/my-project/download/Veda-ERP-API-Source-Code.pdf'

# Collect all route.ts files sorted
files = sorted(Path(BASE).rglob('route.ts'))
print(f'Found {len(files)} route files')

# Section grouping by top-level module
sections = {}
for f in files:
    rel = f.relative_to(BASE)
    parts = rel.parts
    top = parts[0]
    if top not in sections:
        sections[top] = []
    sections[top].append(f)

# Escape HTML
def esc(text):
    return html_mod.escape(text)

# Build HTML
html_parts = []

# CSS + Prism
html_parts.append('''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Veda ERP - API Source Code</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
@page {
  size: A4 portrait;
  margin: 15mm 12mm 15mm 12mm;
}
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  font-family: 'Inter', -apple-system, sans-serif;
}

/* Cover */
.cover {
  page-break-after: always;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #1a1a2e;
  color: #fff;
  text-align: center;
  padding: 40px;
  box-sizing: border-box;
}
.cover h1 { font-size: 42px; margin: 0 0 8px; font-weight: 700; letter-spacing: -1px; }
.cover h2 { font-size: 20px; margin: 0 0 24px; color: #94a3b8; font-weight: 400; }
.cover .stats { color: #64748b; font-size: 13px; line-height: 1.8; }
.cover .divider { width: 60px; height: 3px; background: #97781b; margin: 20px auto; border-radius: 2px; }

/* TOC */
.toc {
  page-break-after: always;
  padding: 20px 0;
}
.toc h2 { color: #1a1a2e; font-size: 22px; margin: 0 0 16px; border-bottom: 2px solid #97781b; padding-bottom: 8px; }
.toc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 24px;
}
.toc-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
}
.toc-item .path { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: #97781b; font-weight: 500; }
.toc-item .count { color: #94a3b8; font-size: 10px; margin-left: auto; }

/* File section */
.file-section {
  page-break-before: always;
  margin-bottom: 12px;
}
.file-header {
  background: #1e293b;
  color: #e2e8f0;
  padding: 8px 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  border-radius: 6px 6px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.file-header .file-path { color: #94a3b8; }
.file-header .file-lines { color: #64748b; font-size: 10px; }

/* Code block */
.code-block {
  background: #fafafa;
  border: 1px solid #e2e8f0;
  border-top: none;
  border-radius: 0 0 6px 6px;
  padding: 0;
  overflow: hidden;
}
.code-block pre {
  margin: 0;
  padding: 12px 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 7.5px;
  line-height: 1.55;
  color: #1e293b;
  white-space: pre;
  tab-size: 2;
  overflow-x: hidden;
}

/* Prism overrides for smaller font */
.token.keyword { color: #7c3aed; }
.token.string, .token.template-string { color: #059669; }
.token.comment { color: #94a3b8; font-style: italic; }
.token.function { color: #2563eb; }
.token.number { color: #d97706; }
.token.operator { color: #475569; }
.token.class-name { color: #0891b2; }
.token.builtin { color: #c026d3; }
.token.boolean { color: #d97706; }
.token.punctuation { color: #64748b; }
.token.constant { color: #0891b2; }
.token.parameter { color: #9333ea; }
.token.property { color: #0369a1; }
.token.tag { color: #7c3aed; }
.token.attr-name { color: #059669; }
.token.attr-value { color: #d97706; }
</style>
</head>
<body>
''')

# Cover page
html_parts.append('''
<div class="cover">
  <h1>Veda ERP</h1>
  <h2>API Source Code</h2>
  <div class="divider"></div>
  <div class="stats">
    ''' + str(len(files)) + ''' Route Files | 13 Modules<br>
    Next.js App Router | TypeScript<br>
    MongoDB + JWT Authentication
  </div>
</div>
''')

# TOC
html_parts.append('<div class="toc"><h2>Table of Contents</h2><div class="toc-grid">\n')
for sec_name in sorted(sections.keys()):
    sec_files = sections[sec_name]
    paths_str = '<br>'.join(f'/api/{f.relative_to(BASE)}' for f in sec_files)
    html_parts.append(f'<div class="toc-item"><span class="path">/api/{esc(sec_name)}/</span><span class="count">{len(sec_files)} files</span></div>\n')
html_parts.append('</div></div>\n')

# File sections
for f in files:
    rel_path = f'/api/{f.relative_to(BASE)}'
    code = f.read_text(encoding='utf-8', errors='replace')
    lines = code.count('\n') + 1
    
    # Escape for HTML
    code_escaped = esc(code)
    
    html_parts.append(f'<div class="file-section">\n')
    html_parts.append(f'<div class="file-header"><span class="file-path">{rel_path}</span><span class="file-lines">{lines} lines</span></div>\n')
    html_parts.append(f'<div class="code-block"><pre class="language-typescript"><code class="language-typescript">{code_escaped}</code></pre></div>\n')
    html_parts.append(f'</div>\n')

html_parts.append('''
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
<script>Prism.highlightAll();</script>
</body>
</html>
''')

# Write HTML
full_html = ''.join(html_parts)
with open(OUTPUT_HTML, 'w', encoding='utf-8') as fh:
    fh.write(full_html)

print(f'HTML written: {OUTPUT_HTML} ({os.path.getsize(OUTPUT_HTML)/1024/1024:.1f} MB)')
print(f'Files: {len(files)}, Total lines: {sum(1 for f in files for _ in open(f))}')
