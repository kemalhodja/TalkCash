#!/usr/bin/env bash
# Phase 4 — polish: haptics, paywall, a11y, feedback, onboarding.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0
fail() { echo "FAIL  $1"; FAIL=1; }
ok() { echo "OK    $1"; }

echo "==> TalkCash Phase 4 validation"

for f in \
  mobile/utils/haptics.ts \
  mobile/utils/onboardingFlow.ts \
  mobile/app/feedback.tsx \
  mobile/__tests__/onboardingFlow.test.ts; do
  if [ -f "$ROOT/$f" ]; then ok "$f"; else fail "missing $f"; fi
done

grep -q 'hapticImpact' "$ROOT/mobile/components/ui/PrimaryButton.tsx" \
  && ok "PrimaryButton haptics" \
  || fail "PrimaryButton haptics missing"

grep -q 'accessibilityRole="radio"' "$ROOT/mobile/components/ui/ChipPicker.tsx" \
  && ok "ChipPicker a11y" \
  || fail "ChipPicker a11y missing"

grep -q 'accessibilityRole="tab"' "$ROOT/mobile/components/ui/SegmentedControl.tsx" \
  && ok "SegmentedControl a11y" \
  || fail "SegmentedControl a11y missing"

grep -q 'restoreSubscriptions' "$ROOT/mobile/components/PaywallCard.tsx" \
  && ok "Paywall restore purchases" \
  || fail "Paywall restore missing"

grep -q 'choosePlan' "$ROOT/mobile/components/PaywallCard.tsx" \
  && ok "Paywall plan picker" \
  || fail "Paywall plan picker missing"

grep -q 'stepProgress' "$ROOT/mobile/app/onboarding.tsx" \
  && ok "onboarding step progress" \
  || fail "onboarding step progress missing"

grep -q 'getOnboardingLastStep' "$ROOT/mobile/app/onboarding.tsx" \
  && ok "onboarding lastStep helper" \
  || fail "onboarding lastStep helper missing"

grep -q 'accessibilityLabel' "$ROOT/mobile/components/VoiceInput.tsx" \
  && ok "VoiceInput a11y" \
  || fail "VoiceInput a11y missing"

grep -q 'feedback' "$ROOT/mobile/app/_layout.tsx" \
  && ok "feedback route" \
  || fail "feedback route missing"

grep -q 'trustSecure' "$ROOT/mobile/i18n/en.ts" \
  && grep -q 'trustSecure' "$ROOT/mobile/i18n/tr.ts" \
  && ok "premium trust i18n" \
  || fail "premium trust i18n missing"

echo ""
if [ "$FAIL" -ne 0 ]; then
  echo "Phase 4 validation FAILED"
  exit 1
fi
echo "Phase 4 validation PASSED"
exit 0
