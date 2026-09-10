# AI Studio Pro Suite

<details open>
<summary><b>English</b></summary>

### What is this?

**AI Studio Pro Suite** is a lightweight Chrome extension for [Google AI Studio](https://aistudio.google.com).

It restores missing generation controls (`Temperature`, `Top P`, `Top K`) on models that hide them (such as Gemini Flash with Thinking), provides 8 empirically calibrated sampling presets based on ML benchmarks, adds a safe prompt dispatch confirmation toggle, auto-saves prompt drafts per chat, and integrates seamlessly into the native Google Material 3 UI with zero typing latency.

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
| **Deterministic / Strict Code**        | Exact syntax, Zod/JSON schemas, SQL, unit tests    | `0.10` | `0.10` |  `1`  |
| **Production Code & Architecture**     | Production development, refactoring, Clean Arch    | `0.30` | `0.75` | `32`  |
| **Creative Code, Shaders & Math**      | Algorithmic search, WebGL/GLSL, Three.js, shaders  | `0.70` | `0.85` | `40`  |
| **Balanced (Default)**                 | General assistant, daily tasks, balanced responses | `1.00` | `0.92` | `65`  |
| **Creative Narrative & Worldbuilding** | Fiction novels, long-form dialogs, roleplay        | `1.10` | `0.92` | `65`  |
| **Brainstorm & Avant-Garde**           | Ideation, conceptual poetry, brand naming          | `1.45` | `0.96` | `90`  |
| **Dream Logic / Surrealism**           | Surrealism, dream sequences, creative stream       | `1.80` | `0.98` | `110` |
| **Matrix Glitch / Pure Entropy**       | Maximum logit entropy, edge-case probing, glitch   | `2.00` | `1.00` | `128` |

---

### Key Capabilities

- **Zero-Latency Typing Firewall**: Off-screen chat messages are culled from rendering pipelines via CSS `content-visibility: auto`. Fast-exit typing guards eliminate layout thrashing during input.
- **Multi-RPC Network Hook**: Directly intercepts and patches outgoing payloads for `GenerateContent`, `CreatePrompt`, and `UpdatePrompt` RPC schemas, ensuring custom parameters take effect even on restricted models.
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

- **Hardware Culling**: Utilizes `content-visibility: auto` with `contain-intrinsic-size` on `ms-chat-turn` to skip paint and layout computations for off-screen turns, preserving 60 FPS in 100+ turn chats.
- **Layout Thrashing Prevention**: Bypasses Angular CDK TextareaAutosize layout conflicts by decoupling containment rules from the native input node.
- **Zero InnerHTML Injection**: 100% compliant with strict CSP and Trusted Types via native DOM element synthesis (`createElement`, `createTextNode`).
- **Debounced Observer**: MutationObserver is targeted specifically at run settings panels and suspended during rapid typing bursts.

</details>

<details>
<summary><b>Русский</b></summary>

### Что это такое?

**AI Studio Pro Suite** — легковесное расширение для [Google AI Studio](https://aistudio.google.com).

Оно возвращает скрытые разработчиками ползунки генерации (`Temperature`, `Top P`, `Top K`) в моделях, где они принудительно отключены (например, Gemini Flash с Thinking), добавляет 8 научно калиброванных пресетов под задачи разработки и текста, внедряет подтверждение отправки промпта, автоматически сохраняет черновики диалогов и полностью устраняет лаги ввода при объемных чатах.

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
| **Deterministic / Strict Code**        | Точный синтаксис, Zod/JSON-схемы, SQL   | `0.10` | `0.10` |  `1`  |
| **Production Code & Architecture**     | Продакшн-код, рефакторинг, архитектура  | `0.30` | `0.75` | `32`  |
| **Creative Code, Shaders & Math**      | Алгоритмический поиск, WebGL, Three.js  | `0.70` | `0.85` | `40`  |
| **Balanced (Default)**                 | Базовый ассистент, повседневные задачи  | `1.00` | `0.92` | `65`  |
| **Creative Narrative & Worldbuilding** | Сценарии, художественный текст, ролевые | `1.10` | `0.92` | `65`  |
| **Brainstorm & Avant-Garde**           | Брейншторм, неологизмы, слоганы, питчи  | `1.45` | `0.96` | `90`  |
| **Dream Logic / Surrealism**           | Сюрреализм, поток сознания, логика сна  | `1.80` | `0.98` | `110` |
| **Matrix Glitch / Pure Entropy**       | Максимальная случайность, сбой логитов  | `2.00` | `1.00` | `128` |

---

### Функциональные возможности

- **Устранение задержек ввода**: Внеэкранные сообщения чата отсекаются от пайплайна рендера браузера с помощью CSS `content-visibility: auto`. O(1)-гварды ввода блокируют лаги клавиатуры.
- **Поддержка Multi-RPC**: Перехватчик модифицирует структуры вызовов `GenerateContent`, `CreatePrompt` и `UpdatePrompt` на уровне `fetch` и `XMLHttpRequest`, гарантируя применение параметров.
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

- **Аппаратное отсечение (Hardware Culling)**: CSS-изоляция `content-visibility: auto` с `contain-intrinsic-size` для `ms-chat-turn` полностью исключает расчет стилей и перерисовку скрытых блоков, сохраняя 60 FPS при 100+ сообщениях.
- **Ликвидация Layout Thrashing**: Полное удаление конфликтующих правил `contain: layout` с поля ввода предотвращает принудительный перерасчет высоты Angular CDK TextareaAutosize при каждом нажатии клавиши.
- **Безопасность (Strict CSP / Trusted Types)**: 0% использования `innerHTML`. Разметка создается строго через нативные вызовы `createElement` и `createTextNode`.
- **Изоляция MutationObserver**: Наблюдатель подключается точечно к панели настроек с дебаунсом 500 мс и приостанавливает работу во время набора текста пользователем.

</details>
