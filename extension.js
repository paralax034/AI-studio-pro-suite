'use strict';

/**
 * AI Studio Pro Suite
 * Core Runtime: Presets, RPC Interceptor, and Jitter-Free Native UI.
 */
(function () {
  const PRESETS = {
    deterministic: { name: 'Deterministic / Strict Code', temp: 0.0, topP: 0.1, topK: 1 },
    precise: { name: 'Precise / Data Extraction', temp: 0.2, topP: 0.4, topK: 16 },
    academic: { name: 'Academic & Technical', temp: 0.45, topP: 0.7, topK: 24 },
    gamedev: { name: 'Creative Code & Shaders', temp: 0.65, topP: 0.85, topK: 40 },
    balance: { name: 'Balanced (Default)', temp: 1.0, topP: 0.95, topK: 64 },
    roleplay: { name: 'Conversational & Roleplay', temp: 1.15, topP: 0.92, topK: 64 },
    creative: { name: 'Creative & Storytelling', temp: 1.4, topP: 0.95, topK: 80 },
    brainstorm: { name: 'Brainstorm & Ideation', temp: 1.75, topP: 0.98, topK: 100 },
    entropy: { name: 'Maximum Entropy / Experimental', temp: 2.0, topP: 1.0, topK: 128 }
  };

  const DEFAULT_PARAMS = {
    preset: 'balance',
    temperature: PRESETS.balance.temp,
    topP: PRESETS.balance.topP,
    topK: PRESETS.balance.topK
  };

  function getStorageKey() {
    const promptMatch = location.pathname.match(/\/prompts\/([a-zA-Z0-9_-]+)/);
    const promptId = promptMatch ? promptMatch[1] : 'new_chat';
    const modelEl = document.querySelector('[data-test-id="model-name"]') || document.querySelector('.model-name');
    const modelName = modelEl ? modelEl.textContent.trim().replace(/\s+/g, '_') : 'default_model';
    return `aistudio_cfg_${promptId}_${modelName}`;
  }

  function loadParams() {
    try {
      const raw = localStorage.getItem(getStorageKey());
      return raw ? { ...DEFAULT_PARAMS, ...JSON.parse(raw) } : { ...DEFAULT_PARAMS };
    } catch {
      return { ...DEFAULT_PARAMS };
    }
  }

  function saveParams(params) {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(params));
    } catch (e) {
      console.warn('[AISU] Storage error:', e);
    }
  }

  function parseNum(val, isFloat) {
    if (val === undefined || val === null) return 0;
    const clean = String(val).replace(',', '.').trim();
    const num = isFloat ? parseFloat(clean) : parseInt(clean, 10);
    return Number.isNaN(num) ? 0 : num;
  }

  // RPC Interceptor
  function findConfigArray(arr) {
    if (!Array.isArray(arr)) return null;
    if (arr.length >= 6 && typeof arr[2] === 'string' && arr[2].startsWith('models/')) return arr;
    for (let i = 0; i < arr.length; i++) {
      if (Array.isArray(arr[i])) {
        const found = findConfigArray(arr[i]);
        if (found) return found;
      }
    }
    return null;
  }

  function modifyPayload(rawBody) {
    if (!rawBody || typeof rawBody !== 'string') return rawBody;
    try {
      const body = JSON.parse(rawBody);
      const cfg = findConfigArray(body);
      if (cfg) {
        const params = loadParams();
        cfg[0] = parseNum(params.temperature, true);
        cfg[4] = parseNum(params.topP, true);
        cfg[5] = parseNum(params.topK, false);
        return JSON.stringify(body);
      }
    } catch (e) {
      console.warn('[AISU] Intercept skipped:', e);
    }
    return rawBody;
  }

  function sanitizeResponse(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    return raw
      .replace(/"The model output could not be generated[^"]*"/g, 'null')
      .replace(/"PROHIBITED_CONTENT"/g, '"STOP"')
      .replace(/"IMAGE_SAFETY"/g, '"STOP"')
      .replace(/"blocked"\s*:\s*true/g, '"blocked":false');
  }

  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  const descRT = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
  const getRT = descRT && descRT.get;
  const descR = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response');
  const getR = descR && descR.get;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._url = typeof url === 'string' ? url : (url ? url.toString() : '');
    this._isGenerate = this._url.includes('MakerSuiteService/GenerateContent');
    return nativeOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (this._isGenerate) {
      if (getRT) {
        Object.defineProperty(this, 'responseText', {
          get() {
            const raw = getRT.call(this);
            return typeof raw === 'string' ? sanitizeResponse(raw) : raw;
          },
          configurable: true
        });
      }
      if (getR) {
        Object.defineProperty(this, 'response', {
          get() {
            const raw = getR.call(this);
            return typeof raw === 'string' ? sanitizeResponse(raw) : raw;
          },
          configurable: true
        });
      }
      if (typeof body === 'string') body = modifyPayload(body);
    }
    return nativeSend.call(this, body);
  };

  const nativeFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (url.includes('MakerSuiteService/GenerateContent')) {
      if (init && typeof init.body === 'string') {
        init.body = modifyPayload(init.body);
      } else if (input instanceof Request) {
        try {
          const raw = await input.clone().text();
          input = new Request(input, { body: modifyPayload(raw) });
        } catch (e) {
          console.warn('[AISU] Fetch intercept skipped:', e);
        }
      }
    }
    return nativeFetch.call(this, input, init);
  };

  // UI & Layout Controller
  let isInternalMutation = false;
  let rafSyncId = null;
  let lastModelName = '';

  function createEl(tag, props = {}, ...children) {
    const el = tag === 'svg' || tag === 'path'
      ? document.createElementNS('http://www.w3.org/2000/svg', tag)
      : document.createElement(tag);

    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined) continue;
      if (k === 'className') el.className = v;
      else if (k === 'textContent') el.textContent = v;
      else el.setAttribute(k, String(v));
    }

    for (const child of children.flat()) {
      if (child === null || child === undefined) continue;
      el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return el;
  }

  function updateSliderFill(rangeEl) {
    if (!rangeEl) return;
    const min = parseFloat(rangeEl.min) || 0;
    const max = parseFloat(rangeEl.max) || 100;
    const val = parseFloat(rangeEl.value) || 0;
    const percent = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    const targetStr = `${percent.toFixed(2)}%`;
    if (rangeEl.style.getPropertyValue('--aisu-progress') !== targetStr) {
      rangeEl.style.setProperty('--aisu-progress', targetStr);
    }
  }

  function getActiveModelName() {
    const el = document.querySelector('[data-test-id="model-name"]') ||
               document.querySelector('.model-name') ||
               document.querySelector('.ms-model-selector-button');
    return el ? el.textContent.trim() : '';
  }

  function getNativeControls() {
    const isCustom = (el) => !el || el.hasAttribute('data-aisu') || el.closest('[data-aisu]');

    const tempCandidates = Array.from(
      document.querySelectorAll('input[type="range"][aria-label*="Temperature" i], ms-slider[title*="Temperature" i] input[type="range"], [data-test-id="temperatureSliderContainer"] input[type="range"]')
    );
    const nativeTempRange = tempCandidates.find((el) => !isCustom(el)) || null;
    const nativeTempContainer = nativeTempRange
      ? nativeTempRange.closest('.settings-item-column, .settings-item, [data-test-id="temperatureSliderContainer"]')
      : null;
    const nativeTempNum = nativeTempContainer
      ? nativeTempContainer.querySelector('input.slider-number-input:not([data-aisu])')
      : null;

    const topPCandidates = Array.from(
      document.querySelectorAll('input[type="range"][aria-label*="Top P" i], ms-slider[title*="Top P" i] input[type="range"], [data-test-id="topPSliderContainer"] input[type="range"]')
    );
    const nativeTopPRange = topPCandidates.find((el) => !isCustom(el)) || null;
    const nativeTopPContainer = nativeTopPRange
      ? nativeTopPRange.closest('.settings-item-column, .settings-item, [data-test-id="topPSliderContainer"]')
      : null;
    const nativeTopPNum = nativeTopPContainer
      ? nativeTopPContainer.querySelector('input.slider-number-input:not([data-aisu])')
      : null;

    return { nativeTempRange, nativeTempNum, nativeTopPRange, nativeTopPNum, nativeTopPContainer };
  }

  function dispatchNativeInput(input, value) {
    if (!input) return;
    const strVal = String(value);
    const proto = Object.getPrototypeOf(input);
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value') ||
                       Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    if (descriptor && descriptor.set) descriptor.set.call(input, strVal);
    else input.value = strVal;

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function createCustomSlider(prefix, title, min, max, step, val, isFloat, tip) {
    const range = createEl('input', {
      type: 'range',
      className: 'aisu-slider-row__range',
      id: `aisu-range-${prefix}`,
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(val),
      'data-prefix': prefix,
      'data-float': String(isFloat),
      'data-aisu': 'true',
      'aria-label': `Custom ${title}`
    });

    const numInput = createEl('input', {
      type: 'text',
      inputmode: isFloat ? 'decimal' : 'numeric',
      className: 'slider-number-input small aisu-slider-row__input',
      id: `aisu-num-${prefix}`,
      value: String(val),
      'data-prefix': prefix,
      'data-float': String(isFloat),
      'data-aisu': 'true',
      'aria-label': `Custom ${title} value`
    });

    const block = createEl('div', {
      className: 'settings-item-column settings-item-spacer aisu-slider-item ng-star-inserted',
      id: `aisu-slider-block-${prefix}`,
      title: tip,
      'data-aisu': 'true'
    },
      createEl('div', { className: 'item-about item-about-slider item-about-no-icon aisu-slider-item__header' },
        createEl('div', { className: 'item-description' },
          createEl('h3', { className: 'item-description-title aisu-slider-item__title', textContent: title })
        )
      ),
      createEl('div', { className: 'item-input' },
        createEl('div', { className: 'ms-slider aisu-slider-row' },
          createEl('div', { className: 'aisu-slider-row__track-container' }, range),
          createEl('div', { className: 'slider-input-wrapper aisu-slider-row__input-wrap' }, numInput)
        )
      )
    );

    updateSliderFill(range);
    return block;
  }

  function createPresetDropdown(currentPresetKey) {
    const activePreset = PRESETS[currentPresetKey];
    const initialLabel = activePreset ? activePreset.name : 'Custom';

    const trigger = createEl('button', {
      type: 'button',
      className: 'aisu-select__trigger',
      id: 'aisu-preset-trigger',
      'aria-haspopup': 'listbox',
      'aria-expanded': 'false',
      'data-aisu': 'true'
    },
      createEl('span', { className: 'aisu-select__label', id: 'aisu-preset-label', textContent: initialLabel }),
      createEl('svg', {
        class: 'aisu-select__arrow',
        viewBox: '0 0 24 24',
        width: '20',
        height: '20',
        'aria-hidden': 'true',
        fill: 'currentColor'
      },
        createEl('path', { d: 'M7 10l5 5 5-5z' })
      )
    );

    const menu = createEl('div', {
      className: 'aisu-select__menu',
      id: 'aisu-preset-menu',
      role: 'listbox',
      hidden: 'true',
      'data-aisu': 'true'
    },
      Object.entries(PRESETS).map(([k, p]) =>
        createEl('div', {
          className: `aisu-select__option ${k === currentPresetKey ? 'aisu-select__option--selected' : ''}`,
          role: 'option',
          'data-preset': k,
          'data-aisu': 'true'
        },
          createEl('div', { className: 'aisu-select__option-content' },
            createEl('span', { className: 'aisu-select__option-title', textContent: p.name }),
            createEl('span', { className: 'aisu-select__option-spec', textContent: `Temp ${p.temp} · Top P ${p.topP} · Top K ${p.topK}` })
          )
        )
      )
    );

    return createEl('div', { className: 'field-group aisu-field-group', id: 'aisu-preset-group', 'data-aisu': 'true' },
      createEl('div', { className: 'settings-item settings-item-column dropdown-field' },
        createEl('div', { className: 'item-input-form-field form-field-density--4' },
          createEl('div', { className: 'aisu-select', id: 'aisu-preset-select' }, trigger, menu)
        )
      )
    );
  }

  function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    saveParams({
      preset: presetKey,
      temperature: preset.temp,
      topP: preset.topP,
      topK: preset.topK
    });

    const { nativeTempRange, nativeTempNum, nativeTopPRange, nativeTopPNum } = getNativeControls();

    if (nativeTempRange) dispatchNativeInput(nativeTempRange, preset.temp);
    if (nativeTempNum) dispatchNativeInput(nativeTempNum, preset.temp);
    if (nativeTopPRange) dispatchNativeInput(nativeTopPRange, preset.topP);
    if (nativeTopPNum) dispatchNativeInput(nativeTopPNum, preset.topP);

    syncInputsWithStorage();
  }

  function syncInputsWithStorage() {
    const params = loadParams();

    const labelEl = document.getElementById('aisu-preset-label');
    if (labelEl) {
      const activePreset = PRESETS[params.preset];
      const targetLabel = activePreset ? activePreset.name : 'Custom';
      if (labelEl.textContent !== targetLabel) labelEl.textContent = targetLabel;
    }

    const options = document.querySelectorAll('#aisu-preset-menu .aisu-select__option');
    for (let i = 0; i < options.length; i++) {
      const isSelected = options[i].getAttribute('data-preset') === params.preset;
      options[i].classList.toggle('aisu-select__option--selected', isSelected);
    }

    const sliderMap = [
      { prefix: 'mod-temp', val: String(params.temperature) },
      { prefix: 'mod-topp', val: String(params.topP) },
      { prefix: 'mod-topk', val: String(params.topK) }
    ];

    for (const { prefix, val } of sliderMap) {
      const range = document.getElementById(`aisu-range-${prefix}`);
      const num = document.getElementById(`aisu-num-${prefix}`);

      if (range && document.activeElement !== range && range.value !== val) {
        range.value = val;
        updateSliderFill(range);
      }
      if (num && document.activeElement !== num && num.value !== val) {
        num.value = val;
      }
    }
  }

  function closePresetDropdown() {
    const menu = document.getElementById('aisu-preset-menu');
    const trigger = document.getElementById('aisu-preset-trigger');
    if (menu) menu.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function bindEventDelegation() {
    if (window._aisuEventsBound) return;
    window._aisuEventsBound = true;

    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('#aisu-preset-trigger');
      if (trigger) {
        const menu = document.getElementById('aisu-preset-menu');
        if (menu) {
          const willOpen = menu.hidden;
          menu.hidden = !willOpen;
          trigger.setAttribute('aria-expanded', String(willOpen));
        }
        return;
      }

      const option = e.target.closest('.aisu-select__option');
      if (option) {
        const key = option.getAttribute('data-preset');
        if (key) {
          applyPreset(key);
          closePresetDropdown();
        }
        return;
      }

      if (!e.target.closest('#aisu-preset-select')) {
        closePresetDropdown();
      }
    });

    document.addEventListener('input', (e) => {
      const range = e.target.closest('.aisu-slider-row__range');
      if (range) {
        const prefix = range.getAttribute('data-prefix');
        const isFloat = range.getAttribute('data-float') === 'true';
        const parsed = parseNum(range.value, isFloat);

        const num = document.getElementById(`aisu-num-${prefix}`);
        if (num) num.value = String(parsed);
        updateSliderFill(range);

        const params = loadParams();
        params.preset = 'custom';
        if (prefix === 'mod-temp') params.temperature = parsed;
        if (prefix === 'mod-topp') params.topP = parsed;
        if (prefix === 'mod-topk') params.topK = parsed;
        saveParams(params);
        syncInputsWithStorage();
        return;
      }

      const { nativeTempRange, nativeTopPRange } = getNativeControls();
      if (e.target === nativeTempRange || e.target === nativeTopPRange) {
        const isTemp = e.target === nativeTempRange;
        const val = parseNum(e.target.value, true);
        const params = loadParams();
        params.preset = 'custom';
        if (isTemp) params.temperature = val;
        else params.topP = val;
        saveParams(params);
        syncInputsWithStorage();
      }
    });

    document.addEventListener('change', (e) => {
      const num = e.target.closest('.aisu-slider-row__input');
      if (!num) return;

      const prefix = num.getAttribute('data-prefix');
      const isFloat = num.getAttribute('data-float') === 'true';
      let parsed = parseNum(num.value, isFloat);

      if (prefix === 'mod-temp') parsed = Math.max(0, Math.min(2, parsed));
      if (prefix === 'mod-topp') parsed = Math.max(0, Math.min(1, parsed));
      if (prefix === 'mod-topk') parsed = Math.max(1, Math.min(128, parsed));

      num.value = String(parsed);
      const range = document.getElementById(`aisu-range-${prefix}`);
      if (range) {
        range.value = String(parsed);
        updateSliderFill(range);
      }

      const params = loadParams();
      params.preset = 'custom';
      if (prefix === 'mod-temp') params.temperature = parsed;
      if (prefix === 'mod-topp') params.topP = parsed;
      if (prefix === 'mod-topk') params.topK = parsed;
      saveParams(params);
      syncInputsWithStorage();
    });
  }

  function reconcilePosition(anchor, target) {
    if (!anchor || !target || !anchor.parentNode) return;
    if (target.parentNode === anchor.parentNode && anchor.nextElementSibling === target) return;
    anchor.after(target);
  }

  function reconcileControls() {
    const { nativeTempRange, nativeTopPRange, nativeTopPContainer } = getNativeControls();
    const params = loadParams();
    const presetGroup = document.getElementById('aisu-preset-group');

    // 1. Temperature Slider (Top Section)
    const customTemp = document.getElementById('aisu-slider-block-mod-temp');
    if (nativeTempRange) {
      if (customTemp) customTemp.remove();
    } else if (presetGroup && presetGroup.parentNode) {
      const tempBlock = customTemp || createCustomSlider(
        'mod-temp', 'Temperature', 0, 2, 0.05, params.temperature, true,
        'Controls randomness: 0 is deterministic, higher values increase variety.'
      );
      reconcilePosition(presetGroup, tempBlock);
    }

    // 2. Output Length Anchor (Advanced Settings)
    const outputLengthItem = document.querySelector('.settings-item.output-length') ||
                             document.querySelector('ms-slider[title*="Output length" i]')?.closest('.settings-item') ||
                             document.querySelector('input[name="maxOutputTokens"]')?.closest('.settings-item');

    // 3. Top P Slider (Advanced Settings)
    const customTopP = document.getElementById('aisu-slider-block-mod-topp');
    if (nativeTopPRange) {
      if (customTopP) customTopP.remove();
    } else if (outputLengthItem && outputLengthItem.parentNode) {
      const topPBlock = customTopP || createCustomSlider(
        'mod-topp', 'Top P', 0, 1, 0.01, params.topP, true,
        'Cumulative probability threshold for nucleus sampling.'
      );
      reconcilePosition(outputLengthItem, topPBlock);
    }

    // 4. Top K Slider (Advanced Settings)
    const topKAnchor = nativeTopPContainer ||
                       document.getElementById('aisu-slider-block-mod-topp') ||
                       outputLengthItem;

    if (topKAnchor && topKAnchor.parentNode) {
      const topKBlock = document.getElementById('aisu-slider-block-mod-topk') || createCustomSlider(
        'mod-topk', 'Top K', 1, 128, 1, params.topK, false,
        'Limits candidate tokens to the K most likely choices (1–128).'
      );
      reconcilePosition(topKAnchor, topKBlock);
    }
  }

  function injectInputs() {
    bindEventDelegation();

    const currentParams = loadParams();
    let presetGroup = document.getElementById('aisu-preset-group');

    if (!presetGroup || !presetGroup.isConnected) {
      const anchor = document.querySelector('.selector-container.field-group') ||
                     document.querySelector('.selector-container') ||
                     document.querySelector('ms-model-selector')?.closest('.field-group') ||
                     document.querySelector('.settings-items-wrapper > :first-child');

      if (anchor && anchor.parentNode) {
        if (!presetGroup) {
          presetGroup = createPresetDropdown(currentParams.preset);
        }
        anchor.after(presetGroup);
      }
    }

    reconcileControls();
    syncInputsWithStorage();
  }

  function executeSync() {
    if (isInternalMutation) return;

    const presetGroup = document.getElementById('aisu-preset-group');
    const currentModel = getActiveModelName();

    if (presetGroup && presetGroup.isConnected && currentModel === lastModelName) {
      reconcileControls();
      syncInputsWithStorage();
      return;
    }

    isInternalMutation = true;
    try {
      lastModelName = currentModel;
      injectInputs();
    } finally {
      isInternalMutation = false;
    }
  }

  function scheduleSync() {
    if (rafSyncId !== null) return;
    rafSyncId = requestAnimationFrame(() => {
      rafSyncId = null;
      executeSync();
    });
  }

  const settingsObserver = new MutationObserver((mutations) => {
    if (isInternalMutation) return;

    for (let i = 0; i < mutations.length; i++) {
      const target = mutations[i].target;
      if (!target || target.nodeType !== 1) continue;

      const el = /** @type {HTMLElement} */ (target);
      if (el.closest('[data-aisu]')) continue;
      if (el.closest('ms-chat-turn, ms-thought-chunk, ms-autoscroll-container, textarea')) continue;

      if (el.closest('ms-run-settings, ms-right-side-panel, .settings-items-wrapper')) {
        scheduleSync();
        break;
      }
    }
  });

  function bindSettingsObserver() {
    const target = document.querySelector('ms-run-settings') ||
                   document.querySelector('ms-right-side-panel') ||
                   document.body;

    if (target) {
      settingsObserver.observe(target, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
      bindSettingsObserver();
      scheduleSync();
    }, { once: true });
  } else {
    bindSettingsObserver();
    scheduleSync();
  }

  const wrapHistory = (type) => {
    const orig = history[type];
    return function (...args) {
      lastModelName = '';
      const res = orig.apply(this, args);
      scheduleSync();
      return res;
    };
  };

  history.pushState = wrapHistory('pushState');
  history.replaceState = wrapHistory('replaceState');
  window.addEventListener('popstate', () => {
    lastModelName = '';
    scheduleSync();
  });
  window.addEventListener('hashchange', () => {
    lastModelName = '';
    scheduleSync();
  });
})();