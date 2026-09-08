'use strict';

/**
 * @module Interceptor
 * @description Non-destructive RPC interception for MakerSuiteService/GenerateContent protobuf payloads.
 */
(function () {
  /**
   * @function findConfigArray
   * @param {Array} arr Target payload array.
   * @returns {Array|null} Reference to configuration vector: [temp, null, model, null, topP, topK, ...]
   */
  function findConfigArray(arr) {
    if (!Array.isArray(arr)) return null;
    if (arr.length >= 6 && typeof arr[2] === 'string' && arr[2].startsWith('models/')) {
      return arr;
    }
    for (let i = 0; i < arr.length; i++) {
      if (Array.isArray(arr[i])) {
        const found = findConfigArray(arr[i]);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * @function modifyPayload
   * @param {string} rawBody
   * @returns {string}
   */
  function modifyPayload(rawBody) {
    if (!rawBody || typeof rawBody !== 'string') return rawBody;

    try {
      const body = JSON.parse(rawBody);
      const cfg = findConfigArray(body);

      if (cfg) {
        const params = window.AISU.loadCurrentParams();
        cfg[0] = window.AISU.parseNumber(params.temperature, true);
        cfg[4] = window.AISU.parseNumber(params.topP, true);
        cfg[5] = window.AISU.parseNumber(params.topK, false);
        return JSON.stringify(body);
      }
    } catch (err) {
      console.warn('[AISU] Payload modification skipped:', err);
    }
    return rawBody;
  }

  /**
   * @function sanitizeResponse
   * @param {string} raw
   * @returns {string}
   */
  function sanitizeResponse(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    return raw
      .replace(/"The model output could not be generated[^"]*"/g, 'null')
      .replace(/"PROHIBITED_CONTENT"/g, '"STOP"')
      .replace(/"IMAGE_SAFETY"/g, '"STOP"')
      .replace(/"blocked"\s*:\s*true/g, '"blocked":false');
  }

  // Hook XMLHttpRequest
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
      if (typeof body === 'string') {
        body = modifyPayload(body);
      }
    }
    return nativeSend.call(this, body);
  };

  // Hook Fetch API
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
        } catch (err) {
          console.warn('[AISU] Fetch clone modification skipped:', err);
        }
      }
    }
    return nativeFetch.call(this, input, init);
  };
})();