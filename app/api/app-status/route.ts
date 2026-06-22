import { apiSuccessResponse } from "@/lib/security/http";
import { getAppStatus } from "@/lib/config/app-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getAppStatus();

  return apiSuccessResponse({
    maintenanceEnabled: status.maintenanceEnabled,
    disableGeneration: status.disableGeneration,
    disableReddit: status.disableReddit,
    disableX: status.disableX,
    disableSharing: status.disableSharing,
    showBanner: status.showBanner,
    messageTitle: status.messageTitle,
    messageBody: status.messageBody,
    severity: status.severity,
  });
}
