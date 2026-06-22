import { FeedFMApp } from "@/components/feedfm/FeedFMApp";
import { getAppStatus } from "@/lib/config/app-status";

export const dynamic = "force-dynamic";

export default async function Home() {
  const appStatus = await getAppStatus();

  return <FeedFMApp initialAppStatus={appStatus} />;
}
