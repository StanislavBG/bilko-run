import type { FastifyInstance } from 'fastify';
import { registerHeadlineGraderRoutes } from './headline-grader.js';
import { registerAdScorerRoutes } from './ad-scorer.js';
import { registerThreadGraderRoutes } from './thread-grader.js';
import { registerEmailForgeRoutes } from './email-forge.js';
import { registerEmailCaptureRoutes } from './email-capture.js';
import { registerAudienceDecoderRoutes } from './audience-decoder.js';
import { registerStackAuditRoutes } from './stack-audit.js';
import { registerLaunchGraderRoutes } from './launch-grader.js';
import { registerPageRoastRoutes } from './page-roast.js';
import { registerTokensRoutes } from './tokens.js';

export function registerToolRoutes(app: FastifyInstance): void {
  registerHeadlineGraderRoutes(app);
  registerAdScorerRoutes(app);
  registerThreadGraderRoutes(app);
  registerEmailForgeRoutes(app);
  registerEmailCaptureRoutes(app);
  registerAudienceDecoderRoutes(app);
  registerStackAuditRoutes(app);
  registerLaunchGraderRoutes(app);
  registerPageRoastRoutes(app);
  registerTokensRoutes(app);
}
