function registerPptRoutes(app, context) {
  const { graphStore, PPTService } = context;

  app.get('/api/node-ppt/:nodeLabel', async (req, res) => {
    const result = await PPTService.getNodePPTContent(graphStore, req.params.nodeLabel);
    if (result.success) {
      return res.json(result);
    }
    res.status(500).json(result);
  });

  app.post('/api/generate-ppt-from-template', async (req, res) => {
    const { templateName, data } = req.body;
    if (!templateName) {
      return res.json({ success: false, error: '缂哄皯妯℃澘鍚嶇О鍙傛暟' });
    }
    if (!data) {
      return res.json({ success: false, error: '缂哄皯鏇挎崲鏁版嵁鍙傛暟' });
    }

    const result = await PPTService.generatePPTFromTemplate(templateName, data);
    if (result.success) {
      return res.json(result);
    }
    res.status(500).json(result);
  });

  app.post('/api/export-chain-ppt', async (req, res) => {
    const { enterpriseName } = req.body;
    if (!enterpriseName) {
      return res.json({ success: false, error: '缂哄皯浼佷笟鍚嶇О鍙傛暟' });
    }

    const result = await PPTService.exportChainPPT(graphStore, enterpriseName);
    if (result.success) {
      return res.json(result);
    }
    res.status(500).json(result);
  });
}

module.exports = {
  registerPptRoutes,
};
