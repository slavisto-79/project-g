// Pulls named top-level declarations out of a TS file along with everything
// they transitively reference, using the compiler's own AST rather than line
// heuristics. Harnesses built on this run the shipped code.
const fs = require("fs");
const ts = require("typescript");

function buildIndex(file) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);
  const index = new Map();
  const order = [];

  for (const stmt of sf.statements) {
    const names = [];
    if (ts.isFunctionDeclaration(stmt) && stmt.name) names.push(stmt.name.text);
    else if (ts.isTypeAliasDeclaration(stmt)) names.push(stmt.name.text);
    else if (ts.isInterfaceDeclaration(stmt)) names.push(stmt.name.text);
    else if (ts.isEnumDeclaration(stmt)) names.push(stmt.name.text);
    else if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) names.push(d.name.text);
      }
    }
    if (!names.length) continue;
    // Statement text without leading trivia, with `export ` removed.
    const body = text.slice(stmt.getStart(sf), stmt.getEnd()).replace(/^export\s+/, "");
    const entry = { text: body, pos: stmt.getStart(sf), refs: new Set() };
    for (const m of body.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) entry.refs.add(m[1]);
    for (const n of names) { index.set(n, entry); order.push(n); }
  }
  return index;
}

function load(file, roots, extraGlobals = {}) {
  const index = buildIndex(file);
  const missing = roots.filter((r) => !index.has(r));
  if (missing.length) throw new Error("not found in " + file + ": " + missing.join(", "));

  const chosen = new Map();
  const queue = [...roots];
  while (queue.length) {
    const name = queue.pop();
    if (chosen.has(name) || !index.has(name)) continue;
    const entry = index.get(name);
    chosen.set(name, entry);
    for (const ref of entry.refs) if (index.has(ref) && !chosen.has(ref)) queue.push(ref);
  }

  const unique = [...new Set([...chosen.values()])].sort((a, b) => a.pos - b.pos);
  const src = unique.map((e) => e.text).join("\n\n");
  const js = ts.transpileModule(src, {
    // Some pulled declarations are components; without this their JSX is left
    // in the output and the Function constructor chokes on it.
    compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
  }).outputText;
  const globalNames = Object.keys(extraGlobals);
  const fn = new Function(...globalNames, js + "\nreturn {" + roots.join(",") + "};");
  return { api: fn(...globalNames.map((n) => extraGlobals[n])), pulled: unique.length };
}

module.exports = { load };
