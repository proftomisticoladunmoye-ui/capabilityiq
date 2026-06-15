// Live document exporters: Word (.docx), Excel (.xlsx), PowerPoint (.pptx).
// All driven from the same HCI profile object that powers the dashboard, so the
// reporting layer never diverges from what the user sees on screen.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} from 'docx';
import ExcelJS from 'exceljs';
import PptxGenJS from 'pptxgenjs';

const NAVY = '0B2545';
const GOLD = 'B8860B';
const SLATE = '5C677D';

// ---- WORD ---------------------------------------------------------------
function cell(text, { bold = false, color, fill, align = AlignmentType.LEFT, width } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: fill ? { fill } : undefined,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text: String(text), bold, color })] })],
  });
}

export async function buildDocx(profile, user) {
  const headerRow = (cells) =>
    new TableRow({ children: cells.map((c) => cell(c, { bold: true, color: 'FFFFFF', fill: NAVY })) });

  const dimTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow(['Dimension', 'Score', 'Level']),
      ...profile.dimensions.map((d, i) =>
        new TableRow({
          children: [
            cell(d.name, { fill: i % 2 ? 'F8F9FB' : 'FFFFFF' }),
            cell(d.score ?? '—', { align: AlignmentType.RIGHT, bold: true, color: NAVY, fill: i % 2 ? 'F8F9FB' : 'FFFFFF' }),
            cell(d.level ?? '—', { fill: i % 2 ? 'F8F9FB' : 'FFFFFF' }),
          ],
        })
      ),
    ],
  });

  const gapTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow(['#', 'Dimension', 'Score', 'Gap', 'Recommended action']),
      ...profile.gaps.map((g, i) =>
        new TableRow({
          children: [
            cell(i + 1), cell(g.name, { bold: true }),
            cell(g.score, { align: AlignmentType.RIGHT }),
            cell(g.gap, { align: AlignmentType.RIGHT, color: GOLD, bold: true }),
            cell(profile.recommendations[i]?.action || ''),
          ],
        })
      ),
    ],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{
      properties: {},
      children: [
        new Paragraph({ children: [new TextRun({ text: 'CAPABILITY IQ™  ·  HUMAN CAPABILITY INTELLIGENCE REPORT', color: GOLD, bold: true, size: 18 })] }),
        new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: user?.name || 'Individual Capability Profile', color: NAVY })] }),
        new Paragraph({ children: [new TextRun({ text: `${user?.role || 'individual'}  ·  Generated ${new Date(profile.generatedAt).toLocaleDateString()}  ·  ${profile.completion}% complete`, color: SLATE })] }),
        new Paragraph({ spacing: { before: 240 }, children: [
          new TextRun({ text: `Human Capability Index: `, bold: true, size: 28 }),
          new TextRun({ text: `${profile.hci}/100 `, bold: true, color: NAVY, size: 36 }),
          new TextRun({ text: `(${profile.level.label})`, color: GOLD, bold: true, size: 28 }),
        ] }),
        new Paragraph({ spacing: { before: 120 }, children: [new TextRun({
          text: `Career ${profile.readiness.career} · AI ${profile.readiness.ai} · Leadership ${profile.readiness.leadership} · Entrepreneurship ${profile.readiness.entrepreneurship} · Research ${profile.readiness.research}`,
          color: SLATE,
        })] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280 }, children: [new TextRun({ text: 'Capability Dimensions', color: NAVY })] }),
        dimTable,
        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280 }, children: [new TextRun({ text: 'Priority Development Gaps', color: NAVY })] }),
        gapTable,
        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280 }, children: [new TextRun({ text: 'Growth Outlook', color: NAVY })] }),
        new Paragraph({ children: [new TextRun({ text:
          `Growth potential ${profile.growth.score} with ${profile.growth.headroom} points of headroom. ` +
          `Projected 12-month HCI ${profile.growth.projected12mo}; modelled 24-month optimistic ceiling ${profile.forecast.optimistic.at(-1)}.` })] }),
        new Paragraph({ spacing: { before: 360 }, children: [new TextRun({ text: 'Capability IQ™ — Measure. Develop. Predict. Amplify Human Capability.', italics: true, color: SLATE, size: 18 })] }),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

// ---- EXCEL --------------------------------------------------------------
export async function buildXlsx(profile, user) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Capability IQ';
  const navyFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2545' } };
  const head = (ws, cells) => {
    const row = ws.addRow(cells);
    row.eachCell((c) => { c.fill = navyFill; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });
    return row;
  };

  // Summary sheet
  const s = wb.addWorksheet('Summary');
  s.columns = [{ width: 30 }, { width: 18 }, { width: 18 }];
  s.addRow(['Capability IQ™ — Human Capability Intelligence Report']).font = { bold: true, size: 14, color: { argb: 'FF0B2545' } };
  s.addRow(['Measure. Develop. Predict. Amplify Human Capability.']).font = { italic: true, size: 10, color: { argb: 'FFB8860B' } };
  s.addRow([user?.name || 'Individual', user?.role || 'individual']);
  s.addRow([]);
  head(s, ['Metric', 'Value', 'Level']);
  const hciRow = s.addRow(['Human Capability Index', profile.hci, profile.level.label]);
  hciRow.getCell(2).font = { bold: true, size: 13, color: { argb: 'FFB8860B' } }; // gold accent
  hciRow.getCell(1).font = { bold: true };
  s.addRow(['Career readiness', profile.readiness.career]);
  s.addRow(['AI readiness', profile.readiness.ai]);
  s.addRow(['Leadership readiness', profile.readiness.leadership]);
  s.addRow(['Entrepreneurship readiness', profile.readiness.entrepreneurship]);
  s.addRow(['Research readiness', profile.readiness.research]);
  s.addRow(['Growth potential', profile.growth.score]);
  s.addRow(['12-month projection', profile.growth.projected12mo]);

  // Dimensions sheet
  const d = wb.addWorksheet('Dimensions');
  d.columns = [{ width: 34 }, { width: 12 }, { width: 16 }, { width: 12 }];
  head(d, ['Dimension', 'Score', 'Level', 'Weight']);
  profile.dimensions.forEach((dim) => d.addRow([dim.name, dim.score, dim.level, dim.weight]));
  d.getColumn(2).numFmt = '0.0';

  // Gaps sheet
  const g = wb.addWorksheet('Gaps & Actions');
  g.columns = [{ width: 34 }, { width: 10 }, { width: 10 }, { width: 60 }];
  head(g, ['Dimension', 'Score', 'Gap', 'Recommended action']);
  profile.gaps.forEach((gap, i) => g.addRow([gap.name, gap.score, gap.gap, profile.recommendations[i]?.action || '']));

  // Benchmarks sheet
  const b = wb.addWorksheet('Benchmarks');
  b.columns = [{ width: 18 }, { width: 12 }, { width: 12 }, { width: 12 }];
  head(b, ['Cohort', 'Norm', 'Delta', 'Percentile']);
  profile.benchmarks.forEach((bm) => b.addRow([bm.cohort, bm.mean, bm.delta, bm.percentile]));

  // Forecast sheet
  const f = wb.addWorksheet('Forecast');
  f.columns = [{ width: 10 }, { width: 14 }, { width: 14 }, { width: 14 }];
  head(f, ['Month', 'Expected', 'Optimistic', 'Conservative']);
  profile.forecast.months.forEach((m, i) =>
    f.addRow([m, profile.forecast.expected[i], profile.forecast.optimistic[i], profile.forecast.conservative[i]]));

  return wb.xlsx.writeBuffer();
}

// ---- POWERPOINT ---------------------------------------------------------
export async function buildPptx(profile, user) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';
  const navy = '0B2545', gold = 'B8860B', slate = '5C677D', light = 'F8F9FB';

  // Slide 1 — title
  let sl = pptx.addSlide();
  sl.background = { color: navy };
  // brand badge: gold "iQ" on a rounded navy tile
  sl.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 0.6, w: 0.55, h: 0.55, fill: { color: '13325c' }, line: { color: gold, width: 1 }, rectRadius: 0.1 });
  sl.addText('iQ', { x: 0.7, y: 0.6, w: 0.55, h: 0.55, align: 'center', valign: 'middle', fontSize: 22, color: gold, bold: true, fontFace: 'Poppins' });
  sl.addText('Capability IQ™', { x: 1.35, y: 0.7, fontSize: 14, color: gold, bold: true, charSpacing: 2 });
  sl.addText(user?.name || 'Capability Intelligence Report', { x: 0.7, y: 2.4, fontSize: 44, color: 'FFFFFF', bold: true, fontFace: 'Poppins' });
  sl.addText('Measure. Develop. Predict. Amplify Human Capability.', { x: 0.7, y: 3.6, fontSize: 18, color: 'AEBBD0' });
  sl.addText(`HCI ${profile.hci} / 100`, { x: 0.7, y: 4.6, fontSize: 40, color: gold, bold: true });
  sl.addText(profile.level.label, { x: 0.7, y: 5.5, fontSize: 20, color: 'FFFFFF' });

  // Slide 2 — readiness + dimensions
  sl = pptx.addSlide();
  sl.background = { color: 'FFFFFF' };
  sl.addText('Capability Profile', { x: 0.7, y: 0.4, fontSize: 26, color: navy, bold: true, fontFace: 'Poppins' });
  const rk = profile.readiness;
  const cards = [['Career', rk.career], ['AI', rk.ai], ['Leadership', rk.leadership], ['Entrepreneur', rk.entrepreneurship], ['Research', rk.research]];
  cards.forEach((c, i) => {
    const x = 0.7 + i * 2.45;
    sl.addShape(pptx.ShapeType.roundRect, { x, y: 1.2, w: 2.2, h: 1.4, fill: { color: light }, line: { color: 'E3E8F0' }, rectRadius: 0.1 });
    sl.addText(String(c[1]), { x, y: 1.35, w: 2.2, h: 0.8, align: 'center', fontSize: 30, color: navy, bold: true });
    sl.addText(c[0], { x, y: 2.05, w: 2.2, h: 0.4, align: 'center', fontSize: 12, color: slate });
  });
  const dimRows = [[{ text: 'Dimension', options: { bold: true, color: 'FFFFFF', fill: navy } }, { text: 'Score', options: { bold: true, color: 'FFFFFF', fill: navy, align: 'right' } }, { text: 'Level', options: { bold: true, color: 'FFFFFF', fill: navy } }]];
  profile.dimensions.forEach((d) => dimRows.push([d.name, { text: String(d.score ?? '—'), options: { align: 'right', bold: true, color: navy } }, d.level ?? '—']));
  sl.addTable(dimRows, { x: 0.7, y: 2.9, w: 11.9, fontSize: 11, color: '16213A', border: { type: 'solid', color: 'E3E8F0', pt: 0.5 }, rowH: 0.3 });

  // Slide 3 — gaps & roadmap
  sl = pptx.addSlide();
  sl.background = { color: 'FFFFFF' };
  sl.addText('Priority Gaps & Development Roadmap', { x: 0.7, y: 0.4, fontSize: 26, color: navy, bold: true, fontFace: 'Poppins' });
  const gapRows = [[{ text: '#', options: { bold: true, color: 'FFFFFF', fill: navy } }, { text: 'Dimension', options: { bold: true, color: 'FFFFFF', fill: navy } }, { text: 'Gap', options: { bold: true, color: 'FFFFFF', fill: navy } }, { text: 'Action', options: { bold: true, color: 'FFFFFF', fill: navy } }]];
  profile.gaps.forEach((g, i) => gapRows.push([String(i + 1), { text: g.name, options: { bold: true } }, { text: String(g.gap), options: { color: gold, bold: true } }, profile.recommendations[i]?.action || '']));
  sl.addTable(gapRows, { x: 0.7, y: 1.3, w: 11.9, fontSize: 12, color: '16213A', border: { type: 'solid', color: 'E3E8F0', pt: 0.5 }, colW: [0.6, 3, 1, 7.3], rowH: 0.5 });
  sl.addText(`Projected 12-month HCI: ${profile.growth.projected12mo}  ·  24-month optimistic ceiling: ${profile.forecast.optimistic.at(-1)}`, { x: 0.7, y: 6.6, fontSize: 14, color: slate, bold: true });

  return pptx.write({ outputType: 'nodebuffer' });
}
