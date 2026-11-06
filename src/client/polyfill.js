// Tiny polyfills for older Android WebViews / in-app viewers. Imported first.
if (!Object.fromEntries) Object.fromEntries = (it) => { const o = {}; for (const [k, v] of it) o[k] = v; return o; };
