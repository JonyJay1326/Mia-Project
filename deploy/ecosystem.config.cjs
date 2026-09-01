const path = require('path')

/** PM2 进程配置：API 只监听 127.0.0.1，由 Nginx 反代 */
module.exports = {
  apps: [
    {
      name: 'mia-api',
      cwd: path.join(__dirname, '../server'),
      script: 'dist/main.js',
      // 强制用加载本配置的 Node（避免 PM2 落到系统旧 /usr/bin/node）
      interpreter: process.execPath,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '450M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
