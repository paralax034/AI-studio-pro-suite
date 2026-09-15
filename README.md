# AI Studio Pro Suite

<details open>
<summary><b>English</b></summary>

### What is this?

**AI Studio Pro Suite** is a lightweight Chrome extension for [Google AI Studio](https://aistudio.google.com).

It restores missing generation controls (`Temperature`, `Top P`, `Top K`) on models that hide them (such as Gemini 3.x Flash with Thinking/Reasoning), provides 8 empirically calibrated sampling presets based on ML benchmarks, adds a safe prompt dispatch confirmation toggle, auto-saves prompt drafts per chat, and integrates seamlessly into the native Google Material 3 UI with zero typing latency.

---

### Screenshots

|                1. One-Click Presets                 |               2. Native Temperature Slider                |              3. Advanced Top P & Top K               |
| :-------------------------------------------------: | :-------------------------------------------------------: | :--------------------------------------------------: |
| ![Presets Dropdown](docs/screenshots/1_presets.png) | ![Temperature Slider](docs/screenshots/2_temperature.png) | ![Advanced Sliders](docs/screenshots/3_advanced.png) |
|  _Clean preset picker right under model selection_  |    _Seamless slider for models that hide temperature_     |   _Guaranteed Top P & Top K in Advanced Settings_    |

---

### Calibrated Presets

| Preset                                 | Best For                                           |  Temp  | Top P  | Top K |
| :------------------------------------- | :------------------------------------------------- | :----: | :----: | :---: |
| **Deterministic / Strict Code**        | Exact syntax, Zod/JSON schemas, SQL, unit tests    | `0.10` | `0.10` |  `4`  |
| **Production Code & Architecture**     | Production development, refactoring, Clean Arch    | `0.30` | `0.75` | `32`  |
| **Creative Code, Shaders & Math**      | Algorithmic search, WebGL/GLSL, Three.js, shaders  | `0.70` | `0.85` | `40`  |
| **Balanced (Default)**                 | General assistant, daily tasks, balanced responses | `1.00` | `0.95` | `64`  |
| **Creative Narrative & Worldbuilding** | Fiction novels, long-form dialogs, roleplay        | `1.10` | `0.95` | `64`  |
| **Brainstorm & Avant-Garde**           | Ideation, conceptual poetry, brand naming          | `1.45` | `0.96` | `90`  |
| **Dream Logic / Surrealism**           | Surrealism, dream sequences, creative stream       | `1.80` | `0.98` | `110` |
| **Matrix Glitch / Pure Entropy**       | Maximum logit entropy, edge-case probing, glitch   | `2.00` | `1.00` | `128` |

---

### Key Capabilities

- **Zero-Latency Typing Firewall**: Fast-exit typing guards and debounced state loops eliminate layout thrashing during rapid user input.
- **Precision Multi-RPC Protobuf Patcher**: Directly intercepts and patches outgoing payloads for `GenerateContent`, `CreatePrompt`, and `UpdatePrompt` RPC schemas, ensuring custom parameters take effect without corrupting internal model configs (such as Thinking Config indexes).
- **Safe Send Confirmation**: Native M3 toggle switch prompts for explicit confirmation before triggering prompt execution via button or `Ctrl+Enter` / `Cmd+Enter`.
- **Per-Chat Draft Persistence**: Automatically backs up uncommitted prompt drafts into local storage keyed by conversation ID.

---

### Installation & Building

#### Option A: Load from Source

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the repository root folder.

#### Option B: Build Release Package

Run the zero-dependency build script to generate minified distribution files and a production archive:

```bash
node build.js
```

The script reads the version from `manifest.json` and outputs:

- **`dist/`**: Minified extension directory ready for deployment.
- **`ai-studio-pro-suite-v<VERSION>.zip`**: Production archive ready for Chrome Web Store and GitHub Releases.

---

### Under the Hood (Technical Highlights)

- **Layout Thrashing Prevention**: Bypasses Angular CDK TextareaAutosize layout conflicts by decoupling containment rules from the native input node and guarding against reflow loops.
- **Zero InnerHTML Injection**: 100% compliant with strict CSP and Trusted Types via native DOM element synthesis (`createElement`, `createTextNode`).
- **Targeted MutationObserver**: Optimized observer specifically tracking model panels and run settings with built-in pause states during typing bursts.

</details>

<details>
<summary><b>Русский</b></summary>

### Что это такое?

**AI Studio Pro Suite** — легковесное расширение для [Google AI Studio](https://aistudio.google.com).

Оно возвращает скрытые разработчиками ползунки генерации (`Temperature`, `Top P`, `Top K`) в моделях, где они принудительно отключены (например, Gemini 3.x Flash с режимом Thinking/Reasoning), добавляет 8 научно калиброванных пресетов под задачи разработки и текста, внедряет подтверждение отправки промпта, автоматически сохраняет черновики диалогов и полностью устраняет лаги ввода при объемных чатах.

---

### Скриншоты

|                  1. Выбор пресетов                  |                  2. Ползунок Temperature                  |             3. Top P и Top K в Advanced              |
| :-------------------------------------------------: | :-------------------------------------------------------: | :--------------------------------------------------: |
| ![Presets Dropdown](docs/screenshots/1_presets.png) | ![Temperature Slider](docs/screenshots/2_temperature.png) | ![Advanced Sliders](docs/screenshots/3_advanced.png) |
|         _Удобный выбор пресета под моделью_         |          _Родной дизайн для скрытых параметров_           |     _Гарантированные Top P и Top K в настройках_     |

---

### Калиброванные пресеты

| Пресет                                 | Оптимальные сценарии                    |  Temp  | Top P  | Top K |
| :------------------------------------- | :-------------------------------------- | :----: | :----: | :---: |
| **Deterministic / Strict Code**        | Точный синтаксис, Zod/JSON-схемы, SQL   | `0.10` | `0.10` |  `4`  |
| **Production Code & Architecture**     | Продакшн-код, рефакторинг, архитектура  | `0.30` | `0.75` | `32`  |
| **Creative Code, Shaders & Math**      | Алгоритмический поиск, WebGL, Three.js  | `0.70` | `0.85` | `40`  |
| **Balanced (Default)**                 | Базовый ассистент, повседневные задачи  | `1.00` | `0.95` | `64`  |
| **Creative Narrative & Worldbuilding** | Сценарии, художественный текст, ролевые | `1.10` | `0.95` | `64`  |
| **Brainstorm & Avant-Garde**           | Брейншторм, неологизмы, слоганы, питчи  | `1.45` | `0.96` | `90`  |
| **Dream Logic / Surrealism**           | Сюрреализм, поток сознания, логика сна  | `1.80` | `0.98` | `110` |
| **Matrix Glitch / Pure Entropy**       | Максимальная случайность, сбой логитов  | `2.00` | `1.00` | `128` |

---

### Функциональные возможности

- **Устранение задержек ввода**: Быстрые гварды ввода и дебаунс-петли состояния эффективно пресекают зависания интерфейса при наборе текста.
- **Точный Multi-RPC Protobuf-патчер**: Безопасный перехват и модификация запросов `GenerateContent`, `CreatePrompt` и `UpdatePrompt` на уровне сетевых вызовов с сохранением служебных параметров модели (например, конфигураций Thinking).
- **Защита от случайной отправки**: Нативный переключатель Material 3 запрашивает подтверждение перед отправкой запроса кликом или комбинацией `Ctrl+Enter` / `Cmd+Enter`.
- **Автосохранение черновиков**: Текст в поле ввода сохраняется с дебаунсом в `localStorage` с привязкой к идентификатору текущего чата.

---

### Установка и сборка

#### Вариант А: Запуск из исходников

1. Скачайте архив или склонируйте данный репозиторий.
2. Откройте Google Chrome и перейдите по адресу `chrome://extensions/`.
3. Включите **Режим разработчика** (Developer mode) в верхнем правом углу.
4. Нажмите **Загрузить распакованное** (Load unpacked) и укажите папку проекта.

#### Вариант Б: Сборка релизного пакета

Запустите скрипт сборки без сторонних npm-зависимостей (требуется только Node.js):

```bash
node build.js
```

Скрипт прочитает актуальную версию из `manifest.json` и сгенерирует:

- **`dist/`**: Чистую минифицированную папку для ручной загрузки.
- **`ai-studio-pro-suite-v<ВЕРСИЯ>.zip`**: Готовый релизный архив для публикации в Chrome Web Store и GitHub Releases.

---

### Технические особенности

- **Ликвидация Layout Thrashing**: Полное устранение конфликтов с Angular CDK TextareaAutosize за счет изоляции контейнеров ввода от принудительных пересчетов высоты.
- **Безопасность (Strict CSP / Trusted Types)**: 0% использования `innerHTML`. Разметка создается строго через нативные вызовы `createElement` и `createTextNode`.
- **Изоляция MutationObserver**: Целевой наблюдатель следит за изменениями панели настроек и автоматически приостанавливает циклы синхронизации во время активного набора текста пользователем.

</details>
