// Reading an Excel file, without adding a dependency to do it.
//
// The hospital lives in Excel. They already keep their leads in a sheet, and M11 already accepts
// their weekly export pasted in as text. Pasting works — tab-separated columns are exactly what
// copying a block of Excel cells puts on the clipboard — but "paste the cells" is a sentence you
// have to explain, and "choose the file" is not.
//
// Why this is hand-written rather than a library:
//
// The obvious answer is SheetJS. It is four hundred kilobytes for a feature that reads six columns
// of text, on an app whose whole bundle is already too big for a telecaller on mobile data, in a
// repository that has deliberately kept itself to seven runtime dependencies. The parts of the
// format that make a spreadsheet library large — formulas, styles, charts, pivot tables, merged
// cells, a hundred date formats — are all parts this never has to read.
//
// An .xlsx is a ZIP holding a few XML files. Two things make reading one small:
//
//   `DecompressionStream` is in every modern browser and in Node, so one code path covers the app
//   and the tests. No polyfill, no build-time branch, and the whole reader is exercised by
//   `npm run test:xlsx` rather than only by a human clicking a file picker.
//
//   The XML inside a spreadsheet is machine-generated and rigidly shaped. Cells are always
//   `<c r="B4" t="s"><v>7</v></c>`. Matching that with a regular expression would be a bad idea
//   against XML written by a person; against XML written by Excel it is the right size of tool,
//   and it avoids depending on DOMParser, which does not exist in Node.
//
// What is deliberately not supported: formulas are read as their cached value, styles and number
// formats are ignored, and dates come back as the underlying serial number. Every column this
// screen reads is text, so none of that matters here. If a column ever needs a real date, that is
// the moment to reach for a library rather than to grow this file.

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

// The three parts of a workbook this reads. Everything else in the archive is skipped.
const SHARED_STRINGS = "xl/sharedStrings.xml";
const WORKBOOK = "xl/workbook.xml";

export class SpreadsheetError extends Error {}

/**
 * The ZIP central directory, which is the only reliable way to find the files.
 *
 * Walking local headers from the front also appears to work and then quietly fails on archives
 * written with streaming, where the compressed size in the local header is zero and the real one
 * is in a trailing descriptor. The central directory always has the true sizes.
 */
function readCentralDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // The end record is last, but a trailing comment can push it back up to 64 KB.
  let eocd = -1;
  const earliest = Math.max(0, bytes.length - 65558);
  for (let at = bytes.length - 22; at >= earliest; at--) {
    if (view.getUint32(at, true) === EOCD_SIGNATURE) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) throw new SpreadsheetError("That is not a spreadsheet — no zip end record found.");

  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);

  const entries = new Map();
  for (let index = 0; index < count; index++) {
    if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) break;
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));

    entries.set(name, { method, compressedSize, localOffset });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflate(bytes) {
  // Raw deflate: a zip member has no zlib header.
  const stream = new DecompressionStream("deflate-raw");
  const decompressed = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(decompressed).arrayBuffer());
}

async function readMember(bytes, entry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.localOffset;
  if (view.getUint32(at, true) !== LOCAL_SIGNATURE) {
    throw new SpreadsheetError("The file is damaged — a zip entry header is wrong.");
  }
  // The local header's name and extra lengths can differ from the central one's, so both are read
  // from the header actually being used.
  const nameLength = view.getUint16(at + 26, true);
  const extraLength = view.getUint16(at + 28, true);
  const start = at + 30 + nameLength + extraLength;
  const raw = bytes.subarray(start, start + entry.compressedSize);

  if (entry.method === 0) return raw; // stored, rare but legal
  if (entry.method === 8) return inflate(raw);
  throw new SpreadsheetError(`That file uses an unsupported compression method (${entry.method}).`);
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXmlText(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (whole, entity) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[entity] ?? whole;
  });
}

/**
 * The shared string table.
 *
 * Excel stores every repeated string once and refers to it by index, so a sheet full of text is
 * mostly numbers pointing in here. A rich-text run splits one string across several `<r>` elements,
 * which is why the text nodes are concatenated rather than taking the first.
 */
function parseSharedStrings(xml) {
  const strings = [];
  const items = xml.match(/<si\b[\s\S]*?<\/si>|<si\s*\/>/g) || [];
  for (const item of items) {
    const parts = item.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
    strings.push(parts.map((part) => decodeXmlText(part.replace(/<[^>]+>/g, ""))).join(""));
  }
  return strings;
}

/** "BC" is column 55. Zero-based, so it can index an array. */
export function columnIndex(letters) {
  let index = 0;
  for (const character of letters) index = index * 26 + (character.charCodeAt(0) - 64);
  return index - 1;
}

/**
 * One worksheet, as rows of strings.
 *
 * Cells are placed by their reference rather than by the order they appear, because Excel omits
 * empty cells entirely: a row with the first and third columns filled contains two `<c>` elements,
 * and reading them in sequence silently shifts the third column into the second. That shift is the
 * kind of bug that turns a phone number into a condition and is invisible until somebody calls it.
 */
function parseSheet(xml, sharedStrings) {
  const rows = [];
  const rowMatches = xml.match(/<row\b[\s\S]*?<\/row>|<row\b[^>]*\/>/g) || [];

  for (const rowXml of rowMatches) {
    const cells = [];
    const cellMatches = rowXml.match(/<c\b[^>]*>[\s\S]*?<\/c>|<c\b[^>]*\/>/g) || [];

    for (const cellXml of cellMatches) {
      const reference = /\br="([A-Z]+)\d+"/.exec(cellXml);
      const type = /\bt="([^"]+)"/.exec(cellXml)?.[1] ?? "n";

      let value = "";
      if (type === "inlineStr") {
        const parts = cellXml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
        value = parts.map((part) => decodeXmlText(part.replace(/<[^>]+>/g, ""))).join("");
      } else {
        // `<v>` holds the value for every other type, including the cached result of a formula.
        const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cellXml)?.[1];
        if (raw != null) {
          const decoded = decodeXmlText(raw);
          value = type === "s" ? sharedStrings[Number(decoded)] ?? "" : decoded;
        }
      }

      const at = reference ? columnIndex(reference[1]) : cells.length;
      while (cells.length < at) cells.push("");
      cells[at] = String(value).trim();
    }

    rows.push(cells);
  }

  return rows;
}

/** The first sheet in the workbook's own order, which is not always `sheet1.xml`. */
function firstSheetPath(workbookXml, relsXml, entries) {
  const firstId = /<sheet\b[^>]*r:id="([^"]+)"/.exec(workbookXml || "")?.[1];
  if (firstId && relsXml) {
    const pattern = new RegExp(`<Relationship\\b[^>]*Id="${firstId}"[^>]*Target="([^"]+)"`);
    const target = pattern.exec(relsXml)?.[1];
    if (target) {
      const path = target.startsWith("/")
        ? target.slice(1)
        : `xl/${target.replace(/^\.\//, "").replace(/^\/+/, "")}`;
      if (entries.has(path)) return path;
    }
  }
  // Fall back to the conventional name, then to whatever worksheet exists.
  if (entries.has("xl/worksheets/sheet1.xml")) return "xl/worksheets/sheet1.xml";
  return [...entries.keys()].find((name) => /^xl\/worksheets\/.+\.xml$/.test(name)) ?? null;
}

/**
 * An .xlsx file in, rows of trimmed strings out. Blank rows are dropped.
 *
 * Accepts anything with an `arrayBuffer()` — a `File` from an input element, a `Blob`, or a
 * `Uint8Array` in a test.
 */
export async function readWorkbook(source) {
  const bytes =
    source instanceof Uint8Array
      ? source
      : new Uint8Array(await (source.arrayBuffer ? source.arrayBuffer() : source));

  if (bytes.length < 22) throw new SpreadsheetError("That file is empty.");

  const entries = readCentralDirectory(bytes);
  const decoder = new TextDecoder();
  const textOf = async (name) =>
    entries.has(name) ? decoder.decode(await readMember(bytes, entries.get(name))) : null;

  const sheetPath = firstSheetPath(
    await textOf(WORKBOOK),
    await textOf("xl/_rels/workbook.xml.rels"),
    entries
  );
  if (!sheetPath) throw new SpreadsheetError("That workbook has no sheets in it.");

  const sharedStrings = parseSharedStrings((await textOf(SHARED_STRINGS)) || "");
  const rows = parseSheet(decoder.decode(await readMember(bytes, entries.get(sheetPath))), sharedStrings);

  return rows.filter((row) => row.some((cell) => cell !== ""));
}

/** A comma or tab file, split the same way, so both paths hand back the same shape. */
export function readDelimited(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.split(/\t|,/).map((cell) => cell.trim().replace(/^"|"$/g, "")))
    .filter((row) => row.some((cell) => cell !== ""));
}

/** Whether this is a file worth trying to open, by name. */
export function isSpreadsheet(filename) {
  return /\.(xlsx|xlsm)$/i.test(String(filename || ""));
}

export function isDelimited(filename) {
  return /\.(csv|tsv|txt)$/i.test(String(filename || ""));
}
