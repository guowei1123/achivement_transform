const knowledgeBase = require('./knowledgeBase');
const { LangChainTechAgentHarness } = require('./harness/langChainTechAgentHarness');
const {
  loadProfile,
  recordFeedback,
  buildStrategySummary,
} = require('./harness/profileStore');

const langChainHarness = new LangChainTechAgentHarness({ knowledgeBase });

async function runAgent(userInput, context, conversationHistory = [], options = {}) {
  return langChainHarness.run(userInput, context, conversationHistory, options);
}

function findPatternById(patternId) {
  if (!patternId) {
    return null;
  }
  return knowledgeBase.loadPatterns().find((item) => item.id === patternId) || null;
}

function recordAgentFeedback(payload = {}) {
  const feedbackId = knowledgeBase.recordFeedback(payload);
  const pattern = findPatternById(payload.patternId);
  const rating = Number(payload.rating || 0);

  if (rating >= 4 && payload.patternId) {
    knowledgeBase.incrementPatternHit(payload.patternId);
  }

  if (pattern?.userInput && Array.isArray(payload.correctedChainLinks) && payload.correctedChainLinks.length > 0) {
    knowledgeBase.recordLearning({
      category: 'chain_mapping',
      key: pattern.userInput.substring(0, 80),
      value: `corrected_links=${payload.correctedChainLinks.join('|')}`,
      source: 'harness_feedback',
    });
  }

  const updatedProfile = recordFeedback(loadProfile(), {
    ...payload,
    pattern,
  });

  knowledgeBase.recordLearning({
    category: 'optimization',
    key: `feedback:${new Date().toISOString().slice(0, 10)}`,
    value: `rating=${rating}; pattern=${payload.patternId || 'none'}`,
    source: 'harness_feedback',
  });

  return {
    feedbackId,
    profile: buildStrategySummary(updatedProfile),
  };
}

function getAgentProfile() {
  return buildStrategySummary(loadProfile());
}

function getRawAgentProfile() {
  return loadProfile();
}

module.exports = {
  runAgent,
  knowledgeBase,
  recordAgentFeedback,
  getAgentProfile,
  getRawAgentProfile,
};
