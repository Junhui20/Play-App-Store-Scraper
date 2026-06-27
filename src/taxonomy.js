// Review-mining taxonomy — defined once here so the categories can be read and
// edited in a single place. Previously these tables were inlined in utils.js and
// analyze.js with copies that had quietly drifted apart.
//
// They are deliberately three separate tables, not one, because they serve
// different jobs:
//   THEME_PATTERNS           broad buckets over ANY review (positive or
//                            negative); used by utils.extractThemes for an
//                            overview with sample quotes + percentages.
//   PAIN_POINT_PATTERNS      the negative-review-focused, actionable subset;
//                            used by analyze.extractPainPoints with severity.
//   FEATURE_REQUEST_PATTERNS capture-group regexes that EXTRACT the requested
//                            feature text (match[1]), so they have a different
//                            shape from the boolean classifiers above.

const THEME_PATTERNS = {
  'crash/bug': /crash|bug|freeze|stuck|error|glitch|broke|broken/i,
  'slow/performance': /slow|lag|loading|takes long|battery|drain|heavy/i,
  'ads': /ads?\b|advertis|popup|pop-up|banner/i,
  'price/payment': /pay|price|expensive|subscription|premium|free|cost|money/i,
  'ui/design': /ui|design|interface|layout|ugly|beautiful|clean|look/i,
  'feature request': /wish|hope|please add|would be nice|should have|need|missing|want/i,
  'update issue': /update|version|after update|new update|latest/i,
  'offline/connectivity': /offline|internet|connection|wifi|online|sync/i,
  'login/account': /login|log in|sign|account|password|register/i,
  'notification': /notification|notify|alert|remind/i,
};

const PAIN_POINT_PATTERNS = [
  { label: 'Crashes/Bugs', regex: /crash|bug|freeze|stuck|error|glitch/i },
  { label: 'Performance', regex: /slow|lag|loading|battery|drain/i },
  { label: 'Ads Overload', regex: /too many ads|ads everywhere|full of ads|ad every/i },
  { label: 'Missing Features', regex: /can't|cannot|doesn't|no way to|unable to|missing/i },
  { label: 'Bad UX', regex: /confusing|hard to use|complicated|unintuitive|not intuitive/i },
  { label: 'Privacy Concerns', regex: /privacy|data|permission|track|spy/i },
  { label: 'Paywall', regex: /pay to|paywall|used to be free|subscription|cash grab/i },
];

const FEATURE_REQUEST_PATTERNS = [
  /please add (.{5,80})/i,
  /wish (?:it |there was |they would )(.{5,80})/i,
  /would be (?:great|nice|awesome|cool) (?:if|to) (.{5,80})/i,
  /should (?:have|add|include) (.{5,80})/i,
  /need[s]? (.{5,80})/i,
  /missing (.{5,80})/i,
];

module.exports = {
  THEME_PATTERNS,
  PAIN_POINT_PATTERNS,
  FEATURE_REQUEST_PATTERNS,
};
