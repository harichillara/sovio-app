// Minimal react-native shim for Next.js web builds.
// @sovio/core imports `Platform` from 'react-native' at module level for
// platform detection. On web, Next 15's webpack refuses to parse the real
// react-native source (Flow syntax). This stub supplies just enough surface
// for the platform-gate pattern (`Platform.OS === 'web' ? ... : ...`) so
// web-only code paths resolve correctly at build time.
module.exports = {
  Platform: { OS: 'web', select: (specifics) => specifics.web ?? specifics.default },
};
