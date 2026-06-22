"use client";

import { AlertTriangle, Info, OctagonAlert, RadioTower } from "lucide-react";
import { useEffect } from "react";

import { trackClientEvent } from "@/lib/analytics/client-events";
import type { AppStatus } from "@/lib/config/app-status-types";

type AppStatusBannerProps = {
  status: AppStatus;
};

const severityStyles = {
  info: {
    icon: Info,
    eyebrow: "Signal notice",
    box: "border-signal-green bg-[#11130e] text-signal-green",
  },
  warning: {
    icon: AlertTriangle,
    eyebrow: "Signal warning",
    box: "border-amber bg-[#211d14] text-amber",
  },
  error: {
    icon: OctagonAlert,
    eyebrow: "Signal outage",
    box: "border-coral bg-[#211412] text-coral",
  },
};

export function AppStatusBanner({ status }: AppStatusBannerProps) {
  const shouldShowBanner = status.showBanner && (status.messageTitle || status.messageBody);
  const showMaintenancePanel = status.maintenanceEnabled;
  const style = severityStyles[status.severity];
  const Icon = style.icon;

  useEffect(() => {
    if (!shouldShowBanner) {
      return;
    }

    const key = "feedfm:maintenance-banner-seen";

    if (sessionStorage.getItem(key) === "1") {
      return;
    }

    sessionStorage.setItem(key, "1");
    trackClientEvent({
      eventName: "maintenance_banner_seen",
      metadata: {
        severity: status.severity,
        maintenanceEnabled: status.maintenanceEnabled,
      },
    });
  }, [shouldShowBanner, status.maintenanceEnabled, status.severity]);

  if (!shouldShowBanner && !showMaintenancePanel) {
    return null;
  }

  return (
    <section className="mx-auto w-[min(100%,80rem)] max-w-[100vw] px-5 pb-6 sm:px-8">
      {shouldShowBanner ? (
        <div className={`pixel-border-sm flex flex-col gap-3 border-2 p-4 sm:flex-row sm:items-start ${style.box}`}>
          <Icon className="shrink-0" aria-hidden="true" />
          <div>
            <p className="font-pixel text-xs uppercase">{style.eyebrow}</p>
            {status.messageTitle ? (
              <h2 className="mt-1 text-lg font-bold leading-tight text-pixel-cream">
                {status.messageTitle}
              </h2>
            ) : null}
            {status.messageBody ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {status.messageBody}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {showMaintenancePanel ? (
        <div className="mt-4 pixel-border bg-[#211412] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <RadioTower className="shrink-0 text-coral" aria-hidden="true" />
            <div>
              <p className="font-pixel text-xs uppercase text-coral">Maintenance mode</p>
              <h2 className="mt-1 text-xl font-bold text-pixel-cream">
                FeedFM is temporarily offline. Please check back later.
              </h2>
              {status.messageBody ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {status.messageBody}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
