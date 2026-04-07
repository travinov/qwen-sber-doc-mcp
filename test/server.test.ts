import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import test from "node:test";
import assert from "node:assert/strict";

import { analyzePythonModule, analyzePythonTarget } from "../src/pythonAnalyzer.js";
import { buildSberDocOutline, buildSberProjectOutline } from "../src/outline.js";
import { validateSberDoc } from "../src/validator.js";

const queryEnginePath = path.resolve(
  process.cwd(),
  "../claw-code/src/query_engine.py"
);

test("analyze_python_module extracts public classes and methods", () => {
  const analysis = analyzePythonModule(queryEnginePath);

  assert.equal(analysis.moduleName, "query_engine");
  assert.ok(analysis.classes.some((item) => item.name === "QueryEnginePort"));

  const queryEnginePort = analysis.classes.find((item) => item.name === "QueryEnginePort");
  assert.ok(queryEnginePort);
  assert.ok(analysis.classes.some((item) => item.methods.some((method) => method.name === "submit_message")));
});

test("build_sber_doc_outline returns required sections", () => {
  const analysis = analyzePythonModule(queryEnginePath);
  const outline = buildSberDocOutline("query_engine", analysis);

  assert.equal(outline.moduleName, "query_engine");
  assert.ok(outline.sections.some((section) => section.title === "Назначение"));
  assert.ok(outline.sections.some((section) => section.title === "Примеры использования"));
});

test("analyze_python_target supports module and directory", () => {
  const moduleAnalysis = analyzePythonTarget(queryEnginePath);
  assert.equal(moduleAnalysis.kind, "module");
  if (moduleAnalysis.kind === "module") {
    assert.equal(moduleAnalysis.module.moduleName, "query_engine");
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gigadoc-"));
  const moduleA = path.join(tempDir, "alpha.py");
  const moduleB = path.join(tempDir, "beta.py");
  fs.writeFileSync(moduleA, "class Alpha:\n    def run(self):\n        return 1\n");
  fs.writeFileSync(moduleB, "def helper(value):\n    return value\n");

  const projectAnalysis = analyzePythonTarget(tempDir);
  assert.equal(projectAnalysis.kind, "project");
  if (projectAnalysis.kind === "project") {
    assert.equal(projectAnalysis.project.moduleCount, 2);
    assert.ok(projectAnalysis.project.moduleSummaries.some((item) => item.moduleName === "alpha"));
  }
});

test("analyze_python_target supports compact project mode", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gigadoc-compact-"));
  fs.writeFileSync(path.join(tempDir, "alpha.py"), "def run():\n    return 1\n");
  fs.writeFileSync(path.join(tempDir, "beta.py"), "class Beta:\n    def execute(self):\n        return 2\n");

  const analysis = analyzePythonTarget(tempDir, 200, false);
  assert.equal(analysis.kind, "project");
  if (analysis.kind === "project") {
    assert.equal(analysis.project.modules.length, 0);
    assert.equal(analysis.project.moduleCount, 2);
    assert.equal(analysis.project.moduleSummaries.length, 2);
    assert.ok(analysis.project.totalPublicFunctions >= 2);
  }
});

test("build_sber_project_outline returns project sections", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gigadoc-outline-"));
  fs.writeFileSync(path.join(tempDir, "main.py"), "def entrypoint():\n    return 'ok'\n");

  const analysis = analyzePythonTarget(tempDir);
  assert.equal(analysis.kind, "project");
  if (analysis.kind !== "project") {
    throw new Error("Expected project analysis for directory target");
  }

  const outline = buildSberProjectOutline("demo_project", analysis.project);
  assert.equal(outline.moduleName, "demo_project");
  assert.ok(outline.sections.some((section) => section.title === "Структура директории"));
  assert.ok(outline.sections.some((section) => section.title === "Публичные точки входа"));
});

test("build_sber_project_outline accepts wrapped analyze_python_target payload", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gigadoc-outline-wrapped-"));
  fs.writeFileSync(path.join(tempDir, "main.py"), "def entrypoint():\n    return 'ok'\n");

  const analysis = analyzePythonTarget(tempDir);
  assert.equal(analysis.kind, "project");

  const outline = buildSberProjectOutline("wrapped_project", analysis);
  assert.equal(outline.moduleName, "wrapped_project");
  assert.ok(outline.sections.some((section) => section.title === "Основные сущности"));
});

test("build_sber_project_outline accepts JSON string payload", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gigadoc-outline-string-"));
  fs.writeFileSync(path.join(tempDir, "main.py"), "def entrypoint():\n    return 'ok'\n");

  const analysis = analyzePythonTarget(tempDir);
  assert.equal(analysis.kind, "project");

  const outline = buildSberProjectOutline("string_project", JSON.stringify(analysis));
  assert.equal(outline.moduleName, "string_project");
  assert.ok(outline.sections.some((section) => section.title === "Публичные точки входа"));
});

test("build_sber_doc_outline accepts wrapped module payload", () => {
  const analysis = analyzePythonTarget(queryEnginePath);
  assert.equal(analysis.kind, "module");

  const outline = buildSberDocOutline("query_engine_wrapped", analysis);
  assert.equal(outline.moduleName, "query_engine_wrapped");
  assert.ok(outline.sections.some((section) => section.title === "Публичные методы и функции"));
});

test("build_sber_doc_outline accepts JSON string payload", () => {
  const analysis = analyzePythonTarget(queryEnginePath);
  assert.equal(analysis.kind, "module");

  const outline = buildSberDocOutline("query_engine_string", JSON.stringify(analysis));
  assert.equal(outline.moduleName, "query_engine_string");
  assert.ok(outline.sections.some((section) => section.title === "Основные сущности"));
});

test("validate_sber_doc reports structural problems", () => {
  const invalid = validateSberDoc("# Черновик\n\nТекст без структуры");
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some((issue) => issue.code === "missing-section"));

  const valid = validateSberDoc(`
# Модуль query_engine

## Назначение
Текст.

## Основные сущности
Текст.

## Публичные методы
Текст.

## Параметры
| Поле | Значение |
| --- | --- |
| prompt | запрос |

## Примеры использования
\`\`\`python
print("ok")
\`\`\`

## Практические замечания
Текст.
`);
  assert.equal(valid.ok, true);
});
