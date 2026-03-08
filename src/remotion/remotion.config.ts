/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Docker/headless Chrome settings (v4.x API — setChromiumArgs was removed)
// No-sandbox and GPU flags are passed via --chrome-flag in the CLI call
Config.setChromiumDisableWebSecurity(false);
Config.setChromiumMultiProcessOnLinux(false); // keep single-process for Docker

// Per-frame timeout (was setTimeoutInMilliseconds in v3, renamed in v4)
Config.setDelayRenderTimeoutInMilliseconds(30000); // 30s per frame

