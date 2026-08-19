// The weekly sheet parser, checked against TRH's real export.
//
//   npm run test:sheet
//
// This is the only part of the app that runs on the hospital's actual numbers, so it is the only
// part where a parsing bug shows up in a meeting rather than in a dashboard. The fixture below is
// their sheet for 01-08-2026 to 07-08-2026, tabs and all, including the merged disease cells and
// the subtotal rows the parser has to ignore.
//
// The strongest check here is the last one: the parser's totals must equal the subtotals the
// hospital typed by hand. If those two ever disagree, one of us is wrong and it is worth knowing
// which before the meeting rather than during it.

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");
const { parseSheet, diagnose, headline, rupees } = await import(
  pathToFileURL(path.join(appRoot, "src/lib/sheetDiagnosis.js")).href
);

// Their export, verbatim shape: merged disease cell, subtotal rows, percent signs.
const SHEET = [
  "\tS.No\tDISEASE\tSource\tTotal Leads\tPERSENTAGE\tConnected leads\tConversion %\tNot Connected leads\tPercentage\tOp\tConversion %\tIp\tConversion%\tPending Follow-up\tPercentage",
  "1\tCIRCUM\tYoutube\t94\t100%\t94\t100%\t0\t0%\t23\t24.00%\t11\t48%\t71\t76%",
  "2\t\tDOUBLE TICK\t59\t100%\t59\t100%\t0\t0%\t4\t7.00%\t1\t25%\t55\t93%",
  "3\t\tWebsite\t17\t100%\t17\t100%\t0\t0%\t5\t29.00%\t4\t80%\t12\t71%",
  "4\t\tGOOGLE\t2\t100%\t2\t100%\t0\t0%\t1\t50.00%\t1\t100%\t1\t50%",
  "\t\tSubtotal\t172\t100%\t172\t100%\t0\t0%\t33\t19.00%\t17\t52%\t139\t81%",
  "1\tPILES\tYoutube\t35\t100%\t29\t83%\t6\t17%\t5\t17.00%\t2\t40%\t30\t86%",
  "2\t\tWebsite\t4\t100%\t3\t75%\t1\t25%\t1\t25.00%\t0\t0%\t3\t75%",
  "3\t\tGoogle\t4\t100%\t4\t100%\t0\t0%\t3\t75.00%\t2\t67%\t1\t25%",
  "4\t\tSuman TV\t6\t100%\t6\t100%\t0\t0%\t1\t17.00%\t1\t100%\t5\t83%",
  "\t\tSubtotal\t49\t100%\t42\t86%\t7\t14%\t10\t24.00%\t5\t50%\t39\t80%",
  "1\tGYNIC\tYoutube\t1\t100%\t1\t100%\t0\t0%\t0\t0%\t0\t0%\t1\t100%",
  "2\t\tSuman TV\t6\t100%\t6\t100%\t0\t0%\t1\t17%\t0\t0%\t5\t83%",
  "3\t\tWebsite\t7\t100%\t7\t100%\t0\t0%\t3\t43%\t0\t0%\t4\t57%",
  "4\t\tMETA\t2\t100%\t2\t100%\t0\t0%\t0\t0%\t0\t0%\t2\t100%",
  "5\t\tGOOGLE\t1\t100%\t1\t100%\t0\t0%\t0\t0%\t0\t0%\t1\t100%",
  "\t\tSubtotal\t17\t100%\t17\t100%\t0\t0%\t4\t24%\t0\t0%\t13\t76%",
  "1\tVARICOSE\tYoutube\t13\t100%\t11\t85%\t2\t15%\t5\t45.00%\t1\t20%\t8\t62%",
  "2\t\tWebsite\t29\t100%\t26\t90%\t3\t10%\t8\t31.00%\t1\t13%\t21\t72%",
  "3\t\tTV\t2\t100%\t2\t100%\t0\t0%\t0\t0.00%\t0\t0%\t2\t100%",
  "\t\tSubtotal\t44\t100%\t39\t89%\t5\t11%\t13\t33.00%\t2\t15%\t31\t70%",
].join("\n");

let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  void name;
};

const { rows, problems } = parseSheet(SHEET);
const result = diagnose(rows);

check("every source row is read and every subtotal row is ignored", () => {
  // 4 + 4 + 5 + 3 source rows. The four Subtotal rows and the header must not be counted.
  assert.equal(rows.length, 16);
  assert.ok(!rows.some((row) => /subtotal/i.test(row.source)), "a subtotal row leaked into the data");
});

check("the merged disease cell is carried down its block", () => {
  // DOUBLE TICK, Website and GOOGLE have a blank disease cell in the export.
  const circum = rows.filter((row) => row.disease === "CIRCUM");
  assert.equal(circum.length, 4);
  assert.deepEqual(
    circum.map((row) => row.source),
    ["Youtube", "DOUBLE TICK", "Website", "GOOGLE"]
  );
  assert.deepEqual([...new Set(rows.map((row) => row.disease))], ["CIRCUM", "PILES", "GYNIC", "VARICOSE"]);
});

check("percent signs and decimals do not leak into the counts", () => {
  const youtube = rows.find((row) => row.disease === "CIRCUM" && row.source === "Youtube");
  assert.deepEqual(
    { leads: youtube.leads, connected: youtube.connected, op: youtube.op, ip: youtube.ip, pending: youtube.pending },
    { leads: 94, connected: 94, op: 23, ip: 11, pending: 71 }
  );
});

check("the parser's totals equal the hospital's own hand-typed subtotals", () => {
  // This is the check that matters. Their subtotals: 172/49/17/44 leads, 139/39/13/31 pending.
  const expected = {
    CIRCUM: { leads: 172, connected: 172, op: 33, ip: 17, pending: 139 },
    PILES: { leads: 49, connected: 42, op: 10, ip: 5, pending: 39 },
    GYNIC: { leads: 17, connected: 17, op: 4, ip: 0, pending: 13 },
    VARICOSE: { leads: 44, connected: 39, op: 13, ip: 2, pending: 31 },
  };
  for (const line of result.byDisease) {
    const want = expected[line.disease];
    assert.ok(want, `unexpected block ${line.disease}`);
    assert.equal(line.leads, want.leads, `${line.disease} leads`);
    assert.equal(line.connected, want.connected, `${line.disease} connected`);
    assert.equal(line.op, want.op, `${line.disease} OPD`);
    assert.equal(line.ip, want.ip, `${line.disease} admitted`);
    assert.equal(line.pending, want.pending, `${line.disease} pending`);
  }
});

check("the week totals are 282 leads and 222 pending", () => {
  assert.equal(result.totals.leads, 282);
  assert.equal(result.totals.connected, 270);
  assert.equal(result.totals.op, 60);
  assert.equal(result.totals.ip, 24);
  assert.equal(result.totals.pending, 222);
  assert.equal(result.totals.pendingRate, 78.7);
  assert.equal(result.totals.admissionRate, 8.5);
});

check("their sheet is internally consistent, so nothing is flagged", () => {
  assert.deepEqual(problems, [], "the real sheet should parse without contradictions");
});

check("a sheet that contradicts itself is reported, never corrected", () => {
  const broken = parseSheet("1\tCIRCUM\tYoutube\t10\t100%\t14\t100%\t0\t0%\t2\t20%\t9\t90%\t3\t30%");
  assert.equal(broken.rows.length, 1);
  assert.equal(broken.rows[0].connected, 14, "the wrong number is kept as written");
  assert.ok(broken.problems.some((p) => /connected \(14\) is more than leads \(10\)/.test(p)));
  assert.ok(broken.problems.some((p) => /admissions \(9\) exceed OPD visits \(2\)/.test(p)));
});

check("blocks are ranked by how many leads are parked in them", () => {
  assert.deepEqual(
    result.byDisease.map((line) => line.disease),
    ["CIRCUM", "PILES", "VARICOSE", "GYNIC"]
  );
  assert.equal(result.worstBlock.disease, "CIRCUM");
  assert.equal(result.worstBlock.pending, 139);
});

check("volume with no admission is named, and noise is not", () => {
  // DOUBLE TICK: 59 leads, 1 admission — real volume, but it did convert, so not dead weight.
  // Sources under 10 leads are excluded so a 2-lead source is never called a failure.
  for (const line of result.deadWeight) {
    assert.ok(line.leads >= 10, `${line.source} has only ${line.leads} leads and should not be named`);
    assert.equal(line.ip, 0);
  }
  assert.ok(!result.deadWeight.some((line) => line.source === "GOOGLE"), "GOOGLE has 2 leads in CIRCUM");
});

check("no rupee figure appears until package values are supplied", () => {
  assert.equal(result.pendingValue, 0, "guessing a hospital's package price is how a meeting ends early");
  const priced = diagnose(rows, { packageValue: { CIRCUM: 60000, PILES: 45000, GYNIC: 50000, VARICOSE: 55000 } });
  // 139*60000 + 39*45000 + 13*50000 + 31*55000
  assert.equal(priced.pendingValue, 139 * 60000 + 39 * 45000 + 13 * 50000 + 31 * 55000);
});

check("rupees are grouped the Indian way", () => {
  assert.equal(rupees(1336150), "₹13,36,150");
});

check("the opening sentence is built from their numbers only", () => {
  const line = headline(result);
  assert.match(line, /222 of your 282 leads/);
  assert.match(line, /78\.7%/);
  assert.match(line, /24 admissions/);
});

check("every blind spot is a fact about the columns, not a guess about patients", () => {
  assert.ok(result.blindSpots.length >= 5);
  for (const spot of result.blindSpots) {
    assert.ok(spot.question && spot.because && spot.fix);
  }
  assert.ok(result.blindSpots.some((spot) => /PERSENTAGE/.test(spot.question)));
  assert.ok(result.blindSpots.some((spot) => /no reason column/i.test(spot.because)));
});

check("an empty or unreadable paste yields nothing rather than zeros", () => {
  assert.deepEqual(parseSheet("").rows, []);
  assert.deepEqual(parseSheet("some notes the manager typed at the top").rows, []);
  assert.equal(headline(diagnose([])), null);
});

console.log(`${checks} sheet checks passed`);
