import { inspectForLoop, StreamingLoopGuard } from "../src/lib/server/loop-guard.ts";

const show = (label, r) => console.log(label, JSON.stringify(r));

// 1. Healthy text — must not trigger
show(
  "good:",
  inspectForLoop(
    "Here's the answer:\n\n- First point with a substantial amount of text to qualify\n- Second point with a substantial amount of text to qualify\n- Third point with a substantial amount of text to qualify\n"
  )
);

// 2. Single-line loop
const single =
  "Here's the answer:\n\n" +
  "- First point with a substantial amount of text to qualify\n".repeat(5);
show("single-line loop:", inspectForLoop(single));

// 3. Multi-line block loop (the case from the user's paste)
const block =
  "Certainly! Here is the info:\n\n" +
  "## Overview\n\nThe overview section contains substantial prose content here.\n\n- Bullet one with a substantial amount of text\n- Bullet two with a substantial amount of text\n\n".repeat(
    4
  );
show("block loop:", inspectForLoop(block));

// 4. Markdown table (legit short-line repeats) — must NOT trigger
show(
  "table:",
  inspectForLoop(
    "| Col A | Col B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |\n\n## Summary\n\nThe table above shows sample data rows with values in two columns.\n"
  )
);

// 5. Jitter (counter inside identical lines) — digits normalized, must trigger
const jitter =
  "Items:\n\n" +
  "3. Item entry with a substantial amount of detail text\n".repeat(5);
show("jitter loop:", inspectForLoop(jitter));

// 6. Streaming wrapper across chunked pushes
const g = new StreamingLoopGuard();
let acc = "Answer:\n\n";
let last = g.push(acc);
for (let i = 0; i < 6; i++) {
  acc += "The model is repeating this exact substantial line over and over.\n";
  last = g.push(acc);
}
console.log(
  "stream triggered:",
  last.loopDetected,
  "| cleanedText:",
  JSON.stringify(g.cleanedText)
);
