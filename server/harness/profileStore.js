const fs = require('fs');
const path = require('path');

const KB_DIR = path.join(__dirname, '..', '..', 'knowledge_base');
const PROFILE_FILE = path.join(KB_DIR, 'harness_profile.json');
const MAX_RECENT_ADJUSTMENTS = 20;

function ensureKBDir() {
  if (!fs.existsSync(KB_DIR)) {
    fs.mkdirSync(KB_DIR, { recursive: true });
  }
}

function defaultProfile() {
  return {
    version: 1,
    strategy: {
      maxIterations: 8,
      preferKnowledgeBaseFirst: true,
      retryLimitPerTool: 2,
      toolPriority: [
        'query_knowledge_base',
        'parse_chain_links',
        'search_tech',
        'save_learning',
        'respond_to_user',
      ],
      preferredSequence: [
        'query_knowledge_base',
        'parse_chain_links',
        'search_tech',
        'respond_to_user',
      ],
    },
    metrics: {
      runCount: 0,
      successCount: 0,
      averageScore: 0,
      lastRunAt: null,
      toolStats: {},
      sequenceStats: {},
      feedback: {
        count: 0,
        averageRating: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        lastFeedbackAt: null,
      },
    },
    evolution: {
      recentAdjustments: [],
      latestReflection: '',
      updatedAt: new Date().toISOString(),
    },
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readProfile() {
  ensureKBDir();
  try {
    if (!fs.existsSync(PROFILE_FILE)) {
      const profile = defaultProfile();
      fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf-8');
      return profile;
    }
    const parsed = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf-8'));
    return mergeWithDefaults(parsed);
  } catch (error) {
    console.error('Failed to read harness profile:', error.message);
    return defaultProfile();
  }
}

function writeProfile(profile) {
  ensureKBDir();
  const nextProfile = mergeWithDefaults(profile);
  nextProfile.evolution.updatedAt = new Date().toISOString();
  try {
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(nextProfile, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write harness profile:', error.message);
  }
  return nextProfile;
}

function mergeWithDefaults(profile) {
  const base = defaultProfile();
  return {
    ...base,
    ...profile,
    strategy: {
      ...base.strategy,
      ...(profile?.strategy || {}),
    },
    metrics: {
      ...base.metrics,
      ...(profile?.metrics || {}),
      feedback: {
        ...base.metrics.feedback,
        ...(profile?.metrics?.feedback || {}),
      },
      toolStats: {
        ...base.metrics.toolStats,
        ...(profile?.metrics?.toolStats || {}),
      },
      sequenceStats: {
        ...base.metrics.sequenceStats,
        ...(profile?.metrics?.sequenceStats || {}),
      },
    },
    evolution: {
      ...base.evolution,
      ...(profile?.evolution || {}),
      recentAdjustments: Array.isArray(profile?.evolution?.recentAdjustments)
        ? profile.evolution.recentAdjustments.slice(-MAX_RECENT_ADJUSTMENTS)
        : [],
    },
  };
}

function pushAdjustment(profile, adjustment) {
  if (!adjustment) {
    return profile;
  }
  profile.evolution.recentAdjustments.push({
    message: adjustment,
    timestamp: new Date().toISOString(),
  });
  if (profile.evolution.recentAdjustments.length > MAX_RECENT_ADJUSTMENTS) {
    profile.evolution.recentAdjustments.splice(
      0,
      profile.evolution.recentAdjustments.length - MAX_RECENT_ADJUSTMENTS
    );
  }
  return profile;
}

function updateAverage(currentAverage, currentCount, nextValue) {
  if (currentCount <= 0) {
    return nextValue;
  }
  return ((currentAverage * currentCount) + nextValue) / (currentCount + 1);
}

function recordRun(profileInput, evaluation) {
  const profile = mergeWithDefaults(profileInput);
  const metrics = profile.metrics;
  const strategy = profile.strategy;

  metrics.runCount += 1;
  metrics.lastRunAt = new Date().toISOString();
  metrics.averageScore = updateAverage(metrics.averageScore, metrics.runCount - 1, evaluation.score);

  if (evaluation.success) {
    metrics.successCount += 1;
  }

  for (const toolResult of evaluation.toolResults) {
    const current = metrics.toolStats[toolResult.tool] || {
      runs: 0,
      success: 0,
      failure: 0,
      lastUsedAt: null,
    };
    current.runs += 1;
    if (toolResult.success) {
      current.success += 1;
    } else {
      current.failure += 1;
    }
    current.lastUsedAt = metrics.lastRunAt;
    metrics.toolStats[toolResult.tool] = current;
  }

  const sequenceKey = evaluation.toolSequence.join(' > ');
  if (sequenceKey) {
    const sequence = metrics.sequenceStats[sequenceKey] || {
      runs: 0,
      success: 0,
      averageScore: 0,
      lastUsedAt: null,
    };
    sequence.averageScore = updateAverage(sequence.averageScore, sequence.runs, evaluation.score);
    sequence.runs += 1;
    if (evaluation.success) {
      sequence.success += 1;
    }
    sequence.lastUsedAt = metrics.lastRunAt;
    metrics.sequenceStats[sequenceKey] = sequence;
  }

  const failedTools = evaluation.toolResults.filter((item) => !item.success);
  if (failedTools.length >= 2) {
    const previous = strategy.maxIterations;
    strategy.maxIterations = clamp(strategy.maxIterations + 1, 6, 10);
    if (strategy.maxIterations !== previous) {
      pushAdjustment(profile, `Raised maxIterations to ${strategy.maxIterations} after repeated tool failures.`);
    }
  }

  const successfulSequences = Object.entries(metrics.sequenceStats)
    .sort((a, b) => {
      const leftScore = (a[1].success / Math.max(1, a[1].runs)) + a[1].averageScore;
      const rightScore = (b[1].success / Math.max(1, b[1].runs)) + b[1].averageScore;
      return rightScore - leftScore;
    });

  if (successfulSequences.length > 0) {
    const topSequence = successfulSequences[0][0].split(' > ').filter(Boolean);
    if (topSequence.length > 0) {
      strategy.preferredSequence = topSequence;
    }
  }

  const rankedTools = Object.entries(metrics.toolStats)
    .sort((a, b) => {
      const left = (a[1].success - a[1].failure) / Math.max(1, a[1].runs);
      const right = (b[1].success - b[1].failure) / Math.max(1, b[1].runs);
      return right - left;
    })
    .map(([tool]) => tool);

  if (rankedTools.length > 0) {
    strategy.toolPriority = rankedTools;
  }

  profile.evolution.latestReflection = evaluation.summary;
  return writeProfile(profile);
}

function recordFeedback(profileInput, payload) {
  const profile = mergeWithDefaults(profileInput);
  const feedback = profile.metrics.feedback;
  const rating = Number(payload.rating || 0);

  feedback.averageRating = updateAverage(feedback.averageRating, feedback.count, rating);
  feedback.count += 1;
  feedback.lastFeedbackAt = new Date().toISOString();

  if (rating >= 4) {
    feedback.positive += 1;
  } else if (rating <= 2) {
    feedback.negative += 1;
  } else {
    feedback.neutral += 1;
  }

  if (payload.pattern?.toolSequence?.length) {
    const key = payload.pattern.toolSequence.join(' > ');
    const sequence = profile.metrics.sequenceStats[key] || {
      runs: 0,
      success: 0,
      averageScore: 0,
      lastUsedAt: null,
    };
    sequence.runs += 1;
    if (rating >= 4) {
      sequence.success += 1;
      pushAdjustment(profile, `Reinforced preferred tool sequence: ${key}.`);
    } else if (rating <= 2) {
      pushAdjustment(profile, `Marked tool sequence as weak after low rating: ${key}.`);
    }
    profile.metrics.sequenceStats[key] = sequence;
  }

  if (rating <= 2 && Array.isArray(payload.correctedChainLinks) && payload.correctedChainLinks.length > 0) {
    profile.strategy.preferKnowledgeBaseFirst = true;
    profile.strategy.retryLimitPerTool = clamp(profile.strategy.retryLimitPerTool + 1, 1, 3);
    pushAdjustment(
      profile,
      `Expanded retryLimitPerTool to ${profile.strategy.retryLimitPerTool} after corrected chain links feedback.`
    );
  }

  if (feedback.averageRating >= 4.2 && profile.strategy.maxIterations > 6) {
    profile.strategy.maxIterations = clamp(profile.strategy.maxIterations - 1, 6, 10);
    pushAdjustment(profile, `Reduced maxIterations to ${profile.strategy.maxIterations} because recent quality is stable.`);
  }

  return writeProfile(profile);
}

function buildStrategySummary(profileInput) {
  const profile = mergeWithDefaults(profileInput);
  const recentAdjustments = profile.evolution.recentAdjustments
    .slice(-3)
    .map((item) => item.message);

  return {
    maxIterations: profile.strategy.maxIterations,
    preferKnowledgeBaseFirst: profile.strategy.preferKnowledgeBaseFirst,
    retryLimitPerTool: profile.strategy.retryLimitPerTool,
    preferredSequence: profile.strategy.preferredSequence,
    toolPriority: profile.strategy.toolPriority,
    recentAdjustments,
    averageScore: Number(profile.metrics.averageScore.toFixed(3)),
    runCount: profile.metrics.runCount,
    successRate: profile.metrics.runCount > 0
      ? Number((profile.metrics.successCount / profile.metrics.runCount).toFixed(3))
      : 0,
    feedback: {
      count: profile.metrics.feedback.count,
      averageRating: Number(profile.metrics.feedback.averageRating.toFixed(2)),
      positive: profile.metrics.feedback.positive,
      neutral: profile.metrics.feedback.neutral,
      negative: profile.metrics.feedback.negative,
    },
  };
}

module.exports = {
  defaultProfile,
  loadProfile: readProfile,
  saveProfile: writeProfile,
  recordRun,
  recordFeedback,
  buildStrategySummary,
};
