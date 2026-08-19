import {
  listEngagementItems,
  listQueueItems,
  getNewFollowerQuality,
  getAccountHealthSummary,
  getCandidate,
  getDraftByCandidate,
  getRelationshipProfile,
  listApprovedMainFeedItems,
  listRecentMainFeedPublications,
  listAcceptedLearnedRules
} from './store.js';
import { rankMainFeedItems } from './scheduler.js';

const AUTO_POST = String(process.env.AUTO_POST || 'false').toLowerCase() === 'true';

function schedulerContext(now = Date.now()) {
  const recentPosts = listRecentMainFeedPublications({ limit: 20 });
  return {
    now,
    recentPosts,
    lastMainFeedPostAt: recentPosts[0]?.publishedAt ?? null,
    learnedRules: listAcceptedLearnedRules({ limit: 500 }),
  };
}

export async function handleApi(req, res, requestUrl) {
  const sendJson = (status, payload) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
  };

  try {
    const path = requestUrl.pathname.replace(/^\/api/, '');
    
    if (req.method === 'GET' && path === '/today') {
      const now = Date.now();
      const engagementItems = listEngagementItems({ limit: 100 });
      const activeConversations = engagementItems.filter((item) => item.engagementKind !== 'initial_reply');
      const newOpportunities = engagementItems.filter((item) => item.engagementKind === 'initial_reply');
      const reviewItems = listQueueItems({ lane: 'main', status: 'needs_review', limit: 20 });
      const followerQuality = getNewFollowerQuality({ since: Number(now) - 24 * 3_600_000 });
      const accountHealth = getAccountHealthSummary();
      const scheduleDecisions = rankMainFeedItems(listApprovedMainFeedItems({ automatedOnly: true, limit: 100 }), schedulerContext(now));
      const nextScheduled = scheduleDecisions.find((item) => item.eligible) || null;
      
      const actions = [];
      
      if (accountHealth?.health?.state === 'constrained') {
        actions.push({
          eyebrow: 'Needs attention',
          title: 'Some actions are temporarily limited',
          body: accountHealth.health.explanation || 'Observed account evidence is limiting some actions until it is resolved.',
          href: '/?source=health',
          action: 'Review account status',
          tone: 'danger',
        });
      }
      
      const conversation = activeConversations[0];
      if (conversation) {
        const candidate = getCandidate(conversation.candidateKey);
        const profile = conversation.targetUsername ? getRelationshipProfile(conversation.targetUsername) : null;
        const contribution = conversation.contributionSummary || conversation.engagement?.contribution?.summary || 'Review the conversation and decide whether you have something useful to add.';
        actions.push({
          eyebrow: 'Continue a conversation',
          title: `@${conversation.targetUsername || profile?.username || 'conversation'} has new activity`,
          body: contribution,
          note: candidate?.text ? `Source: ${candidate.text.slice(0, 140)}${candidate.text.length > 140 ? '…' : ''}` : '',
          href: '/?source=engage',
          action: 'Review reply',
          tone: 'primary',
        });
      }
      
      const reviewItem = reviewItems[0];
      if (reviewItem) {
        const draft = getDraftByCandidate(reviewItem.candidateKey);
        const candidate = getCandidate(reviewItem.candidateKey);
        const ready = Boolean(draft && draft.qualityScore >= 40 && draft.gates?.passed === true);
        actions.push({
          eyebrow: 'Review a post',
          title: candidate?.title || 'A draft needs your decision',
          body: ready ? 'The draft passed its checks and is ready for your approval.' : 'The draft still needs a fix or confirmation before it can be approved.',
          note: draft ? `Quality ${draft.qualityScore}/50 · ${reviewItem.pipeline}` : reviewItem.pipeline,
          href: draft ? `/?source=drafts&draft=${draft.id}` : '/?source=queue',
          action: 'Review draft',
          tone: ready ? 'success' : 'warning',
        });
      }
      
      if (nextScheduled?.item) {
        const candidate = nextScheduled.item.candidate || getCandidate(nextScheduled.item.candidateKey);
        const dueNow = Number(nextScheduled.recommendedAt) <= Number(now);
        actions.push({
          eyebrow: 'Next post',
          title: candidate?.title || 'An approved post is ready',
          body: dueNow ? 'Approved and ready to publish when your publishing mode allows it.' : `Approved and recommended for around ${new Date(nextScheduled.recommendedAt).toLocaleString()}.`,
          note: AUTO_POST ? 'Main-feed automation is enabled.' : 'Main-feed automation is off. Nothing is auto-published from this recommendation.',
          href: '/?source=queue',
          action: 'View publishing plan',
          tone: 'primary',
        });
      }
      
      if (!activeConversations.length && newOpportunities[0]) {
        const item = newOpportunities[0];
        actions.push({
          eyebrow: 'New opportunity',
          title: 'Something new is worth answering',
          body: item.contributionSummary || 'A relevant post from your audience is worth a thoughtful first reply.',
          note: item.candidateKey ? `From @${item.targetUsername || 'someone you follow'}` : '',
          href: '/?source=engage',
          action: 'Review opportunity',
          tone: 'primary',
        });
      }
      
      return sendJson(200, {
        state: 'success',
        data: {
          taskCount: actions.length,
          actions,
          accountHealth,
          followerQuality,
          nextScheduled: nextScheduled ? {
            recommendedAt: nextScheduled.recommendedAt,
            item: nextScheduled.item,
          } : null,
          automation: AUTO_POST,
        }
      });
    }


    if (req.method === 'GET' && path === '/conversations') {
      const engagementItems = listEngagementItems({ limit: 200 });
      const activeConversations = engagementItems.filter((item) => item.engagementKind !== 'initial_reply');
      const newOpportunities = engagementItems.filter((item) => item.engagementKind === 'initial_reply');
      
      const conversations = activeConversations.map((item) => {
        const candidate = getCandidate(item.candidateKey);
        const profile = item.targetUsername ? getRelationshipProfile(item.targetUsername) : null;
        return {
          id: item.candidateKey,
          targetUsername: item.targetUsername,
          targetTweetId: item.targetTweetId,
          contribution: item.contributionSummary || item.engagement?.contribution?.summary || 'Review the conversation',
          sourceText: candidate?.text?.slice(0, 200) || '',
          relationshipStage: profile?.stage || 'unknown',
          lastActivity: item.occurredAt || item.sourceTimestamp || null,
          href: `/?source=engage&draft=${item.candidateKey}`,
        };
      });
      
      const opportunities = newOpportunities.slice(0, 10).map((item) => {
        const candidate = getCandidate(item.candidateKey);
        return {
          id: item.candidateKey,
          targetUsername: item.targetUsername,
          contribution: item.contributionSummary || 'New opportunity worth answering',
          sourceText: candidate?.text?.slice(0, 200) || '',
          href: `/?source=engage&draft=${item.candidateKey}`,
        };
      });
      
      return sendJson(200, {
        state: 'success',
        data: {
          activeConversations: conversations,
          newOpportunities: opportunities,
        }
      });
    }


    if (req.method === 'GET' && path === '/create') {
      const drafts = listQueueItems({ limit: 100 });
      
      // Group by lifecycle stage
      const ideas = drafts.filter((d) => d.status === 'draft' && !d.approved);
      const drafting = drafts.filter((d) => d.status === 'draft' && d.approved);
      const needsReview = drafts.filter((d) => d.status === 'needs_review');
      const approved = drafts.filter((d) => d.status === 'approved');
      const publishing = drafts.filter((d) => d.status === 'publishing');
      const published = drafts.filter((d) => d.status === 'published');
      
      const formatDraft = (item) => {
        const draft = item.draft || {};
        const candidate = item.candidateKey ? getCandidate(item.candidateKey) : null;
        return {
          id: item.id,
          candidateKey: item.candidateKey,
          title: candidate?.title || draft.title || 'Untitled draft',
          body: draft.body || draft.editor?.finalText || '',
          hook: draft.hook || '',
          insight: draft.insight || '',
          evidence: draft.evidence || '',
          action: draft.action || '',
          qualityScore: draft.qualityScore || 0,
          pipeline: item.pipeline || 'original',
          status: item.status,
          scheduledAt: item.scheduledAt,
          publishedTweetId: item.publishedTweetId,
          publishedAt: item.publishedAt,
          gates: draft.gates || {},
          href: `/?source=drafts&draft=${item.id}`,
        };
      };
      
      return sendJson(200, {
        state: 'success',
        data: {
          ideas: ideas.map(formatDraft),
          drafting: drafting.map(formatDraft),
          needsReview: needsReview.map(formatDraft),
          approved: approved.map(formatDraft),
          publishing: publishing.map(formatDraft),
          published: published.map(formatDraft),
          total: drafts.length,
        }
      });
    }

    // Fallback
    return sendJson(404, {
      state: 'error',
      code: 'NOT_FOUND',
      message: 'API route not found',
    });

  } catch (err) {
    return sendJson(500, {
      state: 'error',
      code: 'INTERNAL_ERROR',
      message: err.message || 'Unknown error',
      details: err.stack,
    });
  }
}

