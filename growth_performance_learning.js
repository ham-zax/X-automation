// Evidence-bound performance learning for the *owner's published* posts.
// All metrics are actual observed snapshots; no inferred impression counts.

export function classifyContentStyle(text = '') {
  const s = String(text).toLowerCase();
  if (/```|`[^`]{3,}`|\b(?:npm|pip install|git (?:clone|push)|curl |function |const |import |def |python|typescript|javascript|snippet|repo)\b/.test(s)) return 'code_and_builds';
  if (/\b(?:released|launched|shipping|announced|new model|benchmark|breakthrough|just dropped|new release)\b/.test(s)) return 'launch_and_breaking';
  if (/\b(?:tool|library|github|open.source|framework|plugin|extension|workflow)\b/.test(s)) return 'tools_and_discoveries';
  if (/\?$/.test(s.trim()) || /\bwhat do you think\b/.test(s)) return 'conversation_questions';
  return 'builder_notes_and_opinions';
}

const median = (numbers) => {
  const sorted = numbers.filter(Number.isFinite).sort((a,b)=>a-b);
  if (!sorted.length) return null;
  const m=Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[m] : (sorted[m-1]+sorted[m])/2;
};
const round = (n) => Math.round(n*100)/100;

export function analyzeGrowthPerformance({ metrics = [], attempts = [], policy, now = Date.now() } = {}) {
  const cutoff = now - policy.learning.lookbackDays*86_400_000;
  const byTweet = new Map(attempts.filter(a=>a.state==='confirmed_published' && a.outputTweetId)
    .map(a=>[String(a.outputTweetId),a]));
  const current = new Map();
  for (const p of metrics) {
    const tweetId=String(p.tweet_id || p.id || '');
    if (!tweetId || Number(p.captured_at || 0) < cutoff) continue;
    if (!Number.isFinite(Number(p.views)) || !Number.isFinite(Number(p.likes))
      || !Number.isFinite(Number(p.replies))) continue;
    const old=current.get(tweetId);
    if (!old || Number(old.captured_at)<Number(p.captured_at)) current.set(tweetId,p);
  }
  const posts=[...current.entries()].map(([tweetId,p])=>{
    const a=byTweet.get(tweetId);
    const kind=classifyContentStyle(p.text || a?.approvedContent || '');
    const impressions=Number(p.views), likes=Number(p.likes), replies=Number(p.replies), reposts=Number(p.reposts||0);
    const engagement=likes+2*replies+3*reposts;
    return { tweetId, source: p.metric_source || 'observed', capturedAt:Number(p.captured_at),
      publishedAt:Number(p.published_at||a?.createdAt||0), pipeline:a?.pipeline||'unknown', style:kind,
      impressions,likes,replies,reposts,engagement,
      engagementRate:impressions>0 ? round(100*engagement/impressions):null,
      profileVisits:p.profile_visits==null?null:Number(p.profile_visits),
      newFollows:p.new_follows==null?null:Number(p.new_follows),
      outputUrl:a?.outputUrl || null };
  });
  const groups=[];
  for (const dim of ['style','pipeline']) {
    const keys=[...new Set(posts.map(p=>p[dim]))].sort();
    for (const key of keys) {
      const items=posts.filter(p=>p[dim]===key);
      groups.push({dimension:dim,label:key,sample:items.length,
        medianImpressions:median(items.map(p=>p.impressions)),
        medianLikes:median(items.map(p=>p.likes)),
        medianReplies:median(items.map(p=>p.replies)),
        medianEngagementRate:median(items.map(p=>p.engagementRate)),
        verified:items.length>=policy.learning.minimumSample});
    }
  }
  const verified=groups.filter(g=>g.dimension==='style' && g.verified && Number.isFinite(g.medianEngagementRate))
    .sort((a,b)=>b.medianEngagementRate-a.medianEngagementRate);
  const recommendations=[];
  if (verified.length>=2) {
    recommendations.push(`Observed ${verified[0].label} posts have the strongest median engagement rate (${verified[0].medianEngagementRate}%) across ${verified[0].sample} measured posts. Consider more distinct, source-grounded examples in this style; do not copy winning wording.`);
  } else {
    recommendations.push('Insufficient comparable measured posts to recommend a stronger content style. Collect fresh Account Analytics instead of inferring virality from a single example.');
  }
  if (posts.some(p=>p.newFollows!=null)) recommendations.push('Follower-conversion fields are available; prioritize qualifying follows and meaningful conversations over impressions alone.');
  else recommendations.push('Post-level new-follower attribution is not available in the current snapshots. Do not claim that impressions or likes translated into follower growth.');
  const best=posts.filter(p=>p.impressions>0).sort((a,b)=>b.engagement-a.engagement).slice(0,12);
  return {generatedAt:now,lookbackDays:policy.learning.lookbackDays,minimumSample:policy.learning.minimumSample,
    measuredPosts:posts.length,verifiedStyleGroups:verified.length,groups,topPosts:best,
    recommendations,analyticsFreshness:posts.length?Math.max(...posts.map(p=>p.capturedAt)):null,
    provenance:'stored_post_metrics_only',
    caution:'Style classification is heuristic; small samples and unknown follower attribution do not justify automatic volume increases.'};
}
