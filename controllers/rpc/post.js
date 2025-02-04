import path from 'path';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env') });

if (!process.env.CELESTIA_AUTH_KEY)
  console.error('CELESTIA_AUTH_KEY is not set!');

export default createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  pathRewrite: {
    '^/rpc': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Authorization', 'Bearer ' + process.env.CELESTIA_AUTH_KEY);
  }
});
