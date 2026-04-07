#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { analyzePythonModule, analyzePythonTarget } from "./pythonAnalyzer.js";
import { buildSberDocOutline, buildSberProjectOutline } from "./outline.js";
import { validateSberDoc } from "./validator.js";

function asTextContent(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

const server = new McpServer({
  name: "qwen-sber-doc-mcp",
  version: "0.3.0",
});

server.registerTool(
  "analyze_python_module",
  {
    description: "Analyzes a Python module and returns structured information about classes, functions, and parameters.",
    inputSchema: z.object({
      path: z.string().min(1),
    }).shape,
  },
  async ({ path }) => asTextContent(analyzePythonModule(path))
);

server.registerTool(
  "analyze_python_target",
  {
    description: "Analyzes a Python file or a directory with Python modules. Returns either module or project-level analysis.",
    inputSchema: z
      .object({
        path: z.string().min(1),
        max_modules: z.number().int().positive().max(1000).optional(),
      })
      .shape,
  },
  async ({ path, max_modules }) => asTextContent(analyzePythonTarget(path, max_modules ?? 200))
);

server.registerTool(
  "build_sber_doc_outline",
  {
    description: "Builds a strict Sber-style documentation outline from a Python module analysis result.",
    inputSchema: z.object({
      module_name: z.string().min(1),
      analysis: z.unknown(),
    }).shape,
  },
  async ({ module_name, analysis }) => {
    return asTextContent(buildSberDocOutline(module_name, analysis as Parameters<typeof buildSberDocOutline>[1]));
  }
);

server.registerTool(
  "build_sber_project_outline",
  {
    description: "Builds a strict Sber-style project documentation outline from project-level Python analysis.",
    inputSchema: z.object({
      project_name: z.string().min(1),
      analysis: z.unknown(),
    }).shape,
  },
  async ({ project_name, analysis }) =>
    asTextContent(buildSberProjectOutline(project_name, analysis as Parameters<typeof buildSberProjectOutline>[1]))
);

server.registerTool(
  "validate_sber_doc",
  {
    description: "Validates that a Markdown document follows the required Sber-style structure.",
    inputSchema: z.object({
      markdown: z.string().min(1),
    }).shape,
  },
  async ({ markdown }) => asTextContent(validateSberDoc(markdown))
);

const transport = new StdioServerTransport();
await server.connect(transport);
