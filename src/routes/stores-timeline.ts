import { Router } from "express";
import { getStoreTimeline, normalize } from "../services/storeTimeline";

const router = Router();

router.get("/", (req, res) => {
  const store = normalize(String(req.query.store || ""));
  const address = normalize(String(req.query.address || ""));

  if (!store || !address) {
    return res.status(400).json({
      message: "store and address are required",
    });
  }

  const timeline = getStoreTimeline(store, address);

  if (timeline.length === 0) {
    console.warn(`[StoreTimeline] not found: ${store} / ${address}`);
  }

  return res.json({
    store,
    address,
    totalWins: timeline.reduce((sum, y) => sum + y.items.length, 0),
    timeline,
  });
});

export default router;
