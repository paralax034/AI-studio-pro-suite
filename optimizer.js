'use strict';

/**
 * @module Optimizer
 * @description Applies CSS layout containment to streaming message views to stabilize render performance.
 */
(function () {
  function injectRenderOptimizations() {
    if (document.getElementById('aisu-performance-styles')) return;
    const target = document.head || document.documentElement;
    if (!target) return;

    const style = document.createElement('style');
    style.id = 'aisu-performance-styles';
    style.textContent = `
      ms-chat-turn {
        content-visibility: auto;
        contain-intrinsic-size: 0 160px;
      }
      ms-thought-chunk {
        contain: content;
      }
      ms-autoscroll-container,
      .chat-session-content {
        will-change: transform;
        transform: translateZ(0);
      }
      textarea.cdk-textarea-autosize {
        contain: layout paint;
      }
    `;
    target.appendChild(style);
  }

  const init = () => {
    if (document.head || document.documentElement) {
      injectRenderOptimizations();
    } else {
      setTimeout(init, 16);
    }
  };
  init();
})();