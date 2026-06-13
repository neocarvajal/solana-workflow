self.__BUILD_MANIFEST = {
  "/": [
    "static/chunks/pages/index.js"
  ],
  "/dashboard": [
    "static/chunks/pages/dashboard.js"
  ],
  "/dashboard/workflows": [
    "static/chunks/pages/dashboard/workflows.js"
  ],
  "__rewrites": {
    "afterFiles": [],
    "beforeFiles": [],
    "fallback": []
  },
  "sortedPages": [
    "/",
    "/NotFound",
    "/_app",
    "/_error",
    "/api/webhook",
    "/api/workflow/handlers/swapHandler",
    "/api/workflow/handlers/transferHandler",
    "/api/workflow/simulate-tx",
    "/dashboard",
    "/dashboard/workflows",
    "/documentation"
  ]
};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()