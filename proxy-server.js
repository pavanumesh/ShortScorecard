const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Proxy requests to Google Apps Script
app.use('/api', createProxyMiddleware({
  target: 'https://script.google.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/macros/s/AKfycbwhYLhkIdMT3CEl_Z_kW0946wtztEheNhS3oE_DCqnroGuOxKOfKRN2eP8M3pkqMFpRyg/exec'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log('Proxying request to:', proxyReq.path);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('Response status:', proxyRes.statusCode);
    console.log('Response headers:', proxyRes.headers);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
  }
}));

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`Access your API at: http://localhost:${PORT}/api`);
});
