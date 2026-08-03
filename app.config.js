/**
 * Extends app.json at build time.
 *
 * GitHub Pages serves a project site from a subpath (/tripcost), so the web
 * bundle has to know its base URL or every asset request 404s. Local dev serves
 * from the root, so the base URL is applied only when an explicit env var says
 * this is a deploy — that keeps `npm start` working at localhost:8081 with no
 * path prefix.
 *
 *   npm run deploy:web      → exports with baseUrl=/tripcost
 *   npm start               → no baseUrl, served at /
 */
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_DEPLOY_BASE_URL;
  if (!baseUrl) return config;

  return {
    ...config,
    experiments: { ...(config.experiments ?? {}), baseUrl },
  };
};
