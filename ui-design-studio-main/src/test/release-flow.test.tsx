import { act, render, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { canSeeInstitution, isReadOnly } from "@/lib/selectors";
import { SessionProvider, useSession } from "@/lib/session";
import { PortalProvider, usePortal } from "@/lib/store";

type SessionApi = ReturnType<typeof useSession>;
type PortalApi = ReturnType<typeof usePortal>;

interface Api {
  session: SessionApi;
  portal: PortalApi;
}

function Harness({ apiRef }: { apiRef: { current: Api | null } }) {
  const session = useSession();
  const portal = usePortal();
  apiRef.current = { session, portal };
  return null;
}

const renderPortal = () => {
  const apiRef: { current: Api | null } = { current: null };
  render(
    <SessionProvider>
      <PortalProvider>
        <Harness apiRef={apiRef} />
      </PortalProvider>
    </SessionProvider>,
  );
  return apiRef as { current: Api };
};

const signIn = async (api: { current: Api }, userId: string) => {
  await act(async () => {
    api.current.session.signIn(userId);
  });
  await waitFor(() => expect(api.current.session.user?.id).toBe(userId));
};

describe("release lifecycle and guardrails", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("walks the release gate across roles and locks the decision", async () => {
    const api = renderPortal();
    await waitFor(() => expect(api.current).not.toBeNull());

    const releaseId = "REL-2026-0042";
    const release = () => api.current.portal.state.releases.find((item) => item.id === releaseId)!;
    const instrument = () =>
      api.current.portal.state.instruments.find((item) => item.id === release().instrumentId)!;

    expect(release().status).toBe("CLEARANCES_PENDING");
    expect(release().checklist.find((item) => item.id === "chk-5")?.done).toBe(false);

    // Institution administrator confirms the regulatory hold term.
    await signIn(api, "u-inst-c");
    const holdItem = release().checklist.find((item) => item.id === "chk-5")!;
    let result = api.current.portal.toggleChecklistItem(releaseId, holdItem.id);
    expect(result.ok).toBe(true);
    await waitFor(() =>
      expect(release().checklist.find((item) => item.id === "chk-5")?.done).toBe(true),
    );
    expect(release().status).toBe("CLEARANCES_PENDING");

    // Case officer resolves the high finding; clearance is still missing.
    await signIn(api, "u-officer");
    result = api.current.portal.resolveFinding(
      "find-1004",
      "Applicable holding term confirmed against the pinned policy; release still requires clearances.",
    );
    expect(result.ok).toBe(true);
    await waitFor(() =>
      expect(
        api.current.portal.state.findings.find((item) => item.id === "find-1004")?.status,
      ).toBe("RESOLVED"),
    );
    expect(release().status).toBe("CLEARANCES_PENDING");

    // Clearance reviewer clears the final required bureau row.
    await signIn(api, "u-clearance");
    result = api.current.portal.recordClearance(
      releaseId,
      "clr-2",
      "CLEARED",
      "No pending grievance recorded. Demo note.",
    );
    expect(result.ok).toBe(true);
    await waitFor(() => expect(release().status).toBe("DECISION_PENDING"));
    expect(
      api.current.portal.state.workItems.some(
        (item) =>
          item.entityId === releaseId &&
          item.ownerRole === "DECISION_AUTHORITY" &&
          item.status !== "DONE",
      ),
    ).toBe(true);

    // Only the delegated authority can record the outcome.
    await signIn(api, "u-auditor");
    expect(isReadOnly(api.current.session.user)).toBe(true);
    const auditorAttempt = api.current.portal.decideRelease(
      releaseId,
      "APPROVED",
      "Auditor must not be able to decide.",
      "",
    );
    expect(auditorAttempt.ok).toBe(false);

    await signIn(api, "u-authority");
    const auditBefore = api.current.portal.state.audit.length;
    result = api.current.portal.decideRelease(
      releaseId,
      "APPROVED",
      "All mandatory clearances and the holding term are verified. FDR route proposes a NOC record only.",
      "Subject to original instrument verification at discharge.",
    );
    expect(result.ok).toBe(true);
    await waitFor(() => expect(release().status).toBe("APPROVED"));
    expect(release().decision?.outcome).toBe("APPROVED");
    expect(release().decision?.instrumentRoute).toBe("NOC_RECORD");
    expect(instrument().instrumentStatus).toBe("RELEASED");
    expect(
      api.current.portal.state.obligations.find((item) => item.id === release().obligationId)
        ?.status,
    ).toBe("CLOSED");
    expect(api.current.portal.state.audit.length).toBeGreaterThan(auditBefore);

    // Decisions are immutable.
    const secondAttempt = api.current.portal.decideRelease(
      releaseId,
      "REJECTED",
      "Attempt to overwrite a recorded decision.",
      "",
    );
    expect(secondAttempt.ok).toBe(false);
    expect(release().decision?.outcome).toBe("APPROVED");

    // Tenant scope remains enforced for institution accounts.
    await signIn(api, "u-inst-a");
    expect(canSeeInstitution(api.current.session.user, "inst-c")).toBe(false);
    expect(canSeeInstitution(api.current.session.user, "inst-a")).toBe(true);
  });

  it("deduplicates date-monitor alerts on repeated runs", async () => {
    const api = renderPortal();
    await waitFor(() => expect(api.current).not.toBeNull());
    await signIn(api, "u-officer");

    api.current.portal.resetDemo();
    await waitFor(() => expect(api.current.portal.state.alerts.length).toBeGreaterThan(0));

    const first = api.current.portal.runDateMonitor();
    await waitFor(() => expect(api.current.portal.state.alerts.length).toBeGreaterThan(0));
    const countAfterFirst = api.current.portal.state.alerts.length;

    const second = api.current.portal.runDateMonitor();
    expect(second.created).toBe(0);
    expect(api.current.portal.state.alerts.length).toBe(countAfterFirst);
    expect(first.created).toBeGreaterThanOrEqual(0);
  });
});
