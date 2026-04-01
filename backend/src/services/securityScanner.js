import { scanCode } from "./codeScanner.js";
import { scanConfig } from "./configScanner.js";
import { scanIAM } from "./iamScanner.js";
import { scanSecurityMisconfig } from "./securityMisconfigScanner.js";
import { scanVulnerabilityCatalog } from "./vulnerabilityCatalogScanner.js";

// Backward-compatible service retained from older folder layout.
export const runSecurityScan = (text) => {
  return [
    ...scanCode(text),
    ...scanConfig(text),
    ...scanIAM(text),
    ...scanSecurityMisconfig(text),
    ...scanVulnerabilityCatalog(text),
  ];
};
