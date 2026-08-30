module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // three.js ships static class blocks, which the preset does not transform.
    plugins: ["@babel/plugin-transform-class-static-block"],
  };
};
