"""Export audited Sprint 1 Markdown to A4 DOCX, readable UTF-8 TXT, and clean source ZIP.

Use the bundled Python runtime. No functional files or local demo data are written.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import zipfile
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'deliverables' / 'final'
GIT = shutil.which('git')
if not GIT:
    raise RuntimeError('Git is required to export a clean tracked source baseline')
MAPPING = {
    'sprint-planning': '第7组_Sprint1计划会会议纪要',
    'sprint-review': '第7组_Sprint评审会议纪要',
    'sprint-retrospective': '第7组_Sprint回顾会议纪要',
    'ai-interactions': '第7组_AI互动原始记录',
    'sprint-self-evaluation': '第7组_4+n团队Sprint1自评报告',
    'dri-message': '第7组_DRI期望寄语',
}
CODE_BASE = None  # Resolved to an immutable committed tree at export time.


def git(*args):
    return subprocess.check_output([str(GIT), *args], cwd=ROOT)


def plain(text):
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1（\2）', text)
    return text.replace('`', '').replace('**', '').replace('<br>', '\n')


def blocks(md):
    lines = md.splitlines()
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        if not s:
            i += 1
            continue
        if s.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                row = [plain(x.strip()) for x in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r'[:\- ]+', x) for x in row):
                    rows.append(row)
                i += 1
            yield ('table', rows)
            continue
        m = re.match(r'^(#{1,3})\s+(.*)$', s)
        if m:
            yield ('heading', (len(m[1]), plain(m[2])))
        else:
            yield ('paragraph', plain(s))
        i += 1


def txt_content(items):
    result = []
    for kind, value in items:
        if kind == 'heading':
            result.extend([value[1], ''])
        elif kind == 'paragraph':
            result.extend([value, ''])
        else:
            heads, *rows = value
            for n, row in enumerate(rows, 1):
                result.append(f'条目{n}')
                result.extend(f'{h}：{v}' for h, v in zip(heads, row))
                result.append('')
    return '\n'.join(result).rstrip() + '\n'


def font(obj, size, bold=False, east='宋体'):
    obj.font.name = 'Arial'
    obj.font.size = Pt(size)
    obj.font.bold = bold
    obj.font.color.rgb = RGBColor(0, 0, 0)
    rpr = obj.element.get_or_add_rPr() if hasattr(obj, 'element') else obj._element.get_or_add_rPr()
    rf = rpr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts')
        rpr.insert(0, rf)
    rf.set(qn('w:eastAsia'), east)
    for key in ('asciiTheme', 'hAnsiTheme', 'eastAsiaTheme', 'cstheme'):
        rf.attrib.pop(qn('w:' + key), None)


def add_table(doc, rows):
    count = len(rows[0])
    table = doc.add_table(rows=0, cols=count)
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    # Narrative columns get room; compact statuses, people, and counts stay narrow.
    weights = []
    for col in range(count):
        avg = sum(len(r[col]) for r in rows) / len(rows)
        weights.append(min(34, max(9, avg)))
    widths = [Cm(16.6 * w / sum(weights)) for w in weights]
    for col, width in zip(table.columns, widths):
        col.width = width
    pr = table._tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement('w:' + edge)
        for k, v in {'val': 'single', 'sz': '4', 'color': 'D9D9D9'}.items():
            e.set(qn('w:' + k), v)
        borders.append(e)
    pr.append(borders)
    for ri, row in enumerate(rows):
        cells = table.add_row().cells
        for ci, (cell, text) in enumerate(zip(cells, row)):
            cell.width = widths[ci]
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tcpr = cell._tc.get_or_add_tcPr()
            mar = OxmlElement('w:tcMar')
            for edge, size in [('top', '70'), ('bottom', '70'), ('left', '90'), ('right', '90')]:
                child = OxmlElement('w:' + edge)
                child.set(qn('w:w'), size)
                child.set(qn('w:type'), 'dxa')
                mar.append(child)
            tcpr.append(mar)
            if ri == 0:
                shade = OxmlElement('w:shd')
                shade.set(qn('w:fill'), 'E7E6E6')
                tcpr.append(shade)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.1
            if ri == 0:
                p.paragraph_format.keep_with_next = True
            if len(text) <= 10:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            font(p.add_run(text), 10, ri == 0)
        if ri == 0:
            repeat = OxmlElement('w:tblHeader')
            table.rows[ri]._tr.get_or_add_trPr().append(repeat)
        # Each record is short, so keep an individual table row intact.
        intact = OxmlElement('w:cantSplit')
        table.rows[ri]._tr.get_or_add_trPr().append(intact)
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(0)
    spacer.paragraph_format.line_spacing = Pt(4)
    font(spacer.add_run(''), 1)


def make_docx(items, dest, is_ai=False):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.top_margin, sec.bottom_margin = Cm(2), Cm(2)
    sec.left_margin, sec.right_margin = Cm(2.2), Cm(2.2)
    for name, size, bold in [('Normal', 11, False), ('Title', 19, True), ('Heading 1', 14, True), ('Heading 2', 12, True)]:
        st = doc.styles[name]
        font(st, size, bold, '黑体' if bold else '宋体')
        pf = st.paragraph_format
        pf.space_after = Pt(4 if name == 'Normal' else 6)
        pf.space_before = Pt(0 if name in ('Normal', 'Title') else 8)
        pf.line_spacing = 1.15
        pf.widow_control = True
        if name != 'Normal':
            pf.keep_with_next = True
    # Remove built-in Title rule and theme residues from every style.
    for st in doc.styles:
        for border in list(st.element.findall('.//' + qn('w:pBdr'))):
            border.getparent().remove(border)
        for color in st.element.findall('.//' + qn('w:color')):
            color.set(qn('w:val'), '000000')
            for k in list(color.attrib):
                if k != qn('w:val'):
                    del color.attrib[k]
    title_seen = False
    for kind, value in items:
        if kind == 'heading':
            level, text = value
            if not title_seen:
                p = doc.add_paragraph(text, 'Title')
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                title_seen = True
            else:
                doc.add_paragraph(text, 'Heading 1' if level == 2 else 'Heading 2')
        elif kind == 'table':
            add_table(doc, value)
        else:
            p = doc.add_paragraph(value)
            # AI records are structured fields, with normal prose spacing elsewhere.
            if is_ai and re.match(r'^(时间|人类成员|AI角色|任务场景|人类输入|AI输出|团队处置|记录来源)', value):
                p.paragraph_format.space_after = Pt(2)
    footer = sec.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    font(footer.add_run('第 '), 9)
    field = OxmlElement('w:fldSimple')
    field.set(qn('w:instr'), 'PAGE')
    footer._p.append(field)
    font(footer.add_run(' 页'), 9)
    doc.core_properties.author = '第7组 爱管理项目团队'
    doc.core_properties.last_modified_by = '第7组 爱管理项目团队'
    doc.core_properties.title = items[0][1][1]
    doc.core_properties.subject = '软件项目管理实验二 Sprint 1 正式追溯交付'
    doc.save(dest)


def pack_source():
    dest = OUT / '第7组_Sprint1源代码.zip'
    tracked = git('ls-tree', '-r', '--name-only', CODE_BASE).decode('utf-8').splitlines()
    code_files = [p for p in tracked if p.startswith(('src/', 'public/', 'test/', '.github/'))
                  or p in ('server.js', 'package.json', 'package-lock.json', '.gitignore', 'data/db.json')]
    entries = {p: git('show', f'{CODE_BASE}:{p}') for p in code_files}
    entries['README.md'] = git('show', f'{CODE_BASE}:README.md')
    for path in tracked:
        if path.startswith('docs/'):
            entries[path] = git('show', f'{CODE_BASE}:{path}')
    personal = 'deliverables/第7组_成员一彭佳成_US01交付说明.txt'
    entries[personal] = git('show', f'{CODE_BASE}:{personal}')
    entries['源代码交付说明.txt'] = git('show', f'{CODE_BASE}:deliverables/final/第7组_Sprint1源代码交付说明.txt')
    assert json.loads(entries['data/db.json'])['tasks'] == []
    forbidden = ('node_modules', '.git/', 'experiment1-reference', '.delivery-work', '.env')
    assert not any(any(x in p for x in forbidden) for p in entries)
    manifest = ['源文件清单及SHA256', f'代码及文档已提交基线：{CODE_BASE}', '所有源文件来自同一Git提交；服务状态修复05c7499已包含']
    manifest += [f'{hashlib.sha256(b).hexdigest()}  {p}' for p, b in sorted(entries.items())]
    entries['源文件清单.txt'] = ('\n'.join(manifest) + '\n').encode('utf-8')
    with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as archive:
        for p, content in sorted(entries.items()):
            archive.writestr(p, content)
    print(f'Source ZIP: {len(entries)} files; clean four-member seed; {dest}')


def verify():
    for source, name in MAPPING.items():
        expected = list(blocks((ROOT / 'docs' / f'{source}.md').read_text(encoding='utf-8-sig')))
        txt = (OUT / f'{name}.txt').read_text(encoding='utf-8')
        assert txt == txt_content(expected), name
        assert not re.search(r'<br>|^#', txt, re.M), name
        if source != 'ai-interactions':
            assert not re.search(r'TBD|待填写|待团队确认|候选', txt), name
        # AI history intentionally quotes old draft/pending dispositions as history.
        doc = Document(OUT / f'{name}.docx')
        actual = []
        p_map = {p._p: p.text for p in doc.paragraphs}
        t_map = {t._tbl: [[c.text for c in r.cells] for r in t.rows] for t in doc.tables}
        for child in doc.element.body:
            if child in p_map and p_map[child]:
                actual.append(('text', p_map[child]))
            elif child in t_map:
                actual.append(('table', t_map[child]))
        wanted = [('table', v) if k == 'table' else ('text', v[1] if k == 'heading' else v) for k, v in expected]
        assert actual == wanted, f'DOCX source mismatch: {name}'
        for ext in ('txt', 'docx'):
            assert (ROOT / 'deliverables' / f'{name}.{ext}').read_bytes() == (OUT / f'{name}.{ext}').read_bytes()
        assert abs(doc.sections[0].page_width.cm - 21) < .01
        print(f'PARITY OK: {name}')
    assert len(list(OUT.glob('*.docx'))) == 6
    assert len(re.findall(r'^### 记录\d+ ', (ROOT / 'docs/ai-interactions.md').read_text(encoding='utf-8'), re.M)) == 17
    assert len((ROOT / 'docs/dri-message.md').read_text(encoding='utf-8').splitlines()[-1]) <= 100
    with zipfile.ZipFile(OUT / '第7组_Sprint1源代码.zip') as archive:
        assert archive.testzip() is None
        assert json.loads(archive.read('data/db.json'))['tasks'] == []
    print('17 historical records; DRI under 100 characters; A4 and ZIP integrity OK')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['build', 'pack', 'verify'], nargs='?', default='build')
    parser.add_argument('--source-ref', default='HEAD', help='Committed source/document tree to package')
    args = parser.parse_args()
    CODE_BASE = git('rev-parse', '--verify', args.source_ref + '^{commit}').decode().strip()
    OUT.mkdir(parents=True, exist_ok=True)
    if args.mode == 'build':
        for source, name in MAPPING.items():
            items = list(blocks((ROOT / 'docs' / f'{source}.md').read_text(encoding='utf-8-sig')))
            (OUT / f'{name}.txt').write_text(txt_content(items), encoding='utf-8', newline='\n')
            make_docx(items, OUT / f'{name}.docx', source == 'ai-interactions')
            for ext in ('txt', 'docx'):
                shutil.copy2(OUT / f'{name}.{ext}', ROOT / 'deliverables' / f'{name}.{ext}')
            print(f'Exported: {name}')
        pack_source()
        verify()
    elif args.mode == 'pack':
        pack_source()
    else:
        verify()
