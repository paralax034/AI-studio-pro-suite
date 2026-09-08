'use strict';

/**
 * @module UI
 * @description Native Material 3 UI adapter for Google AI Studio.
 * Uses 1:1 platform design tokens extracted directly from AI Studio stylesheets.
 */
(function () {
  let isInternalMutation = false;
  let rafSyncId = null;
  let lastModelName = '';

  /**
   * @function createEl
   * @description Trusted Types compliant DOM element factory.
   * @param {string} tag
   * @param {Object} [props={}]
   * @param {...(Node|string|Array)} children
   * @returns {HTMLElement|SVGElement}
   */
  function createEl(tag, props = {}, ...children) {
    const el = tag === 'svg' || tag === 'path'
      ? document.createElementNS('http://www.w3.org/2000/svg', tag)
      : document.createElement(tag);

    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined) continue;
      if (k === 'className') {
        el.className = v;
      } else if (k === 'textContent') {
        el.textContent = v;
      } else {
        el.setAttribute(k, String(v));
      }
    }

    for (const child of children.flat()) {
      if (child === null || child === undefined) continue;
      el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return el;
  }

  /**
   * @function injectStyles
   * @description Mounts styles mapped directly to AI Studio's native CSS variables.
   */
  function injectStyles() {
    if (document.getElementById('aisu-design-tokens')) return;
    const target = document.head || document.documentElement;
    if (!target) return;

    const styleEl = createEl('style', { id: 'aisu-design-tokens' });
    styleEl.textContent = `
      :root {
        --aisu-font: Inter, sans-serif;
        --aisu-bg-surface: var(--color-v3-surface-container, #1f1f1f);
        --aisu-bg-field: var(--color-v3-surface-container-high, #252525);
        --aisu-bg-hover: var(--color-v3-hover, #323232);
        --aisu-bg-selected: var(--color-v3-surface-container-highest, #2a2a2a);
        --aisu-border-subtle: var(--color-v3-outline-var, #262626);
        --aisu-border-default: var(--color-v3-outline, #333333);
        --aisu-border-active: var(--color-v3-outline-active, #b7babd);
        --aisu-color-accent: var(--color-v3-text, #d4d4d4);
        --aisu-text-primary: var(--color-v3-text, #d4d4d4);
        --aisu-text-secondary: var(--color-v3-text-var, #8c8c8c);
        --aisu-shadow-dropdown: var(--v3-shadow-dropdown, 0 4px 8px 3px rgba(0,0,0,0.05), 0 1px 3px 0 rgba(0,0,0,0.15));
      }

      .aisu-field-group {
        border-bottom: 1px solid var(--aisu-border-subtle);
        padding: clamp(8px, 1.2vw, 12px) 0 clamp(10px, 1.5vw, 14px);
        width: 100%;
        box-sizing: border-box;
      }

      .aisu-select {
        position: relative;
        width: 100%;
      }

      .aisu-select__trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        min-height: 40px;
        height: 40px;
        padding: 0 12px;
        background-color: var(--aisu-bg-field);
        border: 1px solid var(--aisu-border-subtle);
        border-radius: 12px;
        color: var(--aisu-text-primary);
        font-family: var(--aisu-font);
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        cursor: pointer;
        user-select: none;
        box-sizing: border-box;
        transition: border-color 0.15s ease-in-out, background-color 0.15s ease-in-out;
      }

      .aisu-select__trigger:hover {
        border-color: var(--aisu-border-default);
      }

      .aisu-select__trigger[aria-expanded="true"] {
        border-color: var(--aisu-border-active);
      }

      .aisu-select__label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding-right: 8px;
      }

      .aisu-select__arrow {
        flex-shrink: 0;
        color: var(--aisu-text-primary);
        transition: transform 0.2s ease;
      }

      .aisu-select__trigger[aria-expanded="true"] .aisu-select__arrow {
        transform: rotate(180deg);
      }

      .aisu-select__menu {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        width: 100%;
        background-color: var(--aisu-bg-surface);
        border: 1px solid var(--aisu-border-subtle);
        border-radius: 8px;
        box-shadow: var(--aisu-shadow-dropdown);
        padding: 4px;
        z-index: 1000;
        box-sizing: border-box;
      }

      .aisu-select__option {
        display: flex;
        align-items: center;
        width: 100%;
        min-height: 36px;
        padding: 6px 8px;
        margin: 2px 0;
        border-radius: 4px;
        color: var(--aisu-text-primary);
        font-family: var(--aisu-font);
        cursor: pointer;
        user-select: none;
        box-sizing: border-box;
        transition: background-color 0.12s ease-in-out;
      }

      .aisu-select__option:hover {
        background-color: var(--aisu-bg-hover);
      }

      .aisu-select__option--selected {
        background-color: var(--aisu-bg-selected);
      }

      .aisu-select__option-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 100%;
        min-width: 0;
      }

      .aisu-select__option-title {
        font-size: 13px;
        font-weight: 500;
        line-height: 18px;
        color: var(--aisu-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .aisu-select__option-spec {
        font-size: 11px;
        font-weight: 400;
        line-height: 14px;
        color: var(--aisu-text-secondary);
        letter-spacing: 0.2px;
      }

      .aisu-slider-item {
        display: flex;
        flex-direction: column;
        width: 100%;
        padding: clamp(6px, 1vw, 8px) 0;
        box-sizing: border-box;
      }

      .aisu-slider-item__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        margin-bottom: 2px;
      }

      .aisu-slider-item__title {
        font-family: var(--aisu-font);
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        color: var(--aisu-text-primary);
        margin: 0;
      }

      .aisu-slider-row {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-height: 44px;
      }

      .aisu-slider-row__track-container {
        position: relative;
        flex: 1;
        display: flex;
        align-items: center;
        min-height: 44px;
      }

      .aisu-slider-row__range {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        min-height: 44px;
        height: 44px;
        margin: 0;
        background: transparent;
        cursor: pointer;
      }

      .aisu-slider-row__range:focus {
        outline: none;
      }

      .aisu-slider-row__range::-webkit-slider-runnable-track {
        height: 4px;
        border-radius: 2px;
        background: linear-gradient(
          to right,
          var(--aisu-color-accent) 0%,
          var(--aisu-color-accent) var(--aisu-progress, 50%),
          var(--aisu-border-default) var(--aisu-progress, 50%),
          var(--aisu-border-default) 100%
        );
      }

      .aisu-slider-row__range::-moz-range-track {
        height: 4px;
        border-radius: 2px;
        background: var(--aisu-border-default);
      }

      .aisu-slider-row__range::-moz-range-progress {
        height: 4px;
        border-radius: 2px;
        background: var(--aisu-color-accent);
      }

      .aisu-slider-row__range::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        margin-top: -5px;
        border-radius: 50%;
        background: var(--aisu-color-accent);
        border: none;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      }

      .aisu-slider-row__range::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--aisu-color-accent);
        border: none;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      }

      .aisu-slider-row__input-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 48px;
        min-height: 44px;
      }

      .aisu-slider-row__input {
        width: 48px;
        min-width: 48px;
        height: 28px;
        background-color: transparent;
        border: 1px solid var(--aisu-border-subtle);
        border-radius: 8px;
        color: var(--aisu-text-primary);
        font-family: var(--aisu-font);
        font-size: 12px;
        font-weight: 400;
        line-height: 18px;
        text-align: center;
        box-sizing: border-box;
        outline: none;
        transition: border-color 0.15s ease-in-out;
        -moz-appearance: textfield;
      }

      .aisu-slider-row__input:focus {
        border-color: var(--aisu-border-active);
      }

      .aisu-slider-row__input::-webkit-inner-spin-button,
      .aisu-slider-row__input::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      @media (prefers-reduced-motion: reduce) {
        .aisu-select__trigger,
        .aisu-select__arrow,
        .aisu-select__option,
        .aisu-slider-row__input {
          transition: none;
        }
      }
    `;
    target.appendChild(styleEl);
  }

  /**
   * @function updateSliderFill
   * @param {HTMLInputElement} rangeEl
   */
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

  /**
   * @function getActiveModelName
   * @returns {string}
   */
  function getActiveModelName() {
    const el = document.querySelector('[data-test-id="model-name"]') ||
               document.querySelector('.model-name') ||
               document.querySelector('.ms-model-selector-button');
    return el ? el.textContent.trim() : '';
  }

  /**
   * @function getNativeControls
   * @returns {{nativeTempRange: HTMLInputElement|null, nativeTempNum: HTMLInputElement|null, nativeTopPRange: HTMLInputElement|null, nativeTopPNum: HTMLInputElement|null, nativeTopPContainer: HTMLElement|null}}
   */
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

  /**
   * @function dispatchNativeInput
   * @param {HTMLInputElement} input
   * @param {string|number} value
   */
  function dispatchNativeInput(input, value) {
    if (!input) return;
    const strVal = String(value);
    const proto = Object.getPrototypeOf(input);
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value') ||
                       Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(input, strVal);
    } else {
      input.value = strVal;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * @function createCustomSlider
   * @param {string} prefix
   * @param {string} title
   * @param {number} min
   * @param {number} max
   * @param {number} step
   * @param {number} val
   * @param {boolean} isFloat
   * @param {string} tip
   * @returns {HTMLDivElement}
   */
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

  /**
   * @function createPresetDropdown
   * @param {string} currentPresetKey
   * @returns {HTMLDivElement}
   */
  function createPresetDropdown(currentPresetKey) {
    const activePreset = window.AISU.PRESETS[currentPresetKey];
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
      Object.entries(window.AISU.PRESETS).map(([k, p]) =>
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

  /**
   * @function applyPreset
   * @param {string} presetKey
   */
  function applyPreset(presetKey) {
    const preset = window.AISU.PRESETS[presetKey];
    if (!preset) return;

    window.AISU.saveCurrentParams({
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

  /**
   * @function syncInputsWithStorage
   */
  function syncInputsWithStorage() {
    const params = window.AISU.loadCurrentParams();

    const labelEl = document.getElementById('aisu-preset-label');
    if (labelEl) {
      const activePreset = window.AISU.PRESETS[params.preset];
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

  /**
   * @function closePresetDropdown
   */
  function closePresetDropdown() {
    const menu = document.getElementById('aisu-preset-menu');
    const trigger = document.getElementById('aisu-preset-trigger');
    if (menu) menu.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  /**
   * @function bindEventDelegation
   */
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
        const parsed = window.AISU.parseNumber(range.value, isFloat);

        const num = document.getElementById(`aisu-num-${prefix}`);
        if (num) num.value = String(parsed);
        updateSliderFill(range);

        const params = window.AISU.loadCurrentParams();
        params.preset = 'custom';
        if (prefix === 'mod-temp') params.temperature = parsed;
        if (prefix === 'mod-topp') params.topP = parsed;
        if (prefix === 'mod-topk') params.topK = parsed;
        window.AISU.saveCurrentParams(params);
        syncInputsWithStorage();
        return;
      }

      const { nativeTempRange, nativeTopPRange } = getNativeControls();
      if (e.target === nativeTempRange || e.target === nativeTopPRange) {
        const isTemp = e.target === nativeTempRange;
        const val = window.AISU.parseNumber(e.target.value, true);
        const params = window.AISU.loadCurrentParams();
        params.preset = 'custom';
        if (isTemp) params.temperature = val;
        else params.topP = val;
        window.AISU.saveCurrentParams(params);
        syncInputsWithStorage();
      }
    });

    document.addEventListener('change', (e) => {
      const num = e.target.closest('.aisu-slider-row__input');
      if (!num) return;

      const prefix = num.getAttribute('data-prefix');
      const isFloat = num.getAttribute('data-float') === 'true';
      let parsed = window.AISU.parseNumber(num.value, isFloat);

      if (prefix === 'mod-temp') parsed = Math.max(0, Math.min(2, parsed));
      if (prefix === 'mod-topp') parsed = Math.max(0, Math.min(1, parsed));
      if (prefix === 'mod-topk') parsed = Math.max(1, Math.min(128, parsed));

      num.value = String(parsed);
      const range = document.getElementById(`aisu-range-${prefix}`);
      if (range) {
        range.value = String(parsed);
        updateSliderFill(range);
      }

      const params = window.AISU.loadCurrentParams();
      params.preset = 'custom';
      if (prefix === 'mod-temp') params.temperature = parsed;
      if (prefix === 'mod-topp') params.topP = parsed;
      if (prefix === 'mod-topk') params.topK = parsed;
      window.AISU.saveCurrentParams(params);
      syncInputsWithStorage();
    });
  }

  /**
   * @function reconcilePosition
   * @param {HTMLElement} anchor
   * @param {HTMLElement} target
   */
  function reconcilePosition(anchor, target) {
    if (!anchor || !target || !anchor.parentNode) return;
    if (target.parentNode === anchor.parentNode && anchor.nextElementSibling === target) return;
    anchor.after(target);
  }

  /**
   * @function reconcileControls
   */
  function reconcileControls() {
    const { nativeTempRange, nativeTopPRange, nativeTopPContainer } = getNativeControls();
    const params = window.AISU.loadCurrentParams();
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

    // 4. Top K Slider (Advanced Settings, immediately following Top P)
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

  /**
   * @function injectInputs
   */
  function injectInputs() {
    injectStyles();
    bindEventDelegation();

    const currentParams = window.AISU.loadCurrentParams();
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

  /**
   * @function executeSync
   */
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

  /**
   * @function scheduleSync
   */
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
    window.addEventListener('DOMContentLoaded', bindSettingsObserver, { once: true });
  } else {
    bindSettingsObserver();
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

  scheduleSync();
})();