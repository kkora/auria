// Unit tests for the pure markdown->HTML converter used by the PDF renderer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "../../src/report/pdf.mjs";

test("markdownToHtml: headings h1-h3", () => {
  const html = markdownToHtml("# Title\n## Section\n### Sub");
  assert.ok(html.includes("<h1>Title</h1>"));
  assert.ok(html.includes("<h2>Section</h2>"));
  assert.ok(html.includes("<h3>Sub</h3>"));
});

test("markdownToHtml: pipe table -> th header row + td body rows", () => {
  const md = "| Rule | Impact |\n| --- | --- |\n| image-alt | critical |";
  const html = markdownToHtml(md);
  assert.ok(html.includes("<table>"));
  assert.ok(html.includes("<tr><th>Rule</th><th>Impact</th></tr>"));
  assert.ok(html.includes("<tr><td>image-alt</td><td>critical</td></tr>"));
  assert.ok(html.includes("</table>"));
});

test("markdownToHtml: ordered and unordered lists", () => {
  assert.ok(markdownToHtml("1. first\n2. second").includes("<ol>"));
  assert.ok(markdownToHtml("- a\n- b").includes("<ul>"));
  assert.ok(markdownToHtml("1. first").includes("<li>first</li>"));
});

test("markdownToHtml: inline bold, code, and <br>", () => {
  const html = markdownToHtml("A **bold** and `code` and x<br>y");
  assert.ok(html.includes("<strong>bold</strong>"));
  assert.ok(html.includes("<code>code</code>"));
  assert.ok(html.includes("x<br>y"));
});

test("markdownToHtml: escapes raw angle brackets in text", () => {
  const html = markdownToHtml("plain <script> text");
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
});
