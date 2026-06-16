const axios = require('axios');

async function filterAchievementsWithAI(techNeed, achievements, runtime) {
  try {
    const achievementsText = achievements.map((item, index) => `${index + 1}. ${item.label}`).join('\n');

    const prompt = `璇锋牴鎹紒涓氭妧鏈渶姹傦紝绛涢€夊嚭鏈€鐩稿叧鐨勭鎶€鎴愭灉銆?

鎶€鏈渶姹傦細${techNeed.label}

绉戞妧鎴愭灉鍒楄〃锛?
${achievementsText}

璇蜂互JSON鏍煎紡杩斿洖锛?
{
  "filtered": [
    {
      "index": 1,
      "score": 8,
      "reason": "绛涢€夌悊鐢?"
    }
  ]
}`;

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '浣犳槸涓€涓笓涓氱殑鎶€鏈尮閰嶄笓瀹讹紝鎿呴暱璇勪及绉戞妧鎴愭灉涓庢妧鏈渶姹傜殑鐩稿叧鎬с€?',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${runtime.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const aiContent = response.data.choices[0].message.content;
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return achievements;
    }

    const filteredResult = JSON.parse(jsonMatch[0]);

    if (!filteredResult.filtered) {
      return achievements;
    }

    const filteredIndices = filteredResult.filtered.map((item) => item.index - 1);
    return achievements
      .filter((_, index) => filteredIndices.includes(index))
      .map((achievement, index) => {
        const filteredInfo = filteredResult.filtered.find((item) => item.index === index + 1);
        const score = filteredInfo ? filteredInfo.score : 7.5;

        return {
          ...achievement,
          structural_score: (score / 10) * 0.7,
          semantic_score: (score / 10) * 0.8,
          fused_score: score / 10,
          recommendation_reason: filteredInfo ? filteredInfo.reason : 'AI鏅鸿兘鍖归厤鎺ㄨ崘',
          matching_path: [techNeed.label, 'AI鍖归厤', achievement.label],
        };
      });
  } catch (error) {
    console.error('AI绛涢€夌鎶€鎴愭灉澶辫触:', error);
    return achievements;
  }
}

module.exports = {
  filterAchievementsWithAI,
};
