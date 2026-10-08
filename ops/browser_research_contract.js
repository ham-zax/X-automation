// Secondary browser for source research only. Never owns X authentication or sends.
// A browser switch changes this contract, not Growth OS action authority.
export const RESEARCH_BROWSERS = Object.freeze(['none', 'lightpanda-mcp']);

export function researchBrowserContract({ researchBrowser = 'none', browserInterface = 'lightpanda-mcp', lightpandaMcpServer = 'xgrowth_lightpanda' } = {}) {
  if (researchBrowser === 'none') return '';
  if (browserInterface === 'lightpanda-mcp') return '\nFor source research use the SAME native Lightpanda MCP browser already selected for primary X observation. Never create a second research browser or change the authenticated account identity. Publishing remains bridge-only via act.\n';
  if (researchBrowser !== 'lightpanda-mcp') throw new Error(`Unsupported research browser: ${researchBrowser}`);
  return `\nIndependent public-web research browser: Lightpanda MCP (enabled), exposed as Codex tools \`mcp__${lightpandaMcpServer}__goto\`, \`mcp__${lightpandaMcpServer}__tree\`, \`mcp__${lightpandaMcpServer}__markdown\`, \`mcp__${lightpandaMcpServer}__extract\`, \`mcp__${lightpandaMcpServer}__waitForState\`, and \`mcp__${lightpandaMcpServer}__getUrl\`.
- Use this **only** to read publicly accessible GitHub/Hacker News/technical documentation/source URLs that substantiate an eligible Original or technical assertion. For a T2 Original with a concrete external public source, make one bounded Lightpanda read before drafting, when the tool is available. Do not browse merely to manufacture a post or bypass the Growth Run's source budgets.
- Native Lightpanda's contract is NOT WebHarness Fast's observe/execute schema. Navigate with \`goto({"url":"https://..."})\` or use \`tree({"url":"https://..."})\` to read; wait for post-load readiness with \`waitForState({"state":"networkidle"})\` when needed, then re-read. Use \`extract({"schema":"{\\"title\\":\\"h1\\"}"})\` only with selectors observed on that page. Check HTTP failures and content readiness. Keep exact source URLs; don't invent text or metrics.
- Lightpanda is an **independent unauthenticated session**. Do NOT use its cookies, attach credentials, rely on it for X authentication, home/mentions/For You, X account metrics, or any public mutation. Use the PRIMARY browser selected above for all X account verification, live X selection/observation and all bridge-backed publishing.
- No Lightpanda clicks, fills, keyboard sends, JS evaluation, uploads, follows, likes, replies, or posts. If Lightpanda cannot render an external source or its MCP tools are absent, do not claim it was checked; skip that research source and continue the primary browser workflow. Do not silently substitute Lightpanda evidence for live authenticated X evidence.\n`;
}
