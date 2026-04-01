(async () => {
  try {
    await import("./backend/server.js");
  } catch (error) {
    console.error("Failed to start backend from project root.");
    console.error(error?.message || error);
    process.exit(1);
  }
})();
