module.exports = {
  apps: [{
    name: 'draft-betting',
    script: 'server/index.js',
    env: {
      NODE_ENV: 'production',
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
  }],
};
