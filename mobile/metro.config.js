const { getDefaultConfig } = require("expo/metro-config");
const { createProxyMiddleware } = require("http-proxy-middleware");

const apiUrl =
  process.env.EXPO_PUBLIC_API_URL || "https://talkcash-api-prod.onrender.com/api/v1";
const apiOrigin = apiUrl.replace(/\/api\/v1\/?$/, "");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const apiProxy = createProxyMiddleware({
  target: apiOrigin,
  changeOrigin: true,
  secure: true,
});

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url && req.url.startsWith("/__api")) {
        req.url = req.url.replace(/^\/__api/, "") || "/";
        return apiProxy(req, res, next);
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
