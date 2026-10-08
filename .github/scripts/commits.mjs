// Commit check for a pull request, copied into each repository as
// .github/scripts/commits.mjs by the engineering plugin's protect-repo skill.
// Self-contained on purpose: it imports nothing outside Node.
//
// The pull request title and description become the commit on the protected
// branch. The title must follow Conventional Commits. Neither the description nor
// any branch commit may name an AI assistant: the author of a commit is the
// person who makes it.
//
// Usage: PR_TITLE="<title>" PR_BODY="<description>" node .github/scripts/commits.mjs <base-ref>
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const PATRONEN = [
  /co-authored-by:[^\n]*(claude|anthropic|copilot|chatgpt|openai|\bai\b)/i,
  /(generated|gegenereerd|written|geschreven) (with|met|by|door)[^\n]*(claude|ai\b|assistant|assistent)/i,
  /noreply@anthropic\.com/i,
  /\u{1F916}/u,
];

const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w./-]+\))?!?: \S/;

export const noemtAi = (tekst) => PATRONEN.some((p) => p.test(tekst));

export function beoordeel(titel, berichten, beschrijving = "") {
  const problemen = [];
  if (!CONVENTIONAL.test(titel)) {
    problemen.push(
      `The title "${titel}" does not follow Conventional Commits. Use "<type>(<scope>)?: <description>", ` +
        "with type feat, fix, docs, style, refactor, perf, test, build, ci, chore or revert.",
    );
  }
  if (noemtAi(beschrijving)) {
    problemen.push("The pull request description names an AI assistant, and it becomes the commit body. Remove that line.");
  }
  for (const bericht of berichten) {
    if (noemtAi(bericht)) {
      problemen.push(`The commit "${bericht.split("\n")[0]}" names an AI assistant. Rewrite the message without the trailer or footer.`);
    }
  }
  return problemen;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const basis = process.argv[2];
  if (!basis || process.env.PR_TITLE === undefined) {
    console.error('Usage: PR_TITLE="<title>" PR_BODY="<description>" node .github/scripts/commits.mjs <base-ref>');
    process.exit(2);
  }
  const berichten = execFileSync("git", ["log", "--format=%B%x00", `${basis}..HEAD`], { encoding: "utf8" })
    .split("\0")
    .map((b) => b.trim())
    .filter(Boolean);
  const problemen = beoordeel(process.env.PR_TITLE, berichten, process.env.PR_BODY ?? "");
  for (const p of problemen) console.error(p);
  if (problemen.length) process.exit(1);
  console.log(`Title, description and ${berichten.length} commit(s) are fine.`);
}
