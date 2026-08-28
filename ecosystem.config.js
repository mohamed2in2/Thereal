module.exports = {
  apps: [
    {
      name: "Thefake",
      script: "server.js",
      instances: "max",
      exec_mode: "cluster",
      max_memory_restart: "1200M",
      node_args: "--max-old-space-size=1536",
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
