// The spreadsheet reader, run against real .xlsx archives.
//
//   npm run test:xlsx
//
// The fixtures in test/fixtures are genuine zip files, not strings pretending to be one, so this
// exercises the whole path: central directory, inflate, shared strings, cell references. They were
// written by hand rather than by a spreadsheet library specifically so they contain the shapes
// that break naive readers — a sheet that is not called sheet1.xml, a phone number stored as a
// number, an inline string, an escaped ampersand, a row with a hole in the middle of it, and a
// blank row left behind by a deletion.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");
const load = (relative) => import(pathToFileURL(path.join(appRoot, relative)).href);

const { readWorkbook, readDelimited, columnIndex, isSpreadsheet, isDelimited, SpreadsheetError } =
  await load("src/lib/xlsx.js");
const { parseRows, parseBulk } = await load("src/lib/intake.js");

const fixture = (name) =>
  new Uint8Array(fs.readFileSync(path.join(appRoot, "test", "fixtures", name)));

let checks = 0;
const check = async (name, fn) => {
  await fn();
  checks++;
  void name;
};

const rows = await readWorkbook(fixture("leads.xlsx"));

// ---- reading the file --------------------------------------------------------------------------

await check("a workbook reads back as rows of strings", () => {
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0], ["Name", "Phone", "Condition", "Source", "Campaign", "Branch"]);
});

await check("the sheet is found through the workbook relationship, not by guessing a filename", () => {
  // The fixture's sheet is xl/worksheets/leads.xml. A reader that assumes sheet1.xml finds nothing.
  assert.equal(rows[1][0], "Ravi Kumar");
});

await check("a phone number stored as a number survives", () => {
  // Excel turns a bare ten-digit value into a number. Read carelessly this comes back as
  // 9845011225 in exponential form, or empty, and the lead is unreachable.
  assert.equal(rows[1][1], "9845011225");
});

await check("an inline string reads the same as a shared one", () => {
  assert.equal(rows[2][1], "+91 98450 11226");
});

await check("xml entities are decoded rather than shown raw", () => {
  assert.equal(rows[2][0], "Lakshmi & Co");
});

await check("a missing cell holds its column open", () => {
  // This is the defect the whole reference-based approach exists to prevent. Row 4 has no campaign
  // cell at all — Excel omits empty cells entirely. Reading cells in the order they appear shifts
  // the branch one column left, and every lead silently gets the wrong branch.
  assert.deepEqual(rows[3], ["Sunita Rao", "9845011227", "Hernia", "Meta Ads", "", "Whitefield"]);
  assert.equal(rows[3][5], "Whitefield", "the branch must stay in the branch column");
});

await check("blank rows are dropped rather than becoming empty leads", () => {
  assert.ok(rows.every((row) => row.some((cell) => cell !== "")));
});

await check("an uncompressed archive reads identically to a deflated one", async () => {
  // Both are legal zip, and some exporters store rather than deflate.
  assert.deepEqual(await readWorkbook(fixture("leads-stored.xlsx")), rows);
});

await check("a file that is not a spreadsheet is refused with a sentence, not a stack trace", async () => {
  await assert.rejects(
    () => readWorkbook(new Uint8Array(Buffer.from("this is a text file, not a workbook"))),
    (error) => error instanceof SpreadsheetError && /not a spreadsheet/i.test(error.message)
  );
});

await check("an empty file is refused", async () => {
  await assert.rejects(() => readWorkbook(new Uint8Array(0)), SpreadsheetError);
});

// ---- column references -------------------------------------------------------------------------

await check("column letters convert past Z", () => {
  assert.equal(columnIndex("A"), 0);
  assert.equal(columnIndex("F"), 5);
  assert.equal(columnIndex("Z"), 25);
  assert.equal(columnIndex("AA"), 26);
  assert.equal(columnIndex("BC"), 54);
});

await check("file kinds are told apart by extension", () => {
  assert.equal(isSpreadsheet("weekly leads.xlsx"), true);
  assert.equal(isSpreadsheet("leads.XLSX"), true);
  assert.equal(isSpreadsheet("leads.csv"), false);
  assert.equal(isDelimited("leads.csv"), true);
  assert.equal(isDelimited("leads.tsv"), true);
  assert.equal(isDelimited("leads.xlsx"), false);
});

await check("a csv splits into the same shape a workbook produces", () => {
  const parsed = readDelimited('Ravi Kumar,9845011225,Piles\n"Lakshmi Rao",9845011226,Hernia\n\n');
  assert.deepEqual(parsed, [
    ["Ravi Kumar", "9845011225", "Piles"],
    ["Lakshmi Rao", "9845011226", "Hernia"],
  ]);
});

// ---- the guard is the same one, whichever door the leads come through ---------------------------

await check("a spreadsheet goes through the same §3.1 guard as a typed lead", () => {
  const parsed = parseRows(rows);
  // Header skipped, two complete leads accepted, two rows refused for different reasons.
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(
    parsed.rows.map((row) => row.patient_name),
    ["Ravi Kumar", "Lakshmi & Co"]
  );
  assert.equal(parsed.rejected.length, 2);
});

await check("the row with the hole in it is refused for the campaign, which proves nothing shifted", () => {
  // Row 4 has no campaign cell. The reader keeps the branch in the branch column, so the guard
  // refuses this row for the missing campaign. Had the columns shifted left, the branch would have
  // landed in the campaign slot: the row would have passed attribution and been filed under a
  // branch that does not exist. The reason on this refusal is the assertion.
  const refused = parseRows(rows).rejected.find((row) => row.line === 4);
  assert.match(refused.why, /Campaign is required/);
  assert.match(refused.text, /Whitefield/);
});

await check("a bad phone number is refused by line, never dropped silently", () => {
  const refused = parseRows(rows).rejected.find((row) => row.line === 5);
  assert.match(refused.why, /Ten digits starting 6, 7, 8 or 9/);
  assert.match(refused.text, /12345/);
});

await check("pasting the same content as text produces the same drafts", () => {
  // The two doors must not disagree. If pasting and choosing a file ever diverge, one of them is
  // applying a rule the other does not.
  const asText = rows.map((row) => row.join("\t")).join("\n");
  const pasted = parseBulk(asText);
  const chosen = parseRows(rows);
  assert.deepEqual(
    pasted.rows.map((row) => row.patient_name),
    chosen.rows.map((row) => row.patient_name)
  );
  assert.equal(pasted.rejected.length, chosen.rejected.length);
});

console.log(`${checks} spreadsheet checks passed`);
