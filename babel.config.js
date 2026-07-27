module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Lets drizzle migrations (.sql files) be bundled as importable strings.
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
