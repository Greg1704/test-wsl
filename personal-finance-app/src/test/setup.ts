import "@testing-library/jest-dom";

// Polyfills para Radix UI (Dialog/Select/Popover) bajo jsdom: usan APIs del DOM
// que jsdom no implementa. Sin esto, abrir un dialog en un component test rompe.
if (typeof window !== "undefined") {
  const proto = window.HTMLElement.prototype;
  proto.hasPointerCapture = () => false;
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.scrollIntoView = () => {};
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}
