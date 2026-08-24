import React from "react";

export default function RouteLoadingBar() {
  return <div className="route-loading-indicator" role="status" aria-live="polite"><span /><span className="sr-only">Loading selected workspace</span></div>;
}
