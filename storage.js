'use strict';

/**
 * @namespace AISU
 * @description State persistence and hyperparameter preset definitions for Google AI Studio.
 */
window.AISU = window.AISU || {};

/**
 * @constant {Object.<string, {name: string, temp: number, topP: number, topK: number}>} PRESETS
 * @description Curated sampling hyperparameter presets across distinct generative tasks.
 */
window.AISU.PRESETS = {
  deterministic: {
    name: 'Deterministic / Strict Code',
    temp: 0.0,
    topP: 0.1,
    topK: 1
  },
  precise: {
    name: 'Precise / Data Extraction',
    temp: 0.2,
    topP: 0.4,
    topK: 16
  },
  academic: {
    name: 'Academic & Technical',
    temp: 0.45,
    topP: 0.7,
    topK: 24
  },
  gamedev: {
    name: 'Creative Code & Shaders',
    temp: 0.65,
    topP: 0.85,
    topK: 40
  },
  balance: {
    name: 'Balanced (Default)',
    temp: 1.0,
    topP: 0.95,
    topK: 64
  },
  roleplay: {
    name: 'Conversational & Roleplay',
    temp: 1.15,
    topP: 0.92,
    topK: 64
  },
  creative: {
    name: 'Creative & Storytelling',
    temp: 1.4,
    topP: 0.95,
    topK: 80
  },
  brainstorm: {
    name: 'Brainstorm & Ideation',
    temp: 1.75,
    topP: 0.98,
    topK: 100
  },
  entropy: {
    name: 'Maximum Entropy / Experimental',
    temp: 2.0,
    topP: 1.0,
    topK: 128
  }
};

/**
 * @constant {Object} DEFAULT_PARAMS
 */
window.AISU.DEFAULT_PARAMS = {
  preset: 'balance',
  temperature: window.AISU.PRESETS.balance.temp,
  topP: window.AISU.PRESETS.balance.topP,
  topK: window.AISU.PRESETS.balance.topK
};

/**
 * @function getCurrentContextKey
 * @returns {string} Partitioned storage key bound to active prompt and model.
 */
window.AISU.getCurrentContextKey = function () {
  const urlMatch = location.pathname.match(/\/prompts\/([a-zA-Z0-9_-]+)/);
  const promptId = urlMatch ? urlMatch[1] : 'new_chat';
  const modelEl = document.querySelector('[data-test-id="model-name"]') ||
                  document.querySelector('.model-name');
  const modelName = modelEl ? modelEl.textContent.trim().replace(/\s+/g, '_') : 'default_model';
  return `aistudio_cfg_${promptId}_${modelName}`;
};

/**
 * @function loadCurrentParams
 * @returns {{preset: string, temperature: number, topP: number, topK: number}}
 */
window.AISU.loadCurrentParams = function () {
  try {
    const raw = localStorage.getItem(window.AISU.getCurrentContextKey());
    return raw ? { ...window.AISU.DEFAULT_PARAMS, ...JSON.parse(raw) } : { ...window.AISU.DEFAULT_PARAMS };
  } catch {
    return { ...window.AISU.DEFAULT_PARAMS };
  }
};

/**
 * @function saveCurrentParams
 * @param {Object} params
 */
window.AISU.saveCurrentParams = function (params) {
  try {
    localStorage.setItem(window.AISU.getCurrentContextKey(), JSON.stringify(params));
  } catch (err) {
    console.warn('[AISU] Failed to persist configuration:', err);
  }
};

/**
 * @function parseNumber
 * @param {string|number} val
 * @param {boolean} isFloat
 * @returns {number}
 */
window.AISU.parseNumber = function (val, isFloat) {
  if (val === undefined || val === null) return 0;
  const clean = String(val).replace(',', '.').trim();
  const num = isFloat ? parseFloat(clean) : parseInt(clean, 10);
  return Number.isNaN(num) ? 0 : num;
};