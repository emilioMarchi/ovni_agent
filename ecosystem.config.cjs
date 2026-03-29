module.exports = {
  apps: [{
    name: "ovni-agent",
    script: "./dist/server/index.js",
    instances: 1,
    exec_mode: "fork",
    watch: false,
    max_memory_restart: "800M",
    env: {
      NODE_ENV: "production",
      PORT: 8080,
    },
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    error_file: "./logs/err.log",
    out_file: "./logs/out.log",
    merge_logs: true,
  }],
};