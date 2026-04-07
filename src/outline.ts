import type {
  OutlineSection,
  PythonClass,
  PythonFunction,
  PythonModuleAnalysis,
  PythonProjectModuleSummary,
  PythonProjectAnalysis,
  SberDocOutline,
} from "./types.js";

function describeFunction(item: PythonFunction): string {
  const params = item.parameters.map((parameter) => parameter.name).join(", ") || "без параметров";
  return `\`${item.name}\`: параметры ${params}; возвращаемое значение ${item.returns ?? "не указано"}.`;
}

function describeClass(item: PythonClass): string {
  const publicMethods = item.methods.filter((method) => method.visibility === "public");
  if (publicMethods.length === 0) {
    return `\`${item.name}\`: публичные методы отсутствуют или не выделены отдельно.`;
  }
  return `\`${item.name}\`: публичные методы ${publicMethods.map((method) => `\`${method.name}\``).join(", ")}.`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function summarizeModule(moduleItem: PythonModuleAnalysis): PythonProjectModuleSummary {
  const publicFunctionCount =
    moduleItem.functions.filter((item) => item.visibility === "public").length +
    moduleItem.classes.reduce(
      (count, classItem) =>
        count + classItem.methods.filter((method) => method.visibility === "public").length,
      0
    );

  return {
    moduleName: moduleItem.moduleName,
    path: moduleItem.path,
    publicClassCount: moduleItem.classes.length,
    publicFunctionCount,
  };
}

function normalizeModuleAnalysis(input: unknown): PythonModuleAnalysis {
  const direct = asRecord(input);
  const wrapped = direct ? asRecord(direct.module) : null;
  const candidate = wrapped ?? direct;

  if (!candidate) {
    throw new Error("Invalid module analysis payload: expected object.");
  }

  const classes = Array.isArray(candidate.classes) ? (candidate.classes as PythonModuleAnalysis["classes"]) : [];
  const functions = Array.isArray(candidate.functions)
    ? (candidate.functions as PythonModuleAnalysis["functions"])
    : [];
  const imports = Array.isArray(candidate.imports) ? (candidate.imports as string[]) : [];

  return {
    path: typeof candidate.path === "string" ? candidate.path : "",
    moduleName: typeof candidate.moduleName === "string" ? candidate.moduleName : "module",
    docstring: typeof candidate.docstring === "string" ? candidate.docstring : null,
    imports,
    classes,
    functions,
  };
}

function normalizeProjectAnalysis(input: unknown): PythonProjectAnalysis {
  const direct = asRecord(input);
  const wrapped = direct ? asRecord(direct.project) : null;
  const candidate = wrapped ?? direct;

  if (!candidate) {
    throw new Error("Invalid project analysis payload: expected object.");
  }

  const modules = Array.isArray(candidate.modules) ? (candidate.modules as PythonModuleAnalysis[]) : [];

  let moduleSummaries: PythonProjectModuleSummary[];
  if (Array.isArray(candidate.moduleSummaries)) {
    moduleSummaries = candidate.moduleSummaries as PythonProjectModuleSummary[];
  } else if (Array.isArray(candidate.module_summaries)) {
    moduleSummaries = candidate.module_summaries as PythonProjectModuleSummary[];
  } else {
    moduleSummaries = modules.map(summarizeModule);
  }

  const totalClassesFromModules = modules.reduce((count, item) => count + item.classes.length, 0);
  const totalFunctionsFromModules = modules.reduce((count, item) => count + item.functions.length, 0);
  const totalPublicFunctionsFromSummaries = moduleSummaries.reduce(
    (count, item) => count + item.publicFunctionCount,
    0
  );

  return {
    targetPath: typeof candidate.targetPath === "string" ? candidate.targetPath : "",
    projectName: typeof candidate.projectName === "string" ? candidate.projectName : "project",
    moduleCount: toNumber(candidate.moduleCount, modules.length),
    totalClasses: toNumber(candidate.totalClasses, totalClassesFromModules),
    totalFunctions: toNumber(candidate.totalFunctions, totalFunctionsFromModules),
    totalPublicFunctions: toNumber(candidate.totalPublicFunctions, totalPublicFunctionsFromSummaries),
    modules,
    moduleSummaries,
  };
}

export function buildSberDocOutline(
  moduleName: string,
  analysisInput: PythonModuleAnalysis | unknown
): SberDocOutline {
  const analysis = normalizeModuleAnalysis(analysisInput);

  const entityBullets = [
    ...analysis.classes.map(describeClass),
    ...analysis.functions.filter((item) => item.visibility === "public").map(describeFunction),
  ];

  const methodsBullets = [
    ...analysis.classes.flatMap((item) =>
      item.methods
        .filter((method) => method.visibility === "public")
        .map((method) => `\`${item.name}.${method.name}\`: описать назначение, параметры и результат.`)
    ),
    ...analysis.functions
      .filter((item) => item.visibility === "public")
      .map((item) => `\`${item.name}\`: описать назначение, параметры и результат.`),
  ];

  const sections: OutlineSection[] = [
    {
      title: "Назначение",
      bullets: [
        `Указать роль модуля \`${moduleName}\` в составе проекта.`,
        "Зафиксировать границы ответственности и связи с соседними компонентами.",
      ],
    },
    {
      title: "Основные сущности",
      bullets: entityBullets.length > 0 ? entityBullets : ["Выделить публичные сущности модуля."],
    },
    {
      title: "Публичные методы и функции",
      bullets: methodsBullets.length > 0 ? methodsBullets : ["Описать доступные публичные точки входа."],
    },
    {
      title: "Параметры и возвращаемые значения",
      bullets: [
        "Для каждого публичного метода оформить таблицу параметров.",
        "Для каждого метода зафиксировать тип или смысл возвращаемого значения.",
      ],
    },
    {
      title: "Примеры использования",
      bullets: [
        "Подобрать примеры только из реального кода, тестов или CLI-сценариев.",
        "Показать не менее одного практического сценария вызова.",
      ],
    },
    {
      title: "Практические замечания",
      bullets: [
        "Зафиксировать ограничения реализации, допущения и особенности поведения.",
      ],
    },
  ];

  return {
    moduleName,
    recommendedTitle: `Модуль \`${moduleName}\``,
    sections,
  };
}

export function buildSberProjectOutline(
  projectName: string,
  analysisInput: PythonProjectAnalysis | unknown
): SberDocOutline {
  const analysis = normalizeProjectAnalysis(analysisInput);

  const topModules = [...analysis.moduleSummaries]
    .sort((a, b) => b.publicFunctionCount - a.publicFunctionCount)
    .slice(0, 10);

  const moduleBullets = topModules.map(
    (item) =>
      `\`${item.moduleName}\`: публичные классы ${item.publicClassCount}, публичные функции/методы ${item.publicFunctionCount}.`
  );

  const sections: OutlineSection[] = [
    {
      title: "Назначение",
      bullets: [
        `Опишите назначение проекта \`${projectName}\` и его целевой контекст использования.`,
        `Зафиксируйте границы анализа: директория \`${analysis.targetPath}\`.`,
      ],
    },
    {
      title: "Структура директории",
      bullets: [
        `Всего Python-модулей: ${analysis.moduleCount}.`,
        "Выделите ключевые директории и роль каждого блока.",
      ],
    },
    {
      title: "Основные сущности",
      bullets:
        moduleBullets.length > 0
          ? moduleBullets
          : ["Выделите ключевые модули и их публичные сущности."],
    },
    {
      title: "Публичные точки входа",
      bullets: [
        `Суммарно найдено публичных функций и методов: ${analysis.totalPublicFunctions}.`,
        "Опишите важные точки входа по модулям и их ответственность.",
      ],
    },
    {
      title: "Параметры и интерфейсы",
      bullets: [
        "Для ключевых публичных методов приведите таблицы параметров.",
        "Зафиксируйте возвращаемые значения и ограничения вызова.",
      ],
    },
    {
      title: "Примеры использования",
      bullets: [
        "Добавьте 2-3 сценария: запуск, интеграция, типовой рабочий поток.",
        "Приведите примеры только из наблюдаемого кода и тестов.",
      ],
    },
    {
      title: "Практические замечания",
      bullets: [
        "Отразите риски, ограничения и рекомендации по развитию документации проекта.",
      ],
    },
  ];

  return {
    moduleName: projectName,
    recommendedTitle: `Проект \`${projectName}\``,
    sections,
  };
}
