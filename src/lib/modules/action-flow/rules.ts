import { CocRules } from './rules/coc-rules';
import { CommonRules } from './rules/common-rules';
import { VtmRules } from './rules/vtm-rules';

export { resolveCocSuccessLevel, type CocSuccessLevel } from './rules/coc-rules';
export { cloneData, getNumberFromData } from './rules/common-rules';

export const Rules = {
  ...CommonRules,
  ...CocRules,
  ...VtmRules
};
