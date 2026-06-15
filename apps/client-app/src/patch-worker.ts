// Suppress MapLibre style validation warnings on the main thread
const origWarn = console.warn;
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string') {
    if (args[0].includes('Expected value to be of') && args[0].includes('type number, but found null instead')) return;
    if (args[0].includes('There is no style added to the map')) return;
    if (args[0].includes('Geolocation permission denied or failed')) return;
  }
  origWarn.apply(console, args);
};

// Suppress MapLibre style validation warnings inside Web Workers
const OriginalBlob = window.Blob;
const PatchedBlob = function (parts: any[], options?: any) {
  if (options && options.type && options.type.includes('javascript')) {
    try {
      let isMapLibreWorker = false;
      parts.forEach(p => {
        if (typeof p === 'string') {
          if (p.length > 50000 && (p.includes('onmessage') || p.includes('postMessage'))) {
            isMapLibreWorker = true;
          }
        }
      });

      if (isMapLibreWorker) {
        const overrideScript = `
          if (self.console) {
            const origWarn = self.console.warn;
            self.console.warn = function (...args) {
              if (typeof args[0] === 'string') {
                if (args[0].includes('Expected value to be of') && args[0].includes('type number, but found null instead')) return;
              }
              origWarn.apply(self.console, args);
            };
          }
        `;
        parts = [overrideScript, ...parts];
      }
    } catch (e) {
      // Ignored
    }
  }
  return new OriginalBlob(parts, options);
};
PatchedBlob.prototype = OriginalBlob.prototype;
Object.setPrototypeOf(PatchedBlob, OriginalBlob);
window.Blob = PatchedBlob as any;
