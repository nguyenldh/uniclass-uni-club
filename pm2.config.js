module.exports = {
  apps: [
    // ==========================================
    // OPTION 1: PM2 Fork Mode (Multiple instances on DIFFERENT ports)
    // ==========================================
    // Highly recommended for Windows! PM2 Fork mode is completely silent
    // and does not flash CMD/console windows when starting/restarting.
    {
      name: "uniclub-backend-3000",
      cwd: "./backend",
      script: "./dist/index.js",
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        PORT: 3000
      }
    },
    {
      name: "uniclub-backend-3001",
      cwd: "./backend",
      script: "./dist/index.js",
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        PORT: 3001
      }
    },
    {
      name: "uniclub-backend-3002",
      cwd: "./backend",
      script: "./dist/index.js",
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        PORT: 3002
      }
    },

    // ==========================================
    // OPTION 2: PM2 Cluster Mode (Load-balanced on the SAME port)
    // ==========================================
    // Note: PM2 Cluster Mode has a known bug on Windows where it flashes
    // cmd/conhost windows repeatedly during process spawning and crash-loops.
    {
      name: "uniclub-backend-cluster",
      cwd: "./backend",
      script: "./dist/index.js",
      instances: 3,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
        PORT: 3000
      }
    }
  ]
};
