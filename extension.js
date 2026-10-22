"use strict";

/**
 * AI Studio Pro Suite
 */
(function () {
  if (window.__AISU_INITIALIZED__) return;
  window.__AISU_INITIALIZED__ = true;

  /**
   * @typedef {Object} SamplingPreset
   * @property {string} name
   * @property {number} temp
   * @property {number} topP
   * @property {number} topK
   */

  /** @type {Record<string, SamplingPreset>} */
  const PRESETS = Object.freeze({
    code_strict: Object.freeze({
      name: "Deterministic / Strict Code",
      temp: 0.1,
      topP: 0.1,
      topK: 4,
    }),
    code_prod: Object.freeze({
      name: "Production Code & Architecture",
      temp: 0.3,
      topP: 0.75,
      topK: 32,
    }),
    code_creative: Object.freeze({
      name: "Creative Code, Shaders & Math",
      temp: 0.7,
      topP: 0.85,
      topK: 40,
    }),
    balance: Object.freeze({
      name: "Balanced (Default)",
      temp: 1.0,
      topP: 0.95,
      topK: 64,
    }),
    creative_story: Object.freeze({
      name: "Creative Narrative & Worldbuilding",
      temp: 1.1,
      topP: 0.95,
      topK: 64,
    }),
    creative_brainstorm: Object.freeze({
      name: "Brainstorm & Avant-Garde",
      temp: 1.45,
      topP: 0.96,
      topK: 90,
    }),
    fun_dream: Object.freeze({
      name: "Dream Logic / Surrealism",
      temp: 1.8,
      topP: 0.98,
      topK: 110,
    }),
    fun_entropy: Object.freeze({
      name: "Matrix Glitch / Pure Entropy",
      temp: 2.0,
      topP: 1.0,
      topK: 128,
    }),
  });

  const DEFAULT_PARAMS = Object.freeze({
    preset: "balance",
    temperature: PRESETS.balance.temp,
    topP: PRESETS.balance.topP,
    topK: PRESETS.balance.topK,
    confirmSend: false,
  });

  // State synchronization flags
  let isInternalMutation = false;
  let isProgrammaticChange = false;
  let isConfirmedExecution = false;
  let isUserTyping = false;

  // Timer descriptors
  let typingTimer = null;
  let syncDebounceTimer = null;
  let draftDebounceTimer = null;
  let activeModelIdCache = "";

  // Web Audio keep-alive state descriptors
  let activeAudioCtx = null;
  let activeAudioOscillator = null;
  let activeAudioGain = null;
  let activeRpcRequestCount = 0;

  // --- Engine Tab Keep-Alive Watchdog ---

  /**
   * Prevents Chromium/Edge process freezing and socket throttling
   * on background tabs by maintaining an active inaudible audio thread.
   */
  function acquireTabKeepAlive() {
    activeRpcRequestCount++;
    if (activeAudioCtx) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      activeAudioCtx = new AudioCtx();
      activeAudioOscillator = activeAudioCtx.createOscillator();
      activeAudioGain = activeAudioCtx.createGain();

      // Near-zero gain retains active audio processing thread without audible sound
      activeAudioGain.gain.setValueAtTime(0.00001, activeAudioCtx.currentTime);
      activeAudioOscillator.connect(activeAudioGain);
      activeAudioGain.connect(activeAudioCtx.destination);
      activeAudioOscillator.start();
    } catch (e) {
      console.debug("[AISU] Keep-Alive allocation bypassed:", e);
    }
  }

  /**
   * Releases Web Audio graph to preserve host system resources when idle.
   */
  function releaseTabKeepAlive() {
    activeRpcRequestCount = Math.max(0, activeRpcRequestCount - 1);
    if (activeRpcRequestCount === 0 && activeAudioCtx) {
      try {
        if (activeAudioOscillator) {
          activeAudioOscillator.stop();
          activeAudioOscillator.disconnect();
          activeAudioOscillator = null;
        }
        if (activeAudioGain) {
          activeAudioGain.disconnect();
          activeAudioGain = null;
        }
        activeAudioCtx.close();
      } catch {}
      activeAudioCtx = null;
    }
  }

  /**
   * Telemetry diagnostic logger for dropped long-running RPC pipelines.
   * @param {string} url
   * @param {number} status
   * @param {number} durationMs
   */
  function handleRpcFailureTelemetry(url, status, durationMs) {
    if (status === 0 && durationMs >= 50000) {
      console.warn(
        `[AISU Watchdog] RPC connection closed prematurely (~${(durationMs / 1000).toFixed(1)}s) for ${url}.\n` +
          `Root Cause: Client timeout or Edge background thread throttling.\n` +
          `Remedy: Server-side KV cache has likely completed processing. Next dispatch will hit warm cache.`,
      );
    }
  }

  // --- Runtime Model & Storage Management ---

  /**
   * Retrieves active model identifier using fallback hierarchy.
   * @returns {string}
   */
  function getActiveModelId() {
    try {
      const prefRaw = localStorage.getItem("aiStudioUserPreference");
      if (prefRaw) {
        const pref = JSON.parse(prefRaw);
        if (
          pref &&
          typeof pref.promptModel === "string" &&
          pref.promptModel.startsWith("models/")
        ) {
          return pref.promptModel.replace(/^models\//, "").toLowerCase();
        }
      }
    } catch {}

    const card =
      document.querySelector("ms-run-settings .model-selector-card") ||
      document.querySelector("ms-model-selector .model-selector-card");

    if (card) {
      const modelNameEl = card.querySelector('[data-test-id="model-name"]');
      if (modelNameEl && modelNameEl.textContent) {
        const clean = modelNameEl.textContent.trim().toLowerCase();
        if (clean) return clean;
      }

      const cardSubtitle = card.querySelector(".subtitle");
      if (cardSubtitle && cardSubtitle.textContent) {
        const clean = cardSubtitle.textContent.trim().toLowerCase();
        if (clean) return clean;
      }
    }

    return "gemini-3.8-flash";
  }

  /**
   * @param {string} [specificModelId]
   * @returns {string}
   */
  function getStorageKey(specificModelId) {
    const modelId = specificModelId || getActiveModelId();
    return `aistudio_model_cfg_${modelId}`;
  }

  /**
   * @returns {string}
   */
  function getChatDraftKey() {
    const match = location.pathname.match(/\/prompts\/([a-zA-Z0-9_-]+)/);
    const chatId = match ? match[1] : "new_chat";
    return `aisu_draft_${chatId}`;
  }

  /**
   * @param {*} val
   * @param {boolean} isFloat
   * @param {number} fallback
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function clampNumber(val, isFloat, fallback, min, max) {
    if (val === undefined || val === null || val === "") return fallback;
    const clean = String(val).replace(",", ".").trim();
    const num = isFloat ? parseFloat(clean) : parseInt(clean, 10);
    if (Number.isNaN(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }

  /**
   * @param {string} [specificModelId]
   * @returns {{preset: string, temperature: number, topP: number, topK: number, confirmSend: boolean}}
   */
  function loadParams(specificModelId) {
    try {
      const key = getStorageKey(specificModelId);
      const raw = localStorage.getItem(key);
      if (!raw) return { ...DEFAULT_PARAMS };

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { ...DEFAULT_PARAMS };

      return {
        preset: typeof parsed.preset === "string" ? parsed.preset : "custom",
        temperature: clampNumber(
          parsed.temperature,
          true,
          DEFAULT_PARAMS.temperature,
          0,
          2,
        ),
        topP: clampNumber(parsed.topP, true, DEFAULT_PARAMS.topP, 0, 1),
        topK: clampNumber(parsed.topK, false, DEFAULT_PARAMS.topK, 1, 128),
        confirmSend: Boolean(parsed.confirmSend),
      };
    } catch {
      return { ...DEFAULT_PARAMS };
    }
  }

  /**
   * @param {Object} params
   * @param {string} [specificModelId]
   */
  function saveParams(params, specificModelId) {
    try {
      const key = getStorageKey(specificModelId);
      localStorage.setItem(key, JSON.stringify(params));
    } catch (error) {
      console.warn("[AISU] Persistence failure:", error);
    }
  }

  // --- Precision Protobuf RPC Interceptor ---

  /**
   * @param {string} url
   * @returns {boolean}
   */
  function isTargetRpc(url) {
    if (!url || typeof url !== "string") return false;
    return (
      url.includes("GenerateContent") ||
      url.includes("CreatePrompt") ||
      url.includes("UpdatePrompt")
    );
  }

  /**
   * Patches outgoing Protobuf array preserving schema boundaries & thinking config indices.
   * @param {Array} root
   * @returns {boolean}
   */
  function patchPayloadSafe(root) {
    if (!root || !Array.isArray(root)) return false;

    // 1. GenerateContent Schema: root = ["models/...", [contents], [safety], [generationConfig], ...]
    if (typeof root[0] === "string" && root[0].startsWith("models/")) {
      const modelId = root[0].replace(/^models\//, "").toLowerCase();
      const params = loadParams(modelId);

      if (Array.isArray(root[3]) && root[3].length >= 7) {
        root[3][4] = params.temperature;
        root[3][5] = params.topP;
        root[3][6] = params.topK;
        return true;
      }
      return false;
    }

    // 2. CreatePrompt / UpdatePrompt Schema
    if (Array.isArray(root[0]) && Array.isArray(root[0][3])) {
      const cfg = root[0][3];
      if (typeof cfg[2] === "string" && cfg[2].startsWith("models/")) {
        const modelId = cfg[2].replace(/^models\//, "").toLowerCase();
        const params = loadParams(modelId);

        cfg[0] = params.temperature;
        cfg[4] = params.topP;
        cfg[5] = params.topK;
        return true;
      }
    }

    return false;
  }

  /**
   * @param {string} rawBody
   * @returns {string}
   */
  function modifyPayload(rawBody) {
    if (!rawBody || typeof rawBody !== "string") return rawBody;

    const trimmed = rawBody.trim();
    if (!trimmed.startsWith("[")) {
      return rawBody;
    }

    try {
      const body = JSON.parse(trimmed);
      const isPatched = patchPayloadSafe(body);

      if (isPatched) {
        try {
          localStorage.removeItem(getChatDraftKey());
        } catch {}
        return JSON.stringify(body);
      }
    } catch {}
    return rawBody;
  }

  // --- Network Hooks (Fetch & XHR) ---

  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._url = typeof url === "string" ? url : url ? url.toString() : "";
    this._isTargetRpc = isTargetRpc(this._url);
    return nativeOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (this._isTargetRpc) {
      acquireTabKeepAlive();
      const startTime = performance.now();

      const onFinalize = () => {
        releaseTabKeepAlive();
        this.removeEventListener("loadend", onFinalize);
        if (this.status === 0 || this.status >= 400) {
          const duration = performance.now() - startTime;
          handleRpcFailureTelemetry(this._url, this.status, duration);
        }
      };

      this.addEventListener("loadend", onFinalize);

      if (typeof body === "string") {
        body = modifyPayload(body);
      }
    }
    return nativeSend.call(this, body);
  };

  const nativeFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input && input.url ? input.url : input);

    const isRpc = isTargetRpc(url);
    if (isRpc) {
      acquireTabKeepAlive();
      if (init && typeof init.body === "string") {
        init.body = modifyPayload(init.body);
      } else if (input instanceof Request) {
        try {
          const raw = await input.clone().text();
          input = new Request(input, { body: modifyPayload(raw) });
        } catch {}
      }
    }

    const startTime = performance.now();
    try {
      const response = await nativeFetch.call(this, input, init);
      return response;
    } catch (fetchError) {
      if (isRpc) {
        const duration = performance.now() - startTime;
        handleRpcFailureTelemetry(url, 0, duration);
      }
      throw fetchError;
    } finally {
      if (isRpc) {
        releaseTabKeepAlive();
      }
    }
  };

  // --- Prompt Draft Persistence ---

  /**
   * @param {string} text
   */
  function scheduleDraftSave(text) {
    if (draftDebounceTimer) clearTimeout(draftDebounceTimer);
    draftDebounceTimer = setTimeout(() => {
      requestAnimationFrame(() => {
        try {
          const key = getChatDraftKey();
          if (text.trim()) {
            localStorage.setItem(key, text);
          } else {
            localStorage.removeItem(key);
          }
        } catch {}
      });
    }, 1200);
  }

  function restorePromptDraft() {
    try {
      const key = getChatDraftKey();
      const savedDraft = localStorage.getItem(key);
      if (!savedDraft) return;

      const textarea = /** @type {HTMLTextAreaElement | null} */ (
        document.querySelector(
          'textarea.cdk-textarea-autosize, textarea[formcontrolname="promptText"]',
        )
      );

      if (textarea && !textarea.value.trim()) {
        textarea.value = savedDraft;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch {}
  }

  // --- Execution Guards & Interceptors ---

  /**
   * @param {Event} e
   * @param {Function} runAction
   */
  function interceptSendWithConfirmation(e, runAction) {
    const params = loadParams();
    if (!params.confirmSend) return;
    if (isConfirmedExecution) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const modelId = getActiveModelId();
    const confirmed = window.confirm(
      `[AI Studio Pro Suite]\n\nDispatch prompt to model "${modelId}"?`,
    );

    if (confirmed) {
      isConfirmedExecution = true;
      try {
        runAction();
      } finally {
        setTimeout(() => {
          isConfirmedExecution = false;
        }, 200);
      }
    }
  }

  // --- DOM Element Synthesizers (CSP & Trusted Types Compliant) ---

  /**
   * @param {string} tag
   * @param {Record<string, string|null>} [props]
   * @param {...(Node|string|null)} children
   * @returns {HTMLElement}
   */
  function createEl(tag, props = {}, ...children) {
    const el =
      tag === "svg" || tag === "path"
        ? document.createElementNS("http://www.w3.org/2000/svg", tag)
        : document.createElement(tag);

    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined) continue;
      if (k === "className") {
        el.setAttribute("class", String(v));
      } else if (k === "textContent") {
        el.textContent = String(v);
      } else {
        el.setAttribute(k, String(v));
      }
    }

    for (const child of children.flat()) {
      if (child === null || child === undefined) continue;
      el.appendChild(
        typeof child === "string" ? document.createTextNode(child) : child,
      );
    }
    return /** @type {HTMLElement} */ (el);
  }

  /**
   * @param {HTMLInputElement} rangeEl
   */
  function updateSliderFill(rangeEl) {
    if (!rangeEl) return;
    const min = parseFloat(rangeEl.min) || 0;
    const max = parseFloat(rangeEl.max) || 100;
    const val = parseFloat(rangeEl.value) || 0;
    const percent = Math.max(
      0,
      Math.min(100, ((val - min) / (max - min)) * 100),
    );
    rangeEl.style.setProperty("--aisu-progress", `${percent.toFixed(2)}%`);
  }

  /**
   * Discovers native Material 3 input elements.
   */
  function getNativeControls() {
    const isCustom = (el) =>
      !el || el.hasAttribute("data-aisu") || el.closest("[data-aisu]");

    const tempCandidates = Array.from(
      document.querySelectorAll(
        'input[type="range"][aria-label*="Temperature" i], ms-slider[title*="Temperature" i] input[type="range"]',
      ),
    );
    const nativeTempRange = /** @type {HTMLInputElement | null} */ (
      tempCandidates.find((el) => !isCustom(el)) || null
    );
    const nativeTempContainer = nativeTempRange
      ? nativeTempRange.closest(".settings-item-column, .settings-item")
      : null;
    const nativeTempNum = nativeTempContainer
      ? /** @type {HTMLInputElement | null} */ (
          nativeTempContainer.querySelector(
            "input.slider-number-input:not([data-aisu])",
          )
        )
      : null;

    const topPCandidates = Array.from(
      document.querySelectorAll(
        'input[type="range"][aria-label*="Top P" i], ms-slider[title*="Top P" i] input[type="range"]',
      ),
    );
    const nativeTopPRange = /** @type {HTMLInputElement | null} */ (
      topPCandidates.find((el) => !isCustom(el)) || null
    );
    const nativeTopPContainer = nativeTopPRange
      ? nativeTopPRange.closest(".settings-item-column, .settings-item")
      : null;
    const nativeTopPNum = nativeTopPContainer
      ? /** @type {HTMLInputElement | null} */ (
          nativeTopPContainer.querySelector(
            "input.slider-number-input:not([data-aisu])",
          )
        )
      : null;

    return {
      nativeTempRange,
      nativeTempNum,
      nativeTopPRange,
      nativeTopPNum,
      nativeTopPContainer,
    };
  }

  /**
   * Dispatches input mutations across Angular NgModel binding boundaries.
   * @param {HTMLInputElement} input
   * @param {string|number} value
   */
  function dispatchNativeInput(input, value) {
    if (!input) return;
    const strVal = String(value);
    const proto = Object.getPrototypeOf(input);
    const descriptor =
      Object.getOwnPropertyDescriptor(proto, "value") ||
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

    if (descriptor && descriptor.set) {
      descriptor.set.call(input, strVal);
    } else {
      input.value = strVal;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /**
   * @param {string} prefix
   * @param {string} title
   * @param {number} min
   * @param {number} max
   * @param {number} step
   * @param {number} val
   * @param {boolean} isFloat
   * @param {string} tip
   * @returns {HTMLElement}
   */
  function createCustomSlider(
    prefix,
    title,
    min,
    max,
    step,
    val,
    isFloat,
    tip,
  ) {
    const range = /** @type {HTMLInputElement} */ (
      createEl("input", {
        type: "range",
        className: "aisu-slider-row__range",
        id: `aisu-range-${prefix}`,
        min: String(min),
        max: String(max),
        step: String(step),
        value: String(val),
        "data-prefix": prefix,
        "data-float": String(isFloat),
        "data-aisu": "true",
        "aria-label": `Custom ${title}`,
      })
    );

    const numInput = /** @type {HTMLInputElement} */ (
      createEl("input", {
        type: "text",
        inputmode: isFloat ? "decimal" : "numeric",
        className: "slider-number-input small aisu-slider-row__input",
        id: `aisu-num-${prefix}`,
        value: String(val),
        "data-prefix": prefix,
        "data-float": String(isFloat),
        "data-aisu": "true",
        "aria-label": `Custom ${title} value`,
      })
    );

    const block = createEl(
      "div",
      {
        className:
          "settings-item-column settings-item-spacer aisu-slider-item ng-star-inserted",
        id: `aisu-slider-block-${prefix}`,
        title: tip,
        "data-aisu": "true",
      },
      createEl(
        "div",
        {
          className:
            "item-about item-about-slider item-about-no-icon aisu-slider-item__header",
        },
        createEl(
          "div",
          { className: "item-description" },
          createEl("h3", {
            className: "item-description-title aisu-slider-item__title",
            textContent: title,
          }),
        ),
      ),
      createEl(
        "div",
        { className: "item-input" },
        createEl(
          "div",
          { className: "ms-slider aisu-slider-row" },
          createEl(
            "div",
            { className: "aisu-slider-row__track-container" },
            range,
          ),
          createEl(
            "div",
            { className: "slider-input-wrapper aisu-slider-row__input-wrap" },
            numInput,
          ),
        ),
      ),
    );

    updateSliderFill(range);
    return block;
  }

  /**
   * @param {string} currentPresetKey
   * @param {boolean} confirmSend
   * @returns {HTMLElement}
   */
  function createPresetDropdown(currentPresetKey, confirmSend) {
    const activePreset = PRESETS[currentPresetKey];
    const initialLabel = activePreset ? activePreset.name : "Custom";

    const trigger = createEl(
      "button",
      {
        type: "button",
        className: "aisu-select__trigger",
        id: "aisu-preset-trigger",
        "aria-haspopup": "listbox",
        "aria-expanded": "false",
        "data-aisu": "true",
      },
      createEl("span", {
        className: "aisu-select__label",
        id: "aisu-preset-label",
        textContent: initialLabel,
      }),
      createEl(
        "svg",
        {
          class: "aisu-select__arrow",
          viewBox: "0 0 24 24",
          width: "20",
          height: "20",
          "aria-hidden": "true",
          fill: "currentColor",
        },
        createEl("path", { d: "M7 10l5 5 5-5z" }),
      ),
    );

    const menu = createEl(
      "div",
      {
        className: "aisu-select__menu",
        id: "aisu-preset-menu",
        role: "listbox",
        hidden: "true",
        "data-aisu": "true",
      },
      Object.entries(PRESETS).map(([k, p]) =>
        createEl(
          "div",
          {
            className: `aisu-select__option ${
              k === currentPresetKey ? "aisu-select__option--selected" : ""
            }`,
            role: "option",
            "data-preset": k,
            "data-aisu": "true",
          },
          createEl(
            "div",
            { className: "aisu-select__option-content" },
            createEl("span", {
              className: "aisu-select__option-title",
              textContent: p.name,
            }),
            createEl("span", {
              className: "aisu-select__option-spec",
              textContent: `Temp ${p.temp} · Top P ${p.topP} · Top K ${p.topK}`,
            }),
          ),
        ),
      ),
    );

    const toggleSwitch = createEl(
      "div",
      { className: "settings-item aisu-confirm-row", "data-aisu": "true" },
      createEl(
        "div",
        { className: "item-about item-about-no-icon" },
        createEl(
          "div",
          { className: "item-description" },
          createEl("h3", {
            className: "item-description-title aisu-confirm-title",
            textContent: "Confirm before send",
          }),
        ),
      ),
      createEl(
        "div",
        { className: "item-input-toggle form-field-density--4" },
        createEl(
          "label",
          { className: "aisu-switch", for: "aisu-confirm-checkbox" },
          createEl("input", {
            type: "checkbox",
            id: "aisu-confirm-checkbox",
            className: "aisu-switch__input",
            checked: confirmSend ? "true" : null,
            "data-aisu": "true",
          }),
          createEl(
            "span",
            { className: "aisu-switch__track" },
            createEl("span", { className: "aisu-switch__thumb" }),
          ),
        ),
      ),
    );

    return createEl(
      "div",
      {
        className: "field-group aisu-field-group",
        id: "aisu-preset-group",
        "data-aisu": "true",
      },
      createEl("h3", {
        className: "aisu-field-title",
        textContent: "Sampling Preset",
      }),
      createEl(
        "div",
        { className: "settings-item settings-item-column dropdown-field" },
        createEl(
          "div",
          { className: "item-input-form-field form-field-density--4" },
          createEl(
            "div",
            { className: "aisu-select", id: "aisu-preset-select" },
            trigger,
            menu,
          ),
        ),
      ),
      toggleSwitch,
    );
  }

  /**
   * Applies target preset parameters and propagates to native inputs.
   * @param {string} presetKey
   */
  function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    isProgrammaticChange = true;
    try {
      const current = loadParams();
      saveParams({
        preset: presetKey,
        temperature: preset.temp,
        topP: preset.topP,
        topK: preset.topK,
        confirmSend: current.confirmSend,
      });

      const { nativeTempRange, nativeTempNum, nativeTopPRange, nativeTopPNum } =
        getNativeControls();

      if (nativeTempRange) dispatchNativeInput(nativeTempRange, preset.temp);
      if (nativeTempNum) dispatchNativeInput(nativeTempNum, preset.temp);
      if (nativeTopPRange) dispatchNativeInput(nativeTopPRange, preset.topP);
      if (nativeTopPNum) dispatchNativeInput(nativeTopPNum, preset.topP);

      syncInputsWithStorage();
    } finally {
      isProgrammaticChange = false;
    }
  }

  /**
   * Synchronizes UI inputs with state stored in localStorage.
   */
  function syncInputsWithStorage() {
    const params = loadParams();

    const labelEl = document.getElementById("aisu-preset-label");
    if (labelEl) {
      const activePreset = PRESETS[params.preset];
      const targetLabel = activePreset ? activePreset.name : "Custom";
      if (labelEl.textContent !== targetLabel) {
        labelEl.textContent = targetLabel;
      }
    }

    const checkbox = /** @type {HTMLInputElement | null} */ (
      document.getElementById("aisu-confirm-checkbox")
    );
    if (checkbox && checkbox.checked !== params.confirmSend) {
      checkbox.checked = params.confirmSend;
    }

    const options = document.querySelectorAll(
      "#aisu-preset-menu .aisu-select__option",
    );
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const isSelected = opt.getAttribute("data-preset") === params.preset;
      opt.classList.toggle("aisu-select__option--selected", isSelected);
    }

    const sliderMap = [
      { prefix: "mod-temp", val: String(params.temperature) },
      { prefix: "mod-topp", val: String(params.topP) },
      { prefix: "mod-topk", val: String(params.topK) },
    ];

    for (let i = 0; i < sliderMap.length; i++) {
      const item = sliderMap[i];
      const range = /** @type {HTMLInputElement | null} */ (
        document.getElementById(`aisu-range-${item.prefix}`)
      );
      const num = /** @type {HTMLInputElement | null} */ (
        document.getElementById(`aisu-num-${item.prefix}`)
      );

      if (
        range &&
        document.activeElement !== range &&
        range.value !== item.val
      ) {
        range.value = item.val;
        updateSliderFill(range);
      }
      if (num && document.activeElement !== num && num.value !== item.val) {
        num.value = item.val;
      }
    }

    const { nativeTempRange, nativeTempNum, nativeTopPRange, nativeTopPNum } =
      getNativeControls();

    if (
      nativeTempRange &&
      document.activeElement !== nativeTempRange &&
      nativeTempRange.value !== String(params.temperature)
    ) {
      isProgrammaticChange = true;
      try {
        dispatchNativeInput(nativeTempRange, params.temperature);
        if (nativeTempNum) {
          dispatchNativeInput(nativeTempNum, params.temperature);
        }
      } finally {
        isProgrammaticChange = false;
      }
    }

    if (
      nativeTopPRange &&
      document.activeElement !== nativeTopPRange &&
      nativeTopPRange.value !== String(params.topP)
    ) {
      isProgrammaticChange = true;
      try {
        dispatchNativeInput(nativeTopPRange, params.topP);
        if (nativeTopPNum) {
          dispatchNativeInput(nativeTopPNum, params.topP);
        }
      } finally {
        isProgrammaticChange = false;
      }
    }
  }

  function closePresetDropdown() {
    const menu = document.getElementById("aisu-preset-menu");
    const trigger = document.getElementById("aisu-preset-trigger");
    if (menu) menu.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  // --- Global Event Delegation ---

  function bindEventDelegation() {
    if (window._aisuEventsBound) return;
    window._aisuEventsBound = true;

    // Detect model panel changes
    document.addEventListener(
      "click",
      (e) => {
        const target = /** @type {HTMLElement | null} */ (e.target);
        if (!target) return;

        if (
          target.closest(
            '.model-selector-card, ms-sliding-right-panel, .model-option, .agent-model-options-container, [data-test-id="model-name"]',
          )
        ) {
          scheduleSync(100);
          setTimeout(() => scheduleSync(100), 250);
        }
      },
      true,
    );

    // Prompt dispatch interceptor via Click
    document.addEventListener(
      "click",
      (e) => {
        const target = /** @type {HTMLElement | null} */ (e.target);
        if (!target) return;

        const runBtn = target.closest(
          "ms-run-button button, button.ctrl-enter-submits",
        );
        if (runBtn && runBtn instanceof HTMLButtonElement) {
          interceptSendWithConfirmation(e, () => {
            runBtn.click();
          });
        }
      },
      true,
    );

    // Prompt dispatch interceptor via Ctrl+Enter / Cmd+Enter
    document.addEventListener(
      "keydown",
      (e) => {
        const target = /** @type {HTMLElement | null} */ (e.target);

        if (target && target.nodeName === "TEXTAREA") {
          isUserTyping = true;
          if (typingTimer) clearTimeout(typingTimer);
          typingTimer = setTimeout(() => {
            isUserTyping = false;
          }, 800);
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          if (target && target.nodeName === "TEXTAREA") {
            const params = loadParams();
            if (params.confirmSend) {
              const runBtn = /** @type {HTMLButtonElement | null} */ (
                document.querySelector(
                  "ms-run-button button, button.ctrl-enter-submits",
                )
              );
              if (runBtn) {
                interceptSendWithConfirmation(e, () => {
                  runBtn.click();
                });
              }
            }
          }
        }
      },
      true,
    );

    // Dropdown toggle & option selection
    document.addEventListener("click", (e) => {
      const target = /** @type {HTMLElement | null} */ (e.target);
      if (!target) return;

      const trigger = target.closest("#aisu-preset-trigger");
      if (trigger) {
        const menu = document.getElementById("aisu-preset-menu");
        if (menu) {
          const willOpen = menu.hidden;
          menu.hidden = !willOpen;
          trigger.setAttribute("aria-expanded", String(willOpen));
        }
        return;
      }

      const option = target.closest(".aisu-select__option");
      if (option) {
        const key = option.getAttribute("data-preset");
        if (key) {
          applyPreset(key);
          closePresetDropdown();
        }
        return;
      }

      if (!target.closest("#aisu-preset-select")) {
        closePresetDropdown();
      }
    });

    // Slider range & input dispatching
    document.addEventListener("input", (e) => {
      const target = /** @type {HTMLElement | null} */ (e.target);
      if (!target) return;

      if (target.nodeName === "TEXTAREA") {
        isUserTyping = true;
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          isUserTyping = false;
        }, 800);

        scheduleDraftSave(/** @type {HTMLTextAreaElement} */ (target).value);
        return;
      }

      if (isProgrammaticChange) return;
      if (target.nodeName !== "INPUT") return;

      const isSlider =
        target.classList.contains("aisu-slider-row__range") ||
        target.classList.contains("slider-number-input") ||
        target.hasAttribute("data-aisu");
      if (!isSlider) return;

      const range = target.closest(".aisu-slider-row__range");
      if (range && range instanceof HTMLInputElement) {
        const prefix = range.getAttribute("data-prefix");
        const isFloat = range.getAttribute("data-float") === "true";
        const parsed = clampNumber(range.value, isFloat, 0, 0, 128);

        const num = /** @type {HTMLInputElement | null} */ (
          document.getElementById(`aisu-num-${prefix}`)
        );
        if (num) num.value = String(parsed);
        updateSliderFill(range);

        const params = loadParams();
        params.preset = "custom";
        if (prefix === "mod-temp") params.temperature = parsed;
        if (prefix === "mod-topp") params.topP = parsed;
        if (prefix === "mod-topk") params.topK = parsed;
        saveParams(params);
        syncInputsWithStorage();
        return;
      }

      const { nativeTempRange, nativeTopPRange } = getNativeControls();
      if (target === nativeTempRange || target === nativeTopPRange) {
        const isTemp = target === nativeTempRange;
        const val = clampNumber(
          /** @type {HTMLInputElement} */ (target).value,
          true,
          0,
          0,
          2,
        );
        const params = loadParams();
        params.preset = "custom";
        if (isTemp) params.temperature = val;
        else params.topP = val;
        saveParams(params);
        syncInputsWithStorage();
      }
    });

    // Numeric inputs validation & confirm toggle
    document.addEventListener("change", (e) => {
      const target = /** @type {HTMLElement | null} */ (e.target);
      if (!target || target.nodeName !== "INPUT") return;

      if (target.id === "aisu-confirm-checkbox") {
        const params = loadParams();
        params.confirmSend = /** @type {HTMLInputElement} */ (target).checked;
        saveParams(params);
        return;
      }

      if (isProgrammaticChange) return;

      const num = target.closest(".aisu-slider-row__input");
      if (!num || !(num instanceof HTMLInputElement)) return;

      const prefix = num.getAttribute("data-prefix");
      const isFloat = num.getAttribute("data-float") === "true";

      let min = 0;
      let max = 1;
      if (prefix === "mod-temp") max = 2;
      if (prefix === "mod-topk") {
        min = 1;
        max = 128;
      }

      const parsed = clampNumber(num.value, isFloat, min, min, max);
      num.value = String(parsed);

      const range = /** @type {HTMLInputElement | null} */ (
        document.getElementById(`aisu-range-${prefix}`)
      );
      if (range) {
        range.value = String(parsed);
        updateSliderFill(range);
      }

      const params = loadParams();
      params.preset = "custom";
      if (prefix === "mod-temp") params.temperature = parsed;
      if (prefix === "mod-topp") params.topP = parsed;
      if (prefix === "mod-topk") params.topK = parsed;
      saveParams(params);
      syncInputsWithStorage();
    });
  }

  // --- Layout Reconciliation ---

  /**
   * @param {Element|null} anchor
   * @param {Element|null} target
   */
  function reconcilePosition(anchor, target) {
    if (!anchor || !target || !anchor.parentNode) return;
    if (
      target.parentNode === anchor.parentNode &&
      anchor.nextElementSibling === target
    ) {
      return;
    }
    anchor.after(target);
  }

  function reconcileControls() {
    const { nativeTempRange, nativeTopPRange, nativeTopPContainer } =
      getNativeControls();
    const params = loadParams();
    const presetGroup = document.getElementById("aisu-preset-group");

    // 1. Temperature: mount custom slider if native slider is hidden
    const customTemp = document.getElementById("aisu-slider-block-mod-temp");
    if (nativeTempRange) {
      if (customTemp) customTemp.remove();
    } else if (presetGroup && presetGroup.parentNode) {
      const tempBlock =
        customTemp ||
        createCustomSlider(
          "mod-temp",
          "Temperature",
          0,
          2,
          0.05,
          params.temperature,
          true,
          "Controls randomness: 0 is deterministic, higher values increase variety.",
        );
      reconcilePosition(presetGroup, tempBlock);
    }

    // 2. Locate output length item anchor
    const outputLengthItem =
      document.querySelector(".settings-item.output-length") ||
      document
        .querySelector('input[name="maxOutputTokens"]')
        ?.closest(".settings-item");

    // 3. Top P reconciliation
    const customTopP = document.getElementById("aisu-slider-block-mod-topp");
    if (nativeTopPRange) {
      if (customTopP) customTopP.remove();
    } else if (outputLengthItem && outputLengthItem.parentNode) {
      const topPBlock =
        customTopP ||
        createCustomSlider(
          "mod-topp",
          "Top P",
          0,
          1,
          0.01,
          params.topP,
          true,
          "Cumulative probability threshold for nucleus sampling.",
        );
      reconcilePosition(outputLengthItem, topPBlock);
    }

    // 4. Top K reconciliation
    const topKAnchor =
      nativeTopPContainer ||
      document.getElementById("aisu-slider-block-mod-topp") ||
      outputLengthItem;

    if (topKAnchor && topKAnchor.parentNode) {
      const topKBlock =
        document.getElementById("aisu-slider-block-mod-topk") ||
        createCustomSlider(
          "mod-topk",
          "Top K",
          1,
          128,
          1,
          params.topK,
          false,
          "Limits candidate tokens to the K most likely choices (1–128).",
        );
      reconcilePosition(topKAnchor, topKBlock);
    }
  }

  function injectInputs() {
    bindEventDelegation();

    const currentParams = loadParams();
    let presetGroup = document.getElementById("aisu-preset-group");

    if (!presetGroup || !presetGroup.isConnected) {
      const anchor =
        document.querySelector(".selector-container.field-group") ||
        document.querySelector("ms-model-selector")?.closest(".field-group") ||
        document.querySelector(
          ".settings-items-wrapper .scrollable-area > :first-child",
        );

      if (anchor && anchor.parentNode) {
        if (!presetGroup) {
          presetGroup = createPresetDropdown(
            currentParams.preset,
            currentParams.confirmSend,
          );
        }
        anchor.after(presetGroup);
      }
    }

    reconcileControls();
    syncInputsWithStorage();
    restorePromptDraft();
  }

  function executeSync() {
    if (isInternalMutation || isUserTyping) return;

    const currentModelId = getActiveModelId();
    const presetGroup = document.getElementById("aisu-preset-group");

    if (currentModelId !== activeModelIdCache) {
      activeModelIdCache = currentModelId;
      isInternalMutation = true;
      try {
        injectInputs();
      } finally {
        isInternalMutation = false;
      }
      return;
    }

    if (presetGroup && presetGroup.isConnected) {
      reconcileControls();
      syncInputsWithStorage();
      restorePromptDraft();
      return;
    }

    isInternalMutation = true;
    try {
      injectInputs();
    } finally {
      isInternalMutation = false;
    }
  }

  /**
   * @param {number} [delay]
   */
  function scheduleSync(delay = 500) {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      if (isUserTyping) {
        scheduleSync(500);
        return;
      }
      executeSync();
    }, delay);
  }

  // --- Precision Lifecycle & SPA Engine Observer ---

  const LOG_PREFIX = "[AISU Suite]";

  /**
   * Safe, zero-overhead console logger.
   * @param {string} action
   * @param {Object} [details]
   */
  function logEngine(action, details) {
    if (details) {
      console.log(
        `%c${LOG_PREFIX}%c ${action}`,
        "color: #3b82f6; font-weight: bold;",
        "color: inherit;",
        details,
      );
    } else {
      console.log(
        `%c${LOG_PREFIX}%c ${action}`,
        "color: #3b82f6; font-weight: bold;",
        "color: inherit;",
      );
    }
  }

  function injectInputs() {
    bindEventDelegation();

    const currentParams = loadParams();
    const anchor =
      document.querySelector(".selector-container.field-group") ||
      document.querySelector("ms-model-selector")?.closest(".field-group") ||
      document.querySelector(
        ".settings-items-wrapper .scrollable-area > :first-child",
      );

    if (!anchor || !anchor.parentNode) {
      return false;
    }

    let presetGroup = document.getElementById("aisu-preset-group");
    const isNewInstance = !presetGroup;

    if (isNewInstance) {
      presetGroup = createPresetDropdown(
        currentParams.preset,
        currentParams.confirmSend,
      );
      anchor.after(presetGroup);
      logEngine("Mounted Sampling Presets container into DOM", {
        model: getActiveModelId(),
      });
    } else if (anchor.nextElementSibling !== presetGroup) {
      anchor.after(presetGroup);
      logEngine("Re-anchored Sampling Presets container after DOM mutation");
    }

    reconcileControls();
    syncInputsWithStorage();
    restorePromptDraft();
    return true;
  }

  function executeSync() {
    if (isInternalMutation || isUserTyping) return;

    const currentModelId = getActiveModelId();
    const modelChanged = currentModelId !== activeModelIdCache;

    if (modelChanged) {
      logEngine(
        `Active model transition: "${activeModelIdCache || "init"}" -> "${currentModelId}"`,
      );
      activeModelIdCache = currentModelId;
    }

    isInternalMutation = true;
    try {
      const injected = injectInputs();
      if (injected && modelChanged) {
        logEngine("Synchronized parameters for new model state", loadParams());
      }
    } finally {
      isInternalMutation = false;
    }
  }

  /**
   * @param {number} [delay]
   */
  function scheduleSync(delay = 150) {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      if (isUserTyping) {
        scheduleSync(250);
        return;
      }
      executeSync();
    }, delay);
  }

  /**
   * Root DOM Observer with high-efficiency selector filtering.
   * Eliminates detached node memory leaks and captures Angular route view destroys/rebuilds.
   */
  function initEngineObserver() {
    const rootTarget = document.body || document.documentElement;
    if (!rootTarget) return;

    const rootObserver = new MutationObserver((mutations) => {
      if (isInternalMutation || isUserTyping) return;

      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];

        // Fast-path: inspect added nodes for run settings containers
        if (mutation.addedNodes.length > 0) {
          for (let j = 0; j < mutation.addedNodes.length; j++) {
            const node = mutation.addedNodes[j];
            if (node.nodeType !== 1) continue;
            const el = /** @type {HTMLElement} */ (node);

            if (
              el.matches(
                "ms-run-settings, ms-right-side-panel, ms-model-selector",
              ) ||
              el.querySelector(
                "ms-run-settings, ms-model-selector, .model-selector-card",
              )
            ) {
              logEngine("Detected settings panel mount in DOM tree");
              scheduleSync(50);
              return;
            }
          }
        }

        const target = mutation.target;
        if (!target) continue;
        const el =
          target.nodeType === 1
            ? /** @type {HTMLElement} */ (target)
            : target.parentElement;
        if (!el) continue;

        if (
          el.closest("ms-run-settings, ms-model-selector, .selector-container")
        ) {
          scheduleSync(150);
          return;
        }
      }
    });

    rootObserver.observe(rootTarget, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    logEngine("Root Engine Lifecycle Observer active");
    scheduleSync(100);
  }

  // --- Bootstrap Observer Execution ---
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEngineObserver, {
      once: true,
    });
  } else {
    initEngineObserver();
  }

  // --- Robust SPA Navigation Interceptors ---

  const wrapHistory = (type) => {
    const orig = history[type];
    return function (...args) {
      activeModelIdCache = "";
      const res = orig.apply(this, args);
      logEngine(`SPA Navigation event triggered via history.${type}`);
      scheduleSync(100);
      setTimeout(() => scheduleSync(350), 350);
      return res;
    };
  };

  history.pushState = wrapHistory("pushState");
  history.replaceState = wrapHistory("replaceState");

  window.addEventListener("popstate", () => {
    activeModelIdCache = "";
    logEngine("Browser history back/forward navigation detected");
    scheduleSync(100);
  });

  window.addEventListener("hashchange", () => {
    activeModelIdCache = "";
    scheduleSync(100);
  });
})();
