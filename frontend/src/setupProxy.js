const { createProxyMiddleware } = require('http-proxy-middleware');
module.exports = function(app) {
  app.use('/prudential-api', createProxyMiddleware({
    target: 'http://127.0.0.1:5001', changeOrigin: false,
    pathRewrite: { '^/prudential-api': '/api' }
  }));
};
