# Qwen Sber Doc MCP

MCP server для Qwen CLI, который автоматизирует анализ Python-кода и контроль качества документации.

## Публичные ссылки

1. Репозиторий MCP server: [https://github.com/travinov/qwen-sber-doc-mcp](https://github.com/travinov/qwen-sber-doc-mcp)
2. Репозиторий extension: [https://github.com/travinov/qwen-sber-doc-extension](https://github.com/travinov/qwen-sber-doc-extension)
3. Форк с документированным модулем: [https://github.com/travinov/claw-code](https://github.com/travinov/claw-code)
4. Релиз MCP `v0.1.0`: [https://github.com/travinov/qwen-sber-doc-mcp/releases/tag/v0.1.0](https://github.com/travinov/qwen-sber-doc-mcp/releases/tag/v0.1.0)
5. npm-пакет: [https://www.npmjs.com/package/qwen-sber-doc-mcp](https://www.npmjs.com/package/qwen-sber-doc-mcp)

## Зачем это нужно

Сервер решает две основные проблемы:

1. Полнота: вытягивает реальные классы, методы и параметры из Python AST.
2. Контроль стандарта: проверяет, что Markdown соблюдает обязательную структуру и стиль.

Итог: документация становится воспроизводимой и пригодной для командного использования.

## Для кого полезно

1. Команды платформенной разработки и SDK.
2. Технические писатели и DevRel.
3. Инженеры, поддерживающие внутренние runbook/API docs.

## Инструменты MCP

1. `analyze_python_module`
Вход: `{"path":".../module.py"}`
Выход: структурированный JSON с сущностями модуля.

2. `build_sber_doc_outline`
Вход: `{"module_name":"query_engine","analysis":{...}}`
Выход: строгий каркас документа с обязательными разделами.

3. `validate_sber_doc`
Вход: `{"markdown":"# ..."}`
Выход: `ok` + список нарушений/предупреждений.

## Архитектура

1. Node.js сервер на `@modelcontextprotocol/sdk` (stdio transport).
2. Анализ Python выполняется через `python3` + стандартный `ast`.
3. Контракт tool-ответов JSON-friendly и удобен для интеграции с командами Qwen.

## Установка

Требования:

1. Node.js 22+
2. Python 3.x в `PATH`

```bash
git clone https://github.com/travinov/qwen-sber-doc-mcp.git qwen-sber-doc-mcp
cd qwen-sber-doc-mcp
npm install
npm run build
npm test
```

Проверка запуска:

```bash
node dist/src/index.js
```

После публикации в npm можно использовать пакет без клонирования:

```bash
npx --yes qwen-sber-doc-mcp
```

## Подключение к Qwen CLI

В `.qwen/settings.json`:

```json
{
  "mcpServers": {
    "sber-doc-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/qwen-sber-doc-mcp/dist/src/index.js"],
      "timeout": 15000
    }
  }
}
```

Или используйте companion extension:

- `qwen-sber-doc-extension` содержит launcher и готовую команду `/doc:sber`.

## Примеры типовых задач

1. Аудит покрытия документации после релизных изменений API.
2. Быстрое построение шаблона docs для нового Python-модуля.
3. Валидация PR с документацией перед merge.
4. Унификация оформления техдоков в нескольких репозиториях.

## Практические сценарии

1. Перед написанием docs:
   - `analyze_python_module` -> получить факты по API.
2. Перед генерацией Markdown:
   - `build_sber_doc_outline` -> получить разделы и чек-лист.
3. Перед публикацией:
   - `validate_sber_doc` -> обнаружить пропуски структуры/примеров.
