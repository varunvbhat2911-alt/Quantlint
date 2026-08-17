import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createStrategyStorageClient,
  deleteUserStorage,
} from "@/lib/audit-ingestion";
import { log } from "@/lib/server/logger";
import { requestIdFrom, withRequestId } from "@/lib/server/request";

/* DELETE /api/auth/account — permanently delete the AUTHENTICATED user's
 * account, their audits + child rows (DB CASCADE from auth.users), and sweep
 * their strategy-files storage prefix (no FK can cascade storage).
 *
 * Order:
 *   1. Require an authenticated session (identity from the server JWT only).
 *   2. Best-effort storage sweep of strategy-files/<userId>/** (idempotent).
 *      Done BEFORE the user is deleted so the service-role storage client can
 *      still see the objects (storage RLS is user-prefix scoped; after delete
 *      the user is gone). The service-role client bypasses storage RLS anyway,
 *      but doing it first is clearer and safer.
 *   3. Delete the auth user via the service-role admin client
 *      (auth.admin.deleteUser). This cascades audits + children.
 *   4. Clear the session cookies by returning a 200; the client then redirects
 *      to /auth/login.
 *
 * Never deletes another user's files: paths derive from the trusted session
 * user id only. Storage sweep failures are logged but do not block the DB
 * delete (orphaned objects are inert and re-sweepable). DB delete failure
 * returns 500 and leaves the account intact.
 *
 * This route uses the service-role admin client for the user deletion and
 * storage sweep — both are internal operations performed AFTER
 * authentication. No service-role credentials reach the browser. */
export async function DELETE(request: NextRequest) {
  const { user, response: unauthorized } = await requireUser();
  if (!user) return unauthorized;
  const requestId = requestIdFrom(request);

  // 1. Best-effort storage sweep (idempotent; observable).
  try {
    const sweep = await deleteUserStorage(createStrategyStorageClient(), user.id);
    log.info("auth.account.storage_sweep", {
      requestId,
      userId: user.id,
      removed: sweep.removed,
      failed: sweep.failed,
    });
    if (sweep.failed > 0) {
      log.warn("auth.account.storage_sweep_partial", {
        requestId,
        userId: user.id,
        errors: sweep.errors.join("; "),
      });
    }
  } catch (err) {
    // Log and continue — the DB delete is authoritative for the account.
    log.warn("auth.account.storage_sweep_error", {
      requestId,
      userId: user.id,
      errorCode: "STORAGE_SWEEP_ERROR",
      ...errField(err),
    });
  }

  // 2. Delete the auth user (cascades audits + children).
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      log.error("auth.account.delete_failed", {
        requestId,
        userId: user.id,
        errorCode: "AUTH_DELETE_ERROR",
        error: error.message,
      });
      return withRequestId(
        Response.json(
          { success: false, error: "Failed to delete the account." },
          { status: 500 },
        ),
        requestId,
      );
    }
  } catch (err) {
    log.error("auth.account.delete_exception", {
      requestId,
      userId: user.id,
      errorCode: "AUTH_DELETE_ERROR",
      ...errField(err),
    });
    return withRequestId(
      Response.json(
        { success: false, error: "Failed to delete the account." },
        { status: 500 },
      ),
      requestId,
    );
  }

  log.info("auth.account.deleted", { requestId, userId: user.id });
  return withRequestId(Response.json({ success: true }), requestId);
}

function errField(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : "unknown error" };
}
