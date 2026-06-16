const express = require('express');
const cors = require('cors');

const { registerGraphRoutes } = require('../routes/graph/registerGraphRoutes');
const { registerMatchingRoutes } = require('../routes/matching/registerMatchingRoutes');
const { registerPptRoutes } = require('../routes/ppt/registerPptRoutes');
const { registerAgentRoutes } = require('../routes/agent/registerAgentRoutes');
const { registerAipptRoutes } = require('../routes/aippt/registerAipptRoutes');

function createApp(context) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '80mb' }));
  app.use(express.urlencoded({ extended: true, limit: '80mb' }));
  app.use(express.static(context.paths.publicDir));

  registerGraphRoutes(app, context);
  registerMatchingRoutes(app, context);
  registerPptRoutes(app, context);
  registerAgentRoutes(app, context);
  registerAipptRoutes(app, context);

  return app;
}

module.exports = {
  createApp,
};
