module.exports = function (api) {
  api.cache(true);
  const isTest = process.env.NODE_ENV === 'test';
  const plugins = [
    // Allow importing generated Drizzle .sql migration files as strings.
    ['inline-import', { extensions: ['.sql'] }],
  ];
  // Reanimated's plugin needs the native worklets runtime and must be last.
  // It isn't needed (and doesn't load) under Jest, which only runs pure logic.
  if (!isTest) {
    plugins.push('react-native-reanimated/plugin');
  }
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
