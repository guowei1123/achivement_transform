const { createApp } = require('./bootstrap/createApp');
const { createServerContext, closeServerContext } = require('./bootstrap/createServerContext');

async function startServer() {
  const context = await createServerContext();
  const { runtime } = context;
  const port = process.env.PORT || 3002;
  const app = createApp(context);

  const server = app.listen(port, () => {
    console.log(`Graph API service running on port ${port}`);
    console.log(`Graph store: ${process.env.GRAPH_STORE || 'json'}`);
    console.log(`Matching engine URL: ${runtime.MATCHING_ENGINE_URL}`);
    console.log(`AIPPT backend URL: ${runtime.AIPPT_BACKEND}`);
  });

  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down...`);

    server.close(async () => {
      try {
        await closeServerContext(context);
        process.exit(0);
      } catch (error) {
        console.error('Failed to close server context:', error);
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
